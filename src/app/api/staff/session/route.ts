import { loginWithPin, logoutHeaders, requireStaff, sessionFromRequest, withSessionHeaders } from "@/lib/auth";
import { json, readBody } from "@/lib/http";
import { tenantBundle } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const staff = await sessionFromRequest(request);
  if (!staff) return json({ staff: null }, 200);
  const bundle = await tenantBundle(staff.tenant_id);
  return json({ staff, tenant: bundle?.tenant, settings: bundle?.settings });
}

export async function POST(request: Request) {
  const body = await readBody<{ pin?: string }>(request);
  const result = await loginWithPin(body.pin || "");
  if (!result) return json({ error: "sai_pin" }, 401);
  const bundle = await tenantBundle(result.staff.tenant_id);
  return json(
    { staff: result.staff, tenant: bundle?.tenant, settings: bundle?.settings },
    200,
    withSessionHeaders(result.token),
  );
}

export async function DELETE() {
  return json({ ok: true }, 200, logoutHeaders());
}

export async function PUT(request: Request) {
  const staff = await requireStaff(request);
  if (staff instanceof Response) return staff;
  const bundle = await tenantBundle(staff.tenant_id);
  return json({ staff, tenant: bundle?.tenant, settings: bundle?.settings });
}
