// Proves invoice numbers can't duplicate: fires N invoice creations at the same instant for one
// business, then checks the numbers are exactly 1..N with no gaps and no repeats.
// Run: npm run test:race            (default 50)   or   npm run test:race -- 200
//      npm run test:race -- 50 --naive   shows what goes wrong with "select max(seq) + 1"
import { pool, withTransaction } from "../src/lib/db";
import { createInvoice, formatInvoiceNumber, type CreateInvoiceInput } from "../src/lib/invoices";

// The common bug, kept here only as a counter-example. Two requests read the same max at the same
// time, both try to insert it, and the unique constraint rejects one of them (or, without that
// constraint, you'd silently get duplicate invoice numbers).
async function createInvoiceNaive(input: CreateInvoiceInput) {
  return withTransaction(async (tx) => {
    const year = new Date().getUTCFullYear();
    const { rows } = await tx.query<{ next: number }>(
      "select coalesce(max(seq), 0) + 1 as next from invoices where business_id = $1 and year = $2",
      [input.businessId, year],
    );
    const seq = rows[0].next;
    const number = formatInvoiceNumber(year, seq);
    await tx.query(
      `insert into invoices (business_id, client_id, year, seq, number, subtotal_cents, total_cents, due_date)
       values ($1, $2, $3, $4, $5, 0, 0, $6)`,
      [input.businessId, input.clientId, year, seq, number, input.dueDate],
    );
    return { id: "", number };
  });
}

async function main() {
  const n = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 50);
  const naive = process.argv.includes("--naive");
  const create = naive ? createInvoiceNaive : createInvoice;

  // A throwaway business so the test never touches demo data.
  const biz = await pool.query<{ id: string }>("insert into businesses (name) values ('Race test') returning id");
  const businessId = biz.rows[0].id;
  const client = await pool.query<{ id: string }>(
    "insert into clients (business_id, name) values ($1, 'Race test client') returning id",
    [businessId],
  );
  const clientId = client.rows[0].id;

  const started = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: n }, (_, i) =>
      create({
        businessId,
        clientId,
        dueDate: "2026-12-31",
        lineItems: [{ description: `Concurrent invoice ${i}`, quantity: 1, unitPriceCents: 10000 }],
      }),
    ),
  );
  const ms = Date.now() - started;

  const failed = results.filter((r) => r.status === "rejected");
  const numbers = results.flatMap((r) => (r.status === "fulfilled" ? [r.value.number] : []));
  const unique = new Set(numbers);
  const year = new Date().getUTCFullYear();
  const expected = Array.from({ length: n }, (_, i) => formatInvoiceNumber(year, i + 1));
  const missing = expected.filter((num) => !unique.has(num));

  console.log(`${n} concurrent creates (${naive ? "NAIVE max+1" : "locked counter"}) in ${ms} ms (pool size ${pool.options.max})`);
  console.log(`  succeeded:  ${numbers.length}`);
  console.log(`  failed:     ${failed.length}`);
  console.log(`  unique:     ${unique.size}`);
  console.log(`  duplicates: ${numbers.length - unique.size}`);
  console.log(`  gaps:       ${missing.length}`);
  console.log(`  range:      ${expected[0]} … ${expected.at(-1)}`);

  await pool.query("delete from businesses where id = $1", [businessId]); // cascades
  await pool.end();

  const ok = failed.length === 0 && unique.size === n && missing.length === 0;
  console.log(ok ? "PASS: every number used exactly once" : "FAIL");
  if (failed.length) console.error(failed.slice(0, 3));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
