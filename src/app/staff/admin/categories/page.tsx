"use client";

import { StaffNav } from "@/components/staff/Nav";
import type { Category, MenuItem, Tenant } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminCategories() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [catName, setCatName] = useState("");
  const [rename, setRename] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Category | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch("/api/staff/admin?section=menu", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/staff");
      return;
    }
    const data = (await res.json()) as { categories: Category[]; items: MenuItem[]; tenant?: Tenant };
    setCategories(data.categories || []);
    setItems(data.items || []);
    setTenant(data.tenant || null);
    if (data.tenant?.primary_color) {
      document.documentElement.style.setProperty("--primary", data.tenant.primary_color);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/staff/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: string; id?: string };
    if (!res.ok) {
      setMsg(data.error === "need_move" ? "Nhóm còn món — chọn nhóm nhận rồi xóa." : "Không lưu được.");
      return data;
    }
    setMsg("");
    await load();
    return data;
  }

  function countOf(id: string) {
    return items.filter((i) => i.category_id === id).length;
  }

  async function remove(cat: Category) {
    const n = countOf(cat.id);
    if (n === 0) {
      if (!confirm(`Xóa nhóm “${cat.name}”?`)) return;
      await post({ action: "delete_category", id: cat.id });
      return;
    }
    setPending(cat);
    setMoveTo(categories.find((c) => c.id !== cat.id)?.id || "");
  }

  return (
    <main className="admin" style={{ paddingBottom: 90 }}>
      <header className="staff-top">
        <div>
          <div className="who">Quản trị · {tenant?.name || ""}</div>
          <h1>Danh mục</h1>
        </div>
        <Link className="linkish" href="/staff/admin/menu">
          Thực đơn ›
        </Link>
      </header>

      <section className="admin-card">
        <b>Thêm nhóm món</b>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Ví dụ: Cơm, Lẩu, Nước. Mỗi món thuộc một nhóm trên menu khách.
        </p>
        <div className="row-between" style={{ gap: 8, marginTop: 10, alignItems: "center" }}>
          <input
            placeholder="Tên nhóm"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            style={{ margin: 0 }}
          />
          <button
            className="cta"
            type="button"
            style={{ width: "auto", padding: "0 16px", height: 42, flex: "none" }}
            onClick={() => {
              if (!catName.trim()) return;
              void post({ action: "save_category", name: catName.trim() }).then(() => setCatName(""));
            }}
          >
            Thêm
          </button>
        </div>
      </section>

      {categories.map((c) => {
        const n = countOf(c.id);
        return (
          <article className="admin-card cat-card" key={c.id}>
            <div className="row-between" style={{ alignItems: "baseline", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{c.name}</h2>
              <span className="muted">{n} món</span>
            </div>
            <div className="cat-rename">
              <input
                value={rename[c.id] ?? c.name}
                onChange={(e) => setRename((r) => ({ ...r, [c.id]: e.target.value }))}
                aria-label={`Tên nhóm ${c.name}`}
              />
              <button
                className="k-start"
                type="button"
                onClick={() => void post({ action: "save_category", id: c.id, name: rename[c.id] ?? c.name })}
              >
                Đổi tên
              </button>
            </div>
            <button className="linkish" type="button" style={{ marginTop: 8 }} onClick={() => void remove(c)}>
              Xóa nhóm
            </button>
          </article>
        );
      })}
      {msg && <p className="muted" style={{ padding: "0 16px" }}>{msg}</p>}

      {pending && (
        <div className="modal-back" onClick={() => setPending(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: "left" }}>
            <h2>Xóa “{pending.name}”</h2>
            {categories.filter((x) => x.id !== pending.id).length === 0 ? (
              <p className="muted">Đây là nhóm cuối. Thêm nhóm khác rồi mới chuyển món và xóa được.</p>
            ) : (
              <>
                <p className="muted">
                  Nhóm này còn {countOf(pending.id)} món. Chọn nhóm nhận — món không được để trống nhóm.
                </p>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                  {categories
                    .filter((x) => x.id !== pending.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
                <button
                  className="cta"
                  style={{ marginTop: 14 }}
                  disabled={!moveTo}
                  onClick={() => {
                    const id = pending.id;
                    const dest = moveTo;
                    setPending(null);
                    void post({ action: "delete_category", id, moveTo: dest });
                  }}
                >
                  Chuyển món và xóa
                </button>
              </>
            )}
            <button className="linkish" type="button" style={{ marginTop: 10 }} onClick={() => setPending(null)}>
              Hủy
            </button>
          </div>
        </div>
      )}
      <StaffNav role="admin" />
    </main>
  );
}
