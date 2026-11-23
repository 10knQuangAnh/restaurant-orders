import { requireStaff } from "@/lib/auth";
import { json, readBody, wrap } from "@/lib/http";
import { sql } from "@/lib/db";
import { kitchenQueue, pushNotice, tenantBundle } from "@/lib/queries";
import { canTransition, kitchenOpTarget } from "@/lib/kds";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = wrap(async (request: Request) => {
  const staff = await requireStaff(request, ["admin", "kitchen"]);
  if (staff instanceof Response) return staff;
  const bundle = await tenantBundle(staff.tenant_id);
  const tickets = await kitchenQueue(staff.tenant_id);
  return json({ staff, tenant: bundle?.tenant, tickets });
});

export const POST = wrap(async (request: Request) => {
  const body = await readBody<{ itemId?: string; op?: "start" | "done" | "86" | "served" }>(request);
  if (!body.itemId || !body.op) return json({ error: "bad_request" }, 400);

  const roles =
    body.op === "served" ? (["admin", "waiter", "kitchen"] as const) : (["admin", "kitchen"] as const);
  const staff = await requireStaff(request, [...roles]);
  if (staff instanceof Response) return staff;

  const rows = await sql<{
    id: string;
    item_id: string;
    tenant_id: string;
    kitchen_status: string;
    name_snapshot: string;
    order_id: string;
    table_id: string;
    order_status: string;
  }>(
    `select oi.id, oi.item_id, o.tenant_id, oi.kitchen_status, oi.name_snapshot, oi.order_id, o.table_id, o.status as order_status
     from order_items oi join orders o on o.id = oi.order_id
     where oi.id = $1`,
    [body.itemId],
  );
  const row = rows[0];
  if (!row || row.tenant_id !== staff.tenant_id) return json({ error: "not_found" }, 404);
  if (row.order_status !== "open") return json({ error: "closed" }, 409);

  const target = kitchenOpTarget(body.op);
  if (!canTransition(row.kitchen_status, target)) return json({ error: "bad_transition" }, 409);

  if (body.op === "start") {
    await sql(
      `update order_items set kitchen_status = 'preparing', started_at = coalesce(started_at, now()) where id = $1`,
      [body.itemId],
    );
  } else if (body.op === "done") {
    await sql(
      `update order_items set kitchen_status = 'done', done_at = now(), started_at = coalesce(started_at, now()) where id = $1`,
      [body.itemId],
    );
    await pushNotice(sql, {
      tenantId: staff.tenant_id,
      kind: "ready",
      tableId: row.table_id,
      orderId: row.order_id,
      itemId: row.id,
      message: `Món xong: ${row.name_snapshot}`,
    });
  } else if (body.op === "served") {
    await sql(`update order_items set kitchen_status = 'served' where id = $1`, [body.itemId]);
  } else if (body.op === "86") {
    await sql(`update order_items set kitchen_status = '86', done_at = now() where id = $1`, [body.itemId]);
    await sql(`update items set sold_out = true where id = $1 and tenant_id = $2`, [
      row.item_id,
      staff.tenant_id,
    ]);
    await pushNotice(sql, {
      tenantId: staff.tenant_id,
      kind: "86",
      tableId: row.table_id,
      orderId: row.order_id,
      itemId: row.id,
      message: `Hết món: ${row.name_snapshot}`,
    });
  }
  const tickets = await kitchenQueue(staff.tenant_id);
  return json({ ok: true, tickets });
});
