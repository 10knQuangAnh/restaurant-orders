import { requireStaff } from "@/lib/auth";
import { json, readBody } from "@/lib/http";
import { sql } from "@/lib/db";
import { kitchenQueue, tenantBundle } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const staff = await requireStaff(request, ["admin", "kitchen"]);
  if (staff instanceof Response) return staff;
  const bundle = await tenantBundle(staff.tenant_id);
  const tickets = await kitchenQueue(staff.tenant_id);
  return json({ staff, tenant: bundle?.tenant, tickets });
}

export async function POST(request: Request) {
  const staff = await requireStaff(request, ["admin", "kitchen"]);
  if (staff instanceof Response) return staff;
  const body = await readBody<{ itemId?: string; op?: "start" | "done" | "86" }>(request);
  if (!body.itemId || !body.op) return json({ error: "bad_request" }, 400);

  const rows = await sql<{ id: string; item_id: string; tenant_id: string }>(
    `select oi.id, oi.item_id, o.tenant_id
     from order_items oi join orders o on o.id = oi.order_id
     where oi.id = $1`,
    [body.itemId],
  );
  const row = rows[0];
  if (!row || row.tenant_id !== staff.tenant_id) return json({ error: "not_found" }, 404);

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
  } else if (body.op === "86") {
    await sql(
      `update order_items set kitchen_status = '86', done_at = now() where id = $1`,
      [body.itemId],
    );
    await sql(`update items set sold_out = true where id = $1 and tenant_id = $2`, [
      row.item_id,
      staff.tenant_id,
    ]);
  }
  const tickets = await kitchenQueue(staff.tenant_id);
  return json({ ok: true, tickets });
}
