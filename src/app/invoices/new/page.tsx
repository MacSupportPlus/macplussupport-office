import Link from "next/link";
import { redirect } from "next/navigation";
import { listClients } from "@/lib/invoices";
import { requireUser } from "@/lib/session";
import { InvoiceForm } from "./invoice-form";

// Signed-in, per-user page: render on each request rather than prerendering a shell.
export const instant = false;

export default async function NewInvoicePage() {
  const user = await requireUser();
  if (!user) redirect("/");
  const clients = await listClients(user.businessId);

  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 14);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <Link href="/dashboard" className="text-sm underline">← Invoices</Link>
      <h1 className="text-2xl font-semibold">New invoice</h1>
      <p className="text-sm text-zinc-500">The invoice number is assigned when you save, so two people saving at once never collide.</p>
      <InvoiceForm clients={clients} defaultDue={due.toISOString().slice(0, 10)} />
    </main>
  );
}
