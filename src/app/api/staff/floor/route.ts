import { requireStaff } from "@/lib/auth";
import { json, wrap } from "@/lib/http";
import { billFor, floorState, openOrderForTable, tenantBundle } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = wrap(async (request: Request) => {
  const staff = await requireStaff(request, ["admin", "waiter"]);
  if (staff instanceof Response) return staff;
  const bundle = await tenantBundle(staff.tenant_id);
  const floor = await floorState(staff.tenant_id);
  const cards = [];
  for (const table of floor.tables) {
    const open = floor.openOrders.find((o) => o.table_id === table.id);
    const call = floor.calls.find((c) => c.table_id === table.id);
    let total = 0;
    if (open) {
      const detail = await openOrderForTable(table.id, staff.tenant_id);
      if (detail) {
        total = billFor(
          detail.items,
          {
            vat_rate: detail.order.vat_rate,
            vat_included: detail.order.vat_included,
            service_rate: detail.order.service_rate,
            cash_round_to: Number(bundle?.settings?.cash_round_to ?? 0),
          },
          detail.order.discount_dong,
        ).total;
      }
    }
    cards.push({
      table,
      orderId: open?.id ?? null,
      guestName: open?.guest_name ?? null,
      itemCount: Number(open?.item_count ?? 0),
      queued: Number(open?.queued ?? 0),
      preparing: Number(open?.preparing ?? 0),
      ready: Number(open?.ready ?? 0),
      call: call ?? null,
      total,
      openedAt: open?.created_at ?? null,
    });
  }
  return json({ staff, tenant: bundle?.tenant, calls: floor.calls, tables: cards });
});
