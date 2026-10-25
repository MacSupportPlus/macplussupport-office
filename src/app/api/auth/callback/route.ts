import { NextResponse, type NextRequest } from "next/server";
import { upsertUserAndBusiness } from "@/lib/accounts";
import { env, redirectUri } from "@/lib/env";
import { msalClient, SIGN_IN_SCOPES } from "@/lib/msal";
import { getSession } from "@/lib/session";

// Step 2: Microsoft sends the browser back here with ?code=... (or ?error=... if the user said no).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const home = (reason: string) => NextResponse.redirect(`${env().APP_URL}/?error=${encodeURIComponent(reason)}`);

  // Declined consent, or the tenant requires an admin to approve the app first (AADSTS65001 / 90094).
  if (params.get("error")) return home(params.get("error_description") ?? params.get("error")!);

  const session = await getSession();
  const code = params.get("code");
  if (!code || !session.pkceVerifier || !session.cachePartition || params.get("state") !== session.authState) {
    return home("Sign-in expired or was tampered with. Please try again.");
  }

  const result = await msalClient(session.cachePartition).acquireTokenByCode({
    code,
    scopes: SIGN_IN_SCOPES,
    redirectUri: redirectUri(),
    codeVerifier: session.pkceVerifier,
  });
  const account = result.account;
  if (!account) return home("Microsoft did not return an account.");

  const email = (account.username || "").toLowerCase();
  const allow = env()
    .ALLOWED_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length > 0 && !allow.includes(email)) return home("This demo is invite-only right now.");

  const businessId = await upsertUserAndBusiness({
    homeAccountId: account.homeAccountId,
    tenantId: account.tenantId,
    email,
    name: account.name,
  });

  session.pkceVerifier = undefined;
  session.authState = undefined;
  session.homeAccountId = account.homeAccountId;
  session.businessId = businessId;
  session.email = email;
  session.name = account.name;
  await session.save();

  return NextResponse.redirect(`${env().APP_URL}/dashboard`);
}
