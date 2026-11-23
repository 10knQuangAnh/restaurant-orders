import { loginWithPin, logoutSession, currentStaff } from "@/lib/auth";
import { json, readBody, wrap } from "@/lib/http";
import { tenantBundle } from "@/lib/queries";
import { clearSessionCookie, requestIsHttps, sessionCookie } from "@/lib/cookies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = wrap(async (request: Request) => {
  const staff = await currentStaff(request);
  if (!staff) return json({ staff: null }, 200);
  const bundle = await tenantBundle(staff.tenant_id);
  return json({ staff, tenant: bundle?.tenant, settings: bundle?.settings });
});

export const POST = wrap(async (request: Request) => {
  const body = await readBody<{ pin?: string; slug?: string; staffId?: string }>(request);
  const result = await loginWithPin({
    slug: body.slug || "",
    staffId: body.staffId || "",
    pin: body.pin || "",
  });
  if ("error" in result) return json({ error: result.error }, result.status);
  const bundle = await tenantBundle(result.staff.tenant_id);
  return json(
    { staff: result.staff, tenant: bundle?.tenant, settings: bundle?.settings },
    200,
    { "set-cookie": sessionCookie(result.token, requestIsHttps(request)) },
  );
});

export const DELETE = wrap(async (request: Request) => {
  await logoutSession(request);
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(requestIsHttps(request)) });
});
