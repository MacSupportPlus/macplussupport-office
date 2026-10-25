import { Pool, type PoolClient } from "pg";

// One pool per server instance. On Vercel, point DATABASE_URL at Neon's *pooled* connection string
// (the host contains "-pooler") and keep max small, because each serverless instance gets its own pool.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 5),
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
