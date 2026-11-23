import { json, readBody, wrap } from "@/lib/http";
import { sql, withTx } from "@/lib/db";
import { nid } from "@/lib/ids";
import { hashPin } from "@/lib/pin";
import { isHexColor } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function platformOk(request: Request): boolean {
  const secret = process.env.PLATFORM_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("x-platform-secret") === secret;
}

export const POST = wrap(async (request: Request) => {
  if (!platformOk(request)) return json({ error: "forbidden" }, 403);
  const body = await readBody<{
    name?: string;
    slug?: string;
    pin?: string;
    primary_color?: string;
    adminName?: string;
  }>(request);
  const slug = String(body.slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const pin = String(body.pin || "").replace(/\D/g, "");
  if (!slug || slug.length < 3) return json({ error: "bad_slug" }, 400);
  if (!/^\d{4,8}$/.test(pin)) return json({ error: "bad_pin" }, 400);
  const name = String(body.name || "")
    .trim()
    .slice(0, 80);
  if (!name) return json({ error: "need_name" }, 400);
  const color = body.primary_color && isHexColor(body.primary_color) ? body.primary_color : "#E85D04";
  const exists = await sql<{ id: string }>(`select id from tenants where slug = $1`, [slug]);
  if (exists[0]) return json({ error: "slug_taken" }, 409);
  const id = nid("tn");
  await withTx(async (q) => {
    await q(`insert into tenants (id, slug, name, primary_color, accent_color) values ($1,$2,$3,$4,$5)`, [
      id,
      slug,
      name,
      color,
      "#FFF1E6",
    ]);
    await q(`insert into tenant_settings (tenant_id, cash_round_to) values ($1, 0)`, [id]);
    await q(
      `insert into staff (id, tenant_id, name, pin, pin_hash, role, active) values ($1,$2,$3,$4,$5,'admin',true)`,
      [nid("st"), id, (body.adminName || "Chủ quán").slice(0, 80), pin, hashPin(pin)],
    );
    await q(
      `insert into tax_rates (id, tenant_id, code, rate, effective_from, effective_to) values
      ($1,$4,'food',0.08,'2025-07-01','2026-12-31'),
      ($2,$4,'food',0.10,'2027-01-01',null),
      ($3,$4,'alcohol',0.10,'2025-01-01',null)`,
      [nid("tax"), nid("tax"), nid("tax"), id],
    );
  });
  return json({ ok: true, tenantId: id, slug });
});
