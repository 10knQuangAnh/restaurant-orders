"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: string; kind: string; message: string; created_at: string };

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.start();
    o.stop(ctx.currentTime + 0.12);
  } catch {
    /* ignore */
  }
}

export function InboxBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const last = useRef(0);

  const load = useCallback(async () => {
    if (document.hidden) return;
    const res = await fetch("/api/staff/inbox", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { items: Item[] };
    if (data.items.length > last.current && last.current !== 0) beep();
    last.current = data.items.length;
    setItems(data.items);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    const vis = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [load]);

  async function ack(id?: string) {
    await fetch("/api/staff/inbox", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    void load();
  }

  return (
    <div className="inbox">
      <button type="button" className="inbox-btn" onClick={() => setOpen((v) => !v)} aria-label="Thông báo">
        {items.length > 0 ? `● ${items.length}` : "○"}
      </button>
      {open && (
        <div className="inbox-pop">
          {items.length === 0 && <p className="muted">Không có thông báo</p>}
          {items.map((it) => (
            <button key={it.id} type="button" className="inbox-item" onClick={() => void ack(it.id)}>
              <strong>{it.kind}</strong>
              <span>{it.message}</span>
            </button>
          ))}
          {items.length > 0 && (
            <button type="button" className="linkish" onClick={() => void ack()}>
              Đã đọc hết
            </button>
          )}
        </div>
      )}
    </div>
  );
}
