import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { deleteTokenCache } from "@/lib/msal";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (session.cachePartition) await deleteTokenCache(session.cachePartition);
  session.destroy();

  // Also end the Microsoft session, then come back to the home page.
  const back = encodeURIComponent(env().APP_URL);
  return NextResponse.redirect(
    `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${back}`,
  );
}
