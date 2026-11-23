"use client";

import { useState } from "react";

export default function Platform() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pin, setPin] = useState("1234");
  const [msg, setMsg] = useState("");

  return (
    <main className="admin">
      <header className="staff-top">
        <h1>Tạo tenant</h1>
      </header>
      <p className="muted" style={{ padding: "0 16px" }}>
        Chỉ admin quán demo (PIN 2580 / identity) tạo nhà hàng mới. Nền tảng không mang thương hiệu quán.
      </p>
      <section className="admin-card">
        <input placeholder="Tên quán" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <input placeholder="PIN admin" value={pin} onChange={(e) => setPin(e.target.value)} />
        <button
          className="cta"
          style={{ marginTop: 12 }}
          onClick={async () => {
            const res = await fetch("/api/staff/admin", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "add_tenant", name, slug, pin }),
            });
            const data = (await res.json()) as { ok?: boolean; slug?: string; error?: string };
            setMsg(data.ok ? `Đã tạo ${data.slug}` : data.error || "Không tạo được");
          }}
        >
          Tạo nhà hàng
        </button>
        {msg && <p>{msg}</p>}
      </section>
    </main>
  );
}
