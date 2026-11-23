"use client";

import { StaffNav } from "@/components/staff/Nav";
import { formatVnd } from "@/lib/money";
import type { Category, MenuItem, Tenant } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Form = {
  id?: string;
  name: string;
  name_en: string;
  description: string;
  category_id: string;
  price_dong: string;
  unit_name: string;
  image_url: string;
};

const emptyForm = (categoryId = ""): Form => ({
  name: "",
  name_en: "",
  description: "",
  category_id: categoryId,
  price_dong: "",
  unit_name: "Phần",
  image_url: "",
});

async function compressPhoto(file: File): Promise<{ mime: string; data: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("bad_image"));
      el.src = url;
    });
    const max = 720;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("bad_image");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    return { mime: "image/jpeg", data: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AdminMenu() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [catName, setCatName] = useState("");
  const [rename, setRename] = useState<Record<string, string>>({});
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});
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
    setForm((f) => ({ ...f, category_id: f.category_id || data.categories[0]?.id || "" }));
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
    const data = (await res.json()) as { error?: string; url?: string; itemId?: string };
    if (!res.ok) {
      setMsg(
        data.error === "need_move"
          ? "Chọn danh mục để chuyển món trước khi xóa."
          : data.error === "bad_image"
            ? "Ảnh không hợp lệ (JPEG/PNG, dưới 900KB)."
            : "Không lưu được.",
      );
      return data;
    }
    setMsg("");
    await load();
    return data;
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    const packed = await compressPhoto(file);
    const data = await post({ action: "upload_photo", mime: packed.mime, data: packed.data, itemId: form.id });
    if (data.url) setForm((f) => ({ ...f, image_url: data.url as string }));
  }

  const grouped = categories.map((c) => ({ cat: c, items: items.filter((i) => i.category_id === c.id) }));

  return (
    <main className="admin" style={{ paddingBottom: 90 }}>
      <header className="staff-top">
        <div>
          <div className="who">Thực đơn · {tenant?.name || ""}</div>
          <h1>Món & danh mục</h1>
        </div>
      </header>

      <section className="admin-card">
        <b>Danh mục</b>
        {categories.map((c) => (
          <div className="cat-edit" key={c.id}>
            <input
              value={rename[c.id] ?? c.name}
              onChange={(e) => setRename((r) => ({ ...r, [c.id]: e.target.value }))}
            />
            <button
              className="linkish"
              type="button"
              onClick={() => void post({ action: "save_category", id: c.id, name: rename[c.id] ?? c.name })}
            >
              Đổi tên
            </button>
            <select value={moveTo[c.id] || ""} onChange={(e) => setMoveTo((m) => ({ ...m, [c.id]: e.target.value }))}>
              <option value="">Chuyển món sang…</option>
              {categories.filter((x) => x.id !== c.id).map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
            <button
              className="linkish"
              type="button"
              onClick={() => {
                if (!confirm(`Xóa nhóm “${c.name}”? Món sẽ chuyển nếu bạn đã chọn nhóm khác.`)) return;
                void post({ action: "delete_category", id: c.id, moveTo: moveTo[c.id] });
              }}
            >
              Xóa
            </button>
          </div>
        ))}
        <div className="cat-edit" style={{ marginTop: 8 }}>
          <input placeholder="Tên nhóm mới" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <button
            className="cta"
            type="button"
            style={{ width: "auto", padding: "0 14px", height: 40 }}
            onClick={() => {
              if (!catName.trim()) return;
              void post({ action: "save_category", name: catName.trim() }).then(() => setCatName(""));
            }}
          >
            Thêm nhóm
          </button>
        </div>
      </section>

      <section className="admin-card">
        <b>{form.id ? "Sửa món" : "Thêm món"}</b>
        {form.image_url ? (
          <img className="admin-thumb" src={form.image_url} alt="" />
        ) : (
          <div className="admin-thumb placeholder">Ảnh</div>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void onPickPhoto(e.target.files?.[0])} />
        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input placeholder="Tên món" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Tên tiếng Anh (tuỳ chọn)" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        <textarea placeholder="Mô tả ngắn" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input placeholder="Giá (đ)" inputMode="numeric" value={form.price_dong} onChange={(e) => setForm({ ...form, price_dong: e.target.value })} />
        <input placeholder="Đơn vị" value={form.unit_name} onChange={(e) => setForm({ ...form, unit_name: e.target.value })} />
        <div className="kbtns" style={{ marginTop: 10 }}>
          <button
            className="cta"
            type="button"
            onClick={() =>
              void post({
                action: "save_item",
                id: form.id,
                name: form.name,
                name_en: form.name_en,
                description: form.description,
                category_id: form.category_id,
                price_dong: Number(form.price_dong),
                unit_name: form.unit_name,
                image_url: form.image_url || null,
              }).then((data) => {
                if (data && !data.error) setForm(emptyForm(form.category_id));
              })
            }
          >
            Lưu món
          </button>
          {form.id && (
            <button className="linkish" type="button" onClick={() => setForm(emptyForm(form.category_id))}>
              Hủy sửa
            </button>
          )}
        </div>
        {msg && <p className="muted">{msg}</p>}
      </section>

      {grouped.map((g) => (
        <section key={g.cat.id}>
          <h2 className="cat-title" style={{ padding: "0 16px" }}>{g.cat.name}</h2>
          {g.items.map((it) => (
            <div className="admin-card" key={it.id}>
              <div className="row-between" style={{ alignItems: "center", gap: 12 }}>
                {it.image_url ? <img className="admin-thumb" src={it.image_url} alt="" /> : <div className="admin-thumb placeholder" />}
                <div style={{ flex: 1 }}>
                  <strong>{it.name}</strong>
                  <div className="muted">{formatVnd(it.units[0]?.price_dong || 0)} · {it.units[0]?.name}</div>
                </div>
                <button
                  className="linkish"
                  type="button"
                  onClick={() =>
                    setForm({
                      id: it.id,
                      name: it.name,
                      name_en: it.name_en || "",
                      description: it.description || "",
                      category_id: it.category_id,
                      price_dong: String(it.units.find((u) => u.is_default)?.price_dong || it.units[0]?.price_dong || ""),
                      unit_name: it.units.find((u) => u.is_default)?.name || it.units[0]?.name || "Phần",
                      image_url: it.image_url || "",
                    })
                  }
                >
                  Sửa
                </button>
                <button className="linkish" type="button" onClick={() => void post({ action: "toggle_sold_out", itemId: it.id })}>
                  {it.sold_out ? "Mở bán" : "86"}
                </button>
              </div>
            </div>
          ))}
        </section>
      ))}
      <StaffNav role="admin" />
    </main>
  );
}
