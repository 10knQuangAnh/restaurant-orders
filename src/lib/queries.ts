import { sql, type QueryFn } from "./db";
import { billFromOrder } from "./billing";
import { ApiError } from "./http";
import { pickTaxRate, type TaxRateRow, ymdInZone } from "./time";
import type { Category, DiningTable, ItemUnit, MenuItem, Order, OrderItem, Tenant, TenantSettings } from "./types";

function num(v: unknown): number {
  return Number(v ?? 0);
}

function bool(v: unknown): boolean {
  return v === true || v === "t" || v === "true";
}

function features(raw: unknown): Record<string, boolean> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      return {};
    }
  }
  return raw as Record<string, boolean>;
}

export async function tableByToken(token: string) {
  const tables = await sql<DiningTable & Tenant>(
    `select t.id, t.tenant_id, t.code, t.name, t.qr_token, t.zone, t.seats,
            r.id as rid, r.slug, r.name as restaurant_name, r.logo_url, r.primary_color, r.accent_color, r.phone, r.address, r.hours, r.tagline
     from dining_tables t
     join tenants r on r.id = t.tenant_id
     where t.qr_token = $1
     limit 1`,
    [token],
  );
  const row = tables[0];
  if (!row) return null;
  const settingsRows = await sql<TenantSettings>(
    `select tenant_id, vat_rate, vat_included, service_rate, cash_round_to, bank_name, bank_account, bank_holder, features, timezone, day_cut_hour
     from tenant_settings where tenant_id = $1`,
    [row.tenant_id],
  );
  const settings = settingsRows[0];
  const tenant: Tenant = {
    id: row.tenant_id,
    slug: row.slug,
    name: (row as unknown as { restaurant_name: string }).restaurant_name,
    logo_url: row.logo_url,
    primary_color: row.primary_color,
    accent_color: row.accent_color,
    phone: row.phone,
    address: row.address,
    hours: (row as unknown as { hours?: string }).hours ?? null,
    tagline: (row as unknown as { tagline?: string }).tagline ?? null,
  };
  return {
    table: {
      id: row.id,
      tenant_id: row.tenant_id,
      code: row.code,
      name: row.name,
      qr_token: row.qr_token,
      zone: row.zone,
      seats: row.seats,
    } satisfies DiningTable,
    tenant,
    settings: settings ? mapSettings(settings) : null,
  };
}

function mapSettings(settings: TenantSettings): TenantSettings {
  return {
    ...settings,
    vat_rate: num(settings.vat_rate),
    service_rate: num(settings.service_rate),
    vat_included: bool(settings.vat_included),
    cash_round_to: num(settings.cash_round_to),
    features: features(settings.features),
    day_cut_hour: settings.day_cut_hour == null ? 5 : num(settings.day_cut_hour),
  };
}

export async function tenantBundle(tenantId: string) {
  const tenants = await sql<Tenant>(
    `select id, slug, name, logo_url, primary_color, accent_color, phone, address, hours, tagline from tenants where id = $1`,
    [tenantId],
  );
  const tenant = tenants[0];
  if (!tenant) return null;
  const settingsRows = await sql<TenantSettings>(
    `select tenant_id, vat_rate, vat_included, service_rate, cash_round_to, bank_name, bank_account, bank_holder, features, timezone, day_cut_hour
     from tenant_settings where tenant_id = $1`,
    [tenantId],
  );
  const settings = settingsRows[0];
  return {
    tenant,
    settings: settings ? mapSettings(settings) : null,
  };
}

