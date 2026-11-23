import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { json, readBody } from "@/lib/http";
import { nid } from "@/lib/ids";
import { loadMenu, tenantBundle } from "@/lib/queries";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const staff = await requireStaff(request, ["admin"]);
  if (staff instanceof Response) return staff;
  const url = new URL(request.url);
  const section = url.searchParams.get("section") || "overview";
  const bundle = await tenantBundle(staff.tenant_id);
  const origin = url.origin;

  if (section === "menu") {
    const menu = await loadMenu(staff.tenant_id);
    return json({ staff, tenant: bundle?.tenant, ...menu });
  }
  if (section === "tables") {
    const tables = await sql(
      `select id, code, name, qr_token, zone, seats, sort_order from dining_tables where tenant_id = $1 order by sort_order`,
      [staff.tenant_id],
    );
    const withQr = [];
    for (const t of tables as { qr_token: string; code: string; name: string; id: string; zone: string | null; seats: number }[]) {
      const link = `${origin}/t/${t.qr_token}`;
      const qr = await QRCode.toDataURL(link, { margin: 1, width: 240 });
      withQr.push({ ...t, link, qr });
    }
    return json({ staff, tenant: bundle?.tenant, tables: withQr });
  }
  if (section === "staff") {
    const people = await sql(
      `select id, name, role, pin, identity_email, active from staff where tenant_id = $1 order by role, name`,
      [staff.tenant_id],
    );
    return json({ staff, tenant: bundle?.tenant, people });
  }
  if (section === "settings") {
    return json({ staff, tenant: bundle?.tenant, settings: bundle?.settings });
  }
  if (section === "reports") {
    const today = await sql<{ orders: number; revenue: number; cash: number; transfer: number }>(
      `select
         count(distinct o.id)::int as orders,
         coalesce(sum(p.amount_dong),0)::int as revenue,
         coalesce(sum(case when p.method = 'cash' then p.amount_dong else 0 end),0)::int as cash,
         coalesce(sum(case when p.method = 'transfer' then p.amount_dong else 0 end),0)::int as transfer
       from payments p
       join orders o on o.id = p.order_id
       where o.tenant_id = $1 and p.created_at::date = current_date`,
      [staff.tenant_id],
    );
    const open = await sql<{ n: number; value: number }>(
      `select count(distinct o.id)::int as n,
              coalesce(sum(oi.qty * oi.unit_price_dong),0)::int as value
       from orders o
       join order_items oi on oi.order_id = o.id
       where o.tenant_id = $1 and o.status = 'open' and oi.kitchen_status <> 'cancelled'`,
      [staff.tenant_id],
    );
    const top = await sql<{ name_snapshot: string; qty: number }>(
      `select oi.name_snapshot, sum(oi.qty)::int as qty
       from order_items oi
       join orders o on o.id = oi.order_id
       where o.tenant_id = $1 and oi.kitchen_status <> 'cancelled'
       group by oi.name_snapshot
       order by qty desc
       limit 8`,
      [staff.tenant_id],
    );
    return json({
      staff,
      tenant: bundle?.tenant,
      today: today[0] ?? { orders: 0, revenue: 0, cash: 0, transfer: 0 },
      open: open[0] ?? { n: 0, value: 0 },
      top,
    });
  }

  const counts = await sql<{ tables: number; items: number; staff: number }>(
    `select
       (select count(*)::int from dining_tables where tenant_id = $1) as tables,
       (select count(*)::int from items where tenant_id = $1 and active) as items,
       (select count(*)::int from staff where tenant_id = $1 and active) as staff`,
    [staff.tenant_id],
  );
  return json({ staff, tenant: bundle?.tenant, settings: bundle?.settings, counts: counts[0] });
}

type AdminBody = {
  action: string;
  [k: string]: unknown;
};

