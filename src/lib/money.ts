export function formatVnd(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `${n.toLocaleString("en-US")}đ`;
}

export function roundCash(amount: number, step: number): number {
  if (!step || step <= 1) return Math.round(amount);
  return Math.round(amount / step) * step;
}

export type Bill = {
  subtotal: number;
  vat: number;
  service: number;
  discount: number;
  total: number;
  cashTotal: number;
};

export function computeBill(input: {
  lines: { qty: number; unit_price_dong: number; complementary?: boolean }[];
  vatRate: number;
  vatIncluded: boolean;
  serviceRate: number;
  discount: number;
  cashRoundTo: number;
}): Bill {
  const subtotal = input.lines.reduce((sum, line) => {
    if (line.complementary) return sum;
    return sum + line.qty * line.unit_price_dong;
  }, 0);
  const vat = input.vatIncluded
    ? Math.round((subtotal * input.vatRate) / (1 + input.vatRate))
    : Math.round(subtotal * input.vatRate);
  const net = input.vatIncluded ? subtotal : subtotal + vat;
  const service = Math.round(net * input.serviceRate);
  const discount = Math.min(input.discount || 0, net + service);
  const total = Math.max(0, net + service - discount);
  return {
    subtotal,
    vat,
    service,
    discount,
    total,
    cashTotal: roundCash(total, input.cashRoundTo),
  };
}
