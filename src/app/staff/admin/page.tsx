"use client";

import { StaffNav } from "@/components/staff/Nav";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Overview = {
  staff: { name: string; role: string };
  tenant: { name: string; primary_color: string; phone?: string; address?: string };
  settings: { vat_rate: number; service_rate: number };
  counts: { tables: number; items: number; staff: number };
};

export default function AdminHome() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/staff/admin", { cache: "no-store" });
      if (res.status === 401) return router.replace("/staff");
      if (res.status === 403) return router.replace("/staff/floor");
      setData((await res.json()) as Overview);
    })();
  }, [router]);

  if (!data) {
    return <main className="admin" style={{ padding: 24 }}>Đang mở quản trị…</main>;
  }

  const links = [
    ["/staff/stock", "Kho", "Còn lại / hết món"],
    ["/staff/admin/menu", "Thực đơn", `${data.counts.items} món`],
    ["/staff/admin/categories", "Danh mục", "Nhóm món trên menu"],
    ["/staff/admin/tables", "Bàn & QR", `${data.counts.tables} bàn`],
    ["/staff/admin/staff", "Nhân viên", `${data.counts.staff} người`],
    ["/staff/admin/settings", "VAT / phí / cờ", `VAT ${Math.round(Number(data.settings.vat_rate) * 100)}%`],
    ["/staff/admin/reports", "Báo cáo ca", "Doanh thu · mix TT"],
  ] as const;

  return (
    <main className="admin">
      <header className="staff-top">
        <div>
          <div className="who">Quản trị · {data.staff.name}</div>
          <h1>{data.tenant.name}</h1>
        </div>
      </header>
      {links.map(([href, title, sub]) => (
        <Link key={href} href={href} className="admin-card" style={{ display: "block" }}>
          <div className="row-between">
            <strong>{title}</strong>
            <span>›</span>
          </div>
          <div className="muted">{sub}</div>
        </Link>
      ))}
      <p className="muted" style={{ padding: "0 16px 90px" }}>
        Màu chủ đạo tenant: {data.tenant.primary_color}. Nền tảng không lấy thương hiệu này.
      </p>
      <StaffNav role="admin" />
    </main>
  );
}
