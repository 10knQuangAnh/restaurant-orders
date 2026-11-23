"use client";

import { StaffNav } from "@/components/staff/Nav";
import { useEffect, useState } from "react";

type T = { id: string; code: string; name: string; zone: string | null; seats: number; link: string; qr: string };

function downloadPng(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export default function AdminTables() {
  const [tables, setTables] = useState<T[]>([]);
  const [form, setForm] = useState({ code: "", name: "", zone: "", seats: "4" });

  async function load() {
    const res = await fetch("/api/staff/admin?section=tables", { cache: "no-store" });
    const data = (await res.json()) as { tables: T[] };
    setTables(data.tables);
  }
  useEffect(() => {
    void load();
  }, []);

  async function downloadAll() {
    for (const t of tables) {
      downloadPng(t.qr, `QR-${t.code}.png`);
      await new Promise((r) => setTimeout(r, 180));
    }
  }

  return (
    <main className="admin" style={{ paddingBottom: 90 }}>
      <header className="staff-top">
        <h1>Bàn & QR</h1>
      </header>
      <section className="admin-card no-print">
        <b>Thêm bàn</b>
        <input placeholder="Mã (T11)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <input placeholder="Tên (SÂN VƯỜN)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Khu" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
        <input placeholder="Số ghế" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
        <button
          className="cta"
          style={{ marginTop: 10 }}
          onClick={async () => {
            await fetch("/api/staff/admin", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "add_table", ...form, seats: Number(form.seats) }),
            });
            setForm({ code: "", name: "", zone: "", seats: "4" });
            await load();
          }}
        >
          Tạo QR
        </button>
        <div className="kbtns" style={{ marginTop: 12 }}>
          <button className="k-start" type="button" onClick={() => void downloadAll()}>Tải tất cả PNG</button>
          <button className="k-start" type="button" onClick={() => window.print()}>In tờ QR</button>
        </div>
      </section>
      <div className="qr-grid">
        {tables.map((t) => (
          <article className="admin-card qr-card" key={t.id} style={{ textAlign: "center" }}>
            <div className="row-between">
              <strong>{t.code} · {t.name}</strong>
              <span className="muted">{t.seats} ghế</span>
            </div>
            <img src={t.qr} alt={`QR ${t.code}`} style={{ width: 180, margin: "12px auto" }} />
            <div className="muted">{t.link}</div>
            <button
              className="cta no-print"
              type="button"
              style={{ marginTop: 12, height: 40 }}
              onClick={() => downloadPng(t.qr, `QR-${t.code}.png`)}
            >
              Tải PNG
            </button>
          </article>
        ))}
      </div>
      <StaffNav role="admin" />
    </main>
  );
}
