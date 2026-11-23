"use client";

import { cartCount, cartKey, cartTotal, guestKey, readCart, writeCart, type StoredLine } from "@/lib/cart";
import { formatVnd } from "@/lib/money";
import type { DiningTable, Tenant } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CartPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [lines, setLines] = useState<StoredLine[]>([]);
  const [table, setTable] = useState<DiningTable | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [guest, setGuest] = useState({ name: "", phone: "" });
  const [note, setNote] = useState("");
  const [guestOpen, setGuestOpen] = useState(false);
  const [ok, setOk] = useState(false);
  const [secs, setSecs] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLines(readCart(token));
    try {
      const g = JSON.parse(localStorage.getItem(guestKey(token)) || "{}") as { name?: string; phone?: string };
      setGuest({ name: g.name || "", phone: g.phone || "" });
    } catch {
      /* ignore */
    }
    void (async () => {
      const res = await fetch(`/api/public/table/${token}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { table: DiningTable; tenant: Tenant };
      setTable(data.table);
      setTenant(data.tenant);
      document.documentElement.style.setProperty("--primary", data.tenant.primary_color);
    })();
  }, [token]);

  useEffect(() => {
    if (!ok) return;
    if (secs <= 0) {
      router.push(`/t/${token}`);
      return;
    }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [ok, secs, router, token]);

  function setQty(idx: number, qty: number) {
    const next = [...lines];
    next[idx] = { ...next[idx], qty: Math.min(99, qty) };
    const cleaned = next.filter((l) => l.qty > 0);
    writeCart(token, cleaned);
    setLines(cleaned);
  }

  async function confirm() {
    if (busy || lines.length === 0) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/public/table/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "order",
          items: lines.map((l) => ({ itemId: l.itemId, unitId: l.unitId, qty: l.qty, note: l.note })),
          guestName: guest.name,
          guestPhone: guest.phone,
          note,
        }),
      });
      setBusy(false);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(body.error === "sold_out" ? "Có món vừa hết. Vui lòng chọn lại." : "Không gửi được order.");
        return;
      }
      localStorage.removeItem(cartKey(token));
      setLines([]);
      setOk(true);
    } catch {
      setErr("Không kết nối được. Giỏ hàng vẫn được giữ để bạn thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const count = cartCount(lines);
  const total = cartTotal(lines);

  return (
    <main className="guest-root" style={{ background: "#f4f1ee", minHeight: "100dvh" }}>
      <div className="page-head">
        <button className="linkish" onClick={() => router.back()}>
          ‹
        </button>
        Xác nhận gọi món
      </div>

      <section className="card">
        <div className="row-between">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="avatar">☺</div>
            <div>
              <b>Thông tin của bạn</b>
              <p className="muted" style={{ margin: 0 }}>
                Để lại tên và số điện thoại, quán sẽ gọi bạn khi mang món ra
              </p>
            </div>
          </div>
          <button className="linkish" onClick={() => setGuestOpen(true)}>
            {guest.name || "Nhập"}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="row-between">
          <b>Món đã chọn ({count})</b>
          <button className="linkish" onClick={() => router.push(`/t/${token}`)}>
            Thêm món
          </button>
        </div>
        {lines.map((l, i) => (
          <div className="line-item" key={`${l.unitId}-${i}`}>
            <img src={l.image || ""} alt="" />
            <div>
              <div className="row-between">
                <strong>{l.name}</strong>
              </div>
              <div className="muted">
                {l.unitName}
                {l.note ? ` · ${l.note}` : ""}
              </div>
              <div className="row-between" style={{ marginTop: 8 }}>
                <span className="price">{formatVnd(l.price)}</span>
                <div className="qty-row" style={{ margin: 0, gap: 10 }}>
                  <button className="round-btn" style={{ width: 32, height: 32 }} onClick={() => setQty(i, l.qty - 1)}>
                    −
                  </button>
                  <span>{l.qty}</span>
                  <button className="round-btn" style={{ width: 32, height: 32 }} onClick={() => setQty(i, l.qty + 1)}>
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <b>Thêm lưu ý cho quán</b>
        <textarea
          className="note"
          maxLength={255}
          placeholder="Cho quán biết thêm về yêu cầu của bạn"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="counter">{note.length}/255</div>
      </section>

      <div className="confirm-dock">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span>Tổng tiền ({count} món)</span>
          <strong>{formatVnd(total)}</strong>
        </div>
        {err && <p style={{ color: "#dc2626" }}>{err}</p>}
        <button className="cta" disabled={busy || count === 0} onClick={() => void confirm()}>
          Xác nhận
        </button>
      </div>

      {guestOpen && (
        <div className="modal-back" onClick={() => setGuestOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: "left" }}>
            <h2>Thông tin của bạn</h2>
            <input
              className="field"
              placeholder="Tên"
              value={guest.name}
              onChange={(e) => setGuest({ ...guest, name: e.target.value })}
            />
            <input
              className="field"
              placeholder="Số điện thoại"
              value={guest.phone}
              onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
            />
            <button
              className="cta"
              style={{ marginTop: 14 }}
              onClick={() => {
                localStorage.setItem(guestKey(token), JSON.stringify(guest));
                setGuestOpen(false);
              }}
            >
              Lưu
            </button>
          </div>
        </div>
      )}

      {ok && (
        <div className="modal-back">
          <div className="modal">
            <div className="check">✓</div>
            <h2>Gọi món thành công</h2>
            <p className="muted">Quán sẽ sớm xác nhận yêu cầu gọi món của bạn</p>
            <button className="cta" style={{ marginTop: 16 }} onClick={() => router.push(`/t/${token}`)}>
              Về trang chủ ({secs}s)
            </button>
          </div>
        </div>
      )}
      <span className="hidden">
        {table?.code} {tenant?.name}
      </span>
    </main>
  );
}
