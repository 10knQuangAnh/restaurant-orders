import { requireStaff } from "@/lib/auth";
import { ApiError, json, readBody, wrap } from "@/lib/http";
import { sql, withTx } from "@/lib/db";
import { loadMenu } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = wrap(async (request: Request) => {
  const staff = await requireStaff(request, ["admin", "waiter", "kitchen"]);
  if (staff instanceof Response) return staff;
  const menu = await loadMenu(staff.tenant_id, {
    includeInactive: staff.role === "admin",
  });
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
  for (const key of ["stock_left", "daily_limit", "price_dong"] as const) {
    if (
      body[key] != null &&
      (typeof body[key] === "boolean" ||
        !Number.isSafeInteger(Number(body[key])) ||
        Number(body[key]) < 0 ||
        Number(body[key]) > 2_000_000_000)
    )
      throw new ApiError(400, "bad_number");
  }
  if (!body.itemId) return json({ error: "need_item" }, 400);

  await withTx(async (q) => {
    const owned = await q<{ id: string }>(`select id from items where id = $1 and tenant_id = $2`, [
      body.itemId,
      staff.tenant_id,
    ]);
    if (!owned[0]) throw new ApiError(404, "not_found");

    if (typeof body.sold_out === "boolean") {
      await q(`update items set sold_out = $1 where id = $2 and tenant_id = $3`, [
        body.sold_out,
        body.itemId,
        staff.tenant_id,
      ]);
    }
    if (body.stock_left !== undefined) {
      const n = body.stock_left == null ? null : Math.max(0, Math.floor(Number(body.stock_left)));
      await q(`update items set stock_left = $1, sold_out = coalesce($1, 1) = 0 where id = $2 and tenant_id = $3`, [
        n,
        body.itemId,
        staff.tenant_id,
      ]);
    }
    if (body.daily_limit !== undefined && staff.role === "admin") {
      const n = body.daily_limit == null ? null : Math.max(0, Math.floor(Number(body.daily_limit)));
      await q(
        `update items set daily_limit = $1, stock_left = coalesce($1, stock_left), sold_out = case when $1::int is null then sold_out else $1 = 0 end where id = $2 and tenant_id = $3`,
        [n, body.itemId, staff.tenant_id],
      );
    }
    if (typeof body.active === "boolean" && staff.role !== "waiter") {
      await q(`update items set active = $1 where id = $2 and tenant_id = $3`, [
        body.active,
        body.itemId,
        staff.tenant_id,
      ]);
    }
    if (body.name && staff.role === "admin") {
      await q(`update items set name = $1 where id = $2 and tenant_id = $3`, [
        String(body.name).slice(0, 120),
        body.itemId,
        staff.tenant_id,
      ]);
    }
    if (body.price_dong != null && staff.role === "admin") {
      const price = Math.max(0, Math.floor(Number(body.price_dong)));
      await q(`update item_units set price_dong = $1 where item_id = $2 and is_default = true`, [price, body.itemId]);
    }
  });
  const menu = await loadMenu(staff.tenant_id, { includeInactive: true });
  return json({ ok: true, items: menu.items });
});
