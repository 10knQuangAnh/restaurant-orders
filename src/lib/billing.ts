import { computeBill, isBillableLine, type Bill } from "./money";

export { computeBill, isBillableLine, type Bill };

export function billFromOrder(
  items: {
    qty: number;
    unit_price_dong: number;
    complementary?: boolean;
    kitchen_status?: string;
    vat_rate?: number | null;
  }[],
  rates: {
    vat_rate: number;
    vat_included: boolean;
    service_rate: number;
    cash_round_to: number;
  },
  discount = 0,
): Bill {
  return computeBill({
    lines: items,
    vatRate: Number(rates.vat_rate) || 0,
    vatIncluded: Boolean(rates.vat_included),
    serviceRate: Number(rates.service_rate) || 0,
    discount: Math.max(0, discount || 0),
    cashRoundTo: Number(rates.cash_round_to) || 0,
  });
}

export function clampQty(n: unknown): number | null {
  const q = Number(n);
  if (typeof n === "boolean" || n == null || !Number.isInteger(q) || q < 1 || q > 99) return null;
  return q;
}

export function isHexColor(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

export function clampRate(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n;
}

export function asPercentOrRate(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 1 && n <= 100) return n / 100;
  if (n > 1) return null;
  return n;
}
