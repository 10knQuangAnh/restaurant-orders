import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { json, readBody } from "@/lib/http";
import { nid } from "@/lib/ids";
import { billFor, openOrderForTable, tenantBundle } from "@/lib/queries";
import type { OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PatchBody = {
  action:
    | "add"
    | "patch_item"
    | "transfer"
    | "merge"
    | "split"
    | "pay"
    | "void"
    | "ack_call"
    | "open";
  tableId?: string;
  otherOrderId?: string;
  itemIds?: string[];
  itemId?: string;
  qty?: number;
  note?: string;
  rush?: boolean;
  complementary?: boolean;
  cancel?: boolean;
  items?: { itemId: string; unitId: string; qty: number; note?: string }[];
  method?: "cash" | "transfer";
  received?: number;
  guestName?: string;
};

async function loadTicket(orderId: string, tenantId: string) {
  const orders = await sql<{
    id: string;
    tenant_id: string;
    table_id: string;
    status: string;
    guest_name: string | null;
    guest_phone: string | null;
    guest_note: string | null;
    vat_rate: number;
    vat_included: boolean;
    service_rate: number;
    discount_dong: number;
    created_at: string;
    code: string;
    tname: string;
    qr_token: string;
  }>(
    `select o.id, o.tenant_id, o.table_id, o.status, o.guest_name, o.guest_phone, o.guest_note,
            o.vat_rate, o.vat_included, o.service_rate, o.discount_dong, o.created_at,
            t.code, t.name as tname, t.qr_token
     from orders o join dining_tables t on t.id = o.table_id
     where o.id = $1 and o.tenant_id = $2`,
    [orderId, tenantId],
  );
  const order = orders[0];
  if (!order) return null;
  const items = await sql<OrderItem>(
    `select id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, qty, note,
            rush, complementary, kitchen_status, sent_at, started_at, done_at, created_at
     from order_items where order_id = $1 order by created_at`,
    [orderId],
  );
  const payments = await sql<{ id: string; method: string; amount_dong: number; received_dong: number | null; created_at: string }>(
    `select id, method, amount_dong, received_dong, created_at from payments where order_id = $1 order by created_at`,
    [orderId],
  );
  return { order, items, payments };
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const staff = await requireStaff(request, ["admin", "waiter"]);
  if (staff instanceof Response) return staff;
  const { id } = await ctx.params;
  if (id === "new") return json({ error: "not_found" }, 404);
  const bundle = await tenantBundle(staff.tenant_id);
  const ticket = await loadTicket(id, staff.tenant_id);
  if (!ticket) return json({ error: "not_found" }, 404);
  const settings = bundle?.settings ?? {
    vat_rate: Number(ticket.order.vat_rate),
    vat_included: ticket.order.vat_included === true || ticket.order.vat_included === ("t" as unknown as boolean),
    service_rate: Number(ticket.order.service_rate),
    cash_round_to: 1000,
  };
  const bill = billFor(
    ticket.items.map((i) => ({ ...i, unit_price_dong: Number(i.unit_price_dong), qty: Number(i.qty) })),
    {
      vat_rate: Number(settings.vat_rate),
      vat_included: Boolean(settings.vat_included),
      service_rate: Number(settings.service_rate),
      cash_round_to: Number(settings.cash_round_to ?? 1000),
    },
    Number(ticket.order.discount_dong),
  );
  return json({ staff, tenant: bundle?.tenant, settings: bundle?.settings, ticket, bill });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const staff = await requireStaff(request, ["admin", "waiter"]);
  if (staff instanceof Response) return staff;
  const { id } = await ctx.params;
  const body = await readBody<PatchBody>(request);
  const bundle = await tenantBundle(staff.tenant_id);
  if (!bundle?.settings) return json({ error: "no_tenant" }, 400);

  if (body.action === "open") {
    if (!body.tableId) return json({ error: "need_table" }, 400);
    const existing = await openOrderForTable(body.tableId);
    if (existing) return json({ orderId: existing.order.id });
    const orderId = nid("ord");
    await sql(
      `insert into orders (id, tenant_id, table_id, status, guest_name, vat_rate, vat_included, service_rate)
       values ($1,$2,$3,'open',$4,$5,$6,$7)`,
      [
        orderId,
        staff.tenant_id,
        body.tableId,
        body.guestName || null,
        bundle.settings.vat_rate,
        bundle.settings.vat_included,
        bundle.settings.service_rate,
      ],
    );
    return json({ orderId });
  }

  if (body.action === "ack_call") {
    await sql(
      `update staff_calls set status = 'ack', ack_at = now()
       where id = $1 and tenant_id = $2`,
      [id, staff.tenant_id],
    );
    return json({ ok: true });
  }

  const ticket = await loadTicket(id, staff.tenant_id);
  if (!ticket) return json({ error: "not_found" }, 404);
  if (ticket.order.status !== "open" && body.action !== "pay") {
    return json({ error: "closed" }, 409);
  }

  if (body.action === "add" && body.items?.length) {
    for (const line of body.items) {
      const units = await sql<{ id: string; item_id: string; name: string; price_dong: number; item_name: string }>(
        `select u.id, u.item_id, u.name, u.price_dong, i.name as item_name
         from item_units u join items i on i.id = u.item_id
         where u.id = $1 and i.tenant_id = $2`,
        [line.unitId, staff.tenant_id],
      );
      const u = units[0];
      if (!u) continue;
      await sql(
        `insert into order_items (id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, qty, note, kitchen_status, sent_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'queued', now())`,
        [nid("oi"), id, u.item_id, u.id, u.item_name, u.name, u.price_dong, line.qty, line.note || null],
      );
    }
  }

  if (body.action === "patch_item" && body.itemId) {
    if (body.cancel) {
      await sql(
        `update order_items set kitchen_status = 'cancelled', qty = 0 where id = $1 and order_id = $2`,
        [body.itemId, id],
      );
    } else {
      const fields: string[] = [];
      const params: unknown[] = [];
      const add = (clause: string, value: unknown) => {
        params.push(value);
        fields.push(clause.replace("?", `$${params.length}`));
      };
      if (body.qty != null) add("qty = ?", Math.max(0, Math.floor(body.qty)));
      if (body.note != null) add("note = ?", body.note.slice(0, 255));
      if (body.rush != null) add("rush = ?", body.rush);
      if (body.complementary != null) {
        add("complementary = ?", body.complementary);
        if (body.complementary) add("unit_price_dong = ?", 0);
      }
      if (fields.length) {
        params.push(body.itemId, id);
        await sql(
          `update order_items set ${fields.join(", ")} where id = $${params.length - 1} and order_id = $${params.length}`,
          params,
        );
      }
    }
  }

  if (body.action === "transfer" && body.tableId) {
    const dest = await openOrderForTable(body.tableId);
    if (dest && dest.order.id !== id) {
      await sql(`update order_items set order_id = $1 where order_id = $2`, [dest.order.id, id]);
      await sql(`update orders set status = 'void', closed_at = now() where id = $1`, [id]);
      return json({ orderId: dest.order.id, merged: true });
    }
    await sql(`update orders set table_id = $1 where id = $2 and tenant_id = $3`, [
      body.tableId,
      id,
      staff.tenant_id,
    ]);
  }

  if (body.action === "merge" && body.otherOrderId && body.otherOrderId !== id) {
    const other = await loadTicket(body.otherOrderId, staff.tenant_id);
    if (other && other.order.status === "open") {
      await sql(`update order_items set order_id = $1 where order_id = $2`, [id, body.otherOrderId]);
      await sql(`update orders set status = 'void', closed_at = now() where id = $1`, [body.otherOrderId]);
    }
  }

  if (body.action === "split" && body.itemIds?.length) {
    const newId = nid("ord");
    const tableId = body.tableId || ticket.order.table_id;
    await sql(
      `insert into orders (id, tenant_id, table_id, status, vat_rate, vat_included, service_rate)
       values ($1,$2,$3,'open',$4,$5,$6)`,
      [
        newId,
        staff.tenant_id,
        tableId,
        bundle.settings.vat_rate,
        bundle.settings.vat_included,
        bundle.settings.service_rate,
      ],
    );
    for (const itemId of body.itemIds) {
      await sql(`update order_items set order_id = $1 where id = $2 and order_id = $3`, [
        newId,
        itemId,
        id,
      ]);
    }
    return json({ orderId: newId, splitFrom: id });
  }

  if (body.action === "pay") {
    const fresh = await loadTicket(id, staff.tenant_id);
    if (!fresh) return json({ error: "not_found" }, 404);
    const bill = billFor(
      fresh.items.map((i) => ({ ...i, unit_price_dong: Number(i.unit_price_dong), qty: Number(i.qty) })),
      bundle.settings,
      Number(fresh.order.discount_dong),
    );
    const amount = body.method === "cash" ? bill.cashTotal : bill.total;
    await sql(
      `insert into payments (id, order_id, method, amount_dong, received_dong, staff_id)
       values ($1,$2,$3,$4,$5,$6)`,
      [nid("pay"), id, body.method || "cash", amount, body.received ?? amount, staff.id],
    );
    await sql(`update orders set status = 'paid', closed_at = now() where id = $1`, [id]);
    return json({ ok: true, paid: amount });
  }

  if (body.action === "void") {
    await sql(`update orders set status = 'void', closed_at = now() where id = $1`, [id]);
    await sql(
      `update order_items set kitchen_status = 'cancelled' where order_id = $1 and kitchen_status in ('queued','preparing')`,
      [id],
    );
  }

  const next = await loadTicket(id, staff.tenant_id);
  return json({ ok: true, ticket: next });
}
