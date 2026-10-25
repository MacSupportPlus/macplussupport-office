import { CryptoProvider } from "@azure/msal-node";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { redirectUri } from "@/lib/env";
import { msalClient, SIGN_IN_SCOPES } from "@/lib/msal";
import { getSession } from "@/lib/session";

// Step 1 of the authorization code flow with PKCE: send the browser to Microsoft.
export async function GET() {
  const session = await getSession();
  const { verifier, challenge } = await new CryptoProvider().generatePkceCodes();

  session.pkceVerifier = verifier;
  session.authState = crypto.randomUUID(); // CSRF protection: checked again in the callback
  session.cachePartition = session.cachePartition ?? crypto.randomUUID();
  await session.save();

  const url = await msalClient(session.cachePartition).getAuthCodeUrl({
    scopes: SIGN_IN_SCOPES,
    redirectUri: redirectUri(),
    codeChallenge: challenge,
    codeChallengeMethod: "S256",
    state: session.authState,
    prompt: "select_account",
  });
  return NextResponse.redirect(url);
}
