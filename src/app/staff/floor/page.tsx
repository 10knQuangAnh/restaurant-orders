"use client";

import { StaffNav } from "@/components/staff/Nav";
import { formatVnd } from "@/lib/money";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Card = {
  table: { id: string; code: string; name: string; zone: string | null; seats: number };
  orderId: string | null;
  guestName: string | null;
  itemCount: number;
  queued: number;
  preparing: number;
  call: { id: string; reason: string } | null;
  total: number;
  openedAt: string | null;
};

export default function FloorPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Card[]>([]);
  const [staff, setStaff] = useState<{ name: string; role: string } | null>(null);
  const [tenant, setTenant] = useState<{ name: string; primary_color?: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/staff/floor", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/staff");
      return;
    }
    if (res.status === 403) {
      router.replace("/staff/kitchen");
      return;
    }
    const data = (await res.json()) as { tables: Card[]; staff: { name: string; role: string }; tenant: { name: string } };
    setTables(data.tables);
    setStaff(data.staff);
    setTenant(data.tenant);
  }, [router]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  async function openTable(card: Card) {
    if (card.orderId) {
      router.push(`/staff/ticket/${card.orderId}`);
      return;
    }
    const res = await fetch("/api/staff/order/new", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "open", tableId: card.table.id }),
    });
    const data = (await res.json()) as { orderId?: string };
    if (data.orderId) router.push(`/staff/ticket/${data.orderId}`);
  }

  async function ack(id: string) {
    await fetch(`/api/staff/order/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "ack_call" }),
    });
    void load();
  }

  const calls = tables.filter((t) => t.call);

  return (
    <main className="staff-root">
      <header className="staff-top">
        <div>
          <div className="who">{tenant?.name} · {staff?.name}</div>
          <h1>Sàn bàn</h1>
        </div>
        <button
          className="linkish"
          onClick={async () => {
            await fetch("/api/staff/session", { method: "DELETE" });
            router.replace("/staff");
          }}
        >
          Kết ca
        </button>
      </header>
      {calls.map((c) => (
        <div className="call-banner" key={c.call!.id}>
          <span>
            {c.table.code} đang gọi nhân viên
          </span>
          <button className="linkish" style={{ color: "#fff" }} onClick={() => void ack(c.call!.id)}>
            Đã nhận
          </button>
        </div>
      ))}
      <section className="floor">
        {tables.map((c) => (
          <button
            key={c.table.id}
            className={`table-card ${c.call ? "call" : c.orderId ? "busy" : ""}`}
            onClick={() => void openTable(c)}
            style={{ textAlign: "left", width: "100%", color: "inherit" }}
          >
            <div className="code">{c.table.code}</div>
            <div>{c.table.name}</div>
            <div className="meta">
              {c.orderId ? (
                <>
                  <span className="busy-dot" />
                  {c.guestName || "Khách"} · {c.itemCount} món
                  {c.total ? ` · ${formatVnd(c.total)}` : ""}
                </>
              ) : (
                `${c.table.seats} chỗ · ${c.table.zone || "Trống"}`
              )}
            </div>
          </button>
        ))}
      </section>
      {staff && <StaffNav role={staff.role} />}
    </main>
  );
}
