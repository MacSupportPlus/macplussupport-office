import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/graph";
import { listInvoices } from "@/lib/invoices";
import { formatCents } from "@/lib/money";
import { requireUser } from "@/lib/session";

// Signed-in, per-user page: render on each request rather than prerendering a shell.
export const instant = false;

export default async function Dashboard() {
  const user = await requireUser();
  if (!user) redirect("/");

  const [profile, invoices] = await Promise.all([
    getMyProfile(user.cachePartition!, user.homeAccountId),
    listInvoices(user.businessId),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-zinc-500">
            {profile
              ? `Signed in via Microsoft Graph as ${profile.displayName} (${profile.mail ?? profile.userPrincipalName})`
              : `Signed in as ${user.email}. Graph token unavailable, sign in again to refresh.`}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/invoices/new" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
            New invoice
          </Link>
          <Link href="/api/auth/logout" prefetch={false} className="rounded-lg border px-4 py-2 text-sm">
            Sign out
          </Link>
        </div>
      </header>

      {invoices.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-zinc-500">
          No invoices yet. Create one to see the numbering start at INV-{new Date().getUTCFullYear()}-0001.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t">
                  <td className="px-4 py-3 font-mono">
                    <Link className="underline" href={`/invoices/${inv.id}`}>{inv.number}</Link>
                  </td>
                  <td className="px-4 py-3">{inv.client_name}</td>
                  <td className="px-4 py-3">{inv.issue_date}</td>
                  <td className="px-4 py-3">{inv.due_date}</td>
                  <td className="px-4 py-3 capitalize">{inv.status}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(inv.total_cents, inv.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
