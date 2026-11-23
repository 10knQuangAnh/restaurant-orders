import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { call } from "./helpers/api.mjs";

assert.ok(process.env.TEST_PLATFORM_SECRET, "Use a test server with PLATFORM_SECRET set");
const headers = { "x-platform-secret": process.env.TEST_PLATFORM_SECRET };
const stamp = Date.now();
const slug = "platform-regression-" + stamp;
assert.equal((await call("/api/platform/tenants", { slug, name: "Forbidden", pin: "746281" })).status, 403);
const r = await call("/api/platform/tenants", { slug, name: "Platform regression", pin: "746281" }, undefined, headers);
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.equal(
  (await call("/api/platform/tenants", { slug, name: "Duplicate", pin: "746281" }, undefined, headers)).status,
  409,
);
const dir = await call("/api/staff/directory?slug=" + slug);
assert.equal(dir.data.people.length, 1);
const login = await call("/api/staff/session", { slug, staffId: dir.data.people[0].id, pin: "746281" });
assert.equal(login.status, 200);
assert.equal((await call("/api/staff/admin", undefined, login.cookie)).data.counts.tables, 0);
console.log("PASS platform authorization, tenant creation, duplicate slug and admin login");
const spec = JSON.parse(await readFile(new URL("../seeds/templates/quan-sample.json", import.meta.url), "utf8"));
spec.tenant.slug = "import-regression-" + stamp;
const imported = await call("/api/platform/tenants/import", spec, undefined, headers);
assert.equal(imported.status, 200, JSON.stringify(imported.data));
assert.equal((await call("/api/platform/tenants/import", spec, undefined, headers)).status, 409);
const directory = await call("/api/staff/directory?slug=" + spec.tenant.slug);
const owner = directory.data.people.find((p) => p.role === "admin");
const auth = await call("/api/staff/session", { slug: spec.tenant.slug, staffId: owner.id, pin: spec.admin.pin });
assert.equal(auth.status, 200);
const menu = await call("/api/staff/admin?section=menu", undefined, auth.cookie);
assert.equal(
  menu.data.items.length,
  spec.categories.reduce((sum, category) => sum + category.items.length, 0),
);
console.log("PASS venue import, duplicate import, imported menu and admin login");
