import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getInvoice } from "@/lib/invoices";
import { formatCents } from "@/lib/money";
import { requireUser } from "@/lib/session";

// Signed-in, per-user page: render on each request rather than prerendering a shell.
export const instant = false;

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) redirect("/");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const inv = await getInvoice(user.businessId, id);
  if (!inv) notFound(); // also what another business's invoice id returns: no hint that it exists

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <Link href="/dashboard" className="text-sm underline">← Invoices</Link>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-mono text-2xl font-semibold">{inv.number}</h1>
        <span className="rounded-full border px-3 py-1 text-sm capitalize">{inv.status}</span>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div><dt className="text-zinc-500">Bill to</dt><dd>{inv.client_name}<br />{inv.client_email}</dd></div>
        <div><dt className="text-zinc-500">Issued</dt><dd>{inv.issue_date_text}</dd></div>
        <div><dt className="text-zinc-500">Due</dt><dd>{inv.due_date_text}</dd></div>
      </dl>
      <table className="w-full text-sm">
        <thead className="border-b text-left text-zinc-500">
          <tr><th className="py-2">Description</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Unit</th><th className="py-2 text-right">Amount</th></tr>
        </thead>
        <tbody>
          {inv.lineItems.map((li: { description: string; quantity: number; unit_price_cents: number; line_total_cents: number }, i: number) => (
            <tr key={i} className="border-b">
              <td className="py-2">{li.description}</td>
              <td className="py-2 text-right tabular-nums">{li.quantity}</td>
              <td className="py-2 text-right tabular-nums">{formatCents(li.unit_price_cents, inv.currency)}</td>
              <td className="py-2 text-right tabular-nums">{formatCents(li.line_total_cents, inv.currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3} className="py-3 text-right font-medium">Total</td><td className="py-3 text-right font-semibold tabular-nums">{formatCents(inv.total_cents, inv.currency)}</td></tr>
        </tfoot>
      </table>
      {inv.notes && <p className="text-sm text-zinc-600">{inv.notes}</p>}
      <p className="text-sm text-zinc-500">PDF download and “Send via Outlook” arrive in Weekend 2.</p>
    </main>
  );
}
