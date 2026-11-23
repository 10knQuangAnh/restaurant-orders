"use client";

import { StaffNav } from "@/components/staff/Nav";
import { formatVnd } from "@/lib/money";
import { useEffect, useState } from "react";

type Report = {
  today: { orders: number; revenue: number; cash: number; transfer: number };
  open: { n: number; value: number };
  top: { name_snapshot: string; qty: number }[];
};

export default function Reports() {
  const [r, setR] = useState<Report | null>(null);
  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/staff/admin?section=reports", { cache: "no-store" });
      setR((await res.json()) as Report);
    })();
  }, []);
  if (!r) return <main className="admin" style={{ padding: 24 }}>Đang tính…</main>;
  return (
    <main className="admin" style={{ paddingBottom: 90 }}>
      <header className="staff-top"><h1>Báo cáo</h1></header>
      <section className="admin-card">
        <div className="row-between"><span>Hóa đơn đã thu hôm nay</span><strong>{r.today.orders}</strong></div>
        <div className="row-between"><span>Doanh thu</span><strong>{formatVnd(Number(r.today.revenue))}</strong></div>
        <div className="row-between muted"><span>Tiền mặt</span><span>{formatVnd(Number(r.today.cash))}</span></div>
        <div className="row-between muted"><span>Chuyển khoản</span><span>{formatVnd(Number(r.today.transfer))}</span></div>
      </section>
      <section className="admin-card">
        <div className="row-between"><span>Bàn đang mở</span><strong>{r.open.n}</strong></div>
        <div className="row-between muted"><span>Giá trị đang mở</span><span>{formatVnd(Number(r.open.value))}</span></div>
      </section>
      <section className="admin-card">
        <b>Món chạy</b>
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
