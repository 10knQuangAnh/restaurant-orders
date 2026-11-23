import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import { migratePostgresUrl } from "../src/lib/postgresUrl.mjs";

const url = migratePostgresUrl();
const files = (await readdir("migrations").catch(() => []))
  .filter((f) => f.endsWith(".sql"))
  .sort();
if (!url || files.length === 0) {
  const raw = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
  if (!url && raw) {
    console.log(
      "migrate: skip — DATABASE_URL is not a usable postgres:// host (pg dummy host “base”). Set it to the Neon/Vercel connection string, or leave it empty. Do not paste the name POSTGRES_URL.",
    );
  } else {
    console.log("migrate: nothing to do");
  }
  process.exit(0);
}

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
} catch (error) {
  const err = error;
  const hostname = err && typeof err === "object" && "hostname" in err ? String(err.hostname || "") : "";
  if (err && typeof err === "object" && err.code === "ENOTFOUND" && (hostname === "base" || !hostname.includes("."))) {
    console.log(
      `migrate: skip — cannot resolve Postgres host “${hostname || "?"}”. Use a full postgres:// URL whose host has a domain (e.g. ep-xxx.neon.tech).`,
    );
    process.exit(0);
  }
  throw error;
}

try {
  await client.query("set lock_timeout = '60s'");
  await client.query("select pg_advisory_lock(7272741)");
  await client.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set(
    (await client.query("select name from schema_migrations")).rows.map((r) => r.name),
  );
  for (const file of files.filter((f) => !done.has(file))) {
    await client.query("begin");
    try {
      await client.query(await readFile(`migrations/${file}`, "utf8"));
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`migrate: applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
