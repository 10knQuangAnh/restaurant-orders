import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { base, call, login } from "./helpers/api.mjs";

// Set PLAYWRIGHT_MODULE when Playwright is installed outside this repository.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  headless: true,
});
const errors = [];
const admin = await login();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
try {
  const code = "UI" + Date.now().toString().slice(-7);
  await call("/api/staff/admin", { action: "add_table", code, name: code }, admin);
  const table = (await call("/api/staff/floor", undefined, admin)).data.tables.find((t) => t.table.code === code).table;
  const opened = await call("/api/staff/order/new", { action: "open", tableId: table.id }, admin);
  const orderId = opened.data.orderId;
  const name = "UI PIN " + Date.now();
  const pin = "6" + Date.now().toString().slice(-7);
  assert.equal((await call("/api/staff/admin", { action: "add_staff", name, pin, role: "waiter" }, admin)).status, 200);
  await page.goto(base + "/staff?slug=quan-tu-do");
  await page.getByRole("button", { name: name + " Phục vụ" }).click();
  let attempts = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/staff/session") && req.method() === "POST") attempts++;
  });
  for (const digit of pin) await page.getByRole("button", { name: digit, exact: true }).click();
  assert.equal(attempts, 0, "typing long PIN must not submit partial PINs");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL("**/staff/floor");
  assert.equal(attempts, 1);
  console.log("PASS mobile login with eight-digit PIN");
  await page.goto(base + "/staff/ticket/" + orderId);
  await page.getByRole("button", { name: "Tiền mặt", exact: true }).click();
  await page.route("**/api/staff/order/" + orderId, async (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "not_open" }),
      });
    return route.continue();
  });
  await page.getByRole("button", { name: "Xác nhận thanh toán", exact: true }).click();
  await page.waitForTimeout(1600);
  assert.ok(page.url().includes("/staff/ticket/"), "failed payment must not redirect to floor");
  assert.equal(await page.getByText("Đã thu · bàn trống, khách mới quét QR được").count(), 0);
  console.log("PASS failed payment stays on ticket and displays error");
  await page.unrouteAll();
  // Admin screens must survive a guest opening a protected deep link without a session.
  const guest = await browser.newContext();
  const g = await guest.newPage();
  g.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/staff/admin",
    "/staff/admin/menu",
    "/staff/admin/staff",
    "/staff/admin/tables",
    "/staff/admin/settings",
    "/staff/admin/categories",
    "/staff/admin/reports",
    "/staff/stock",
    "/staff/kitchen",
    "/staff/floor",
  ]) {
    await g.goto(base + path);
    await g.waitForTimeout(150);
  }
  await guest.close();
  const [cookieName, ...cookieValue] = admin.split("=");
  await context.addCookies([{ name: cookieName, value: cookieValue.join("="), url: base }]);
  for (const path of [
    "/staff/admin",
    "/staff/admin/menu",
    "/staff/admin/staff",
    "/staff/admin/tables",
    "/staff/admin/settings",
    "/staff/admin/categories",
    "/staff/admin/reports",
    "/staff/stock",
    "/staff/kitchen",
    "/staff/floor",
    "/t/" + table.qr_token,
  ]) {
    const res = await page.goto(base + path);
    assert.equal(res.status(), 200, path);
    await page.waitForTimeout(200);
  }
  assert.deepEqual(errors, [], "browser runtime errors");
  console.log("PASS authenticated and unauthenticated route sweep");
  const menu = (await call("/api/public/table/" + table.qr_token)).data;
  const dish = menu.items.find((i) => !i.sold_out && i.units.length);
  await page.goto(base + "/t/" + table.qr_token + "/item/" + dish.id);
  await page.getByRole("button", { name: /Thêm món •/ }).click();
  await page.getByRole("button", { name: /Giỏ ·/ }).click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await page.getByRole("heading", { name: "Gọi món thành công" }).waitFor();
  await page.goto(base + "/t/" + table.qr_token + "/ordered");
  await page.getByRole("button", { name: "Gỡ món", exact: true }).click();
  await page.getByText("Chưa có món nào được gửi.").waitFor();
  assert.deepEqual(errors, [], "guest ordering runtime errors");
  console.log("PASS guest selects dish, submits cart, views order, cancels queued dish");
  const splitCode = "US" + Date.now().toString().slice(-7);
  await call("/api/staff/admin", { action: "add_table", code: splitCode, name: splitCode }, admin);
  const splitTable = (await call("/api/staff/floor", undefined, admin)).data.tables.find(
    (t) => t.table.code === splitCode,
  ).table;
  const addLine = { itemId: dish.id, unitId: dish.units[0].id, qty: 1 };
  await call("/api/staff/order/" + orderId, { action: "add", items: [addLine, addLine] }, admin);
  await page.goto(base + "/staff/ticket/" + orderId);
  await page.getByRole("button", { name: "Tách", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Chọn bàn tách", exact: true }).isDisabled(), true);
  await page.locator(".ticket-line").getByRole("button", { name: "Tách", exact: true }).first().click();
  await page.getByRole("button", { name: "Chọn bàn tách", exact: true }).click();
  await page.getByRole("button", { name: splitCode + " " + splitCode, exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/staff/ticket/") && !url.pathname.endsWith("/" + orderId));
  const splitOrderId = page.url().split("/").at(-1);
  assert.equal((await call("/api/staff/order/" + splitOrderId, undefined, admin)).data.ticket.items.length, 1);
  assert.equal(
    (await call("/api/staff/order/" + splitOrderId, undefined, admin)).data.ticket.order.table_id,
    splitTable.id,
  );
  await call("/api/staff/order/" + splitOrderId, { action: "void" }, admin);
  console.log("PASS staff selects a line before splitting to another free table");
  await call("/api/staff/order/" + orderId, { action: "void" }, admin);
} finally {
  await browser.close();
}
