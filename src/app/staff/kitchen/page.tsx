"use client";

import { StaffNav } from "@/components/staff/Nav";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Ticket = {
  id: string;
  order_id: string;
  table_code: string;
  table_name: string;
  name_snapshot: string;
  unit_snapshot: string;
  qty: number;
  note: string | null;
  rush: boolean;
  kitchen_status: string;
  sent_at: string | null;
  created_at: string;
};

function ago(iso: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(0, Math.floor(ms / 60000));
  return `${m}p`;
}

export default function KitchenPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staff, setStaff] = useState<{ name: string; role: string } | null>(null);
  const [tenant, setTenant] = useState<{ name: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const res = await fetch("/api/staff/kitchen", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/staff");
      return;
    }
    if (res.status === 403) {
      router.replace("/staff/floor");
      return;
    }
    const data = (await res.json()) as { tickets: Ticket[]; staff: { name: string; role: string }; tenant: { name: string } };
    setTickets(data.tickets);
    setStaff(data.staff);
    setTenant(data.tenant);
  }, [router]);

  useEffect(() => {
    void load();
    const a = setInterval(() => void load(), 3000);
    const b = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [load]);

  async function op(itemId: string, action: "start" | "done" | "86") {
    const res = await fetch("/api/staff/kitchen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId, op: action }),
    });
    const data = (await res.json()) as { tickets?: Ticket[] };
    if (data.tickets) setTickets(data.tickets);
  }

  const groups = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const t of tickets) {
      const list = map.get(t.order_id) ?? [];
      list.push(t);
      map.set(t.order_id, list);
    }
    return [...map.values()];
  }, [tickets, now]);

  return (
    <main className="staff-root">
      <header className="staff-top">
        <div>
          <div className="who">{tenant?.name} · bếp · {staff?.name}</div>
          <h1>Hàng đợi</h1>
        </div>
        <span style={{ color: "#b9a396" }}>{tickets.length} món</span>
      </header>
      {groups.length === 0 && <p style={{ padding: 24, color: "#b9a396" }}>Bếp trống.</p>}
      {groups.map((lines) => {
        const first = lines[0];
        const start = first.sent_at || first.created_at;
        const mins = Math.floor((Date.now() - new Date(start).getTime()) / 60000);
        return (
          <article key={first.order_id} className={`ktix ${mins >= 12 ? "late" : ""}`}>
            <header>
              <div>
                <div className="t">
                  {first.table_code} · {first.table_name}
                </div>
              </div>
              <div className="ago">{ago(start)}</div>
            </header>
            {lines.map((ln) => (
              <div key={ln.id}>
                <div className="line">
                  <span>
                    {ln.rush ? "⚡ " : ""}
                    {ln.qty}× {ln.name_snapshot}
                    <div className="muted">
                      {ln.unit_snapshot}
                      {ln.note ? ` · ${ln.note}` : ""}
                      {ln.kitchen_status === "preparing" ? " · đang làm" : ""}
                    </div>
                  </span>
                </div>
                <div className="kbtns">
                  {ln.kitchen_status === "queued" && (
                    <button className="k-start" onClick={() => void op(ln.id, "start")}>
                      Làm
                    </button>
                  )}
                  <button className="k-done" onClick={() => void op(ln.id, "done")}>
                    Xong
                  </button>
                  <button className="k-86" onClick={() => void op(ln.id, "86")}>
                    86
                  </button>
                </div>
              </div>
            ))}
          </article>
        );
      })}
      {staff && <StaffNav role={staff.role} />}
    </main>
  );
}
