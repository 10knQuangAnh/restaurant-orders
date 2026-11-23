"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const dest: Record<string, string> = {
  admin: "/staff/admin",
  waiter: "/staff/floor",
  kitchen: "/staff/kitchen",
};

export default function StaffLogin() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [who, setWho] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/staff/session", { cache: "no-store" });
      const data = (await res.json()) as { staff?: { name: string; role: string } | null };
      if (data.staff) setWho(`${data.staff.name} (${data.staff.role})`);
    })();
  }, []);

  async function submit(next: string) {
    if (next.length < 4) return;
    const res = await fetch("/api/staff/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: next }),
    });
    if (!res.ok) {
      setErr("Sai mã PIN");
      setPin("");
      return;
    }
    const data = (await res.json()) as { staff: { role: string } };
    router.replace(dest[data.staff.role] || "/staff/floor");
  }

  function tap(d: string) {
    setErr("");
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  }

  return (
    <main className="staff-root">
      <div className="pin-wrap">
        <p className="who" style={{ color: "#8a7468", letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 12 }}>
          Vào ca
        </p>
        <h1>Nhập PIN nhân viên</h1>
        <p className="muted" style={{ color: "#b9a396" }}>
          Demo Quán Tự Do: Lan 2580 · Minh 1397 · Hùng 4466
        </p>
        {who && <p className="muted">Đã nhận diện {who}</p>}
        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={pin.length > i ? "on" : ""} />
          ))}
        </div>
        <div className="pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "C"].map((d) => (
            <button
              key={d}
              onClick={() => {
                if (d === "C") setPin("");
                else if (d === "←") setPin((p) => p.slice(0, -1));
                else tap(d);
              }}
            >
              {d}
            </button>
          ))}
        </div>
        {err && <p className="err">{err}</p>}
        {who && (
          <button
            type="button"
            style={{ marginTop: 28, background: "none", border: 0, color: "#8a7468", fontSize: 12 }}
            onClick={() => {
              const role = who.includes("admin") ? "admin" : who.includes("kitchen") ? "kitchen" : "waiter";
              router.push(dest[role]);
            }}
          >
            Phiên Cursor: {who}
          </button>
        )}
      </div>
    </main>
  );
}
