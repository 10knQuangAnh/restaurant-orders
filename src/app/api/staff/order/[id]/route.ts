import { requireStaff } from "@/lib/auth";
import { billFromOrder, clampQty } from "@/lib/billing";
import { sql, withTx, type QueryFn } from "@/lib/db";
import { ApiError, featureOn, json, readBody, wrap } from "@/lib/http";
import { nid } from "@/lib/ids";
import {
  clearTableSession,
  pushNotice,
  rateForItem,
  restoreItemStock,
  reserveItemStock,
  tenantBundle,
  writeAudit,
} from "@/lib/queries";
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

async function loadTicket(orderId: string, tenantId: string, q: QueryFn = sql) {
  const orders = await q<{
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
  const items = await q<OrderItem>(
    `select id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, qty, note,
            rush, complementary, kitchen_status, sent_at, started_at, done_at, created_at, vat_rate, original_price_dong
     from order_items where order_id = $1 order by created_at`,
    [orderId],
  );
  const payments = await q<{
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
  return json({
    staff,
    tenant: bundle?.tenant,
    settings: bundle?.settings,
    ticket,
    bill,
  });
});

export const POST = wrap(async (request: Request, ctx) => {
  const staff = await requireStaff(request, ["admin", "waiter"]);
  if (staff instanceof Response) return staff;
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const body = await readBody<PatchBody>(request);
  if (
    ![
      "open",
      "ack_call",
      "pay",
      "discount",
      "served",
      "add",
      "patch_item",
      "transfer",
      "merge",
      "split",
      "void",
    ].includes(body.action)
  )
    throw new ApiError(400, "bad_action");
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
    return withTx(async (q) => {
      await q(`select id from tenants where id = $1 for update`, [staff.tenant_id]);
      await q(`select id from dining_tables where id = $1 and tenant_id = $2 for update`, [
        body.tableId,
        staff.tenant_id,
      ]);
      const existing = await q<{ id: string }>(
        `select id from orders where table_id = $1 and tenant_id = $2 and status = 'open'`,
        [body.tableId, staff.tenant_id],
      );
      if (existing[0]) return json({ orderId: existing[0].id });
      const orderId = nid("ord");
      await q(
        `insert into orders (id, tenant_id, table_id, status, guest_name, vat_rate, vat_included, service_rate) values ($1,$2,$3,'open',$4,$5,$6,$7)`,
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
      return json({ orderId });
    });
  }

  if (body.action === "ack_call") {
    await sql(
      `update staff_calls set status = 'ack', ack_at = now()
       where id = $1 and tenant_id = $2`,
      [id, staff.tenant_id],
    );
    return json({ ok: true });
  }

  return withTx(async (q) => {
    await q(`select id from tenants where id = $1 for update`, [staff.tenant_id]);
    const locked = await q<{ id: string }>(`select id from orders where id = $1 and tenant_id = $2 for update`, [
      id,
      staff.tenant_id,
    ]);
    if (!locked[0]) throw new ApiError(404, "not_found");
    const ticket = await loadTicket(id, staff.tenant_id, q);
    if (!ticket) throw new ApiError(404, "not_found");
    if (ticket.order.status !== "open") throw new ApiError(409, "not_open");

    if (body.action === "pay") {
      if (body.method != null && !["cash", "transfer"].includes(body.method)) throw new ApiError(400, "bad_method");
      const method = body.method || "cash";
      const bill = billFromOrder(
        ticket.items.map((i) => ({
          ...i,
          qty: Number(i.qty),
          unit_price_dong: Number(i.unit_price_dong),
          vat_rate: i.vat_rate == null ? null : Number(i.vat_rate),
        })),
        orderRates(ticket.order, Number(settings.cash_round_to ?? 0)),
        Number(ticket.order.discount_dong),
      );
      const amount = method === "cash" ? bill.cashTotal : bill.total;
      const rounding = method === "cash" ? bill.rounding : 0;
      const received = body.received ?? amount;
      if (!Number.isSafeInteger(received) || received < amount) throw new ApiError(400, "insufficient_cash");
      const dup = await q(`select id from payments where order_id = $1`, [id]);
      if (dup.length) throw new ApiError(409, "already_paid");
      await q(
        `insert into payments (id, order_id, method, amount_dong, received_dong, rounding_dong, staff_id, idempotency_key)
        values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [nid("pay"), id, method, amount, received, rounding, staff.id, body.idempotencyKey || `pay:${id}`],
      );
      await q(`update orders set status = 'paid', closed_at = now(), bill_snapshot = $2::jsonb where id = $1`, [
        id,
        JSON.stringify({
          ...bill,
          total: amount,
          rounding,
          method,
          staff_id: staff.id,
          paid_at: new Date().toISOString(),
        }),
      ]);
      await clearTableSession(q, staff.tenant_id, ticket.order.table_id);
      await writeAudit(q, {
        tenantId: staff.tenant_id,
        staffId: staff.id,
        action: "pay",
        entity: "order",
        entityId: id,
        after: { amount, method },
      });
      return json({ ok: true, paid: amount, rounding, tableReset: true });
    }

    if (body.action === "discount") {
      if (!Number.isSafeInteger(body.amount) || body.amount! < 0) throw new ApiError(400, "bad_amount");
      if (body.amount! > 50_000 && staff.role !== "admin") throw new ApiError(403, "need_admin");
      await q(`update orders set discount_dong = $1 where id = $2`, [body.amount, id]);
    }

    if (body.action === "served") {
      const moved = await q(
        `update order_items set kitchen_status = 'served' where id = $1 and order_id = $2 and kitchen_status = 'done' returning id`,
        [body.itemId, id],
      );
      if (!moved.length) throw new ApiError(409, "bad_transition");
    }

    if (body.action === "add") {
      if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new ApiError(400, "empty");
      for (const line of [...body.items].sort((a, b) => String(a?.itemId).localeCompare(String(b?.itemId)))) {
        if (!line || typeof line !== "object" || (line.note != null && typeof line.note !== "string"))
          throw new ApiError(400, "bad_item");
        const qty = clampQty(line.qty);
        if (qty == null) throw new ApiError(400, "bad_qty");
        const units = await q<{
          id: string;
          item_id: string;
          name: string;
          price_dong: number;
          item_name: string;
          tax_category: string;
        }>(
          `select u.id, u.item_id, u.name, u.price_dong, i.name as item_name, i.tax_category from item_units u join items i on i.id = u.item_id
           where u.id = $1 and i.id = $2 and i.tenant_id = $3`,
          [line.unitId, line.itemId, staff.tenant_id],
        );
        const u = units[0];
        if (!u) throw new ApiError(404, "bad_item");
        await reserveItemStock(q, staff.tenant_id, u.item_id, qty);
        const vat = await rateForItem(q, staff.tenant_id, u.tax_category || "food", Number(ticket.order.vat_rate));
        await q(
          `insert into order_items (id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, original_price_dong, qty, note, kitchen_status, sent_at, vat_rate)
          values ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,'queued',now(),$10)`,
          [
            nid("oi"),
            id,
            u.item_id,
            u.id,
            u.item_name,
            u.name,
            u.price_dong,
            qty,
            line.note?.slice(0, 255) || null,
            vat,
          ],
        );
      }
    }

    if (body.action === "patch_item") {
      const line = ticket.items.find((i) => i.id === body.itemId);
      if (!line) throw new ApiError(404, "not_found");
      if (["cancelled", "86"].includes(line.kitchen_status)) throw new ApiError(409, "already_closed");
      if (body.cancel) {
        const reason = String(body.cancelReason || "")
          .trim()
          .slice(0, 80);
        if (reason.length < 2) throw new ApiError(400, "need_reason");
        if (["done", "served"].includes(line.kitchen_status) && staff.role !== "admin")
          throw new ApiError(403, "need_admin");
        await q(
          `update order_items set kitchen_status = 'cancelled', cancel_reason = $3 where id = $1 and order_id = $2`,
          [line.id, id, reason],
        );
        await restoreItemStock(q, staff.tenant_id, line.item_id, Number(line.qty));
        await pushNotice(q, {
          tenantId: staff.tenant_id,
          kind: "cancel",
          tableId: ticket.order.table_id,
          orderId: id,
          itemId: line.id,
          message: `Hủy món ${line.name_snapshot} · ${reason}`,
        });
        await writeAudit(q, {
          tenantId: staff.tenant_id,
          staffId: staff.id,
          action: "cancel_line",
          entity: "order_item",
          entityId: line.id,
          after: { reason, kitchen_status: line.kitchen_status },
        });
      } else {
        const fields: string[] = [];
        const params: unknown[] = [];
        const add = (field: string, value: unknown) => {
          params.push(value);
          fields.push(`${field} = $${params.length}`);
        };
        if (body.qty != null) {
          const qty = clampQty(body.qty);
          if (qty == null) throw new ApiError(400, "bad_qty");
          const delta = qty - Number(line.qty);
          if (delta > 0) await reserveItemStock(q, staff.tenant_id, line.item_id, delta);
          if (delta < 0) await restoreItemStock(q, staff.tenant_id, line.item_id, -delta);
          add("qty", qty);
        }
        if (body.note != null) add("note", String(body.note).slice(0, 255));
        for (const field of ["rush", "complementary"] as const) {
          if (body[field] != null) {
            if (typeof body[field] !== "boolean") throw new ApiError(400, "bad_request");
            if (field === "complementary" && !featureOn(features, "complementary")) throw new ApiError(403, "disabled");
            add(field, body[field]);
          }
        }
        if (fields.length) {
          params.push(line.id, id);
          await q(
            `update order_items set ${fields.join(", ")} where id = $${params.length - 1} and order_id = $${params.length}`,
            params,
          );
        }
      }
    }

    if (body.action === "transfer" || body.action === "merge" || body.action === "split") {
      if (body.action === "transfer" && !featureOn(features, "transfer_table")) throw new ApiError(403, "disabled");
      if (body.action === "split" && !featureOn(features, "split_bill")) throw new ApiError(403, "disabled");
      if (body.action === "merge") {
        if (!body.otherOrderId || body.otherOrderId === id) throw new ApiError(400, "bad_order");
        const other = await q<{
          id: string;
          status: string;
          discount_dong: number;
        }>(`select id, status, discount_dong from orders where id = $1 and tenant_id = $2 for update`, [
          body.otherOrderId,
          staff.tenant_id,
        ]);
        if (!other[0]) throw new ApiError(404, "not_found");
        if (other[0].status !== "open") throw new ApiError(409, "not_open");
        await q(`update order_items set order_id = $1 where order_id = $2`, [id, other[0].id]);
        await q(`update orders set status = 'merged', closed_at = now(), merged_into = $2 where id = $1`, [
          other[0].id,
          id,
        ]);
        await q(`update orders set discount_dong = discount_dong + $1 where id = $2`, [other[0].discount_dong, id]);
      } else {
        if (!body.tableId) throw new ApiError(400, "need_table");
        const table = await q(`select id from dining_tables where id = $1 and tenant_id = $2`, [
          body.tableId,
          staff.tenant_id,
        ]);
        if (!table.length) throw new ApiError(404, "not_found");
        if (body.tableId === ticket.order.table_id) throw new ApiError(409, "same_table");
        const dest = await q<{ id: string; discount_dong: number }>(
          `select id, discount_dong from orders where table_id = $1 and tenant_id = $2 and status = 'open' for update`,
          [body.tableId, staff.tenant_id],
        );
        if (body.action === "split") {
          if (dest.length) throw new ApiError(409, "table_busy");
          if (!Array.isArray(body.itemIds) || !body.itemIds.length) throw new ApiError(400, "need_items");
          const ids = [...new Set(body.itemIds)];
          if (
            ids.some(
              (itemId) => !ticket.items.some((i) => i.id === itemId && !["cancelled", "86"].includes(i.kitchen_status)),
            )
          )
            throw new ApiError(404, "not_found");
          const newId = nid("ord");
          await q(
            `insert into orders (id, tenant_id, table_id, status, vat_rate, vat_included, service_rate) values ($1,$2,$3,'open',$4,$5,$6)`,
            [
              newId,
              staff.tenant_id,
              body.tableId,
              ticket.order.vat_rate,
              ticket.order.vat_included,
              ticket.order.service_rate,
            ],
          );
          for (const itemId of ids)
            await q(`update order_items set order_id = $1 where id = $2 and order_id = $3`, [newId, itemId, id]);
          return json({ orderId: newId, splitFrom: id });
        }
        if (dest[0]) {
          await q(`update order_items set order_id = $1 where order_id = $2`, [dest[0].id, id]);
          await q(`update orders set status = 'merged', closed_at = now(), merged_into = $2 where id = $1`, [
            id,
            dest[0].id,
          ]);
          await q(`update orders set discount_dong = discount_dong + $1 where id = $2`, [
            ticket.order.discount_dong,
            dest[0].id,
          ]);
          return json({ orderId: dest[0].id, merged: true });
        }
        await q(`update orders set table_id = $1 where id = $2`, [body.tableId, id]);
      }
    }

    if (body.action === "void") {
      await q(`update orders set status = 'void', closed_at = now() where id = $1`, [id]);
      const live = await q<{ item_id: string; qty: number }>(
        `update order_items set kitchen_status = 'cancelled', cancel_reason = coalesce(cancel_reason, 'void')
        where order_id = $1 and kitchen_status in ('queued','preparing') returning item_id, qty`,
        [id],
      );
      for (const row of live) await restoreItemStock(q, staff.tenant_id, row.item_id, Number(row.qty));
      await clearTableSession(q, staff.tenant_id, ticket.order.table_id);
      await writeAudit(q, {
        tenantId: staff.tenant_id,
        staffId: staff.id,
        action: "void",
        entity: "order",
        entityId: id,
      });
    }
    return json({ ok: true, ticket: await loadTicket(id, staff.tenant_id, q) });
  });
});
