import { json, wrap } from "@/lib/http";
import { sql } from "@/lib/db";
import { applyDemoSeeds } from "@/lib/seedDemo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function platformOk(request: Request): boolean {
  const secret = process.env.PLATFORM_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("x-platform-secret") === secret;
}

export const POST = wrap(async (request: Request) => {
  if (!platformOk(request)) return json({ error: "forbidden" }, 403);
  const n = await sql<{ c: string }>(`select count(*)::text as c from tenants`);
  if (Number(n[0]?.c || 0) > 0) return json({ error: "already_seeded" }, 409);
  const result = await applyDemoSeeds();
  return json({ ok: true, ...result });
});
