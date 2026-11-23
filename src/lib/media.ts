const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 900_000;

export function parseImagePayload(mimeRaw: unknown, dataRaw: unknown): { mime: string; data: string } | null {
  const mime = String(mimeRaw || "").toLowerCase().split(";")[0].trim();
  if (!ALLOWED.has(mime)) return null;
  let data = String(dataRaw || "").replace(/\s/g, "");
  const comma = data.indexOf("base64,");
  if (data.startsWith("data:") && comma >= 0) data = data.slice(comma + 7);
  if (!/^[A-Za-z0-9+/]+=*$/.test(data) || data.length < 24) return null;
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes > MAX_BYTES) return null;
  return { mime, data };
}

export function publicMediaPath(id: string): string {
  return `/api/media/${id}`;
}

export function isSafeImageUrl(url: string): boolean {
  if (!url) return true;
  return (
    url.startsWith("/api/media/") ||
    url.startsWith("/dishes/") ||
    url.startsWith("/logo") ||
    url.startsWith("/icons/")
  );
}
