import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.PROBE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
try {
  for (const [status, message] of [
    [404, "Không tìm thấy quán"],
    [500, "Máy chủ đang gặp lỗi. Vui lòng thử lại sau."],
    [503, "Dịch vụ dữ liệu đang không sẵn sàng. Vui lòng thử lại sau."],
    [0, "Không kết nối được máy chủ. Kiểm tra mạng và thử lại."],
  ]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/staff/session", (route) => route.fulfill({ json: { staff: null } }));
    await page.route("**/api/staff/directory?*", (route) =>
      status ? route.fulfill({ status, json: { error: status === 404 ? "unknown_tenant" : "server" } }) : route.abort(),
    );
    await page.goto(base + "/staff?slug=quan-tu-do");
    await page.getByText(message, { exact: true }).waitFor({ timeout: 5000 });
    assert.deepEqual(errors, []);
    console.log("PASS directory error", status);
    await context.close();
  }
} finally {
  await browser.close();
}
