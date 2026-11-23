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

export type ReportKind = "day" | "week" | "month" | "custom";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function validYmd(v: string | null | undefined): string | null {
  if (!v || !YMD.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return v;
}

export function mondayOnOrBefore(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const dow = new Date(utc).getUTCDay();
  const minus = dow === 0 ? 6 : dow - 1;
  return new Date(utc - minus * 86400000).toISOString().slice(0, 10);
}

export function reportWindow(opts: {
  kind: string;
  now?: Date;
  timeZone?: string;
  cutHour?: number;
  from?: string | null;
  to?: string | null;
}): { from: string; to: string; kind: ReportKind } {
  const kind: ReportKind =
    opts.kind === "week" || opts.kind === "month" || opts.kind === "custom" ? opts.kind : "day";
  const tz = opts.timeZone || "Asia/Ho_Chi_Minh";
  const cut = opts.cutHour ?? 5;
  const today = businessDate(opts.now ?? new Date(), tz, cut);
  if (kind === "custom") {
    const a = validYmd(opts.from) || today;
    const b = validYmd(opts.to) || today;
    return { from: a <= b ? a : b, to: a <= b ? b : a, kind };
  }
  if (kind === "week") return { from: mondayOnOrBefore(today), to: today, kind };
  if (kind === "month") return { from: `${today.slice(0, 8)}01`, to: today, kind };
  return { from: today, to: today, kind };
}

export function pickTaxRate(rows: TaxRateRow[], code: string, ymd: string, fallback: number): number {
  const hit = rows
    .filter((r) => r.code === code)
    .filter((r) => r.effective_from.slice(0, 10) <= ymd)
    .filter((r) => !r.effective_to || r.effective_to.slice(0, 10) >= ymd)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
  return hit ? Number(hit.rate) : fallback;
}
