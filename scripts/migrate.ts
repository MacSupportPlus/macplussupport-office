// Applies db/migrations/*.sql in filename order, once each. Run: npm run db:migrate
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(`create table if not exists schema_migrations (
    filename text primary key, applied_at timestamptz not null default now())`);

  const dir = path.join(process.cwd(), "db", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await db.query<{ filename: string }>("select filename from schema_migrations");
  const done = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (done.has(file)) continue;
    console.log(`applying ${file}`);
    await db.query("begin");
    try {
      await db.query(readFileSync(path.join(dir, file), "utf8"));
      await db.query("insert into schema_migrations (filename) values ($1)", [file]);
      await db.query("commit");
    } catch (err) {
      await db.query("rollback");
      throw err;
    }
  }
  console.log("migrations up to date");
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