export async function loadMenu(
  tenantId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<{ categories: Category[]; items: MenuItem[] }> {
  const categories = await sql<Category>(
    `select id, name, sort_order from categories where tenant_id = $1 ${opts.includeInactive ? "" : "and active = true"} order by sort_order, name`,
    [tenantId],
  );
  const itemRows = await sql<{
    id: string;
    category_id: string;
    name: string;
    name_en: string | null;
    description: string | null;
    image_url: string | null;
    sold_out: boolean;
    active: boolean;
    stock_left: number | null;
    daily_limit: number | null;
    tax_category: string;
  }>(
    `select id, category_id, name, name_en, description, image_url, sold_out, active, stock_left, daily_limit, tax_category
     from items where tenant_id = $1 ${opts.includeInactive ? "" : "and active = true"}
     order by sort_order, name`,
    [tenantId],
  );
  const units = await sql<ItemUnit & { item_id: string }>(
    `select u.id, u.item_id, u.name, u.price_dong, u.is_default
     from item_units u
     join items i on i.id = u.item_id
     where i.tenant_id = $1
     order by u.sort_order, u.name`,
    [tenantId],
  );
  const byItem = new Map<string, ItemUnit[]>();
  for (const u of units) {
    const list = byItem.get(u.item_id) ?? [];
    list.push({
      id: u.id,
      name: u.name,
      price_dong: num(u.price_dong),
      is_default: bool(u.is_default),
    });
    byItem.set(u.item_id, list);
  }
  const catIds = new Set(categories.map((c) => c.id));
  const items: MenuItem[] = itemRows
    .filter((it) => opts.includeInactive || catIds.has(it.category_id))
    .map((it) => {
      const stock = it.stock_left == null ? null : num(it.stock_left);
      const soldOut = bool(it.sold_out) || (stock != null && stock <= 0);
      return {
        ...it,
        sold_out: soldOut,
        active: bool(it.active),
        stock_left: stock,
        daily_limit: it.daily_limit == null ? null : num(it.daily_limit),
        tax_category: it.tax_category || "food",
        units: byItem.get(it.id) ?? [],
      };
    });
  return { categories, items };
}

export async function openOrderForTable(tableId: string, tenantId?: string) {
  const rows = await sql<Order>(
    tenantId
      ? `select id, tenant_id, table_id, status, guest_name, guest_phone, guest_note,
            vat_rate, vat_included, service_rate, discount_dong, created_at
         from orders where table_id = $1 and tenant_id = $2 and status = 'open' order by created_at desc limit 1`
      : `select id, tenant_id, table_id, status, guest_name, guest_phone, guest_note,
            vat_rate, vat_included, service_rate, discount_dong, created_at
         from orders where table_id = $1 and status = 'open' order by created_at desc limit 1`,
    tenantId ? [tableId, tenantId] : [tableId],
  );
  const order = rows[0];
  if (!order) return null;
  const items = await sql<OrderItem>(
    `select id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, qty, note,
            rush, complementary, kitchen_status, sent_at, started_at, done_at, created_at, vat_rate, original_price_dong
     from order_items where order_id = $1 order by created_at`,
    [order.id],
  );
  return {
    order: {
      ...order,
      vat_rate: num(order.vat_rate),
      service_rate: num(order.service_rate),
      vat_included: bool(order.vat_included),
      discount_dong: num(order.discount_dong),
    },
    items: items.map(mapItem),
  };
}

function mapItem(it: OrderItem): OrderItem {
  return {
    ...it,
    unit_price_dong: num(it.unit_price_dong),
    qty: num(it.qty),
    rush: bool(it.rush),
    complementary: bool(it.complementary),
    vat_rate: it.vat_rate == null ? null : num(it.vat_rate),
    original_price_dong: it.original_price_dong == null ? num(it.unit_price_dong) : num(it.original_price_dong),
  };
}

export function billFor(
  items: OrderItem[],
  settings: {
    vat_rate: number;
    vat_included: boolean;
    service_rate: number;
    cash_round_to: number;
  },
  discount = 0,
) {
  return billFromOrder(items, settings, discount);
}

export async function floorState(tenantId: string) {
  const tables = await sql<DiningTable>(
    `select id, tenant_id, code, name, qr_token, zone, seats, sort_order
     from dining_tables where tenant_id = $1 order by sort_order, code`,
    [tenantId],
  );
  const openOrders = await sql<{
    id: string;
    table_id: string;
    guest_name: string | null;
    created_at: string;
    item_count: number;
    queued: number;
    preparing: number;
    ready: number;
  }>(
    `select o.id, o.table_id, o.guest_name, o.created_at,
            coalesce(sum(case when i.kitchen_status not in ('cancelled','86') then i.qty else 0 end), 0) as item_count,
            coalesce(sum(case when i.kitchen_status = 'queued' then i.qty else 0 end), 0) as queued,
            coalesce(sum(case when i.kitchen_status = 'preparing' then i.qty else 0 end), 0) as preparing,
            coalesce(sum(case when i.kitchen_status = 'done' then i.qty else 0 end), 0) as ready
     from orders o
     left join order_items i on i.order_id = o.id
     where o.tenant_id = $1 and o.status = 'open'
     group by o.id, o.table_id, o.guest_name, o.created_at`,
    [tenantId],
  );
  const calls = await sql<{
    id: string;
    table_id: string;
    reason: string;
    created_at: string;
  }>(
    `select id, table_id, reason, created_at from staff_calls
     where tenant_id = $1 and status = 'open' order by created_at`,
    [tenantId],
  );
  return { tables, openOrders, calls };
}

export async function kitchenQueue(tenantId: string) {
  return sql<{
    id: string;
    order_id: string;
    table_code: string;
    table_name: string;
    name_snapshot: string;
    unit_snapshot: string;
    qty: number;
    note: string | null;
    rush: boolean;
    kitchen_status: string;
    sent_at: string | null;
    started_at: string | null;
    created_at: string;
  }>(
    `select oi.id, oi.order_id, t.code as table_code, t.name as table_name,
            oi.name_snapshot, oi.unit_snapshot, oi.qty, oi.note, oi.rush, oi.kitchen_status,
            oi.sent_at, oi.started_at, oi.created_at
     from order_items oi
     join orders o on o.id = oi.order_id
     join dining_tables t on t.id = o.table_id
     where o.tenant_id = $1
       and o.status = 'open'
       and oi.kitchen_status in ('queued', 'preparing')
     order by oi.rush desc, oi.sent_at nulls last, oi.created_at`,
    [tenantId],
  );
}

export async function rateForItem(
  q: QueryFn,
  tenantId: string,
  taxCategory: string,
  fallback: number,
  asOf = new Date(),
): Promise<number> {
  const ymd = ymdInZone(asOf);
  const rows = await q<TaxRateRow>(
    `select code, rate, effective_from::text, effective_to::text from tax_rates
     where tenant_id = $1 and code = $2`,
    [tenantId, taxCategory],
  );
  return pickTaxRate(
    rows.map((r) => ({
      code: r.code,
      rate: num(r.rate),
      effective_from: String(r.effective_from),
      effective_to: r.effective_to ? String(r.effective_to) : null,
    })),
    taxCategory,
    ymd,
    fallback,
  );
}

export async function pushNotice(
  q: QueryFn,
  row: {
    tenantId: string;
    kind: string;
    message: string;
    tableId?: string | null;
    orderId?: string | null;
    itemId?: string | null;
  },
) {
  const { nid } = await import("./ids");
  await q(
    `insert into notifications (id, tenant_id, kind, table_id, order_id, item_id, message)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [nid("nt"), row.tenantId, row.kind, row.tableId ?? null, row.orderId ?? null, row.itemId ?? null, row.message],
  );
}

export async function clearTableSession(q: QueryFn, tenantId: string, tableId: string) {
  await q(
    `update staff_calls set status = 'ack', ack_at = now() where tenant_id = $1 and table_id = $2 and status = 'open'`,
    [tenantId, tableId],
  );
}

export async function restoreItemStock(q: QueryFn, tenantId: string, itemId: string, qty: number) {
  if (qty <= 0) return;
  await q(
    `update items
        set stock_left = case when stock_left is null then null else stock_left + $1 end,
            sold_out = case when stock_left is null then sold_out else (stock_left + $1) <= 0 end
      where id = $2 and tenant_id = $3`,
    [qty, itemId, tenantId],
  );
}

// One conditional UPDATE both checks and reserves stock, including duplicate lines.
export async function reserveItemStock(q: QueryFn, tenantId: string, itemId: string, qty: number) {
  const rows = await q<{ id: string }>(
    `update items set stock_left = stock_left - $1,
       sold_out = case when stock_left is null then sold_out else stock_left - $1 <= 0 end
     where id = $2 and tenant_id = $3 and active = true and sold_out = false
       and (stock_left is null or stock_left >= $1)
     returning id`,
    [qty, itemId, tenantId],
  );
  if (!rows[0]) throw new ApiError(409, "sold_out");
}

export async function writeAudit(
  q: QueryFn,
  row: {
    tenantId: string;
    staffId?: string | null;
    action: string;
    entity?: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  const { nid } = await import("./ids");
  await q(
    `insert into audit_log (id, tenant_id, staff_id, action, entity, entity_id, before_json, after_json)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,
    [
      nid("aud"),
      row.tenantId,
      row.staffId ?? null,
      row.action,
      row.entity ?? null,
      row.entityId ?? null,
      row.before ? JSON.stringify(row.before) : null,
      row.after ? JSON.stringify(row.after) : null,
    ],
  );
}
