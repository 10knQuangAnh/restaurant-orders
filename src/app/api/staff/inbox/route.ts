import { requireStaff } from "@/lib/auth";
import { json, readBody, wrap } from "@/lib/http";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = wrap(async (request: Request) => {
  const staff = await requireStaff(request);
  if (staff instanceof Response) return staff;
  const items = await sql<{
    id: string;
    kind: string;
    message: string;
    table_id: string | null;
    order_id: string | null;
    created_at: string;
    read_at: string | null;
  }>(
    `select id, kind, message, table_id, order_id, created_at, read_at
     from notifications
     where tenant_id = $1 and read_at is null
     order by created_at desc
     limit 40`,
    [staff.tenant_id],
  );
  return json({ items, unread: items.length });
});

export const POST = wrap(async (request: Request) => {
  const staff = await requireStaff(request);
  if (staff instanceof Response) return staff;
  const body = await readBody<{ id?: string; all?: boolean }>(request);
  if (body.all) {
    await sql(`update notifications set read_at = now() where tenant_id = $1 and read_at is null`, [
      staff.tenant_id,
    ]);
  } else if (body.id) {
    await sql(`update notifications set read_at = now() where id = $1 and tenant_id = $2`, [
      body.id,
      staff.tenant_id,
    ]);
  }
  return json({ ok: true });
});
