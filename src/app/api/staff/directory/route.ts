import { json, wrap } from "@/lib/http";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = wrap(async (request: Request) => {
  const slug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase() || "";
  if (!slug) return json({ error: "need_slug" }, 400);
  const tenants = await sql<{ id: string; name: string; slug: string }>(
    `select id, name, slug from tenants where slug = $1`,
    [slug],
  );
  const tenant = tenants[0];
  if (!tenant) return json({ error: "unknown_tenant" }, 404);
  const people = await sql<{ id: string; name: string; role: string }>(
    `select id, name, role from staff where tenant_id = $1 and active = true order by role, name`,
    [tenant.id],
  );
  return json({ tenant, people });
});
