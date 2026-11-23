"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StaffNav({ role }: { role: string }) {
  const path = usePathname();
  const items = [
    role !== "kitchen" ? { href: "/staff/floor", label: "Sàn" } : null,
    role !== "waiter" ? { href: "/staff/kitchen", label: "Bếp" } : null,
    { href: "/staff/stock", label: "Kho" },
    role === "admin" ? { href: "/staff/admin", label: "Quản trị" } : null,
    { href: "/staff", label: "Ca" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <nav className="staff-nav">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={path.startsWith(it.href) && it.href !== "/staff" ? "on" : path === it.href ? "on" : ""}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
