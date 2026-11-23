/** Shared Postgres URL guard for Next runtime + `scripts/migrate.mjs`. */

function stripWrap(raw) {
  let s = String(raw ?? "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function hostOk(host) {
  const h = String(host || "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  if (!h || h === "base") return false;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  return h.includes(".");
}

/**
 * Accept a real postgres:// URL. Reject placeholders that `pg` resolves
 * against dummy host `base` (see pg-connection-string `new URL(str, 'postgres://base')`).
 * @param {string | undefined} raw
 * @returns {string}
 */
export function normalizePostgresUrl(raw) {
  const s = stripWrap(raw);
  if (!s) return "";
  if (!/^postgres(ql)?:\/\//i.test(s)) return "";
  try {
    const u = new URL(s);
    if (!/^postgres(ql)?:$/i.test(u.protocol)) return "";
    const host = u.searchParams.get("host") || u.hostname;
    if (!hostOk(host)) return "";
    return s;
  } catch {
    return "";
  }
}

/** First usable candidate; ignores empty / non-URL / dummy-host values. */
export function usablePostgresUrl(...candidates) {
  for (const raw of candidates) {
    const url = normalizePostgresUrl(raw);
    if (url) return url;
  }
  return "";
}

export function runtimePostgresUrl() {
  return usablePostgresUrl(process.env.DATABASE_URL, process.env.POSTGRES_URL, process.env.POSTGRES_PRISMA_URL);
}

export function migratePostgresUrl() {
  return usablePostgresUrl(
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
  );
}
