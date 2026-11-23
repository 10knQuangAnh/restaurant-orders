import { readFile } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";
import { parseTenantSpec } from "../src/lib/tenantSpec.ts";
import { usablePostgresUrl } from "../src/lib/postgresUrl.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: DATABASE_URL=postgres://... npm run seed:tenant -- seeds/templates/quan-sample.json");
  process.exit(1);
}

const url = usablePostgresUrl(
  process.env.DATABASE_URL_UNPOOLED,
  process.env.DATABASE_URL,
  process.env.POSTGRES_URL_NON_POOLING,
  process.env.POSTGRES_URL,
);
if (!url) {
  console.error("seed:tenant needs a real postgres:// DATABASE_URL (or POSTGRES_URL). PGlite inside next dev is a different process.");
  process.exit(1);
}

function nid(prefix = "") {
  const id = randomBytes(8).toString("hex");
  return prefix ? `${prefix}_${id}` : id;
}
function hashPin(pin, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

const spec = parseTenantSpec(JSON.parse(await readFile(file, "utf8")));
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const taken = await client.query("select id from tenants where slug = $1", [spec.tenant.slug]);
  if (taken.rows[0]) {
    console.error("seed:tenant slug_taken");
    process.exit(1);
  }
  const pins = [spec.admin.pin, ...(spec.staff || []).map((s) => s.pin)];
  if (new Set(pins).size !== pins.length) {
    console.error("seed:tenant pin_taken");
    process.exit(1);
  }
  const color = spec.tenant.primary_color || "#E85D04";
  const accent = spec.tenant.accent_color || "#FFF1E6";
  const tenantId = nid("tn");
  const vat = spec.settings?.vat_rate ?? 0.08;
  const svc = spec.settings?.service_rate ?? 0.05;
  const round = Math.max(0, Math.floor(spec.settings?.cash_round_to ?? 0));
  await client.query("begin");
  await client.query(
    `insert into tenants (id, slug, name, primary_color, accent_color, phone, address, hours, tagline)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [tenantId, spec.tenant.slug, spec.tenant.name, color, accent, spec.tenant.phone || null, spec.tenant.address || null, spec.tenant.hours || null, spec.tenant.tagline || null],
  );
  await client.query(
    `insert into tenant_settings (tenant_id, vat_rate, service_rate, cash_round_to, bank_name, bank_account, bank_holder)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [tenantId, vat, svc, round, spec.settings?.bank_name || null, spec.settings?.bank_account || null, spec.settings?.bank_holder || null],
  );
  await client.query(
    `insert into staff (id, tenant_id, name, pin, pin_hash, role, active) values ($1,$2,$3,$4,$5,'admin',true)`,
    [nid("st"), tenantId, spec.admin.name, spec.admin.pin, hashPin(spec.admin.pin)],
  );
  for (const person of spec.staff || []) {
    await client.query(
      `insert into staff (id, tenant_id, name, pin, pin_hash, role, active) values ($1,$2,$3,$4,$5,$6,true)`,
      [nid("st"), tenantId, person.name, person.pin, hashPin(person.pin), person.role],
    );
  }
  await client.query(
    `insert into tax_rates (id, tenant_id, code, rate, effective_from, effective_to) values
      ($1,$4,'food',0.08,'2025-07-01','2026-12-31'),
      ($2,$4,'food',0.10,'2027-01-01',null),
      ($3,$4,'alcohol',0.10,'2025-01-01',null)`,
    [nid("tax"), nid("tax"), nid("tax"), tenantId],
  );
  let sort = 1;
  for (const table of spec.tables) {
    await client.query(
      `insert into dining_tables (id, tenant_id, code, name, qr_token, zone, seats, sort_order) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [nid("tbl"), tenantId, table.code, table.name, nid("qr"), table.zone || null, table.seats || 4, sort],
    );
    sort += 1;
  }
  let catSort = 1;
  for (const cat of spec.categories) {
    const catId = nid("cat");
    await client.query(`insert into categories (id, tenant_id, name, sort_order) values ($1,$2,$3,$4)`, [catId, tenantId, cat.name, catSort]);
    let itemSort = 1;
    for (const item of cat.items) {
      const itemId = nid("it");
      await client.query(
        `insert into items (id, tenant_id, category_id, name, name_en, description, image_url, sort_order, tax_category)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [itemId, tenantId, catId, item.name, item.name_en || null, item.description || null, item.image_url || null, itemSort, item.tax_category === "alcohol" ? "alcohol" : "food"],
      );
      await client.query(`insert into item_units (id, item_id, name, price_dong, is_default) values ($1,$2,$3,$4,true)`, [
        nid("un"), itemId, item.unit || "Phần", item.price_dong,
      ]);
      itemSort += 1;
    }
    catSort += 1;
  }
  await client.query("commit");
  console.log(`seed:tenant ok slug=${spec.tenant.slug} id=${tenantId}`);
} catch (error) {
  try { await client.query("rollback"); } catch { /* ignore */ }
  console.error("seed:tenant fail", error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end();
}
