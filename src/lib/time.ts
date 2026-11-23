export function ymdInZone(at: Date, timeZone = "Asia/Ho_Chi_Minh"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function hourInZone(at: Date, timeZone = "Asia/Ho_Chi_Minh"): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return Number(hour);
}

/** Business date: hours before cutHour belong to the previous calendar day. */
export function businessDate(at: Date, timeZone = "Asia/Ho_Chi_Minh", cutHour = 5): string {
  const ymd = ymdInZone(at, timeZone);
  if (hourInZone(at, timeZone) >= cutHour) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

export type TaxRateRow = {
  code: string;
  rate: number;
  effective_from: string;
  effective_to: string | null;
};

export function pickTaxRate(rows: TaxRateRow[], code: string, ymd: string, fallback: number): number {
  const hit = rows
    .filter((r) => r.code === code)
    .filter((r) => r.effective_from.slice(0, 10) <= ymd)
    .filter((r) => !r.effective_to || r.effective_to.slice(0, 10) >= ymd)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
  return hit ? Number(hit.rate) : fallback;
}
