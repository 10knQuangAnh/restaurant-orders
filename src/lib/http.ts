export function json(data: unknown, status = 200, extra: HeadersInit = {}) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "private, no-store", ...extra },
  });
}

export async function readBody<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
