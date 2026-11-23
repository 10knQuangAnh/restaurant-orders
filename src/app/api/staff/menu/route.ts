import { requireStaff } from "@/lib/auth";
import { json, wrap } from "@/lib/http";
import { loadMenu } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = wrap(async (request: Request) => {
  const staff = await requireStaff(request, ["admin", "waiter", "kitchen"]);
  if (staff instanceof Response) return staff;
  const menu = await loadMenu(staff.tenant_id, { includeInactive: staff.role !== "waiter" });
  return json(menu);
});
