import type { PoolClient } from "pg";
import { pool, withTransaction } from "./db";
import { lineTotalCents } from "./money";

export type LineItemInput = { description: string; quantity: number; unitPriceCents: number };

export type CreateInvoiceInput = {
  businessId: string;
  clientId: string;
  dueDate: string; // YYYY-MM-DD
  notes?: string;
  createdBy?: string;
  lineItems: LineItemInput[];
};

export function formatInvoiceNumber(year: number, seq: number) {
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

// The heart of the "no duplicate invoice numbers" guarantee.
//
// One statement both creates the year's counter (first invoice of the year) and bumps it. Postgres
// takes a row lock on that counter until the surrounding transaction ends, so a second request for
// the same business waits its turn instead of reading the same number. Because the bump lives in
// the same transaction as the invoice insert, a failed insert rolls the counter back too: no gaps.
//
// Why not a Postgres SEQUENCE? Sequences are never rolled back, so failed inserts leave gaps,
// and one sequence can't restart per business per year.
async function nextInvoiceSeq(tx: PoolClient, businessId: string, year: number): Promise<number> {
  const { rows } = await tx.query<{ seq: number }>(
    `insert into invoice_counters (business_id, year, next_number)
     values ($1, $2, 2)
     on conflict (business_id, year)
       do update set next_number = invoice_counters.next_number + 1
     returning next_number - 1 as seq`,
    [businessId, year],
  );
  return rows[0].seq;
}

export async function createInvoice(input: CreateInvoiceInput) {
  if (input.lineItems.length === 0) throw new Error("An invoice needs at least one line item");

  const items = input.lineItems.map((li, i) => ({
    ...li,
    position: i + 1,
    lineTotalCents: lineTotalCents(li.quantity, li.unitPriceCents),
  }));
  const subtotal = items.reduce((sum, li) => sum + li.lineTotalCents, 0);

  return withTransaction(async (tx) => {
    // The client must belong to this business. Never trust an id that came from a form.
    const owns = await tx.query("select 1 from clients where id = $1 and business_id = $2", [
      input.clientId,
      input.businessId,
    ]);
    if (owns.rowCount === 0) throw new Error("Client not found");

    const year = new Date().getUTCFullYear();
    const seq = await nextInvoiceSeq(tx, input.businessId, year);
    const number = formatInvoiceNumber(year, seq);

    const { rows } = await tx.query<{ id: string }>(
      `insert into invoices
         (business_id, client_id, year, seq, number, subtotal_cents, total_cents, due_date, notes, created_by)
       values ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9)
       returning id`,
      [input.businessId, input.clientId, year, seq, number, subtotal, input.dueDate, input.notes ?? null, input.createdBy ?? null],
    );
    const invoiceId = rows[0].id;

    for (const li of items) {
      await tx.query(
        `insert into invoice_line_items
           (invoice_id, position, description, quantity, unit_price_cents, line_total_cents)
         values ($1, $2, $3, $4, $5, $6)`,
        [invoiceId, li.position, li.description, li.quantity, li.unitPriceCents, li.lineTotalCents],
      );
    }
    return { id: invoiceId, number };
  });
}

export type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  total_cents: number;
  currency: string;
  issue_date: string;
  due_date: string;
  client_name: string;
};

export async function listInvoices(businessId: string): Promise<InvoiceRow[]> {
  const { rows } = await pool.query<InvoiceRow>(
    `select i.id, i.number, i.status, i.total_cents, i.currency,
            to_char(i.issue_date, 'YYYY-MM-DD') as issue_date,
            to_char(i.due_date, 'YYYY-MM-DD') as due_date,
            c.name as client_name
       from invoices i
       join clients c on c.id = i.client_id
      where i.business_id = $1
      order by i.year desc, i.seq desc
      limit 100`,
    [businessId],
  );
  return rows;
}

export async function getInvoice(businessId: string, invoiceId: string) {
  const inv = await pool.query(
    `select i.*, to_char(i.issue_date, 'YYYY-MM-DD') as issue_date_text,
            to_char(i.due_date, 'YYYY-MM-DD') as due_date_text,
            c.name as client_name, c.email as client_email
       from invoices i join clients c on c.id = i.client_id
      where i.business_id = $1 and i.id = $2`,
    [businessId, invoiceId],
  );
  if (inv.rowCount === 0) return null;
  const items = await pool.query(
    `select description, quantity::float as quantity, unit_price_cents, line_total_cents
       from invoice_line_items where invoice_id = $1 order by position`,
    [invoiceId],
  );
  return { ...inv.rows[0], lineItems: items.rows };
}

export async function listClients(businessId: string) {
  const { rows } = await pool.query<{ id: string; name: string; email: string | null }>(
    "select id, name, email from clients where business_id = $1 order by name",
    [businessId],
  );
  return rows;
}
