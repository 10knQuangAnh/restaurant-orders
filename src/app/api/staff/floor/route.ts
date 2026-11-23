import { requireStaff } from "@/lib/auth";
import { json } from "@/lib/http";
import { billFor, floorState, openOrderForTable, tenantBundle } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const staff = await requireStaff(request, ["admin", "waiter"]);
  if (staff instanceof Response) return staff;
  const bundle = await tenantBundle(staff.tenant_id);
  const floor = await floorState(staff.tenant_id);
  const cards = [];
  for (const table of floor.tables) {
    const open = floor.openOrders.find((o) => o.table_id === table.id);
    const call = floor.calls.find((c) => c.table_id === table.id);
    let total = 0;
    if (open && bundle?.settings) {
      const detail = await openOrderForTable(table.id);
      if (detail) total = billFor(detail.items, bundle.settings, detail.order.discount_dong).total;
    }
    cards.push({
      table,
      orderId: open?.id ?? null,
      guestName: open?.guest_name ?? null,
      itemCount: Number(open?.item_count ?? 0),
      queued: Number(open?.queued ?? 0),
      preparing: Number(open?.preparing ?? 0),
      call: call ?? null,
      total,
      openedAt: open?.created_at ?? null,
    });
  }
  return json({ staff, tenant: bundle?.tenant, calls: floor.calls, tables: cards });
}
