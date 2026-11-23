import { nid } from "@/lib/ids";
import { json, readBody } from "@/lib/http";
import { sql } from "@/lib/db";
import { loadMenu, openOrderForTable, tableByToken } from "@/lib/queries";

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

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const found = await tableByToken(token);
  if (!found) return json({ error: "not_found" }, 404);
  const menu = await loadMenu(found.tenant.id);
  const open = await openOrderForTable(found.table.id);
  return json({
    table: found.table,
    tenant: found.tenant,
    settings: found.settings,
    categories: menu.categories,
    items: menu.items,
    ordered: open?.items ?? [],
    orderId: open?.order.id ?? null,
  });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const found = await tableByToken(token);
  if (!found) return json({ error: "not_found" }, 404);
  const body = await readBody<OrderBody>(request);
  const action = body.action ?? "order";

  if (action === "call") {
    if (found.settings && found.settings.features.call_staff === false) {
      return json({ error: "disabled" }, 400);
    }
    await sql(
      `insert into staff_calls (id, tenant_id, table_id, reason, status) values ($1,$2,$3,$4,'open')`,
      [nid("call"), found.tenant.id, found.table.id, body.reason || "staff"],
    );
    return json({ ok: true });
  }

  if (action === "guest") {
    const open = await openOrderForTable(found.table.id);
    if (open) {
      await sql(`update orders set guest_name = $1, guest_phone = $2 where id = $3`, [
        body.guestName || null,
        body.guestPhone || null,
        open.order.id,
      ]);
    }
    return json({ ok: true });
  }

  const lines = (body.items ?? []).filter((l) => l.qty > 0);
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
    tenant_id: string;
  }>(
    `select u.id, u.item_id, u.name, u.price_dong, i.name as item_name, i.sold_out, i.tenant_id
     from item_units u join items i on i.id = u.item_id
     where u.id in (${placeholders})`,
    ids,
  );
  const unitMap = new Map(units.map((u) => [u.id, u]));
  for (const line of lines) {
    const u = unitMap.get(line.unitId);
    if (!u || u.tenant_id !== found.tenant.id) return json({ error: "bad_item" }, 400);
    if (u.sold_out) return json({ error: "sold_out", item: u.item_name }, 409);
  }

  let open = await openOrderForTable(found.table.id);
  const settings = found.settings;
  if (!open) {
    const orderId = nid("ord");
    await sql(
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
    open = await openOrderForTable(found.table.id);
  } else if (body.guestName || body.guestPhone || body.note) {
    await sql(
      `update orders set
         guest_name = coalesce(nullif($1::text, ''), guest_name),
         guest_phone = coalesce(nullif($2::text, ''), guest_phone),
         guest_note = coalesce(nullif($3::text, ''), guest_note)
       where id = $4`,
      [body.guestName || "", body.guestPhone || "", body.note || "", open.order.id],
    );
  }

  if (!open) return json({ error: "order_failed" }, 500);

  for (const line of lines) {
    const u = unitMap.get(line.unitId)!;
    await sql(
      `insert into order_items (
         id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, qty, note, kitchen_status, sent_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'queued', now())`,
      [
        nid("oi"),
        open.order.id,
        u.item_id,
        u.id,
        u.item_name,
        u.name,
        u.price_dong,
        Math.min(99, Math.max(1, Math.floor(line.qty))),
        line.note?.slice(0, 255) || null,
      ],
    );
  }

  const next = await openOrderForTable(found.table.id);
  return json({ ok: true, orderId: next?.order.id, items: next?.items ?? [] });
}
