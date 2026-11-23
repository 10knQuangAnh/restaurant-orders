"use client";

import { StaffNav } from "@/components/staff/Nav";
import { useEffect, useState } from "react";

type Settings = {
  vat_rate: number;
  vat_included: boolean;
  service_rate: number;
  cash_round_to: number;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  features: Record<string, boolean>;
};

const FLAGS = [
  ["guest_order", "Khách tự gọi"],
  ["call_staff", "Gọi nhân viên"],
  ["kitchen", "Bếp"],
  ["vat", "VAT"],
  ["service_charge", "Phí phục vụ"],
  ["split_bill", "Tách / gộp"],
  ["transfer_table", "Chuyển bàn"],
  ["complementary", "Món tặng"],
  ["takeaway", "Mang về"],
] as const;

export default function AdminSettings() {
  const [tenant, setTenant] = useState({ name: "", phone: "", address: "", primary_color: "#E85D04", accent_color: "#FFF1E6" });
  const [s, setS] = useState<Settings | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/staff/admin?section=settings", { cache: "no-store" });
      const data = (await res.json()) as { tenant: typeof tenant; settings: Settings };
      setTenant({
        name: data.tenant.name,
        phone: data.tenant.phone || "",
        address: data.tenant.address || "",
        primary_color: data.tenant.primary_color,
        accent_color: data.tenant.accent_color,
      });
      setS({
        ...data.settings,
        vat_rate: Number(data.settings.vat_rate),
        service_rate: Number(data.settings.service_rate),
        features: data.settings.features || {},
      });
    })();
  }, []);

  async function save() {
    if (!s) return;
    await fetch("/api/staff/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "branding", ...tenant }),
    });
    await fetch("/api/staff/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "settings",
        vat_rate: s.vat_rate,
        vat_included: s.vat_included,
        service_rate: s.service_rate,
        cash_round_to: s.cash_round_to,
        bank_name: s.bank_name,
        bank_account: s.bank_account,
        bank_holder: s.bank_holder,
        features: s.features,
      }),
    });
  }

  if (!s) return <main className="admin" style={{ padding: 24 }}>Đang tải…</main>;

  return (
    <main className="admin" style={{ paddingBottom: 90 }}>
      <header className="staff-top"><h1>Cấu hình</h1></header>
      <section className="admin-card">
        <b>Nhận diện quán</b>
        <input value={tenant.name} onChange={(e) => setTenant({ ...tenant, name: e.target.value })} />
        <input value={tenant.phone} onChange={(e) => setTenant({ ...tenant, phone: e.target.value })} />
        <input value={tenant.address} onChange={(e) => setTenant({ ...tenant, address: e.target.value })} />
        <label className="muted">Màu chính</label>
        <input type="color" value={tenant.primary_color} onChange={(e) => setTenant({ ...tenant, primary_color: e.target.value })} />
      </section>
      <section className="admin-card">
        <b>VAT & phí</b>
        <label className="muted">VAT (0.08 = 8%)</label>
        <input value={s.vat_rate} onChange={(e) => setS({ ...s, vat_rate: Number(e.target.value) })} />
        <div className="switch-row">
          <span>Giá menu đã gồm VAT</span>
          <input type="checkbox" checked={!!s.vat_included} onChange={(e) => setS({ ...s, vat_included: e.target.checked })} />
        </div>
        <label className="muted">Phí phục vụ</label>
        <input value={s.service_rate} onChange={(e) => setS({ ...s, service_rate: Number(e.target.value) })} />
        <label className="muted">Làm tròn tiền mặt</label>
        <input value={s.cash_round_to} onChange={(e) => setS({ ...s, cash_round_to: Number(e.target.value) })} />
      </section>
      <section className="admin-card">
        <b>Chuyển khoản</b>
        <input placeholder="Ngân hàng" value={s.bank_name || ""} onChange={(e) => setS({ ...s, bank_name: e.target.value })} />
        <input placeholder="Số TK" value={s.bank_account || ""} onChange={(e) => setS({ ...s, bank_account: e.target.value })} />
        <input placeholder="Chủ TK" value={s.bank_holder || ""} onChange={(e) => setS({ ...s, bank_holder: e.target.value })} />
      </section>
      <section className="admin-card">
        <b>Cờ chức năng</b>
        {FLAGS.map(([k, label]) => (
          <div className="switch-row" key={k}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={s.features[k] !== false}
              onChange={(e) => setS({ ...s, features: { ...s.features, [k]: e.target.checked } })}
            />
          </div>
        ))}
      </section>
      <div style={{ padding: "0 12px" }}>
        <button className="cta" onClick={() => void save()}>Lưu cấu hình</button>
      </div>
      <StaffNav role="admin" />
    </main>
  );
}
