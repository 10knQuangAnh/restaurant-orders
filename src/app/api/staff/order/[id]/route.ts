import { requireStaff } from "@/lib/auth";
import { billFromOrder, clampQty } from "@/lib/billing";
import { sql, withTx } from "@/lib/db";
import { ApiError, featureOn, json, readBody, wrap } from "@/lib/http";
import { nid } from "@/lib/ids";
import { openOrderForTable, pushNotice, rateForItem, tenantBundle, writeAudit } from "@/lib/queries";
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
    | "open"
    | "discount"
    | "served";
  tableId?: string;
  otherOrderId?: string;
  itemIds?: string[];
  itemId?: string;
  qty?: number;
  note?: string;
  rush?: boolean;
  complementary?: boolean;
  cancel?: boolean;
  cancelReason?: string;
  items?: { itemId: string; unitId: string; qty: number; note?: string }[];
  method?: "cash" | "transfer";
  received?: number;
  guestName?: string;
  amount?: number;
  idempotencyKey?: string;
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
    bill_snapshot: unknown;
    code: string;
    tname: string;
    qr_token: string;
  }>(
    `select o.id, o.tenant_id, o.table_id, o.status, o.guest_name, o.guest_phone, o.guest_note,
            o.vat_rate, o.vat_included, o.service_rate, o.discount_dong, o.created_at, o.bill_snapshot,
            t.code, t.name as tname, t.qr_token
     from orders o join dining_tables t on t.id = o.table_id
     where o.id = $1 and o.tenant_id = $2`,
    [orderId, tenantId],
  );
  const order = orders[0];
  if (!order) return null;
  const items = await sql<OrderItem>(
    `select id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, qty, note,
            rush, complementary, kitchen_status, sent_at, started_at, done_at, created_at, vat_rate, original_price_dong
     from order_items where order_id = $1 order by created_at`,
    [orderId],
  );
  const payments = await sql<{
    id: string;
    method: string;
    amount_dong: number;
    received_dong: number | null;
    rounding_dong: number;
    created_at: string;
  }>(
    `select id, method, amount_dong, received_dong, rounding_dong, created_at from payments where order_id = $1 order by created_at`,
    [orderId],
  );
  return { order, items, payments };
}

function orderRates(order: { vat_rate: unknown; vat_included: unknown; service_rate: unknown }, cashRoundTo: number) {
  return {
    vat_rate: Number(order.vat_rate),
    vat_included: order.vat_included === true || order.vat_included === ("t" as unknown as boolean),
    service_rate: Number(order.service_rate),
    cash_round_to: cashRoundTo,
  };
}

export const GET = wrap(async (request: Request, ctx) => {
  const staff = await requireStaff(request, ["admin", "waiter"]);
  if (staff instanceof Response) return staff;
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  if (id === "new") return json({ error: "not_found" }, 404);
  const bundle = await tenantBundle(staff.tenant_id);
  const ticket = await loadTicket(id, staff.tenant_id);
  if (!ticket) return json({ error: "not_found" }, 404);
  const snap = ticket.order.bill_snapshot as { total?: number } | null;
  const bill =
    ticket.order.status !== "open" && snap && typeof snap === "object"
      ? snap
      : billFromOrder(
          ticket.items.map((i) => ({
            ...i,
            unit_price_dong: Number(i.unit_price_dong),
            qty: Number(i.qty),
            vat_rate: i.vat_rate == null ? null : Number(i.vat_rate),
          })),
          orderRates(ticket.order, Number(bundle?.settings?.cash_round_to ?? 0)),
          Number(ticket.order.discount_dong),
        );
  return json({ staff, tenant: bundle?.tenant, settings: bundle?.settings, ticket, bill });
});

