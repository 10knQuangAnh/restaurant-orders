import { requireStaff } from "@/lib/auth";
import { json, readBody, wrap } from "@/lib/http";
import { sql } from "@/lib/db";
import { loadMenu } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = wrap(async (request: Request) => {
  const staff = await requireStaff(request, ["admin", "waiter", "kitchen"]);
  if (staff instanceof Response) return staff;
  const menu = await loadMenu(staff.tenant_id, { includeInactive: staff.role === "admin" });
  return json({ staff, ...menu });
});

export const POST = wrap(async (request: Request) => {
  const staff = await requireStaff(request, ["admin", "waiter", "kitchen"]);
  if (staff instanceof Response) return staff;
  const body = await readBody<{
    itemId?: string;
    sold_out?: boolean;
    stock_left?: number | null;
    daily_limit?: number | null;
    active?: boolean;
    name?: string;
    price_dong?: number;
  }>(request);
  if (!body.itemId) return json({ error: "need_item" }, 400);

  const owned = await sql<{ id: string }>(`select id from items where id = $1 and tenant_id = $2`, [
    body.itemId,
    staff.tenant_id,
  ]);
  if (!owned[0]) return json({ error: "not_found" }, 404);

  if (typeof body.sold_out === "boolean") {
    await sql(`update items set sold_out = $1 where id = $2 and tenant_id = $3`, [
      body.sold_out,
      body.itemId,
      staff.tenant_id,
    ]);
  }
  if (body.stock_left !== undefined) {
    const n = body.stock_left == null ? null : Math.max(0, Math.floor(Number(body.stock_left)));
    await sql(
      `update items set stock_left = $1, sold_out = coalesce($1, 1) = 0 where id = $2 and tenant_id = $3`,
      [n, body.itemId, staff.tenant_id],
    );
  }
  if (body.daily_limit !== undefined && staff.role === "admin") {
    const n = body.daily_limit == null ? null : Math.max(0, Math.floor(Number(body.daily_limit)));
    await sql(`update items set daily_limit = $1, stock_left = coalesce($1, stock_left) where id = $2 and tenant_id = $3`, [
      n,
      body.itemId,
      staff.tenant_id,
    ]);
  }
  if (typeof body.active === "boolean" && staff.role !== "waiter") {
    await sql(`update items set active = $1 where id = $2 and tenant_id = $3`, [
      body.active,
      body.itemId,
      staff.tenant_id,
    ]);
  }
  if (body.name && staff.role === "admin") {
    await sql(`update items set name = $1 where id = $2 and tenant_id = $3`, [
      String(body.name).slice(0, 120),
      body.itemId,
      staff.tenant_id,
    ]);
  }
  if (body.price_dong != null && staff.role === "admin") {
    const price = Math.max(0, Math.floor(Number(body.price_dong)));
    await sql(`update item_units set price_dong = $1 where item_id = $2 and is_default = true`, [
      price,
      body.itemId,
    ]);
  }
  const menu = await loadMenu(staff.tenant_id, { includeInactive: true });
  return json({ ok: true, items: menu.items });
});
