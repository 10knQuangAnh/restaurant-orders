import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

assert.ok(process.env.PROBE_URL && process.env.QA_SPEC_FILE, "Set PROBE_URL and QA_SPEC_FILE for an isolated QA venue");
const base = process.env.PROBE_URL.replace(/\/$/, "");
const spec = JSON.parse(await readFile(process.env.QA_SPEC_FILE, "utf8"));
assert.ok(spec.tenant.slug.startsWith("qa-live-"), "Only run mutations in a dedicated QA venue");
async function api(path, body, cookie, status = 200) {
  const res = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json();
  if (status != null) assert.equal(res.status, status, `${path}: ${JSON.stringify(data)}`);
  return { status: res.status, data, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}
const dir = (await api("/api/staff/directory?slug=" + spec.tenant.slug)).data;
const sessions = {};
for (const person of [spec.admin, ...spec.staff]) {
  const staff = dir.people.find((p) => p.name === person.name);
  const auth = await api("/api/staff/session", { slug: spec.tenant.slug, staffId: staff.id, pin: person.pin });
  assert.ok(auth.cookie);
  sessions[staff.role] = auth.cookie;
  assert.equal((await api("/api/staff/session", undefined, auth.cookie)).data.staff.role, staff.role);
}
await api("/api/staff/admin", undefined, sessions.waiter, 403);
await api("/api/staff/floor", undefined, sessions.kitchen, 403);
console.log("PASS live role logins, persistent sessions and access controls");
const adminPath = "/api/staff/admin";
const floor = (await api("/api/staff/floor", undefined, sessions.admin)).data;
const tables = floor.tables.map((row) => row.table);
assert.ok(tables.length >= 3);
const [table, second, third] = tables;
const guestPath = "/api/public/table/" + table.qr_token;
const menu = (await api(guestPath)).data;
const dish = menu.items.find((item) => !item.sold_out && item.units.length);
const line = { itemId: dish.id, unitId: dish.units[0].id, qty: 1 };
const ticketPath = (id) => "/api/staff/order/" + id;
const calls = await Promise.all(Array.from({ length: 10 }, () => api(guestPath, { action: "call" }, undefined, null)));
assert.equal(calls.filter((r) => r.status === 200).length, 1);
assert.equal(calls.filter((r) => r.status === 429).length, 9);
const call = (await api("/api/staff/floor", undefined, sessions.waiter)).data.tables.find(
  (row) => row.table.id === table.id,
).call;
await api(ticketPath(call.id), { action: "ack_call" }, sessions.waiter);
console.log("PASS live concurrent staff-call deduplication and acknowledgement");
await api("/api/staff/stock", { itemId: dish.id, stock_left: 3 }, sessions.admin);
const orders = await Promise.all(Array.from({ length: 5 }, () => api(guestPath, { items: [line] }, undefined, null)));
assert.equal(orders.filter((r) => r.status === 200).length, 3);
assert.equal(orders.filter((r) => r.status === 409).length, 2);
const orderId = orders.find((r) => r.status === 200).data.orderId;
assert.equal(new Set(orders.filter((r) => r.status === 200).map((r) => r.data.orderId)).size, 1);
const ticket = (await api(ticketPath(orderId), undefined, sessions.waiter)).data;
assert.equal(ticket.ticket.items.length, 3);
await api(guestPath, { action: "guest", guestName: "QA Guest" });
await api(guestPath, { action: "guest", guestName: "Overwrite" });
assert.equal((await api(ticketPath(orderId), undefined, sessions.waiter)).data.ticket.order.guest_name, "QA Guest");
console.log("PASS live concurrent orders, stock limits, one-open-order and write-once guest details");
const [prepared, unavailable, cancelled] = ticket.ticket.items;
await api("/api/staff/kitchen", { itemId: prepared.id, op: "start" }, sessions.kitchen);
await api("/api/staff/kitchen", { itemId: prepared.id, op: "done" }, sessions.kitchen);
await api("/api/staff/kitchen", { itemId: prepared.id, op: "served" }, sessions.waiter);
await api("/api/staff/kitchen", { itemId: prepared.id, op: "start" }, sessions.kitchen, 409);
await api("/api/staff/kitchen", { itemId: unavailable.id, op: "86" }, sessions.kitchen);
await api(guestPath, { action: "cancel_line", itemId: cancelled.id });
const bill = (await api(ticketPath(orderId), undefined, sessions.waiter)).data.bill;
assert.ok(bill.total > 0 && bill.total < ticket.bill.total);
await api("/api/staff/stock", { itemId: dish.id, stock_left: null, sold_out: false }, sessions.admin);
const payments = await Promise.all(
  Array.from({ length: 10 }, () =>
    api(ticketPath(orderId), { action: "pay", method: "transfer" }, sessions.waiter, null),
  ),
);
assert.equal(payments.filter((r) => r.status === 200).length, 1);
assert.equal(payments.filter((r) => r.status === 409).length, 9);
const paid = (await api(ticketPath(orderId), undefined, sessions.waiter)).data;
assert.equal(paid.ticket.payments.length, 1);
assert.equal(paid.ticket.payments[0].amount_dong, bill.total);
assert.equal(paid.ticket.order.bill_snapshot.total, bill.total);
assert.equal((await api(guestPath)).data.orderId, null);
console.log("PASS live kitchen transitions, 86/cancel billing, concurrent payment and table reset");
const source = (await api(ticketPath("new"), { action: "open", tableId: second.id }, sessions.waiter)).data.orderId;
await api(ticketPath(source), { action: "add", items: [line, line] }, sessions.waiter);
const sourceItems = (await api(ticketPath(source), undefined, sessions.waiter)).data.ticket.items;
const split = (
  await api(ticketPath(source), { action: "split", tableId: third.id, itemIds: [sourceItems[0].id] }, sessions.waiter)
).data.orderId;
await api(ticketPath(source), { action: "discount", amount: 100 }, sessions.waiter);
await api(ticketPath(split), { action: "discount", amount: 200 }, sessions.waiter);
await api(ticketPath(source), { action: "transfer", tableId: table.id }, sessions.waiter);
await api(ticketPath(source), { action: "merge", otherOrderId: split }, sessions.waiter);
const merged = (await api(ticketPath(source), undefined, sessions.waiter)).data;
assert.equal(merged.ticket.items.length, 2);
assert.equal(merged.bill.discount, 300);
await api(ticketPath(source), { action: "void" }, sessions.waiter);
const qrTables = (await api(adminPath + "?section=tables", undefined, sessions.admin)).data.tables;
assert.ok(qrTables.every((row) => row.qr.startsWith("data:image/png")));
assert.equal((await api(adminPath + "?section=reports", undefined, sessions.admin)).data.today.orders, 1);
console.log("PASS live split/transfer/merge, discount preservation, void, QR PNG and revenue reports");

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/t/" + table.qr_token + "/item/" + dish.id);
  await page.getByRole("button", { name: /Thêm món •/ }).click();
  await page.getByRole("button", { name: /Giỏ ·/ }).click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await page.getByRole("heading", { name: "Gọi món thành công" }).waitFor();
  const browserOrder = (await api(guestPath)).data.orderId;
  assert.ok(browserOrder);
  await page.goto(base + "/staff?slug=" + spec.tenant.slug);
  const waiter = spec.staff.find((person) => person.role === "waiter");
  await page.getByRole("button").filter({ hasText: waiter.name }).click();
  for (const digit of waiter.pin) await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/staff/floor");
  await page.goto(base + "/staff/ticket/" + browserOrder);
  await page.getByRole("button", { name: "Tiền mặt", exact: true }).click();
  await page.getByPlaceholder("Khách đưa").fill("0");
  assert.equal(await page.getByRole("button", { name: "Xác nhận thanh toán", exact: true }).isDisabled(), true);
  const browserBill = (await api(ticketPath(browserOrder), undefined, sessions.waiter)).data.bill;
  await page.getByPlaceholder("Khách đưa").fill(String(browserBill.cashTotal));
  await page.getByRole("button", { name: "Xác nhận thanh toán", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/staff/floor");
  assert.equal((await api(ticketPath(browserOrder), undefined, sessions.waiter)).data.ticket.order.status, "paid");
  assert.equal((await api(guestPath)).data.orderId, null);
  assert.deepEqual(errors, []);
  console.log("PASS live mobile guest cart → staff PIN login → cash checkout → empty table, no browser crashes");
} finally {
  await browser.close();
}
