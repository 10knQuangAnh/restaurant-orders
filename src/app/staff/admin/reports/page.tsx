"use client";

import { StaffNav } from "@/components/staff/Nav";
import { formatVnd } from "@/lib/money";
import { useCallback, useEffect, useState } from "react";

type Report = {
  today: { orders: number; revenue: number; cash: number; transfer: number };
  open: { n: number; value: number };
  top: { name_snapshot: string; qty: number }[];
  range?: { from: string; to: string; kind: string };
};

export default function Reports() {
  const [r, setR] = useState<Report | null>(null);
  const [kind, setKind] = useState("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    const q = new URLSearchParams({ range: kind });
    if (kind === "custom" && from) q.set("from", from);
    if (kind === "custom" && to) q.set("to", to);
    const res = await fetch(`/api/staff/admin?section=reports&${q}`, { cache: "no-store" });
    setR((await res.json()) as Report);
  }, [kind, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!r) return <main className="admin" style={{ padding: 24 }}>Đang tính…</main>;
  const span = r.range ? (r.range.from === r.range.to ? r.range.from : `${r.range.from} → ${r.range.to}`) : "";
  const aov = r.today.orders ? Math.round(Number(r.today.revenue) / r.today.orders) : 0;

  return (
    <main className="admin" style={{ paddingBottom: 90 }}>
      <header className="staff-top"><h1>Báo cáo</h1></header>
      <div className="report-tabs">
        {[
          ["day", "Hôm nay"],
          ["week", "Tuần này"],
          ["month", "Tháng này"],
          ["custom", "Chọn ngày"],
        ].map(([id, lab]) => (
          <button key={id} type="button" className={kind === id ? "on" : ""} onClick={() => setKind(id)}>
            {lab}
          </button>
        ))}
      </div>
      {kind === "custom" && (
        <section className="admin-card">
          <div className="row-between" style={{ gap: 8 }}>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </section>
      )}
      <section className="admin-card">
        <div className="muted" style={{ marginBottom: 8 }}>{span}</div>
        <div className="row-between"><span>Hóa đơn đã thu</span><strong>{r.today.orders}</strong></div>
        <div className="row-between"><span>Doanh thu</span><strong>{formatVnd(Number(r.today.revenue))}</strong></div>
        <div className="row-between muted"><span>Tiền mặt</span><span>{formatVnd(Number(r.today.cash))}</span></div>
        <div className="row-between muted"><span>Chuyển khoản</span><span>{formatVnd(Number(r.today.transfer))}</span></div>
        <div className="row-between muted"><span>TB / hóa đơn</span><span>{formatVnd(aov)}</span></div>
      </section>
      <section className="admin-card">
        <div className="row-between"><span>Bàn đang mở</span><strong>{r.open.n}</strong></div>
        <div className="row-between muted"><span>Giá trị đang mở</span><span>{formatVnd(Number(r.open.value))}</span></div>
      </section>
      <section className="admin-card">
        <b>Món chạy</b>
        {r.top.length === 0 && <p className="muted">Chưa có món trong khoảng này.</p>}
        {r.top.map((t) => (
          <div className="row-between" key={t.name_snapshot} style={{ padding: "8px 0" }}>
            <span>{t.name_snapshot}</span>
            <strong>{t.qty}</strong>
          </div>
        ))}
      </section>
      <StaffNav role="admin" />
    </main>
  );
}
