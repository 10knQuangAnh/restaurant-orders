const NON_BILLABLE = new Set(["cancelled", "86"]);

export function formatVnd(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `${n.toLocaleString("en-US")}đ`;
}

export function roundCash(amount: number, step: number): number {
  if (!step || step <= 1) return Math.round(amount);
  return Math.round(amount / step) * step;
}

export function isBillableLine(line: {
  complementary?: boolean;
  kitchen_status?: string;
  qty?: number;
}): boolean {
  if (line.complementary) return false;
  if (NON_BILLABLE.has(String(line.kitchen_status || ""))) return false;
  if (Number(line.qty) <= 0) return false;
  return true;
}

export type Bill = {
  subtotal: number;
  vat: number;
  service: number;
  discount: number;
  total: number;
  cashTotal: number;
  rounding: number;
};

export function computeBill(input: {
  lines: {
    qty: number;
    unit_price_dong: number;
    complementary?: boolean;
    kitchen_status?: string;
    vat_rate?: number | null;
  }[];
  vatRate: number;
  vatIncluded: boolean;
  serviceRate: number;
  discount: number;
  cashRoundTo: number;
}): Bill {
  const lines = input.lines.filter(isBillableLine);
  const subtotal = lines.reduce((sum, line) => sum + line.qty * line.unit_price_dong, 0);
  const vat = lines.reduce((sum, line) => {
    const rate = Number(line.vat_rate ?? input.vatRate) || 0;
    const lineTotal = line.qty * line.unit_price_dong;
    if (rate <= 0) return sum;
    const part = input.vatIncluded
      ? Math.round((lineTotal * rate) / (1 + rate))
      : Math.round(lineTotal * rate);
    return sum + part;
  }, 0);
  const net = input.vatIncluded ? subtotal : subtotal + vat;
  const serviceRate = Math.min(1, Math.max(0, Number(input.serviceRate) || 0));
  const service = Math.round(net * serviceRate);
  const discount = Math.min(Math.max(0, input.discount || 0), net + service);
  const total = Math.max(0, net + service - discount);
  const cashTotal = roundCash(total, input.cashRoundTo || 0);
  return {
    subtotal,
    vat,
    service,
    discount,
    total,
    cashTotal,
    rounding: cashTotal - total,
  };
}
