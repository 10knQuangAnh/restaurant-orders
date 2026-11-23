import { json, readBody, wrap } from "@/lib/http";
import { applyTenantJson } from "@/lib/seedTenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function platformOk(request: Request): boolean {
  const secret = process.env.PLATFORM_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("x-platform-secret") === secret;
}

export const POST = wrap(async (request: Request) => {
  if (!platformOk(request)) return json({ error: "forbidden" }, 403);
  const body = await readBody<unknown>(request);
  try {
    const result = await applyTenantJson(body);
    return json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code || error.message) : "bad_json";
    const status = code === "slug_taken" || code === "pin_taken" ? 409 : 400;
    return json({ error: code }, status);
  }
});
