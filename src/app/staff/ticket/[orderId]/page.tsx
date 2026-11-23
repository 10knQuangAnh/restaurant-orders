"use client";

import { StaffNav } from "@/components/staff/Nav";
import { formatVnd } from "@/lib/money";
import type { MenuItem } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type TicketItem = {
  id: string;
  name_snapshot: string;
  unit_snapshot: string;
  unit_price_dong: number;
  qty: number;
  note: string | null;
  rush: boolean;
  complementary: boolean;
  kitchen_status: string;
};

type Ticket = {
  order: {
    id: string;
    table_id: string;
    status: string;
    guest_name: string | null;
    code: string;
    tname: string;
  };
  items: TicketItem[];
};

type FloorTable = { table: { id: string; code: string; name: string }; orderId: string | null };

const kLabel: Record<string, string> = {
  queued: "chờ",
  preparing: "làm",
  done: "xong",
  "86": "86",
  cancelled: "hủy",
};

export default function TicketPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [bill, setBill] = useState<{ subtotal: number; vat: number; service: number; discount?: number; total: number; cashTotal: number } | null>(null);
  const [settings, setSettings] = useState<{ bank_name?: string; bank_account?: string; bank_holder?: string } | null>(null);
  const [staff, setStaff] = useState<{ role: string; name: string } | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [addOn, setAddOn] = useState(false);
  const [payOn, setPayOn] = useState<"cash" | "transfer" | null>(null);
  const [received, setReceived] = useState("");
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [splitOn, setSplitOn] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [discount, setDiscount] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/staff/order/${orderId}`, { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/staff");
      return;
    }
    const data = (await res.json()) as {
      ticket: Ticket;
      bill: typeof bill;
      settings: typeof settings;
      staff: { role: string; name: string };
    };
    setTicket(data.ticket);
    setBill(data.bill);
    setSettings(data.settings);
    setStaff(data.staff);
  }, [orderId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: Record<string, unknown>) {
    const res = await fetch(`/api/staff/order/${orderId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { orderId?: string; paid?: number; error?: string };
    if (data.orderId && data.orderId !== orderId) {
      router.replace(`/staff/ticket/${data.orderId}`);
      return;
    }
    if (body.action === "pay") {
      setMsg("Đã thu tiền");
      setPayOn(null);
      router.replace("/staff/floor");
      return;
    }
    await load();
  }

  async function loadMenu() {
    const res = await fetch("/api/staff/menu", { cache: "no-store" });
    const data = (await res.json()) as { items: MenuItem[] };
    setMenu(data.items);
    setAddOn(true);
  }

  async function loadTables() {
    const res = await fetch("/api/staff/floor", { cache: "no-store" });
    const data = (await res.json()) as { tables: FloorTable[] };
    setTables(data.tables);
  }

  if (!ticket || !bill) {
    return (
      <main className="staff-root" style={{ padding: 24 }}>
        <p>Đang mở phiếu…</p>
      </main>
    );
  }

  const live = ticket.items.filter((i) => i.kitchen_status !== "cancelled");
  const change = payOn === "cash" ? Math.max(0, Number(received || bill.cashTotal) - bill.cashTotal) : 0;

  return (
    <main className="staff-root" style={{ paddingBottom: 90 }}>
      <header className="staff-top">
        <div>
          <button className="linkish" onClick={() => router.push("/staff/floor")}>
            ‹ Sàn
          </button>
          <h1>
            {ticket.order.code} · {ticket.order.tname}
          </h1>
          <div className="who">{ticket.order.guest_name || "Khách vãng lai"}</div>
        </div>
      </header>

      <section style={{ padding: "0 16px" }}>
        {live.map((it) => (
          <div className="ticket-line" key={it.id}>
            <div className="row-between">
              <strong>
                {it.qty}× {it.name_snapshot}
              </strong>
              <span>{it.complementary ? "Tặng" : formatVnd(it.unit_price_dong * it.qty)}</span>
            </div>
            <div className="muted" style={{ color: "#b9a396" }}>
              {it.unit_snapshot} · {kLabel[it.kitchen_status]}
              {it.note ? ` · ${it.note}` : ""}
              {it.rush ? " · gấp" : ""}
            </div>
            <div className="kbtns">
              <button className="k-start" onClick={() => void act({ action: "patch_item", itemId: it.id, qty: it.qty + 1 })}>
                +
              </button>
              <button className="k-start" onClick={() => void act({ action: "patch_item", itemId: it.id, qty: Math.max(0, it.qty - 1) })}>
                −
              </button>
              <button className="k-start" onClick={() => void act({ action: "patch_item", itemId: it.id, rush: !it.rush })}>
                Gấp
              </button>
              <button className="k-start" onClick={() => void act({ action: "patch_item", itemId: it.id, complementary: !it.complementary })}>
                Tặng
              </button>
              <button
                className="k-86"
                onClick={() => {
                  if (confirm("Hủy món này? Bếp sẽ được báo.")) {
                    void act({ action: "patch_item", itemId: it.id, cancel: true, cancelReason: "staff" });
                  }
                }}
              >
                Hủy
              </button>
              {splitOn && (
                <button
                  className="k-start"
                  onClick={() => setPicked((p) => ({ ...p, [it.id]: !p[it.id] }))}
                >
                  {picked[it.id] ? "✓ Tách" : "Tách"}
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      <div className="pay-box">
        <div className="row-between"><span>Tạm tính</span><span>{formatVnd(bill.subtotal)}</span></div>
        <div className="row-between muted"><span>VAT (gồm)</span><span>{formatVnd(bill.vat)}</span></div>
        <div className="row-between muted"><span>Phí phục vụ</span><span>{formatVnd(bill.service)}</span></div>
        <div className="row-between muted"><span>Giảm giá</span><span>{formatVnd(bill.discount || 0)}</span></div>
        <div className="row-between" style={{ marginTop: 8, fontWeight: 800 }}>
          <span>Phải thu</span><span>{formatVnd(bill.total)}</span>
        </div>
        <div className="muted">Tiền mặt {formatVnd(bill.cashTotal)}</div>
        <div className="kbtns" style={{ marginTop: 10 }}>
          <input
            className="field"
            style={{ flex: 1, height: 40, margin: 0 }}
            inputMode="numeric"
            placeholder="Giảm giá (đ)"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <button className="k-start" onClick={() => void act({ action: "discount", amount: Number(discount || 0) })}>
            Áp giảm
          </button>
        </div>
        <div className="kbtns" style={{ marginTop: 12 }}>
          <button className="k-start" onClick={() => void loadMenu()}>Thêm món</button>
          <button className="k-start" onClick={() => { setSplitOn((s) => !s); void loadTables(); }}>Tách</button>
          <button className="k-start" onClick={() => void loadTables()}>Chuyển/Gộp</button>
        </div>
        <div className="kbtns">
          <button className="k-start" onClick={() => window.print()}>In tạm tính</button>
          <button className="k-done" onClick={() => setPayOn("cash")}>Tiền mặt</button>
          <button className="k-done" onClick={() => setPayOn("transfer")}>Chuyển khoản</button>
          <button className="k-86" onClick={() => void act({ action: "void" })}>Hủy phiếu</button>
        </div>
        {msg && <p className="ok-text">{msg}</p>}
      </div>

      {addOn && (
        <div className="modal-back" onClick={() => setAddOn(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "70vh", overflow: "auto", background: "#231c18", color: "#f6eee6" }}>
            <h2>Gọi hộ</h2>
            {menu.map((it) => (
              <button
                key={it.id}
                className="row-between"
                style={{ width: "100%", background: "none", border: 0, color: "inherit", padding: "10px 0", textAlign: "left" }}
                disabled={it.sold_out}
                onClick={() => {
                  const u = it.units[0];
                  void act({ action: "add", items: [{ itemId: it.id, unitId: u.id, qty: 1 }] });
                  setAddOn(false);
                }}
              >
                <span>{it.name}</span>
                <span>{it.sold_out ? "Hết" : formatVnd(it.units[0]?.price_dong || 0)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tables.length > 0 && !payOn && (
        <div className="modal-back" onClick={() => setTables([])}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ background: "#231c18", color: "#f6eee6" }}>
            <h2>{splitOn ? "Tách sang bàn" : "Chuyển / gộp bàn"}</h2>
            {tables.map((t) => (
              <button
                key={t.table.id}
                style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, color: "inherit", padding: "10px 0" }}
                onClick={() => {
                  if (splitOn) {
                    const itemIds = Object.entries(picked).filter(([, v]) => v).map(([k]) => k);
                    void act({ action: "split", itemIds, tableId: t.table.id });
                    setSplitOn(false);
                    setTables([]);
                    return;
                  }
                  if (t.orderId && t.orderId !== orderId) void act({ action: "merge", otherOrderId: t.orderId });
                  else void act({ action: "transfer", tableId: t.table.id });
                  setTables([]);
                }}
              >
                {t.table.code} {t.table.name} {t.orderId ? "(gộp)" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {payOn && (
        <div className="modal-back" onClick={() => setPayOn(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ background: "#231c18", color: "#f6eee6" }}>
            <h2>{payOn === "cash" ? "Thu tiền mặt" : "Chuyển khoản"}</h2>
            <p>Phải thu {formatVnd(payOn === "cash" ? bill.cashTotal : bill.total)}</p>
            {payOn === "transfer" && settings?.bank_account && (
              <p className="muted">
                {settings.bank_name} · {settings.bank_account} · {settings.bank_holder}
              </p>
            )}
            {payOn === "cash" && (
              <>
                <input
                  className="field"
                  inputMode="numeric"
                  placeholder="Khách đưa"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
                <p>Thối {formatVnd(change)}</p>
              </>
            )}
            <button
              className="cta"
              onClick={() =>
                void act({
                  action: "pay",
                  method: payOn,
                  received: Number(received || bill.cashTotal),
                })
              }
            >
              Xác nhận thanh toán
            </button>
          </div>
        </div>
      )}
      {staff && <StaffNav role={staff.role} />}
    </main>
  );
}
