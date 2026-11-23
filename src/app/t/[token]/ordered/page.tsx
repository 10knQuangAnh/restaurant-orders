"use client";

import { formatVnd } from "@/lib/money";
import type { OrderItem } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const label: Record<string, string> = {
  queued: "Chờ bếp",
  preparing: "Đang làm",
  done: "Đã xong",
  served: "Đã mang ra",
  "86": "Hết món",
  cancelled: "Đã hủy",
};

export default function OrderedPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [color, setColor] = useState("#E85D04");
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false;
    async function tick() {
      if (document.hidden) return;
      const res = await fetch(`/api/public/table/${token}`, { cache: "no-store" });
      if (!res.ok || stop) return;
      const data = (await res.json()) as { ordered: OrderItem[]; tenant: { primary_color: string } };
      setItems(data.ordered || []);
      setColor(data.tenant.primary_color);
      document.documentElement.style.setProperty("--primary", data.tenant.primary_color);
    }
    void tick();
    const t = setInterval(() => void tick(), 4000);
    const vis = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [token]);

  async function removeLine(id: string) {
    setBusy(id);
    setErr("");
    const res = await fetch(`/api/public/table/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "cancel_line", itemId: id }),
    });
    const data = (await res.json()) as { ordered?: OrderItem[]; error?: string };
    setBusy("");
    if (!res.ok) {
      setErr(data.error === "already_sent" ? "Bếp đã nhận món này, nhờ nhân viên hủy." : "Không gỡ được món.");
      return;
    }
    if (data.ordered) setItems(data.ordered);
  }

  return (
    <main className="guest-root">
      <div className="page-head">
        <button className="linkish" onClick={() => router.back()}>
          ‹
        </button>
        Món đã gọi
      </div>
      {items.filter((i) => i.kitchen_status !== "cancelled").length === 0 && (
        <p className="muted" style={{ padding: 24 }}>Chưa có món nào được gửi.</p>
      )}
      {err && <p style={{ color: "#dc2626", padding: "0 16px" }}>{err}</p>}
      <div className="list" style={{ paddingTop: 8 }}>
        {items.filter((i) => i.kitchen_status !== "cancelled").map((it) => (
          <article key={it.id} className="item-row" style={{ gridTemplateColumns: "1fr auto" }}>
            <div>
              <h3>
                {it.qty}× {it.name_snapshot}
              </h3>
              <div className="muted">{it.unit_snapshot}{it.note ? ` · ${it.note}` : ""}</div>
              <div className="price">{it.complementary ? "Tặng" : formatVnd(it.unit_price_dong * it.qty)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <strong style={{ color }}>{label[it.kitchen_status] || it.kitchen_status}</strong>
              {it.kitchen_status === "queued" && (
                <button
                  type="button"
                  className="linkish"
                  disabled={busy === it.id}
                  style={{ display: "block", marginLeft: "auto", marginTop: 6 }}
                  onClick={() => void removeLine(it.id)}
                >
                  Gỡ món
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
