import assert from "node:assert/strict";
import pg from "pg";
import { spawnSync } from "node:child_process";

assert.ok(process.env.TEST_DATABASE_URL, "Use an isolated TEST_DATABASE_URL");
for (let attempt = 0; attempt < 2; attempt++) {
  const run = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      DATABASE_URL_UNPOOLED: process.env.TEST_DATABASE_URL,
      POSTGRES_URL_NON_POOLING: process.env.TEST_DATABASE_URL,
    },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
}
console.log("PASS migration CLI can run twice against PostgreSQL");
const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await client.connect();
try {
  const lock = await client.query("select pg_try_advisory_lock(7272741) as acquired");
  assert.equal(lock.rows[0].acquired, true, "app must release migration lock after boot");
  await client.query("select pg_advisory_unlock(7272741)");
  for (const [name, query] of [
    ["nonnegative stock", "select id from items where stock_left < 0"],
    [
      "one open order per table",
      "select table_id from orders where status = 'open' group by table_id having count(*) > 1",
    ],
    ["one payment per order", "select order_id from payments group by order_id having count(*) > 1"],
    [
      "snapshot matches received revenue",
      "select o.id from orders o join payments p on p.order_id = o.id where o.status = 'paid' and o.bill_snapshot is not null and (o.bill_snapshot->>'total')::int <> p.amount_dong",
    ],
  ]) {
    assert.equal((await client.query(query)).rows.length, 0, name);
    console.log("PASS", name);
  }
  console.log("PASS migration advisory lock released");
} finally {
  await client.end();
}
