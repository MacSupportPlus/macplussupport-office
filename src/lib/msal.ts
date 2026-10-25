import {
  ConfidentialClientApplication,
  type ICachePlugin,
  type TokenCacheContext,
  LogLevel,
} from "@azure/msal-node";
import crypto from "node:crypto";
import { pool } from "./db";
import { env } from "./env";

// Scopes requested at sign-in. Weekend 2 adds "Mail.Send" through incremental consent,
// so a visitor is only asked for mail permission when they first click "Send invoice".
export const SIGN_IN_SCOPES = ["User.Read"];

// --- Encrypted token cache in Postgres -----------------------------------------------------------
// The MSAL cache holds refresh tokens, so it is encrypted (AES-256-GCM) before it leaves the server.

function key() {
  return Buffer.from(env().TOKEN_CACHE_KEY, "base64");
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

function decrypt(stored: string): string {
  const [iv, tag, body] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

function postgresCachePlugin(partitionKey: string): ICachePlugin {
  return {
    async beforeCacheAccess(ctx: TokenCacheContext) {
      const { rows } = await pool.query("select data from msal_token_cache where partition_key = $1", [partitionKey]);
      if (rows[0]) ctx.tokenCache.deserialize(decrypt(rows[0].data));
    },
    async afterCacheAccess(ctx: TokenCacheContext) {
      if (!ctx.cacheHasChanged) return;
      await pool.query(
        `insert into msal_token_cache (partition_key, data, updated_at) values ($1, $2, now())
         on conflict (partition_key) do update set data = excluded.data, updated_at = now()`,
        [partitionKey, encrypt(ctx.tokenCache.serialize())],
      );
    },
  };
}

export async function deleteTokenCache(partitionKey: string) {
  await pool.query("delete from msal_token_cache where partition_key = $1", [partitionKey]);
}

// A fresh client per request, bound to that browser's cache partition. This is MSAL's recommended
// pattern for multi-user web apps: no tokens from one user can leak into another user's cache.
export function msalClient(partitionKey: string) {
  const e = env();
  return new ConfidentialClientApplication({
    auth: {
      clientId: e.AZURE_CLIENT_ID,
      clientSecret: e.AZURE_CLIENT_SECRET,
      authority: e.AZURE_AUTHORITY,
    },
    cache: { cachePlugin: postgresCachePlugin(partitionKey) },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
        piiLoggingEnabled: false,
        loggerCallback: (_level, message) => console.warn(`[msal] ${message}`),
      },
    },
  });
}

// Get a Graph access token without a redirect, refreshing it from the cached refresh token if needed.
export async function getGraphToken(partitionKey: string, homeAccountId: string, scopes = SIGN_IN_SCOPES) {
  const client = msalClient(partitionKey);
  const account = await client.getTokenCache().getAccountByHomeId(homeAccountId);
  if (!account) return null;
  try {
    const result = await client.acquireTokenSilent({ account, scopes });
    return result.accessToken;
  } catch {
    // InteractionRequiredAuthError (consent missing, token revoked, password changed) lands here.
    return null;
  }
}
