"use client";

import { addLine, readCart } from "@/lib/cart";
import { formatVnd } from "@/lib/money";
import type { ItemUnit, MenuItem, Tenant } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function ItemPage() {
  const { token, itemId } = useParams<{ token: string; itemId: string }>();
  const router = useRouter();
  const [item, setItem] = useState<MenuItem | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [unit, setUnit] = useState<ItemUnit | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/public/table/${token}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { tenant: Tenant; items: MenuItem[] };
      setTenant(data.tenant);
      document.documentElement.style.setProperty("--primary", data.tenant.primary_color);
      const found = data.items.find((i) => i.id === itemId) || null;
      setItem(found);
      setUnit(found?.units.find((u) => u.is_default) || found?.units[0] || null);
    })();
  }, [token, itemId]);

  const lineTotal = useMemo(() => (unit ? unit.price_dong * qty : 0), [unit, qty]);

  if (!item || !unit) {
    return (
      <main className="guest-root" style={{ padding: 24 }}>
        <p className="muted">Đang tải món…</p>
      </main>
    );
  }

  const current = item;
  const currentUnit = unit;

  function add() {
    addLine(token, {
      itemId: current.id,
      unitId: currentUnit.id,
      qty,
      note,
      name: current.name,
      unitName: currentUnit.name,
      price: currentUnit.price_dong,
      image: current.image_url,
    });
    readCart(token);
    router.push(`/t/${token}`);
  }

  return (
    <main className="guest-root" style={{ background: "#fff" }}>
      <div className="detail-hero">
        <img src={item.image_url || ""} alt={item.name} />
        <button className="close-x" onClick={() => router.back()}>
          ×
        </button>
      </div>
      <div className="detail-body">
        <div className="detail-title">
          <h1>{item.name}</h1>
          <div className="price" style={{ fontSize: 20, whiteSpace: "nowrap" }}>
            {formatVnd(unit.price_dong)}
          </div>
        </div>
        {item.description && <p className="muted">{item.description}</p>}
        <div className="section-label">Đơn vị tính</div>
        {item.units.map((u) => (
          <button key={u.id} className={`unit ${u.id === unit.id ? "on" : ""}`} onClick={() => setUnit(u)}>
            <span>
              {u.name}
              {u.price_dong !== unit.price_dong ? ` · ${formatVnd(u.price_dong)}` : ""}
            </span>
            <span className="radio">
              <i />
            </span>
          </button>
        ))}
        <div className="section-label">Thêm lưu ý cho quán</div>
        <textarea
          className="note"
          maxLength={225}
          placeholder="Cho quán biết thêm về yêu cầu của bạn"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="counter">{note.length}/225</div>
      </div>
      <div className="detail-dock">
        <div className="qty-row">
          <button className="round-btn" onClick={() => setQty((n) => Math.max(1, n - 1))}>
            −
          </button>
          <strong>{qty}</strong>
          <button className="round-btn" onClick={() => setQty((n) => Math.min(99, n + 1))}>
            +
          </button>
        </div>
        <button className="cta" disabled={item.sold_out} onClick={add}>
          {item.sold_out ? "Hết món" : `Thêm món • ${formatVnd(lineTotal)}`}
        </button>
      </div>
      <span className="hidden">{tenant?.name}</span>
    </main>
  );
}
