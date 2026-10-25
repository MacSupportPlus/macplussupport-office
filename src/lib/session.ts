import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "./env";

export type SessionData = {
  // Set while the browser is away at Microsoft's sign-in page.
  pkceVerifier?: string;
  authState?: string;
  // Keys this browser's row in msal_token_cache.
  cachePartition?: string;
  // Set after a successful sign-in.
  homeAccountId?: string;
  businessId?: string;
  email?: string;
  name?: string;
};

function options(): SessionOptions {
  return {
    password: env().SESSION_SECRET,
    cookieName: "mps_office_session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // must be lax so the cookie survives the redirect back from Microsoft
      path: "/",
    },
  };
}

export async function getSession() {
  // Session data is per-request (and iron-session checks expiry against the clock), so opt out of prerendering.
  await connection();
  return getIronSession<SessionData>(await cookies(), options());
}

export async function requireUser() {
  const session = await getSession();
  if (!session.homeAccountId || !session.businessId) return null;
  return session as SessionData & { homeAccountId: string; businessId: string };
}
