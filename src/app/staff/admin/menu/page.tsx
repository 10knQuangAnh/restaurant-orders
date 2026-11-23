"use client";

import { StaffNav } from "@/components/staff/Nav";
import { formatVnd } from "@/lib/money";
import type { Category, MenuItem } from "@/lib/types";
import { useEffect, useState } from "react";

export default function AdminMenu() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [form, setForm] = useState({ name: "", category_id: "", price_dong: "", unit_name: "Phần" });

  async function load() {
    const res = await fetch("/api/staff/admin?section=menu", { cache: "no-store" });
    const data = (await res.json()) as { categories: Category[]; items: MenuItem[] };
    setCategories(data.categories);
    setItems(data.items);
    if (!form.category_id && data.categories[0]) setForm((f) => ({ ...f, category_id: data.categories[0].id }));
  }

  useEffect(() => {
    void load();
  }, []);

  async function post(body: Record<string, unknown>) {
    await fetch("/api/staff/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  return (
    <main className="admin" style={{ paddingBottom: 90 }}>
      <header className="staff-top">
        <h1>Thực đơn</h1>
      </header>
      <section className="admin-card">
        <b>Thêm món</b>
        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input placeholder="Tên món" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Giá (đ)" inputMode="numeric" value={form.price_dong} onChange={(e) => setForm({ ...form, price_dong: e.target.value })} />
        <input placeholder="Đơn vị" value={form.unit_name} onChange={(e) => setForm({ ...form, unit_name: e.target.value })} />
        <button
          className="cta"
          style={{ marginTop: 10 }}
          onClick={() =>
            void post({
              action: "save_item",
              name: form.name,
              category_id: form.category_id,
              price_dong: Number(form.price_dong),
              unit_name: form.unit_name,
            }).then(() => setForm({ ...form, name: "", price_dong: "" }))
          }
        >
          Lưu món
        </button>
      </section>
      {items.map((it) => (
        <div className="admin-card" key={it.id}>
          <div className="row-between">
            <div>
              <strong>{it.name}</strong>
              <div className="muted">{formatVnd(it.units[0]?.price_dong || 0)}</div>
            </div>
            <button className="linkish" onClick={() => void post({ action: "toggle_sold_out", itemId: it.id })}>
              {it.sold_out ? "Mở bán" : "86 / hết"}
            </button>
          </div>
        </div>
      ))}
      <StaffNav role="admin" />
    </main>
  );
}
