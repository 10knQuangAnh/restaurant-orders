import assert from "node:assert/strict";
import { chromium } from "playwright";

assert.ok(process.env.PROBE_URL, "Set PROBE_URL to the deployment being verified");
const base = process.env.PROBE_URL.replace(/\/$/, "");
const slug = process.env.PROBE_SLUG || "quan-tu-do";

async function get(path, status = 200) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  const body = await response.json();
  assert.equal(response.status, status, `${path}: ${JSON.stringify(body)}`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  return body;
}

assert.equal((await get("/api/readyz")).ready, true);
const directory = await get("/api/staff/directory?slug=" + encodeURIComponent(slug));
assert.ok(directory.people.length > 0, "staff directory is populated");
assert.ok(
  directory.people.every((person) => !("pin" in person)),
  "directory does not expose PINs",
);
const venue = await get("/api/public/venue?slug=" + encodeURIComponent(slug));
assert.ok(venue.guestPath?.startsWith("/t/"), "venue has a guest QR");
const menu = await get("/api/public/table/" + venue.guestPath.slice(3));
assert.equal(menu.tenant.id, directory.tenant.id);
assert.ok(menu.items.length > 0, "guest menu is populated");
await get("/api/staff/admin", 401);
await get("/api/staff/floor", 401);
await get("/api/staff/directory?slug=smoke-nonexistent-" + Date.now(), 404);
console.log("PASS deployed readiness, staff directory, venue, guest menu, access controls");

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/staff?slug=" + encodeURIComponent(slug));
  await page.getByRole("heading", { name: directory.tenant.name, exact: true }).waitFor();
  await page.getByRole("button").filter({ hasText: directory.people[0].name }).waitFor();
  assert.equal(await page.getByText("Không tìm thấy quán", { exact: true }).count(), 0);
  await page.goto(base + venue.guestPath);
  await page.getByRole("button", { name: "Tìm món", exact: true }).waitFor();
  await page.goto(base + "/staff/admin/staff");
  await page.waitForURL((url) => url.pathname === "/staff");
  assert.deepEqual(errors, [], "no browser crashes on the deployment");
  console.log("PASS deployed mobile staff login screen, guest menu and protected admin redirect");
} finally {
  await browser.close();
}
