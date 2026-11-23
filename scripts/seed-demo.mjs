import { readdir, readFile } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
  console.error("seed:demo blocked when NODE_ENV=production (set ALLOW_DEMO_SEED=1 to override)");
  process.exit(1);
}

const url = process.env.DATABASE_URL?.trim() ?? "";
if (!url) {
  console.error("seed:demo needs DATABASE_URL");
  process.exit(1);
}

function hashPin(pin, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED?.trim() || url });
await client.connect();
try {
  const files = (await readdir("seeds")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await client.query(await readFile(`seeds/${file}`, "utf8"));
    console.log(`seed: applied ${file}`);
  }
  const rows = await client.query("select id, pin from staff where pin_hash is null or pin_hash = ''");
  for (const row of rows.rows) {
    await client.query("update staff set pin_hash = $1 where id = $2", [hashPin(row.pin), row.id]);
  }
} finally {
  await client.end();
}
