"use client";

import { StaffNav } from "@/components/staff/Nav";
import { useEffect, useState } from "react";

type Person = { id: string; name: string; role: string; identity_email: string | null; active: boolean };

export default function AdminStaff() {
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState({ name: "", pin: "", role: "waiter" });
  const [msg, setMsg] = useState("");

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
        <input placeholder="PIN mới (4–8 số)" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="admin">Admin</option>
          <option value="waiter">Nhân viên bàn</option>
          <option value="kitchen">Bếp</option>
        </select>
        <button
          className="cta"
          style={{ marginTop: 10 }}
          onClick={async () => {
            const res = await fetch("/api/staff/admin", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "add_staff", ...form }),
            });
            const data = (await res.json()) as { error?: string };
            setMsg(data.error === "pin_taken" ? "PIN đã dùng trong quán" : res.ok ? "Đã thêm" : "Không thêm được");
            setForm({ name: "", pin: "", role: "waiter" });
            await load();
          }}
        >
          Lưu
        </button>
        {msg && <p className="muted">{msg}</p>}
      </section>
      {people.map((p) => (
        <div className="admin-card" key={p.id}>
          <div className="row-between">
            <div>
              <strong>{p.name}</strong>
              <div className="muted">{p.role}{p.active ? "" : " · nghỉ"}</div>
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
          <button
            className="linkish"
            onClick={async () => {
              const pin = prompt("PIN mới (4–8 số)");
              if (!pin) return;
              const res = await fetch("/api/staff/admin", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "reset_pin", id: p.id, pin }),
              });
              setMsg(res.ok ? `Đã reset PIN ${p.name}` : "Không reset được");
            }}
          >
            Đặt lại PIN
          </button>
        </div>
      ))}
      <StaffNav role="admin" />
    </main>
  );
}
