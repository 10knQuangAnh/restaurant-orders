"use client";

import { StaffNav } from "@/components/staff/Nav";
import { useEffect, useState } from "react";

type Person = { id: string; name: string; role: string; pin: string; identity_email: string | null; active: boolean };

export default function AdminStaff() {
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState({ name: "", pin: "", role: "waiter", identity_email: "" });

  async function load() {
    const res = await fetch("/api/staff/admin?section=staff", { cache: "no-store" });
    setPeople(((await res.json()) as { people: Person[] }).people);
  }
  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="admin" style={{ paddingBottom: 90 }}>
      <header className="staff-top"><h1>Nhân viên</h1></header>
      <section className="admin-card">
        <b>Thêm ca</b>
        <input placeholder="Tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="PIN 4 số" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="admin">Admin</option>
          <option value="waiter">Nhân viên bàn</option>
          <option value="kitchen">Bếp</option>
        </select>
        <input placeholder="Email Cursor (tuỳ chọn)" value={form.identity_email} onChange={(e) => setForm({ ...form, identity_email: e.target.value })} />
        <button
          className="cta"
          style={{ marginTop: 10 }}
          onClick={async () => {
            await fetch("/api/staff/admin", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "add_staff", ...form }),
            });
            setForm({ name: "", pin: "", role: "waiter", identity_email: "" });
            await load();
          }}
        >
          Lưu
        </button>
      </section>
      {people.map((p) => (
        <div className="admin-card" key={p.id}>
          <div className="row-between">
            <div>
              <strong>{p.name}</strong>
              <div className="muted">{p.role} · PIN {p.pin}{p.identity_email ? ` · ${p.identity_email}` : ""}</div>
            </div>
            <button
              className="linkish"
              onClick={async () => {
                await fetch("/api/staff/admin", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "set_staff_active", id: p.id, active: !p.active }),
                });
                await load();
              }}
            >
              {p.active ? "Nghỉ" : "Mở"}
            </button>
          </div>
        </div>
      ))}
      <StaffNav role="admin" />
    </main>
  );
}
