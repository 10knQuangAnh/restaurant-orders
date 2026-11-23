"use client";

import { formatVnd } from "@/lib/money";
import { addLine, cartCount, cartTotal, guestKey, readCart, type StoredLine } from "@/lib/cart";
import type { Category, DiningTable, MenuItem, OrderItem, Tenant } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Payload = {
  table: DiningTable;
  tenant: Tenant;
  categories: Category[];
  items: MenuItem[];
  ordered: OrderItem[];
};

export default function MenuPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [grid, setGrid] = useState(false);
  const [q, setQ] = useState("");
  const [searchOn, setSearchOn] = useState(false);
  const [cart, setCart] = useState<StoredLine[]>([]);
  const [guest, setGuest] = useState({ name: "", phone: "" });
  const [guestOpen, setGuestOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callOk, setCallOk] = useState(false);
  const [en, setEn] = useState(false);
  const [callReason, setCallReason] = useState("staff");
  const [consent, setConsent] = useState(false);

  const callReasons = [
    ["staff", "Gọi NV"],
    ["water", "Thêm nước"],
    ["bill", "Thanh toán"],
    ["ask", "Hỏi món"],
  ] as const;

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/table/${token}`, { cache: "no-store" });
    if (!res.ok) {
      setErr(res.status >= 500 ? "Quán chưa kết nối được dữ liệu. Thử tải lại trang." : "Không tìm thấy bàn.");
      return;
    }
    setData((await res.json()) as Payload);
  }, [token]);

  useEffect(() => {
    void load();
    const poll = setInterval(() => {
      if (!document.hidden) void load();
    }, 8000);
    const vis = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", vis);
    setCart(readCart(token));
    try {
      const g = JSON.parse(localStorage.getItem(guestKey(token)) || "{}") as { name?: string; phone?: string };
      setGuest({ name: g.name || "", phone: g.phone || "" });
    } catch {
      /* ignore */
    }
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [load, token]);

  useEffect(() => {
    if (!data) return;
    document.documentElement.style.setProperty("--primary", data.tenant.primary_color);
    document.documentElement.style.setProperty("--peach", data.tenant.accent_color);
  }, [data]);

  const items = useMemo(() => {
    if (!data) return [];
    return data.items.filter((it) => {
      if (cat !== "all" && it.category_id !== cat) return false;
      if (q && !`${it.name} ${it.name_en || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [data, cat, q]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const cats = cat === "all" ? data.categories : data.categories.filter((c) => c.id === cat);
    return cats
      .map((c) => ({ cat: c, items: items.filter((i) => i.category_id === c.id) }))
      .filter((g) => g.items.length);
  }, [data, items, cat]);

  function quickAdd(item: MenuItem) {
    if (item.sold_out) return;
    if (item.units.length !== 1) {
      router.push(`/t/${token}/item/${item.id}`);
      return;
    }
    const u = item.units[0];
    const next = addLine(token, {
      itemId: item.id,
      unitId: u.id,
      qty: 1,
      note: "",
      name: item.name,
      unitName: u.name,
      price: u.price_dong,
      image: item.image_url,
    });
    setCart([...next]);
  }

  async function saveGuest() {
    if (!consent) return;
    localStorage.setItem(guestKey(token), JSON.stringify(guest));
    await fetch(`/api/public/table/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "guest", guestName: guest.name, guestPhone: guest.phone }),
    });
    setGuestOpen(false);
  }

  async function callStaff() {
    const reason = callReasons.find((r) => r[0] === callReason)?.[1] || "Gọi NV";
    await fetch(`/api/public/table/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "call", reason }),
    });
    setCallOpen(false);
    setCallOk(true);
    setTimeout(() => setCallOk(false), 2200);
  }

  if (err) {
    return (
      <main className="guest-root" style={{ padding: 24 }}>
        <h1>Bàn không còn hiệu lực</h1>
        <p className="muted">Nhờ nhân viên in lại mã QR.</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="guest-root" style={{ padding: 24 }}>
        <p className="muted">Đang mở menu…</p>
      </main>
    );
  }

  const count = cartCount(cart);
  const total = cartTotal(cart);
  const defaultUnit = (item: MenuItem) => item.units.find((u) => u.is_default) || item.units[0];

  return (
    <main className="guest-root">
      <header className="guest-head">
        <h1>
          {data.table.code} - {data.table.name}
        </h1>
        {data.tenant.hours && (
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.92 }}>{data.tenant.hours}</p>
        )}
        <button
          type="button"
          className="lang-toggle"
          onClick={() => setEn((v) => !v)}
          aria-label="Đổi ngôn ngữ"
        >
          {en ? "VI" : "EN"}
        </button>
      </header>
      <div className="action-row">
        <button className="search-btn" aria-label="Tìm món" onClick={() => setSearchOn(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </button>
        <div className="chip-action">
          <button type="button" onClick={() => setCallOpen(true)} style={{ background: "none", border: 0, color: "#fff", fontWeight: 600 }}>
            Gọi nhân viên
          </button>
          <span className="sep">|</span>
          <button type="button" onClick={() => router.push(`/t/${token}/ordered`)} style={{ background: "none", border: 0, color: "#fff", fontWeight: 600 }}>
            Món đã gọi
          </button>
        </div>
      </div>

      <section className="name-banner">
        <div className="avatar">☺</div>
        <div>
          <b>Quán nên gọi bạn là?</b>
          <p>Để lại tên và số điện thoại, quán sẽ gọi bạn khi mang món ra</p>
        </div>
        <button onClick={() => setGuestOpen(true)}>{guest.name ? guest.name : "Nhập"}</button>
      </section>

      <nav className="cats">
        <button className={`cat ${cat === "all" ? "on" : ""}`} onClick={() => setCat("all")}>
          Tất cả
        </button>
        {data.categories.map((c) => (
          <button key={c.id} className={`cat ${cat === c.id ? "on" : ""}`} onClick={() => setCat(c.id)}>
            {c.name}
          </button>
        ))}
      </nav>

      <div className="toolbar">
        <span>Tất cả {data.items.length} món</span>
        <div className="view-toggle">
          <button className={!grid ? "on" : ""} onClick={() => setGrid(false)} aria-label="Danh sách">
            ☰
          </button>
          <button className={grid ? "on" : ""} onClick={() => setGrid(true)} aria-label="Lưới">
            ▦
          </button>
        </div>
      </div>

      {grouped.map((g) => (
        <section key={g.cat.id}>
          <h2 className="cat-title">
            {g.cat.name} ({g.items.length})
          </h2>
          <div className={grid ? "grid" : "list"}>
            {g.items.map((item) => {
              const u = defaultUnit(item);
              if (grid) {
                return (
                  <article key={item.id} className={`grid-card ${item.sold_out ? "sold" : ""}`}>
                    <img
                      src={item.image_url || ""}
                      alt={en && item.name_en ? item.name_en : item.name}
                      onClick={() => router.push(`/t/${token}/item/${item.id}`)}
                    />
                    <button className="plus" disabled={item.sold_out} onClick={() => quickAdd(item)}>
                      +
                    </button>
                    <div className="body" onClick={() => router.push(`/t/${token}/item/${item.id}`)}>
                      <h3>{en && item.name_en ? item.name_en : item.name}</h3>
                      {item.sold_out ? <div className="sold-tag">Hết món</div> : <div className="price">{formatVnd(u?.price_dong || 0)}</div>}
                    </div>
                  </article>
                );
              }
              return (
                <article key={item.id} className={`item-row ${item.sold_out ? "sold" : ""}`}>
                  <img
                    src={item.image_url || ""}
                    alt={en && item.name_en ? item.name_en : item.name}
                    onClick={() => router.push(`/t/${token}/item/${item.id}`)}
                  />
                  <div onClick={() => router.push(`/t/${token}/item/${item.id}`)}>
                    <h3>{en && item.name_en ? item.name_en : item.name}</h3>
                    {item.sold_out ? <div className="sold-tag">Hết món</div> : <div className="price">{formatVnd(u?.price_dong || 0)}</div>}
                  </div>
                  <button className="plus" disabled={item.sold_out} onClick={() => quickAdd(item)}>
                    +
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {count > 0 && (
        <button className="cart-bar" onClick={() => router.push(`/t/${token}/cart`)}>
          <span>Giỏ · {count} món</span>
          <span>{formatVnd(total)}</span>
        </button>
      )}

      {searchOn && (
        <div className="search-overlay">
          <div className="row-between">
            <input className="field" autoFocus placeholder="Tìm món…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="linkish" onClick={() => { setSearchOn(false); setQ(""); }}>
              Đóng
            </button>
          </div>
        </div>
      )}

      {guestOpen && (
        <div className="modal-back" onClick={() => setGuestOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: "left" }}>
            <h2>Thông tin của bạn</h2>
            <p className="muted">Tên và SĐT chỉ dùng để quán gọi khi mang món. Không chia sẻ ngoài nhà hàng.</p>
            <input className="field" placeholder="Tên" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} />
            <input className="field" placeholder="Số điện thoại" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} />
            <label className="muted" style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, fontSize: 13 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              Tôi đồng ý lưu thông tin này trên phiếu bàn.
            </label>
            <button className="cta" style={{ marginTop: 14 }} disabled={!consent || !guest.name.trim()} onClick={() => void saveGuest()}>
              Lưu
            </button>
          </div>
        </div>
      )}

      {callOpen && (
        <div className="modal-back" onClick={() => setCallOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Gọi nhân viên</h2>
            <p className="muted">Nhân viên bàn sẽ nhận tín hiệu từ {data.table.code}.</p>
            <div className="kbtns" style={{ margin: "12px 0" }}>
              {callReasons.map(([id, lab]) => (
                <button
                  key={id}
                  type="button"
                  className={callReason === id ? "k-done" : "k-start"}
                  onClick={() => setCallReason(id)}
                >
                  {lab}
                </button>
              ))}
            </div>
            <button className="cta" onClick={() => void callStaff()}>
              Xác nhận gọi
            </button>
          </div>
        </div>
      )}
      {callOk && (
        <div className="modal-back">
          <div className="modal">
            <div className="check">✓</div>
            <h2>Đã gọi nhân viên</h2>
            <p className="muted">Quán sẽ tới bàn {data.table.code} ngay.</p>
          </div>
        </div>
      )}
    </main>
  );
}
