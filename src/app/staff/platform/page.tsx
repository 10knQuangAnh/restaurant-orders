"use client";

import { useState } from "react";

export default function Platform() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pin, setPin] = useState("");
  const [secret, setSecret] = useState("");
  const [msg, setMsg] = useState("");

  return (
    <main className="admin">
      <header className="staff-top">
        <h1>Nền tảng</h1>
      </header>
      <p className="muted" style={{ padding: "0 16px" }}>
        Tạo quán mới cần khóa nền tảng (biến PLATFORM_SECRET). Admin một quán không tạo được tenant khác.
      </p>
      <section className="admin-card">
        <input placeholder="Khóa nền tảng" value={secret} onChange={(e) => setSecret(e.target.value)} />
        <input placeholder="Tên quán" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <input placeholder="PIN admin đầu tiên" value={pin} onChange={(e) => setPin(e.target.value)} />
        <button
          className="cta"
          style={{ marginTop: 12 }}
          onClick={async () => {
            const res = await fetch("/api/platform/tenants", {
              method: "POST",
              headers: { "content-type": "application/json", "x-platform-secret": secret },
              body: JSON.stringify({ name, slug, pin }),
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
