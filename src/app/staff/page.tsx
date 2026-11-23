"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

const dest: Record<string, string> = {
  admin: "/staff/admin",
  waiter: "/staff/floor",
  kitchen: "/staff/kitchen",
};

type Person = { id: string; name: string; role: string };

function StaffLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [slug, setSlug] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const directoryRequest = useRef<AbortController | null>(null);
  const [who, setWho] = useState("");

  useEffect(() => {
    const q = params.get("slug") || localStorage.getItem("venue_slug") || "";
    if (q) {
      setSlug(q);
      void loadDir(q);
    }
    void (async () => {
      const res = await fetch("/api/staff/session", { cache: "no-store" });
      const data = (await res.json()) as {
        staff?: { name: string; role: string } | null;
      };
      if (data.staff) setWho(`${data.staff.name} · ${data.staff.role}`);
    })().catch(() => {
      /* Directory lookup displays the connection error. */
    });
    return () => directoryRequest.current?.abort();
  }, [params]);

  async function loadDir(nextSlug: string) {
    directoryRequest.current?.abort();
    const controller = new AbortController();
    directoryRequest.current = controller;
    setErr("");
    setStaffId("");
    setPin("");
    setPeople([]);
    setTenantName("");
    const normalizedSlug = nextSlug.trim().toLowerCase();
    if (!normalizedSlug) {
      setErr("Nhập mã quán để tiếp tục.");
      setLoadingDirectory(false);
      return;
    }
    setLoadingDirectory(true);
    try {
      const res = await fetch(`/api/staff/directory?slug=${encodeURIComponent(normalizedSlug)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        if (res.status === 404) setErr("Không tìm thấy quán");
        else if (res.status === 503) setErr("Dịch vụ dữ liệu đang không sẵn sàng. Vui lòng thử lại sau.");
        else if (res.status >= 500) setErr("Máy chủ đang gặp lỗi. Vui lòng thử lại sau.");
        else setErr("Không tải được danh sách nhân viên. Vui lòng thử lại.");
        return;
      }
      const data = (await res.json()) as { tenant: { name: string; slug: string }; people: Person[] };
      if (controller.signal.aborted) return;
      setSlug(data.tenant.slug);
      setTenantName(data.tenant.name);
      setPeople(data.people);
      try {
        localStorage.setItem("venue_slug", data.tenant.slug);
      } catch {
        /* Storage may be disabled. */
      }
    } catch {
      if (!controller.signal.aborted) setErr("Không kết nối được máy chủ. Kiểm tra mạng và thử lại.");
    } finally {
      if (directoryRequest.current === controller) setLoadingDirectory(false);
    }
  }

  async function submit(next: string) {
    if (next.length < 4 || !staffId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/staff/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim().toLowerCase(),
          staffId,
          pin: next,
        }),
      });
      if (res.status === 429) {
        setErr("Tài khoản bị khóa tạm. Thử lại sau.");
        setPin("");
        return;
      }
      if (res.status === 403) {
        setErr("Không gửi được từ địa chỉ này. Mở đúng cổng quán.");
        setPin("");
        return;
      }
      if (!res.ok) {
        setErr("Sai PIN");
        setPin("");
        return;
      }
      const data = (await res.json()) as { staff: { role: string } };
      router.replace(dest[data.staff.role] || "/staff/floor");
    } catch {
      setErr("Không kết nối được. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  function tap(d: string) {
    setErr("");
    const next = (pin + d).slice(0, 8);
    setPin(next);
  }

  async function logout() {
    await fetch("/api/staff/session", { method: "DELETE" });
    setWho("");
  }

  return (
    <main className="staff-root">
      <div className="pin-wrap">
        <p
          className="who"
          style={{
            color: "#8a7468",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontSize: 12,
          }}
        >
          Vào ca
        </p>
        <h1>{tenantName || "Chọn quán"}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadDir(slug);
          }}
          style={{ display: "flex", gap: 8, margin: "12px 0 20px" }}
        >
          <input
            className="field"
            placeholder="Mã quán (slug)"
            value={slug}
            onChange={(e) => {
              directoryRequest.current?.abort();
              setLoadingDirectory(false);
              setErr("");
              setSlug(e.target.value);
              setStaffId("");
              setPeople([]);
              setTenantName("");
              setPin("");
            }}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button
            className="cta"
            type="submit"
            disabled={loadingDirectory}
            style={{ width: "auto", padding: "0 16px" }}
          >
            {loadingDirectory ? "Đang tải…" : "Mở"}
          </button>
        </form>
        {people.length > 0 && (
          <div className="staff-pick">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                className={staffId === p.id ? "on" : ""}
                onClick={() => {
                  setStaffId(p.id);
                  setPin("");
                  setErr("");
                }}
              >
                <strong>{p.name}</strong>
                <span>{p.role === "admin" ? "Quản trị" : p.role === "kitchen" ? "Bếp" : "Phục vụ"}</span>
              </button>
            ))}
          </div>
        )}
        {staffId && (
          <>
            <p className="muted" style={{ color: "#b9a396" }}>
              Nhập PIN của bạn (4–8 số)
            </p>
            <div className="pin-dots">
              {Array.from({ length: Math.max(4, pin.length) }, (_, i) => i).map((i) => (
                <i key={i} className={pin.length > i ? "on" : ""} />
              ))}
            </div>
            <div className="pad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "C"].map((d) => (
                <button
                  key={d}
                  disabled={busy}
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
            <button
              className="cta"
              style={{ marginTop: 16 }}
              disabled={busy || pin.length < 4}
              onClick={() => void submit(pin)}
            >
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>
          </>
        )}
        {err && (
          <p className="err" role="alert">
            {err}
          </p>
        )}
        {who && (
          <p className="muted" style={{ marginTop: 20 }}>
            Đang có phiên: {who}{" "}
            <button type="button" className="linkish" onClick={() => void logout()}>
              Kết ca
            </button>
          </p>
        )}
      </div>
    </main>
  );
}

export default function StaffLogin() {
  return (
    <Suspense fallback={<main className="staff-root" />}>
      <StaffLoginInner />
    </Suspense>
  );
}
