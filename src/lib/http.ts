export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export function json(data: unknown, status = 200, extra: HeadersInit = {}) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      ...extra,
    },
  });
}

export async function readBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "bad_json");
  }
}

function portOf(u: URL): string {
  return u.port || (u.protocol === "https:" ? "443" : "80");
}

function loopbackEquivalent(a: URL, b: URL): boolean {
  const loopback = new Set(["localhost", "127.0.0.1", "::1"]);
  return (
    a.protocol === b.protocol &&
    portOf(a) === portOf(b) &&
    loopback.has(a.hostname) &&
    loopback.has(b.hostname)
  );
}

export function assertSameOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new ApiError(403, "csrf");
  }
  const candidates: URL[] = [new URL(request.url)];
  const host = request.headers.get("host");
  if (host) {
    try {
      const proto = (request.headers.get("x-forwarded-proto") || candidates[0].protocol.replace(":", ""))
        .split(",")[0]
        .trim();
      candidates.push(new URL(`${proto}://${host}`));
    } catch {
      /* ignore */
    }
  }
  const ok = candidates.some((u) => u.origin === originUrl.origin || loopbackEquivalent(originUrl, u));
  if (!ok) throw new ApiError(403, "csrf");
}

export function wrap(handler: (request: Request, ctx?: unknown) => Promise<Response>) {
  return async (request: Request, ctx?: unknown) => {
    try {
      assertSameOrigin(request);
      return await handler(request, ctx);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.code }, error.status);
      console.error("api_error", error);
      return json({ error: "server" }, 500);
    }
  };
}

export function featureOn(
  features: Record<string, boolean> | null | undefined,
  key: string,
  fallback = true,
): boolean {
  if (!features || typeof features[key] === "undefined") return fallback;
  return features[key] !== false;
}
