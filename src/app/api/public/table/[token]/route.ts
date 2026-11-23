import { nid } from "@/lib/ids";
import { ApiError, featureOn, json, readBody, wrap } from "@/lib/http";
import { sql, withTx } from "@/lib/db";
import { clampQty } from "@/lib/billing";
import { loadMenu, openOrderForTable, pushNotice, rateForItem, tableByToken } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OrderBody = {
  action?: "order" | "call" | "guest";
  items?: { itemId: string; unitId: string; qty: number; note?: string }[];
  guestName?: string;
  guestPhone?: string;
  note?: string;
  reason?: string;
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

  if (action === "call") {
    if (found.settings && !featureOn(found.settings.features, "call_staff")) {
      return json({ error: "disabled" }, 400);
    }
    const open = await sql<{ id: string }>(
      `select id from staff_calls where table_id = $1 and tenant_id = $2 and status = 'open' limit 1`,
      [found.table.id, found.tenant.id],
    );
    if (open[0]) return json({ error: "rate_limited" }, 429);
    await sql(
      `insert into staff_calls (id, tenant_id, table_id, reason, status) values ($1,$2,$3,$4,'open')`,
      [nid("call"), found.tenant.id, found.table.id, String(body.reason || "staff").slice(0, 40)],
    );
    await pushNotice(sql, {
      tenantId: found.tenant.id,
      kind: "call",
      tableId: found.table.id,
      message: `${found.table.code} gọi nhân viên`,
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

  if (found.settings && !featureOn(found.settings.features, "guest_order")) {
    return json({ error: "disabled" }, 403);
  }

  const lines = (body.items ?? [])
    .map((l) => ({ ...l, qty: clampQty(l.qty) }))
    .filter((l): l is { itemId: string; unitId: string; qty: number; note?: string } => l.qty != null);
  if (lines.length === 0) return json({ error: "empty" }, 400);

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
    if (!u || u.tenant_id !== found.tenant.id) return json({ error: "bad_item" }, 400);
    if (!u.active) return json({ error: "inactive" }, 409);
    if (u.sold_out) return json({ error: "sold_out", item: u.item_name }, 409);
    if (u.stock_left != null && Number(u.stock_left) < line.qty) return json({ error: "sold_out", item: u.item_name }, 409);
  }

  const settings = found.settings;
  const result = await withTx(async (q) => {
    let open = await q<{ id: string; vat_rate: number }>(
      `select id, vat_rate from orders where table_id = $1 and tenant_id = $2 and status = 'open' for update`,
      [found.table.id, found.tenant.id],
    );
    let orderId = open[0]?.id;
    const fallbackVat = Number(open[0]?.vat_rate ?? settings?.vat_rate ?? 0);
    if (!orderId) {
      orderId = nid("ord");
      try {
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
      } catch {
        const race = await q<{ id: string; vat_rate: number }>(
          `select id, vat_rate from orders where table_id = $1 and tenant_id = $2 and status = 'open'`,
          [found.table.id, found.tenant.id],
        );
        if (!race[0]) throw new ApiError(409, "open_conflict");
        orderId = race[0].id;
      }
    } else if (body.guestName || body.guestPhone || body.note) {
      await q(
        `update orders set
           guest_name = coalesce(nullif($1::text, ''), guest_name),
           guest_phone = coalesce(nullif($2::text, ''), guest_phone),
           guest_note = coalesce(nullif($3::text, ''), guest_note)
         where id = $4`,
        [body.guestName || "", body.guestPhone || "", body.note || "", orderId],
      );
    }

    for (const line of lines) {
      const u = unitMap.get(line.unitId)!;
      const vat = await rateForItem(q, found.tenant.id, u.tax_category || "food", fallbackVat);
      await q(
        `insert into order_items (
           id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, original_price_dong, qty, note, kitchen_status, sent_at, vat_rate
         ) values ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,'queued', now(), $10)`,
        [nid("oi"), orderId, u.item_id, u.id, u.item_name, u.name, u.price_dong, line.qty, line.note?.slice(0, 255) || null, vat],
      );
      if (u.stock_left != null) {
        await q(`update items set stock_left = stock_left - $1, sold_out = (stock_left - $1) <= 0 where id = $2`, [
          line.qty,
          u.item_id,
        ]);
      }
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
