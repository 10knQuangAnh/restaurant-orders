import { requireStaff } from "@/lib/auth";
import { json } from "@/lib/http";
import { loadMenu } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const staff = await requireStaff(request, ["admin", "waiter", "kitchen"]);
  if (staff instanceof Response) return staff;
  const menu = await loadMenu(staff.tenant_id);
  return json(menu);
}
