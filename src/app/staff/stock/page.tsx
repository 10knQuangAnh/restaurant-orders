"use client";

import { InboxBell } from "@/components/staff/InboxBell";
import { StaffNav } from "@/components/staff/Nav";
import { formatVnd } from "@/lib/money";
import type { Category, MenuItem } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function StockPage() {
  const router = useRouter();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staff, setStaff] = useState<{ name: string; role: string } | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/staff/stock", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/staff");
      return;
    }
    const data = (await res.json()) as { items: MenuItem[]; categories: Category[]; staff: { name: string; role: string } };
    setItems(data.items);
    setCategories(data.categories);
    setStaff(data.staff);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>) {
    await fetch("/api/staff/stock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  return (
    <main className="staff-root">
      <header className="staff-top">
        <div>
          <div className="who">{staff?.name} · tồn kho</div>
          <h1>Thực đơn / còn lại</h1>
        </div>
        <InboxBell />
      </header>
      {categories.map((cat) => (
        <section key={cat.id} style={{ padding: "0 16px 12px" }}>
          <h2 style={{ fontSize: 14, color: "#b9a396" }}>{cat.name}</h2>
          {items
            .filter((it) => it.category_id === cat.id)
            .map((it) => (
              <div className="ticket-line" key={it.id}>
                <div className="row-between">
                  <strong>
                    {it.name} {it.sold_out ? "· hết" : ""}
                  </strong>
                  <span>{formatVnd(it.units[0]?.price_dong || 0)}</span>
                </div>
                <div className="muted" style={{ color: "#b9a396" }}>
                  Còn: {it.stock_left == null ? "không giới hạn" : it.stock_left}
                  {it.daily_limit != null ? ` / hạn ${it.daily_limit}` : ""}
                </div>
                <div className="stock-actions">
                  <button
                    type="button"
                    className="k-quiet"
                    onClick={() => void post({ itemId: it.id, sold_out: !it.sold_out })}
                  >
                    {it.sold_out ? "Mở bán" : "Hết món"}
                  </button>
                  <input
                    className="field"
                    style={{ width: 72, height: 40, margin: 0, flex: "none" }}
                    inputMode="numeric"
                    placeholder="SL"
                    value={qty[it.id] ?? ""}
                    onChange={(e) => setQty((q) => ({ ...q, [it.id]: e.target.value }))}
                  />
                  <button
                    className="k-start"
                    type="button"
                    onClick={() => {
                      const n = qty[it.id] === "" ? null : Number(qty[it.id]);
                      void post({ itemId: it.id, stock_left: n });
                    }}
                  >
                    Lưu SL
                  </button>
                </div>
              </div>
            ))}
        </section>
      ))}
      {staff && <StaffNav role={staff.role} />}
    </main>
  );
}
