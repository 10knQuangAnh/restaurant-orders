import type { CartLine } from "./types";

export type StoredLine = CartLine & {
  name: string;
  unitName: string;
  price: number;
  image: string | null;
};

export function cartKey(token: string) {
  return `print-order-cart:${token}`;
}

export function guestKey(token: string) {
  return `print-order-guest:${token}`;
}

export function readCart(token: string): StoredLine[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(cartKey(token)) || "[]") as StoredLine[];
  } catch {
    return [];
  }
}

export function writeCart(token: string, lines: StoredLine[]) {
  localStorage.setItem(cartKey(token), JSON.stringify(lines));
}

export function addLine(token: string, line: StoredLine) {
  const cart = readCart(token);
  const idx = cart.findIndex(
    (c) => c.itemId === line.itemId && c.unitId === line.unitId && (c.note || "") === (line.note || ""),
  );
  if (idx >= 0) cart[idx].qty += line.qty;
  else cart.push(line);
  writeCart(token, cart.filter((c) => c.qty > 0));
  return cart;
}

export function cartCount(lines: StoredLine[]) {
  return lines.reduce((n, l) => n + l.qty, 0);
}

export function cartTotal(lines: StoredLine[]) {
  return lines.reduce((n, l) => n + l.qty * l.price, 0);
}
