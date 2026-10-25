import { withTransaction } from "./db";

// Fictional clients for every new demo business. No real customer data ever enters the app.
const DEMO_CLIENTS = [
  { name: "Oak Street Bakery", email: "orders@oakstreet.example", phone: "+15555550101" },
  { name: "Triangle Youth Soccer", email: "treasurer@triangleyouth.example", phone: "+15555550102" },
  { name: "Neuse River Dental", email: "office@neuseriverdental.example", phone: "+15555550103" },
];

type SignedInAccount = { homeAccountId: string; tenantId: string; email: string; name?: string };

// First sign-in creates a business and seeds it. Later sign-ins just update the user row.
export async function upsertUserAndBusiness(acct: SignedInAccount): Promise<string> {
  return withTransaction(async (tx) => {
    const existing = await tx.query<{ business_id: string }>(
      `update app_users set last_login_at = now(), email = $2, display_name = $3
        where home_account_id = $1 returning business_id`,
      [acct.homeAccountId, acct.email, acct.name ?? null],
    );
    if (existing.rows[0]) return existing.rows[0].business_id;

    const firstName = (acct.name ?? acct.email).split(/[\s@]/)[0];
    const biz = await tx.query<{ id: string }>("insert into businesses (name) values ($1) returning id", [
      `${firstName}'s Demo Business`,
    ]);
    const businessId = biz.rows[0].id;

    await tx.query(
      `insert into app_users (home_account_id, business_id, email, display_name, tenant_id)
       values ($1, $2, $3, $4, $5)`,
      [acct.homeAccountId, businessId, acct.email, acct.name ?? null, acct.tenantId],
    );
    for (const c of DEMO_CLIENTS) {
      await tx.query("insert into clients (business_id, name, email, phone) values ($1, $2, $3, $4)", [
        businessId,
        c.name,
        c.email,
        c.phone,
      ]);
    }
    return businessId;
  });
}
