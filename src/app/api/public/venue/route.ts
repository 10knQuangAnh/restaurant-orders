import { json, wrap } from "@/lib/http";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = wrap(async (request: Request) => {
  const slug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase() || "";
  if (!slug) return json({ error: "need_slug" }, 400);
  const rows = await sql<{
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
    primary_color: string;
    qr_token: string | null;
  }>(
    `select r.id, r.name, r.slug, r.tagline, r.primary_color,
            (select t.qr_token from dining_tables t where t.tenant_id = r.id order by t.sort_order limit 1) as qr_token
     from tenants r where r.slug = $1`,
    [slug],
  );
  const row = rows[0];
  if (!row) return json({ error: "unknown_tenant" }, 404);
  return json({
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    primary_color: row.primary_color,
    guestPath: row.qr_token ? `/t/${row.qr_token}` : null,
    staffPath: `/staff?slug=${encodeURIComponent(row.slug)}`,
  });
});
