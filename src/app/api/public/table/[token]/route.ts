import { nid } from "@/lib/ids";
import { ApiError, featureOn, json, readBody, wrap } from "@/lib/http";
import { sql, withTx } from "@/lib/db";
import { clampQty } from "@/lib/billing";
import {
  loadMenu,
  openOrderForTable,
  pushNotice,
  rateForItem,
  restoreItemStock,
  reserveItemStock,
  tableByToken,
} from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderBody = {
  action?: "order" | "call" | "guest" | "cancel_line";
  items?: { itemId: string; unitId: string; qty: number; note?: string }[];
  guestName?: string;
  guestPhone?: string;
  note?: string;
  reason?: string;
  itemId?: string;
};

export const GET = wrap(async (_request: Request, ctx) => {
  const { token } = await (ctx as { params: Promise<{ token: string }> }).params;
  const found = await tableByToken(token);
  if (!found) return json({ error: "not_found" }, 404);
  const menu = await loadMenu(found.tenant.id);
  const open = await openOrderForTable(found.table.id, found.tenant.id);
  return json({
    table: found.table,
    tenant: found.tenant,
    settings: found.settings,
    categories: menu.categories,
    items: menu.items,
    ordered: open?.items ?? [],
    orderId: open?.order.id ?? null,
  });
});