export const POST = wrap(async (request: Request, ctx) => {
  const staff = await requireStaff(request, ["admin", "waiter"]);
  if (staff instanceof Response) return staff;
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const body = await readBody<PatchBody>(request);
  const bundle = await tenantBundle(staff.tenant_id);
  if (!bundle?.settings) return json({ error: "no_tenant" }, 400);
  const settings = bundle.settings;
  const features = settings.features;

  if (body.action === "open") {
    if (!body.tableId) return json({ error: "need_table" }, 400);
    const tables = await sql<{ id: string; tenant_id: string }>(
      `select id, tenant_id from dining_tables where id = $1 and tenant_id = $2`,
      [body.tableId, staff.tenant_id],
    );
    if (!tables[0]) return json({ error: "not_found" }, 404);
    const existing = await openOrderForTable(body.tableId, staff.tenant_id);
    if (existing) return json({ orderId: existing.order.id });
    const orderId = nid("ord");
    try {
      await sql(
        `insert into orders (id, tenant_id, table_id, status, guest_name, vat_rate, vat_included, service_rate)
         values ($1,$2,$3,'open',$4,$5,$6,$7)`,
        [
          orderId,
          staff.tenant_id,
          body.tableId,
          body.guestName || null,
          settings.vat_rate,
          settings.vat_included,
          settings.service_rate,
        ],
      );
    } catch {
      const race = await openOrderForTable(body.tableId, staff.tenant_id);
      if (race) return json({ orderId: race.order.id });
      throw new ApiError(409, "open_conflict");
    }
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

  if (body.action === "pay") {
    return withTx(async (q) => {
      const locked = await q<{ id: string; status: string; discount_dong: number; vat_rate: number; vat_included: boolean; service_rate: number; table_id: string }>(
        `select id, status, discount_dong, vat_rate, vat_included, service_rate, table_id from orders where id = $1 and tenant_id = $2 for update`,
        [id, staff.tenant_id],
      );
      const order = locked[0];
      if (!order) throw new ApiError(404, "not_found");
      if (order.status !== "open") throw new ApiError(409, "not_open");
      const items = await q<OrderItem>(
        `select * from order_items where order_id = $1`,
        [id],
      );
      const bill = billFromOrder(
        items.map((i) => ({
          ...i,
          unit_price_dong: Number(i.unit_price_dong),
          qty: Number(i.qty),
          vat_rate: i.vat_rate == null ? null : Number(i.vat_rate),
        })),
        orderRates(order, Number(settings.cash_round_to ?? 0)),
        Number(order.discount_dong),
      );
      const method = body.method || "cash";
      const amount = bill.total;
      const rounding = method === "cash" ? bill.rounding : 0;
      const key = body.idempotencyKey || `pay:${id}`;
      const dup = await q<{ id: string }>(`select id from payments where order_id = $1 limit 1`, [id]);
      if (dup[0]) throw new ApiError(409, "already_paid");
      await q(
        `insert into payments (id, order_id, method, amount_dong, received_dong, rounding_dong, staff_id, idempotency_key)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [nid("pay"), id, method, amount, body.received ?? amount, rounding, staff.id, key],
      );
      await q(
        `update orders set status = 'paid', closed_at = now(), bill_snapshot = $2::jsonb where id = $1`,
        [id, JSON.stringify({ ...bill, method, staff_id: staff.id, paid_at: new Date().toISOString() })],
      );
      await writeAudit(q, {
        tenantId: staff.tenant_id,
        staffId: staff.id,
        action: "pay",
        entity: "order",
        entityId: id,
        after: { amount, method },
      });
      return json({ ok: true, paid: amount, rounding });
    });
  }

  if (ticket.order.status !== "open") return json({ error: "closed" }, 409);

  if (body.action === "discount") {
    const amount = Math.max(0, Math.floor(Number(body.amount) || 0));
    if (amount > 50_000 && staff.role !== "admin") return json({ error: "need_admin" }, 403);
    await sql(`update orders set discount_dong = $1 where id = $2 and tenant_id = $3 and status = 'open'`, [
      amount,
      id,
      staff.tenant_id,
    ]);
  }

  if (body.action === "served" && body.itemId) {
    await sql(
      `update order_items set kitchen_status = 'served' where id = $1 and order_id = $2 and kitchen_status = 'done'`,
      [body.itemId, id],
    );
  }

  if (body.action === "add" && body.items?.length) {
    await withTx(async (q) => {
      for (const line of body.items!) {
        const qty = clampQty(line.qty);
        if (qty == null) throw new ApiError(400, "bad_qty");
        const units = await q<{
          id: string;
          item_id: string;
          name: string;
          price_dong: number;
          item_name: string;
          active: boolean;
          sold_out: boolean;
          stock_left: number | null;
          tax_category: string;
        }>(
          `select u.id, u.item_id, u.name, u.price_dong, i.name as item_name, i.active, i.sold_out, i.stock_left, i.tax_category
           from item_units u join items i on i.id = u.item_id
           where u.id = $1 and i.tenant_id = $2`,
          [line.unitId, staff.tenant_id],
        );
        const u = units[0];
        if (!u) throw new ApiError(404, "bad_item");
        if (!u.active || u.sold_out) throw new ApiError(409, "sold_out");
        if (u.stock_left != null && Number(u.stock_left) < qty) throw new ApiError(409, "sold_out");
        const vat = await rateForItem(q, staff.tenant_id, u.tax_category || "food", Number(ticket.order.vat_rate));
        await q(
          `insert into order_items (id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, original_price_dong, qty, note, kitchen_status, sent_at, vat_rate)
           values ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,'queued', now(), $10)`,
          [nid("oi"), id, u.item_id, u.id, u.item_name, u.name, u.price_dong, qty, line.note || null, vat],
        );
        if (u.stock_left != null) {
          await q(`update items set stock_left = stock_left - $1, sold_out = (stock_left - $1) <= 0 where id = $2 and tenant_id = $3`, [
            qty,
            u.item_id,
            staff.tenant_id,
          ]);
        }
      }
    });
  }

  if (body.action === "patch_item" && body.itemId) {
    const lines = ticket.items.filter((i) => i.id === body.itemId);
    const line = lines[0];
    if (!line) return json({ error: "not_found" }, 404);
    if (body.cancel) {
      if (line.kitchen_status === "done" || line.kitchen_status === "served") {
        if (staff.role !== "admin") return json({ error: "need_admin" }, 403);
      }
      await sql(
        `update order_items set kitchen_status = 'cancelled', cancel_reason = $3 where id = $1 and order_id = $2`,
        [body.itemId, id, (body.cancelReason || "staff").slice(0, 80)],
      );
      await pushNotice(sql, {
        tenantId: staff.tenant_id,
        kind: "cancel",
        tableId: ticket.order.table_id,
        orderId: id,
        itemId: body.itemId,
        message: `Hủy món ${line.name_snapshot}`,
      });
    } else {
      const fields: string[] = [];
      const params: unknown[] = [];
      const add = (clause: string, value: unknown) => {
        params.push(value);
        fields.push(clause.replace("?", `$${params.length}`));
      };
      if (body.qty != null) {
        const qty = Math.floor(Number(body.qty));
        if (!Number.isFinite(qty) || qty < 0 || qty > 99) throw new ApiError(400, "bad_qty");
        add("qty = ?", qty);
      }
      if (body.note != null) add("note = ?", String(body.note).slice(0, 255));
      if (body.rush != null) add("rush = ?", body.rush);
      if (body.complementary != null) {
        if (!featureOn(features, "complementary")) throw new ApiError(403, "disabled");
        add("complementary = ?", body.complementary);
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
    if (!featureOn(features, "transfer_table")) return json({ error: "disabled" }, 403);
    const destTable = await sql<{ id: string }>(
      `select id from dining_tables where id = $1 and tenant_id = $2`,
      [body.tableId, staff.tenant_id],
    );
    if (!destTable[0]) return json({ error: "not_found" }, 404);
    const dest = await openOrderForTable(body.tableId, staff.tenant_id);
    if (dest && dest.order.id !== id) {
      await withTx(async (q) => {
        await q(`update order_items set order_id = $1 where order_id = $2`, [dest.order.id, id]);
        await q(`update orders set status = 'merged', closed_at = now(), merged_into = $2 where id = $1`, [
          id,
          dest.order.id,
        ]);
      });
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
      await withTx(async (q) => {
        await q(`update order_items set order_id = $1 where order_id = $2`, [id, body.otherOrderId]);
        await q(`update orders set status = 'merged', closed_at = now(), merged_into = $2 where id = $1`, [
          body.otherOrderId,
          id,
        ]);
      });
    }
  }

  if (body.action === "split" && body.itemIds?.length) {
    if (!featureOn(features, "split_bill")) return json({ error: "disabled" }, 403);
    const newId = nid("ord");
    const tableId = body.tableId || ticket.order.table_id;
    const destTable = await sql<{ id: string }>(
      `select id from dining_tables where id = $1 and tenant_id = $2`,
      [tableId, staff.tenant_id],
    );
    if (!destTable[0]) return json({ error: "not_found" }, 404);
    await withTx(async (q) => {
      await q(
        `insert into orders (id, tenant_id, table_id, status, vat_rate, vat_included, service_rate)
         values ($1,$2,$3,'open',$4,$5,$6)`,
        [
          newId,
          staff.tenant_id,
          tableId,
          ticket.order.vat_rate,
          ticket.order.vat_included,
          ticket.order.service_rate,
        ],
      );
      for (const itemId of body.itemIds!) {
        const moved = await q<{ id: string }>(
          `update order_items set order_id = $1 where id = $2 and order_id = $3 returning id`,
          [newId, itemId, id],
        );
        if (!moved[0]) throw new ApiError(404, "not_found");
      }
    });
    return json({ orderId: newId, splitFrom: id });
  }

  if (body.action === "void") {
    await withTx(async (q) => {
      await q(`update orders set status = 'void', closed_at = now() where id = $1 and tenant_id = $2 and status = 'open'`, [
        id,
        staff.tenant_id,
      ]);
      await q(
        `update order_items set kitchen_status = 'cancelled' where order_id = $1 and kitchen_status in ('queued','preparing')`,
        [id],
      );
      await writeAudit(q, { tenantId: staff.tenant_id, staffId: staff.id, action: "void", entity: "order", entityId: id });
    });
  }

  const next = await loadTicket(id, staff.tenant_id);
  return json({ ok: true, ticket: next });
});
