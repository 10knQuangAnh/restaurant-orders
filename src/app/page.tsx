"use client";

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState("");
  const [venue, setVenue] = useState<{ name: string; guestPath: string | null; staffPath: string } | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch(`/api/public/venue?slug=${encodeURIComponent(slug.trim().toLowerCase())}`);
    if (!res.ok) {
      setVenue(null);
      setErr("Không tìm thấy quán");
      return;
    }
    setVenue((await res.json()) as { name: string; guestPath: string | null; staffPath: string });
  }

  return (
    <main className="home">
      <div className="home-card">
        <p className="muted" style={{ color: "#8a7468", letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 12 }}>
          Gọi món tại bàn
        </p>
        <h1>Nhập mã quán</h1>
        <p>Khách quét QR trên bàn. Nhân viên vào ca bằng mã quán, chọn tên, rồi PIN.</p>
        <form onSubmit={(e) => void lookup(e)} style={{ display: "grid", gap: 10, marginTop: 18 }}>
          <input
            className="field"
            placeholder="vd. quan-tu-do"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button className="btn" type="submit">
            Tìm quán
          </button>
        </form>
        {err && <p className="err">{err}</p>}
        {venue && (
          <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
            <strong>{venue.name}</strong>
            {venue.guestPath && (
              <Link className="btn" href={venue.guestPath}>
                Xem menu bàn mẫu
              </Link>
            )}
            <Link className="btn ghost" href={venue.staffPath}>
              Nhân viên · Vào ca
            </Link>
          </div>
        )}
        {!venue && (
          <p style={{ marginTop: 18 }}>
            <Link className="btn ghost" href="/staff">
              Nhân viên · Vào ca
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
