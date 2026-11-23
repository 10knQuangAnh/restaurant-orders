import assert from "node:assert/strict";

export const base = process.env.PROBE_URL || "http://127.0.0.1:3000";
export async function call(path, body, cookie, headers = {}) {
  const res = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
export async function login(name = "Tâm", pin = "5577", slug = "quan-tu-do") {
  const dir = await call("/api/staff/directory?slug=" + slug);
  const person = dir.data.people.find((p) => p.name.includes(name));
  assert.ok(person, "fixture staff exists");
  const r = await call("/api/staff/session", { slug, staffId: person.id, pin });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.cookie;
}
