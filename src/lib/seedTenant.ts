import { isHexColor } from "./billing";
import { sql, withTx } from "./db";
import { nid } from "./ids";
import { isSafeImageUrl } from "./media";
import { hashPin } from "./pin";
import { parseTenantSpec, type TenantSpec } from "./tenantSpec";

export async function applyTenantJson(raw: unknown): Promise<{ tenantId: string; slug: string }> {
  const spec = parseTenantSpec(raw);
  return insertTenant(spec);
}

async function insertTenant(spec: TenantSpec): Promise<{ tenantId: string; slug: string }> {
  const taken = await sql<{ id: string }>(`select id from tenants where slug = $1`, [spec.tenant.slug]);
  if (taken[0]) throw Object.assign(new Error("slug_taken"), { code: "slug_taken" });
  const pins = [spec.admin.pin, ...(spec.staff || []).map((s) => s.pin)];
  if (new Set(pins).size !== pins.length) throw Object.assign(new Error("pin_taken"), { code: "pin_taken" });

  const color = spec.tenant.primary_color && isHexColor(spec.tenant.primary_color) ? spec.tenant.primary_color : "#E85D04";
  const accent = spec.tenant.accent_color && isHexColor(spec.tenant.accent_color) ? spec.tenant.accent_color : "#FFF1E6";
  const tenantId = nid("tn");
  const vat = spec.settings?.vat_rate == null ? 0.08 : Number(spec.settings.vat_rate);
  const svc = spec.settings?.service_rate == null ? 0.05 : Number(spec.settings.service_rate);
  const round = spec.settings?.cash_round_to == null ? 0 : Math.max(0, Math.floor(Number(spec.settings.cash_round_to)));

  await withTx(async (q) => {
    await q(
      `insert into tenants (id, slug, name, primary_color, accent_color, phone, address, hours, tagline)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        tenantId,
        spec.tenant.slug,
        spec.tenant.name,
        color,
        accent,
        spec.tenant.phone || null,
        spec.tenant.address || null,
        spec.tenant.hours || null,
        spec.tenant.tagline || null,
      ],
    );
    await q(
      `insert into tenant_settings (tenant_id, vat_rate, service_rate, cash_round_to, bank_name, bank_account, bank_holder)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        tenantId,
        vat,
        svc,
        round,
        spec.settings?.bank_name || null,
        spec.settings?.bank_account || null,
        spec.settings?.bank_holder || null,
      ],
    );
    await q(
      `insert into staff (id, tenant_id, name, pin, pin_hash, role, active) values ($1,$2,$3,$4,$5,'admin',true)`,
      [nid("st"), tenantId, spec.admin.name, spec.admin.pin, hashPin(spec.admin.pin)],
    );
    for (const person of spec.staff || []) {
      await q(
        `insert into staff (id, tenant_id, name, pin, pin_hash, role, active) values ($1,$2,$3,$4,$5,$6,true)`,
        [nid("st"), tenantId, person.name, person.pin, hashPin(person.pin), person.role],
      );
    }
    await q(
      `insert into tax_rates (id, tenant_id, code, rate, effective_from, effective_to) values
        ($1,$4,'food',0.08,'2025-07-01','2026-12-31'),
        ($2,$4,'food',0.10,'2027-01-01',null),
        ($3,$4,'alcohol',0.10,'2025-01-01',null)`,
      [nid("tax"), nid("tax"), nid("tax"), tenantId],
    );
    let sort = 1;
    for (const table of spec.tables) {
      await q(
        `insert into dining_tables (id, tenant_id, code, name, qr_token, zone, seats, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [nid("tbl"), tenantId, table.code, table.name, nid("qr"), table.zone || null, table.seats || 4, sort],
      );
      sort += 1;
    }
    let catSort = 1;
    for (const cat of spec.categories) {
      const catId = nid("cat");
      await q(`insert into categories (id, tenant_id, name, sort_order) values ($1,$2,$3,$4)`, [
        catId,
        tenantId,
        cat.name,
        catSort,
      ]);
      let itemSort = 1;
      for (const item of cat.items) {
        const itemId = nid("it");
        const image = item.image_url && isSafeImageUrl(item.image_url) ? item.image_url : null;
        await q(
          `insert into items (id, tenant_id, category_id, name, name_en, description, image_url, sort_order, tax_category)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            itemId,
            tenantId,
            catId,
            item.name,
            item.name_en || null,
            item.description || null,
            image,
            itemSort,
            item.tax_category === "alcohol" ? "alcohol" : "food",
          ],
        );
        await q(`insert into item_units (id, item_id, name, price_dong, is_default) values ($1,$2,$3,$4,true)`, [
          nid("un"),
          itemId,
          item.unit || "Phần",
          item.price_dong,
        ]);
        itemSort += 1;
      }
      catSort += 1;
    }
  });
  return { tenantId, slug: spec.tenant.slug };
}