export async function POST(request: Request) {
  const staff = await requireStaff(request, ["admin"]);
  if (staff instanceof Response) return staff;
  const body = await readBody<AdminBody>(request);

  if (body.action === "branding") {
    await sql(
      `update tenants set name = coalesce($1, name), phone = coalesce($2, phone), address = coalesce($3, address),
        primary_color = coalesce($4, primary_color), accent_color = coalesce($5, accent_color)
       where id = $6`,
      [
        (body.name as string) || null,
        (body.phone as string) || null,
        (body.address as string) || null,
        (body.primary_color as string) || null,
        (body.accent_color as string) || null,
        staff.tenant_id,
      ],
    );
  }

  if (body.action === "settings") {
    await sql(
      `update tenant_settings set
         vat_rate = coalesce($1, vat_rate),
         vat_included = coalesce($2, vat_included),
         service_rate = coalesce($3, service_rate),
         cash_round_to = coalesce($4, cash_round_to),
         bank_name = coalesce($5, bank_name),
         bank_account = coalesce($6, bank_account),
         bank_holder = coalesce($7, bank_holder),
         features = coalesce($8::jsonb, features)
       where tenant_id = $9`,
      [
        body.vat_rate ?? null,
        body.vat_included ?? null,
        body.service_rate ?? null,
        body.cash_round_to ?? null,
        (body.bank_name as string) || null,
        (body.bank_account as string) || null,
        (body.bank_holder as string) || null,
        body.features ? JSON.stringify(body.features) : null,
        staff.tenant_id,
      ],
    );
  }

  if (body.action === "toggle_sold_out") {
    await sql(`update items set sold_out = not sold_out where id = $1 and tenant_id = $2`, [
      body.itemId,
      staff.tenant_id,
    ]);
  }

  if (body.action === "save_item") {
    const itemId = (body.id as string) || nid("it");
    if (body.id) {
      await sql(
        `update items set name = $1, name_en = $2, description = $3, category_id = $4, active = $5
         where id = $6 and tenant_id = $7`,
        [body.name, body.name_en || null, body.description || null, body.category_id, body.active !== false, itemId, staff.tenant_id],
      );
    } else {
      await sql(
        `insert into items (id, tenant_id, category_id, name, name_en, description, image_url, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,99)`,
        [itemId, staff.tenant_id, body.category_id, body.name, body.name_en || null, body.description || null, "/dishes/com-chien-trung.svg"],
      );
      await sql(
        `insert into item_units (id, item_id, name, price_dong, is_default) values ($1,$2,$3,$4,true)`,
        [nid("un"), itemId, (body.unit_name as string) || "Phần", Number(body.price_dong) || 0],
      );
    }
    if (body.price_dong != null && body.id) {
      await sql(
        `update item_units set price_dong = $1 where item_id = $2 and is_default = true`,
        [Number(body.price_dong), itemId],
      );
    }
    return json({ ok: true, itemId });
  }

  if (body.action === "add_table") {
    const token = nid("qr").slice(0, 18);
    await sql(
      `insert into dining_tables (id, tenant_id, code, name, qr_token, zone, seats, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        nid("tbl"),
        staff.tenant_id,
        body.code,
        body.name,
        token,
        body.zone || null,
        Number(body.seats) || 4,
        Number(body.sort_order) || 99,
      ],
    );
  }

  if (body.action === "add_staff") {
    await sql(
      `insert into staff (id, tenant_id, name, pin, role, identity_email, active)
       values ($1,$2,$3,$4,$5,$6,true)`,
      [nid("st"), staff.tenant_id, body.name, String(body.pin || "").replace(/\D/g, ""), body.role, body.identity_email || null],
    );
  }

  if (body.action === "set_staff_active") {
    await sql(`update staff set active = $1 where id = $2 and tenant_id = $3`, [
      Boolean(body.active),
      body.id,
      staff.tenant_id,
    ]);
  }

  if (body.action === "add_tenant") {
    const id = nid("tn");
    const slug = String(body.slug || id).toLowerCase().replace(/[^a-z0-9-]/g, "-");
    await sql(
      `insert into tenants (id, slug, name, primary_color, accent_color) values ($1,$2,$3,$4,$5)`,
      [id, slug, body.name || "Nhà hàng mới", body.primary_color || "#E85D04", "#FFF1E6"],
    );
    await sql(
      `insert into tenant_settings (tenant_id) values ($1)`,
      [id],
    );
    await sql(
      `insert into staff (id, tenant_id, name, pin, role, active) values ($1,$2,$3,$4,'admin',true)`,
      [nid("st"), id, "Chủ quán", String(body.pin || "1234")],
    );
    return json({ ok: true, tenantId: id, slug });
  }

  return json({ ok: true });
}
