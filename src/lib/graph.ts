import { getGraphToken } from "./msal";

export type GraphProfile = { displayName: string; mail: string | null; userPrincipalName: string };

// Proves the token cache works: this runs on every dashboard load with no redirect to Microsoft.
export async function getMyProfile(partitionKey: string, homeAccountId: string): Promise<GraphProfile | null> {
  const token = await getGraphToken(partitionKey, homeAccountId);
  if (!token) return null;
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}
