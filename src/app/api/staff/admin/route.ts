import { requireStaff } from "@/lib/auth";
import { asPercentOrRate, clampRate, isHexColor } from "@/lib/billing";
import { hashPin } from "@/lib/pin";
import { sql } from "@/lib/db";
import { ApiError, json, readBody, wrap } from "@/lib/http";
import { nid } from "@/lib/ids";
import { loadMenu, tenantBundle, writeAudit } from "@/lib/queries";
import { businessDate } from "@/lib/time";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = wrap(async (request: Request) => {
  const staff = await requireStaff(request, ["admin"]);
  if (staff instanceof Response) return staff;
  const url = new URL(request.url);
  const section = url.searchParams.get("section") || "overview";
  const bundle = await tenantBundle(staff.tenant_id);
  const origin = url.origin;

  if (section === "menu") {
    const menu = await loadMenu(staff.tenant_id, { includeInactive: true });
    return json({ staff, tenant: bundle?.tenant, ...menu });
  }
  if (section === "tables") {
    const tables = await sql(
      `select id, code, name, qr_token, zone, seats, sort_order from dining_tables where tenant_id = $1 order by sort_order`,
      [staff.tenant_id],
    );
    const withQr = [];
    for (const t of tables as {
      qr_token: string;
      code: string;
      name: string;
      id: string;
      zone: string | null;
      seats: number;
    }[]) {
      const link = `${origin}/t/${t.qr_token}`;
      const qr = await QRCode.toDataURL(link, { margin: 1, width: 240 });
      withQr.push({ ...t, link, qr });
    }
    return json({ staff, tenant: bundle?.tenant, tables: withQr });
  }
  if (section === "staff") {
    const people = await sql(
      `select id, name, role, identity_email, active from staff where tenant_id = $1 order by role, name`,
      [staff.tenant_id],
    );
    return json({ staff, tenant: bundle?.tenant, people });
  }
  if (section === "settings") {
    return json({ staff, tenant: bundle?.tenant, settings: bundle?.settings });
  }
  if (section === "reports") {
    const day = businessDate(new Date(), bundle?.settings?.timezone || "Asia/Ho_Chi_Minh", 5);
    const today = await sql<{ orders: number; revenue: number; cash: number; transfer: number }>(
      `select
         count(distinct o.id)::int as orders,
         coalesce(sum(coalesce((o.bill_snapshot->>'total')::int, p.amount_dong)),0)::int as revenue,
         coalesce(sum(case when p.method = 'cash' then coalesce((o.bill_snapshot->>'total')::int, p.amount_dong) else 0 end),0)::int as cash,
         coalesce(sum(case when p.method = 'transfer' then coalesce((o.bill_snapshot->>'total')::int, p.amount_dong) else 0 end),0)::int as transfer
       from orders o
       left join payments p on p.order_id = o.id
       where o.tenant_id = $1 and o.status = 'paid'
         and ((o.closed_at at time zone 'Asia/Ho_Chi_Minh') - interval '5 hours')::date = $2::date`,
      [staff.tenant_id, day],
    );
    const open = await sql<{ n: number; value: number }>(
      `select count(distinct o.id)::int as n,
              coalesce(sum(case when oi.kitchen_status not in ('cancelled','86') and oi.complementary = false then oi.qty * oi.unit_price_dong else 0 end),0)::int as value
       from orders o
       join order_items oi on oi.order_id = o.id
       where o.tenant_id = $1 and o.status = 'open'`,
      [staff.tenant_id],
    );
    const top = await sql<{ name_snapshot: string; qty: number }>(
      `select oi.name_snapshot, sum(oi.qty)::int as qty
       from order_items oi
       join orders o on o.id = oi.order_id
       where o.tenant_id = $1 and o.status = 'paid' and oi.kitchen_status not in ('cancelled','86')
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
      businessDate: day,
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
});

type AdminBody = {
  action: string;
  [k: string]: unknown;
};

export const POST = wrap(async (request: Request) => {
  const staff = await requireStaff(request, ["admin"]);
  if (staff instanceof Response) return staff;
  const body = await readBody<AdminBody>(request);

  if (body.action === "add_tenant") {
    return json({ error: "platform_only" }, 403);
  }

  if (body.action === "branding") {
    const color = body.primary_color ? String(body.primary_color) : "";
    const accent = body.accent_color ? String(body.accent_color) : "";
    if (color && !isHexColor(color)) throw new ApiError(400, "bad_color");
    if (accent && !isHexColor(accent)) throw new ApiError(400, "bad_color");
    await sql(
      `update tenants set name = coalesce($1, name), phone = coalesce($2, phone), address = coalesce($3, address),
        primary_color = coalesce($4, primary_color), accent_color = coalesce($5, accent_color)
       where id = $6`,
      [
        (body.name as string) || null,
        (body.phone as string) || null,
        (body.address as string) || null,
        color || null,
        accent || null,
        staff.tenant_id,
      ],
    );
  }

  if (body.action === "settings") {
    const vat = body.vat_rate == null ? null : asPercentOrRate(body.vat_rate);
    const parsedSvc = body.service_rate == null ? null : asPercentOrRate(body.service_rate);
    const svc = parsedSvc == null ? null : clampRate(parsedSvc);
    if (body.vat_rate != null && vat == null) throw new ApiError(400, "bad_vat");
    if (body.service_rate != null && svc == null) throw new ApiError(400, "bad_service");
    const round = body.cash_round_to == null ? null : Math.max(0, Math.floor(Number(body.cash_round_to)));
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
        vat,
        body.vat_included ?? null,
        svc,
        round,
        (body.bank_name as string) || null,
        (body.bank_account as string) || null,
        (body.bank_holder as string) || null,
        body.features ? JSON.stringify(body.features) : null,
        staff.tenant_id,
      ],
    );
    await writeAudit(sql, {
      tenantId: staff.tenant_id,
      staffId: staff.id,
      action: "settings",
      entity: "tenant_settings",
      entityId: staff.tenant_id,
      after: { vat, svc, round },
    });
  }

  if (body.action === "toggle_sold_out") {
    await sql(`update items set sold_out = not sold_out where id = $1 and tenant_id = $2`, [
      body.itemId,
      staff.tenant_id,
    ]);
  }

  if (body.action === "save_item") {
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) throw new ApiError(400, "need_name");
    const itemId = (body.id as string) || nid("it");
    if (body.id) {
      const owned = await sql<{ id: string }>(`select id from items where id = $1 and tenant_id = $2`, [
        itemId,
        staff.tenant_id,
      ]);
      if (!owned[0]) throw new ApiError(404, "not_found");
      await sql(
        `update items set name = $1, name_en = $2, description = $3, category_id = $4, active = $5
         where id = $6 and tenant_id = $7`,
        [name, body.name_en || null, body.description || null, body.category_id, body.active !== false, itemId, staff.tenant_id],
      );
    } else {
      await sql(
        `insert into items (id, tenant_id, category_id, name, name_en, description, image_url, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,99)`,
        [itemId, staff.tenant_id, body.category_id, name, body.name_en || null, body.description || null, "/dishes/com-chien-trung.svg"],
      );
      await sql(
        `insert into item_units (id, item_id, name, price_dong, is_default) values ($1,$2,$3,$4,true)`,
        [nid("un"), itemId, (body.unit_name as string) || "Phần", Math.max(0, Number(body.price_dong) || 0)],
      );
    }
    if (body.price_dong != null && body.id) {
      await sql(`update item_units set price_dong = $1 where item_id = $2 and is_default = true`, [
        Math.max(0, Number(body.price_dong)),
        itemId,
      ]);
    }
    return json({ ok: true, itemId });
  }

  if (body.action === "save_category") {
    const name = String(body.name || "").trim().slice(0, 80);
    if (!name) throw new ApiError(400, "need_name");
    const id = (body.id as string) || nid("cat");
    if (body.id) {
      await sql(`update categories set name = $1, sort_order = coalesce($2, sort_order), active = coalesce($3, active) where id = $4 and tenant_id = $5`, [
        name,
        body.sort_order ?? null,
        body.active ?? null,
        id,
        staff.tenant_id,
      ]);
    } else {
      await sql(`insert into categories (id, tenant_id, name, sort_order) values ($1,$2,$3,$4)`, [
        id,
        staff.tenant_id,
        name,
        Number(body.sort_order) || 99,
      ]);
    }
    return json({ ok: true, id });
  }

  if (body.action === "add_table") {
    const token = nid("qr");
    await sql(
      `insert into dining_tables (id, tenant_id, code, name, qr_token, zone, seats, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        nid("tbl"),
        staff.tenant_id,
        String(body.code || "").slice(0, 12),
        String(body.name || body.code || "Bàn").slice(0, 40),
        token,
        body.zone || null,
        Math.min(20, Math.max(1, Number(body.seats) || 4)),
        Number(body.sort_order) || 99,
      ],
    );
  }

  if (body.action === "rotate_qr") {
    const token = nid("qr");
    const n = await sql<{ id: string }>(
      `update dining_tables set qr_token = $1 where id = $2 and tenant_id = $3 returning id`,
      [token, body.id, staff.tenant_id],
    );
    if (!n[0]) throw new ApiError(404, "not_found");
    return json({ ok: true, qr_token: token });
  }

  if (body.action === "add_staff") {
    const pin = String(body.pin || "").replace(/\D/g, "");
    if (!/^\d{4,8}$/.test(pin)) throw new ApiError(400, "bad_pin");
    const role = body.role === "kitchen" || body.role === "admin" ? body.role : "waiter";
    const dup = await sql<{ id: string }>(`select id from staff where tenant_id = $1 and pin = $2 and active = true`, [
      staff.tenant_id,
      pin,
    ]);
    if (dup[0]) throw new ApiError(409, "pin_taken");
    await sql(
      `insert into staff (id, tenant_id, name, pin, pin_hash, role, active)
       values ($1,$2,$3,$4,$5,$6,true)`,
      [nid("st"), staff.tenant_id, String(body.name || "").slice(0, 80), pin, hashPin(pin), role],
    );
  }

  if (body.action === "reset_pin") {
    const pin = String(body.pin || "").replace(/\D/g, "");
    if (!/^\d{4,8}$/.test(pin)) throw new ApiError(400, "bad_pin");
    const dup = await sql<{ id: string }>(
      `select id from staff where tenant_id = $1 and pin = $2 and active = true and id <> $3`,
      [staff.tenant_id, pin, body.id],
    );
    if (dup[0]) throw new ApiError(409, "pin_taken");
    await sql(`update staff set pin = $1, pin_hash = $2, failed_attempts = 0, locked_until = null where id = $3 and tenant_id = $4`, [
      pin,
      hashPin(pin),
      body.id,
      staff.tenant_id,
    ]);
    await sql(`update staff_sessions set revoked = true where staff_id = $1`, [body.id]);
  }

  if (body.action === "set_staff_active") {
    await sql(`update staff set active = $1 where id = $2 and tenant_id = $3`, [
      Boolean(body.active),
      body.id,
      staff.tenant_id,
    ]);
    if (!body.active) {
      await sql(`update staff_sessions set revoked = true where staff_id = $1`, [body.id]);
    }
  }

  return json({ ok: true });
});
