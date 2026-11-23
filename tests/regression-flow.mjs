import assert from "node:assert/strict";
import { call, login } from "./helpers/api.mjs";

const admin = await login();
const otherDirectory = await call("/api/staff/directory?slug=quan-sao-bien");
const other = await login(otherDirectory.data.people.find((p) => p.role === "admin").name, "2580", "quan-sao-bien");
const menu = (await call("/api/staff/admin?section=menu", undefined, admin)).data;
const dish = menu.items.find((i) => i.active && !i.sold_out && i.units.length);
const line = (qty) => ({ itemId: dish.id, unitId: dish.units[0].id, qty });
const path = (id) => "/api/staff/order/" + id;
const stamp = Date.now();
async function table(suffix) {
  const code = ("R" + stamp.toString().slice(-6) + suffix).slice(0, 12);
  assert.equal((await call("/api/staff/admin", { action: "add_table", code, name: code }, admin)).status, 200);
  return (await call("/api/staff/floor", undefined, admin)).data.tables.find((t) => t.table.code === code).table;
}
const t = await table("a");
const dest = await table("b");
const pub = "/api/public/table/" + t.qr_token;
let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log("PASS", name);
  } catch (e) {
    failures++;
    console.error("FAIL", name, e.message);
  }
}
let orderId;
await test("concurrent first orders all succeed on one open ticket", async () => {
  const rs = await Promise.all(Array.from({ length: 5 }, () => call(pub, { items: [line(1)], guestName: "First" })));
  orderId = rs.find((r) => r.data.orderId)?.data.orderId;
  assert.deepEqual(
    rs.map((r) => r.status),
    [200, 200, 200, 200, 200],
  );
  assert.equal(new Set(rs.map((r) => r.data.orderId)).size, 1);
});
await test("ordering again preserves guest details", async () => {
  await call(pub, { items: [line(1)], guestName: "Overwrite" });
  assert.equal((await call(path(orderId), undefined, admin)).data.ticket.order.guest_name, "First");
});
await test("concurrent staff calls create exactly one open call", async () => {
  const rs = await Promise.all(Array.from({ length: 15 }, () => call(pub, { action: "call" })));
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.equal(rs.filter((r) => r.status === 429).length, 14);
});
await test("malformed JSON object and malformed order lines return 400", async () => {
  for (const body of [
    null,
    [],
    { items: "bad" },
    { items: [null] },
    { items: [line(1), line(-1)] },
    { items: [line(1.5)] },
    { action: "unknown" },
  ]) {
    assert.equal((await call(pub, body)).status, 400, JSON.stringify(body));
  }
});
await test("unknown staff operation returns 400", async () => {
  assert.equal((await call(path(orderId), { action: "unknown" }, admin)).status, 400);
});
await test("menu edits save unit names and preserve hidden status", async () => {
  const body = {
    action: "save_item",
    name: "Regression dish " + stamp,
    category_id: dish.category_id,
    price_dong: 12345,
    unit_name: "Bowl",
    active: false,
  };
  const added = await call("/api/staff/admin", body, admin);
  assert.equal(added.status, 200);
  const id = added.data.itemId;
  await call("/api/staff/admin", { ...body, id, active: undefined, unit_name: "Plate" }, admin);
  const saved = (await call("/api/staff/admin?section=menu", undefined, admin)).data.items.find((i) => i.id === id);
  assert.equal(saved.active, false);
  assert.equal(saved.units[0].name, "Plate");
});
await test("stock cannot oversell duplicate lines or concurrent orders", async () => {
  await call("/api/staff/stock", { itemId: dish.id, stock_left: 3 }, admin);
  assert.equal((await call(pub, { items: [line(2), line(2)] })).status, 409);
  const rs = await Promise.all(Array.from({ length: 5 }, () => call(pub, { items: [line(1)] })));
  assert.equal(rs.filter((r) => r.status === 200).length, 3);
  assert.equal(rs.filter((r) => r.status === 409).length, 2);
  await call("/api/staff/stock", { itemId: dish.id, stock_left: null, sold_out: false }, admin);
});
await test("quantity edits reconcile finite stock", async () => {
  await call("/api/staff/stock", { itemId: dish.id, stock_left: 10 }, admin);
  const item = (await call(path(orderId), undefined, admin)).data.ticket.items.find(
    (i) => i.kitchen_status === "queued",
  );
  assert.equal((await call(path(orderId), { action: "patch_item", itemId: item.id, qty: 3 }, admin)).status, 200);
  const items = (await call("/api/staff/stock", undefined, admin)).data.items;
  assert.equal(items.find((i) => i.id === dish.id).stock_left, 8);
  await call("/api/staff/stock", { itemId: dish.id, stock_left: null, sold_out: false }, admin);
});
await test("split requires a different free table and selected lines", async () => {
  const item = (await call(path(orderId), undefined, admin)).data.ticket.items[0];
  assert.equal((await call(path(orderId), { action: "split", itemIds: [item.id], tableId: t.id }, admin)).status, 409);
  const r = await call(path(orderId), { action: "split", itemIds: [item.id], tableId: dest.id }, admin);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await call(path(r.data.orderId), undefined, admin)).data.ticket.items.length, 1);
  await call(path(r.data.orderId), { action: "void" }, admin);
});
await test("foreign staff reset cannot revoke another tenant session", async () => {
  const d = await call("/api/staff/directory?slug=quan-sao-bien");
  const id = d.data.people.find((p) => p.role === "admin").id;
  assert.equal((await call("/api/staff/admin", { action: "reset_pin", id, pin: "746281" }, admin)).status, 404);
  assert.equal((await call("/api/staff/floor", undefined, other)).status, 200);
});
await test("invalid numeric stock input returns 400", async () => {
  assert.equal((await call("/api/staff/stock", { itemId: dish.id, stock_left: "NaN" }, admin)).status, 400);
});
await test("simultaneous kitchen transitions allow only one start", async () => {
  const item = (await call(path(orderId), undefined, admin)).data.ticket.items.find(
    (i) => i.kitchen_status === "queued",
  );
  const rs = await Promise.all(
    Array.from({ length: 5 }, () => call("/api/staff/kitchen", { itemId: item.id, op: "start" }, admin)),
  );
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.equal(rs.filter((r) => r.status === 409).length, 4);
  assert.equal((await call("/api/staff/kitchen", { itemId: item.id, op: "done" }, admin)).status, 200);
  assert.equal((await call("/api/staff/kitchen", { itemId: item.id, op: "served" }, admin)).status, 200);
  assert.equal((await call("/api/staff/kitchen", { itemId: item.id, op: "start" }, admin)).status, 409);
});
await test("malformed login fields return 400", async () => {
  assert.equal((await call("/api/staff/session", { slug: 5, staffId: "bad", pin: 1234 })).status, 400);
});
await test("concurrent cancellation restores stock only once", async () => {
  await call("/api/staff/stock", { itemId: dish.id, stock_left: 10 }, admin);
  const r = await call(pub, { items: [line(1)] });
  const item = r.data.items.at(-1);
  const rs = await Promise.all(
    Array.from({ length: 5 }, () =>
      call(
        path(orderId),
        {
          action: "patch_item",
          itemId: item.id,
          cancel: true,
          cancelReason: "Regression",
        },
        admin,
      ),
    ),
  );
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.equal(rs.filter((r) => r.status === 409).length, 4);
  const stock = (await call("/api/staff/stock", undefined, admin)).data.items.find((i) => i.id === dish.id);
  assert.equal(stock.stock_left, 10);
  await call("/api/staff/stock", { itemId: dish.id, stock_left: null, sold_out: false }, admin);
});
await test("foreign stock update is rejected", async () => {
  assert.equal((await call("/api/staff/stock", { itemId: dish.id, stock_left: 0 }, other)).status, 404);
});
await test("cash settlement matches displayed rounded total and rejects short cash", async () => {
  await call("/api/staff/admin", { action: "settings", cash_round_to: 1000 }, admin);
  await call(path(orderId), { action: "discount", amount: 123 }, admin);
  const bill = (await call(path(orderId), undefined, admin)).data.bill;
  assert.equal((await call(path(orderId), { action: "pay", method: "cash", received: 1 }, admin)).status, 400);
  const pay = await call(path(orderId), { action: "pay", method: "cash", received: bill.cashTotal }, admin);
  assert.equal(pay.status, 200);
  assert.equal(pay.data.paid, bill.cashTotal);
  const paid = (await call(path(orderId), undefined, admin)).data;
  assert.equal(paid.ticket.payments[0].amount_dong, bill.cashTotal);
  assert.equal((await call(path(orderId), { action: "pay", method: "cash" }, admin)).status, 409);
  await call("/api/staff/admin", { action: "settings", cash_round_to: 0 }, admin);
});
await test("concurrent payments record a single settlement", async () => {
  const opened = await call("/api/staff/order/new", { action: "open", tableId: dest.id }, admin);
  const id = opened.data.orderId;
  await call(path(id), { action: "add", items: [line(1)] }, admin);
  const rs = await Promise.all(
    Array.from({ length: 10 }, () => call(path(id), { action: "pay", method: "transfer" }, admin)),
  );
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.equal(rs.filter((r) => r.status === 409).length, 9);
  assert.equal((await call(path(id), undefined, admin)).data.ticket.payments.length, 1);
});
await test("transfer and merge preserve lines and discounts", async () => {
  const movedTable = await table("c");
  const source = (await call("/api/staff/order/new", { action: "open", tableId: t.id }, admin)).data.orderId;
  const target = (await call("/api/staff/order/new", { action: "open", tableId: dest.id }, admin)).data.orderId;
  for (const id of [source, target])
    assert.equal((await call(path(id), { action: "add", items: [line(1)] }, admin)).status, 200);
  await call(path(source), { action: "discount", amount: 1000 }, admin);
  await call(path(target), { action: "discount", amount: 2000 }, admin);
  assert.equal((await call(path(source), { action: "transfer", tableId: movedTable.id }, admin)).status, 200);
  const floor = (await call("/api/staff/floor", undefined, admin)).data.tables;
  assert.equal(floor.find((row) => row.table.id === t.id).orderId, null);
  assert.equal(floor.find((row) => row.table.id === movedTable.id).orderId, source);
  assert.equal((await call(path(source), { action: "merge", otherOrderId: target }, admin)).status, 200);
  const merged = (await call(path(source), undefined, admin)).data;
  assert.equal(merged.ticket.items.length, 2);
  assert.equal(merged.bill.discount, 3000);
  assert.equal((await call(path(target), undefined, admin)).data.ticket.order.status, "merged");
  assert.equal((await call(path(source), undefined, other)).status, 404);
  await call(path(source), { action: "void" }, admin);
});
await test("staff endpoints reject missing sessions and cross-origin writes", async () => {
  for (const endpoint of ["floor", "stock", "kitchen", "inbox", "menu", "admin", "order/" + orderId]) {
    assert.equal((await call("/api/staff/" + endpoint)).status, 401, endpoint);
  }
  assert.equal(
    (await call(path(orderId), { action: "pay" }, admin, { origin: "https://foreign.example" })).status,
    403,
  );
});
await test("concurrent wrong PINs trigger lockout", async () => {
  const name = "Lock regression " + stamp;
  const pin = "9" + stamp.toString().slice(-7);
  assert.equal((await call("/api/staff/admin", { action: "add_staff", name, pin, role: "waiter" }, admin)).status, 200);
  const dir = await call("/api/staff/directory?slug=quan-tu-do");
  const staffId = dir.data.people.find((p) => p.name === name).id;
  const rs = await Promise.all(
    Array.from({ length: 12 }, () =>
      call("/api/staff/session", {
        slug: "quan-tu-do",
        staffId,
        pin: "00000000",
      }),
    ),
  );
  assert.equal(rs.filter((r) => r.status === 401).length, 5);
  assert.equal(rs.filter((r) => r.status === 429).length, 7);
  await call("/api/staff/admin", { action: "set_staff_active", id: staffId, active: false }, admin);
});
await call("/api/staff/stock", { itemId: dish.id, stock_left: null, sold_out: false }, admin);
await call(path(orderId), { action: "void" }, admin);
if (failures) process.exitCode = 1;
