import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import { migratePostgresUrl, pgClientSsl } from "../src/lib/postgresUrl.mjs";
import { migratePool } from "../src/lib/migratePool.mjs";

const url = migratePostgresUrl();
if (!url && (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production")) {
  console.error(
    "migrate: production requires a valid PostgreSQL connection URL; configure the project's database before deploying",
  );
  process.exit(1);
}
const files = (await readdir("migrations").catch(() => [])).filter((f) => f.endsWith(".sql")).sort();
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

const pool = new pg.Pool({ connectionString: url, ssl: pgClientSsl(url), max: 1, connectionTimeoutMillis: 10_000 });
try {
  await migratePool(
    pool,
    await Promise.all(files.map(async (name) => ({ name, sql: await readFile(`migrations/${name}`, "utf8") }))),
  );
  console.log(`migrate: verified ${files.length} schema migrations`);
} finally {
  await pool.end();
}
