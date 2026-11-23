import { sql } from "./db";
import { computeBill } from "./money";
import type {
  Category,
  DiningTable,
  ItemUnit,
  MenuItem,
  Order,
  OrderItem,
  Tenant,
  TenantSettings,
} from "./types";

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
            r.id as rid, r.slug, r.name as restaurant_name, r.logo_url, r.primary_color, r.accent_color, r.phone, r.address
     from dining_tables t
     join tenants r on r.id = t.tenant_id
     where t.qr_token = $1
     limit 1`,
    [token],
  );
  const row = tables[0];
  if (!row) return null;
  const settingsRows = await sql<TenantSettings>(
    `select tenant_id, vat_rate, vat_included, service_rate, cash_round_to, bank_name, bank_account, bank_holder, features, timezone
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
    settings: settings
      ? {
          ...settings,
          vat_rate: num(settings.vat_rate),
          service_rate: num(settings.service_rate),
          vat_included: bool(settings.vat_included),
          cash_round_to: num(settings.cash_round_to),
          features: features(settings.features),
        }
      : null,
  };
}

export async function tenantBundle(tenantId: string) {
  const tenants = await sql<Tenant>(
    `select id, slug, name, logo_url, primary_color, accent_color, phone, address from tenants where id = $1`,
    [tenantId],
  );
  const tenant = tenants[0];
  if (!tenant) return null;
  const settingsRows = await sql<TenantSettings>(
    `select tenant_id, vat_rate, vat_included, service_rate, cash_round_to, bank_name, bank_account, bank_holder, features, timezone
     from tenant_settings where tenant_id = $1`,
    [tenantId],
  );
  const settings = settingsRows[0];
  return {
    tenant,
    settings: settings
      ? {
          ...settings,
          vat_rate: num(settings.vat_rate),
          service_rate: num(settings.service_rate),
          vat_included: bool(settings.vat_included),
          cash_round_to: num(settings.cash_round_to),
          features: features(settings.features),
        }
      : null,
  };
}

export async function loadMenu(tenantId: string): Promise<{ categories: Category[]; items: MenuItem[] }> {
  const categories = await sql<Category>(
    `select id, name, sort_order from categories where tenant_id = $1 and active = true order by sort_order, name`,
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
  }>(
    `select id, category_id, name, name_en, description, image_url, sold_out
     from items where tenant_id = $1 and active = true
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
  const items: MenuItem[] = itemRows.map((it) => ({
    ...it,
    sold_out: bool(it.sold_out),
    units: byItem.get(it.id) ?? [],
  }));
  return { categories, items };
}

export async function openOrderForTable(tableId: string) {
  const rows = await sql<Order>(
    `select id, tenant_id, table_id, status, guest_name, guest_phone, guest_note,
            vat_rate, vat_included, service_rate, discount_dong, created_at
     from orders where table_id = $1 and status = 'open' order by created_at desc limit 1`,
    [tableId],
  );
  const order = rows[0];
  if (!order) return null;
  const items = await sql<OrderItem>(
    `select id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, qty, note,
            rush, complementary, kitchen_status, sent_at, started_at, done_at, created_at
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
    items: items.map((it) => ({
      ...it,
      unit_price_dong: num(it.unit_price_dong),
      qty: num(it.qty),
      rush: bool(it.rush),
      complementary: bool(it.complementary),
    })),
  };
}

export function billFor(
  items: OrderItem[],
  settings: { vat_rate: number; vat_included: boolean; service_rate: number; cash_round_to: number },
  discount = 0,
) {
  return computeBill({
    lines: items,
    vatRate: settings.vat_rate,
    vatIncluded: settings.vat_included,
    serviceRate: settings.service_rate,
    discount,
    cashRoundTo: settings.cash_round_to,
  });
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
  }>(
    `select o.id, o.table_id, o.guest_name, o.created_at,
            coalesce(sum(i.qty), 0) as item_count,
            coalesce(sum(case when i.kitchen_status = 'queued' then i.qty else 0 end), 0) as queued,
            coalesce(sum(case when i.kitchen_status = 'preparing' then i.qty else 0 end), 0) as preparing
     from orders o
     left join order_items i on i.order_id = o.id and i.kitchen_status <> 'cancelled'
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