export const POST = wrap(async (request: Request, ctx) => {
  const { token } = await (ctx as { params: Promise<{ token: string }> }).params;
  const found = await tableByToken(token);
  if (!found) return json({ error: "not_found" }, 404);
  const body = await readBody<OrderBody>(request);
  const action = body.action ?? "order";
  if (!["order", "call", "guest", "cancel_line"].includes(action)) throw new ApiError(400, "bad_action");
  for (const key of ["guestName", "guestPhone", "note", "reason", "itemId"] as const) {
    if (body[key] != null && (typeof body[key] !== "string" || body[key]!.length > 255)) {
      throw new ApiError(400, "bad_request");
    }
  }

  if (action === "call") {
    if (found.settings && !featureOn(found.settings.features, "call_staff")) {
      return json({ error: "disabled" }, 400);
    }
    await withTx(async (q) => {
      await q(`select id from dining_tables where id = $1 and tenant_id = $2 for update`, [
        found.table.id,
        found.tenant.id,
      ]);
      const open = await q<{ id: string }>(
        `select id from staff_calls where table_id = $1 and tenant_id = $2 and status = 'open' limit 1`,
        [found.table.id, found.tenant.id],
      );
      if (open[0]) throw new ApiError(429, "rate_limited");
      await q(`insert into staff_calls (id, tenant_id, table_id, reason, status) values ($1,$2,$3,$4,'open')`, [
        nid("call"),
        found.tenant.id,
        found.table.id,
        String(body.reason || "staff").slice(0, 40),
      ]);
      await pushNotice(q, {
        tenantId: found.tenant.id,
        kind: "call",
        tableId: found.table.id,
        message: `${found.table.code} · ${String(body.reason || "Gọi NV").slice(0, 40)}`,
      });
    });
    return json({ ok: true });
  }

  if (action === "guest") {
    const open = await openOrderForTable(found.table.id, found.tenant.id);
    if (open) {
      await sql(
        `update orders set
           guest_name = case when guest_name is null or guest_name = '' then $1 else guest_name end,
           guest_phone = case when guest_phone is null or guest_phone = '' then $2 else guest_phone end
         where id = $3`,
        [body.guestName || null, body.guestPhone || null, open.order.id],
      );
    }
    return json({ ok: true });
  }

  if (action === "cancel_line") {
    const itemId = String(body.itemId || "");
    if (!itemId) return json({ error: "need_item" }, 400);
    const open = await openOrderForTable(found.table.id, found.tenant.id);
    if (!open) return json({ error: "not_found" }, 404);
    const line = open.items.find((i) => i.id === itemId);
    if (!line) return json({ error: "not_found" }, 404);
    if (line.kitchen_status !== "queued") return json({ error: "already_sent" }, 409);
    await withTx(async (q) => {
      await q(`select id from tenants where id = $1 for update`, [found.tenant.id]);
      const order = await q(`select id from orders where id = $1 and tenant_id = $2 and status = 'open' for update`, [
        open.order.id,
        found.tenant.id,
      ]);
      if (!order.length) throw new ApiError(409, "closed");
      const n = await q<{ id: string; item_id: string; qty: number }>(
        `update order_items set kitchen_status = 'cancelled', cancel_reason = 'guest'
         where id = $1 and order_id = $2 and kitchen_status = 'queued'
         returning id, item_id, qty`,
        [itemId, open.order.id],
      );
      if (!n[0]) throw new ApiError(409, "already_sent");
      await restoreItemStock(q, found.tenant.id, n[0].item_id, Number(n[0].qty));
      await pushNotice(q, {
        tenantId: found.tenant.id,
        kind: "cancel",
        tableId: found.table.id,
        orderId: open.order.id,
        itemId,
        message: `${found.table.code} gỡ món ${line.name_snapshot}`,
      });
    });
    const next = await openOrderForTable(found.table.id, found.tenant.id);
    return json({ ok: true, ordered: next?.items ?? [] });
  }

  if (found.settings && !featureOn(found.settings.features, "guest_order")) {
    return json({ error: "disabled" }, 403);
  }

  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new ApiError(400, "empty");
  const lines = [...body.items]
    .sort((a, b) => String(a?.itemId).localeCompare(String(b?.itemId)))
    .map((line) => {
      if (
        !line ||
        typeof line !== "object" ||
        typeof line.itemId !== "string" ||
        typeof line.unitId !== "string" ||
        (line.note != null && typeof line.note !== "string")
      )
        throw new ApiError(400, "bad_item");
      const qty = clampQty(line.qty);
      if (qty == null) throw new ApiError(400, "bad_qty");
      return { ...line, qty };
    });

  const ids = lines.map((l) => l.unitId);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
  const units = await sql<{
    id: string;
    item_id: string;
    name: string;
    price_dong: number;
    item_name: string;
    sold_out: boolean;
    active: boolean;
    stock_left: number | null;
    tax_category: string;
    tenant_id: string;
  }>(
    `select u.id, u.item_id, u.name, u.price_dong, i.name as item_name, i.sold_out, i.active, i.stock_left, i.tax_category, i.tenant_id
     from item_units u join items i on i.id = u.item_id
     where u.id in (${placeholders})`,
    ids,
  );
  const unitMap = new Map(units.map((u) => [u.id, u]));
  for (const line of lines) {
    const u = unitMap.get(line.unitId);
    if (!u || u.item_id !== line.itemId || u.tenant_id !== found.tenant.id) return json({ error: "bad_item" }, 400);
    if (!u.active) return json({ error: "inactive" }, 409);
    if (u.sold_out) return json({ error: "sold_out", item: u.item_name }, 409);
    if (u.stock_left != null && Number(u.stock_left) < line.qty)
      return json({ error: "sold_out", item: u.item_name }, 409);
  }

  const settings = found.settings;
  const result = await withTx(async (q) => {
    await q(`select id from tenants where id = $1 for update`, [found.tenant.id]);
    await q(`select id from dining_tables where id = $1 and tenant_id = $2 for update`, [
      found.table.id,
      found.tenant.id,
    ]);
    let open = await q<{ id: string; vat_rate: number }>(
      `select id, vat_rate from orders where table_id = $1 and tenant_id = $2 and status = 'open' for update`,
      [found.table.id, found.tenant.id],
    );
    let orderId = open[0]?.id;
    const fallbackVat = Number(open[0]?.vat_rate ?? settings?.vat_rate ?? 0);
    if (!orderId) {
      orderId = nid("ord");
      await q(
        `insert into orders (id, tenant_id, table_id, status, guest_name, guest_phone, guest_note, vat_rate, vat_included, service_rate)
           values ($1,$2,$3,'open',$4,$5,$6,$7,$8,$9)`,
        [
          orderId,
          found.tenant.id,
          found.table.id,
          body.guestName || null,
          body.guestPhone || null,
          body.note || null,
          settings?.vat_rate ?? 0,
          settings?.vat_included ?? true,
          settings?.service_rate ?? 0,
        ],
      );
    } else if (body.guestName || body.guestPhone || body.note) {
      await q(
        `update orders set
           guest_name = coalesce(nullif(guest_name, ''), nullif($1::text, '')),
           guest_phone = coalesce(nullif(guest_phone, ''), nullif($2::text, '')),
           guest_note = coalesce(nullif(guest_note, ''), nullif($3::text, ''))
         where id = $4`,
        [body.guestName || "", body.guestPhone || "", body.note || "", orderId],
      );
    }

    for (const line of lines) {
      const u = unitMap.get(line.unitId)!;
      await reserveItemStock(q, found.tenant.id, u.item_id, line.qty);
      const vat = await rateForItem(q, found.tenant.id, u.tax_category || "food", fallbackVat);
      await q(
        `insert into order_items (
           id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, original_price_dong, qty, note, kitchen_status, sent_at, vat_rate
         ) values ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,'queued', now(), $10)`,
        [
          nid("oi"),
          orderId,
          u.item_id,
          u.id,
          u.item_name,
          u.name,
          u.price_dong,
          line.qty,
          line.note?.slice(0, 255) || null,
          vat,
        ],
      );
    }
    await pushNotice(q, {
      tenantId: found.tenant.id,
      kind: "order",
      tableId: found.table.id,
      orderId,
      message: `${found.table.code} gọi món mới`,
    });
    return orderId;
  });

  const next = await openOrderForTable(found.table.id, found.tenant.id);
  return json({ ok: true, orderId: result, items: next?.items ?? [] });
});
