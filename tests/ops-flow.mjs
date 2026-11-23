const B = process.env.PROBE_URL || "http://127.0.0.1:3000";
const fail = (m) => {
  console.error("FAIL", m);
  process.exit(1);
};
const ok = (id, extra) => console.log("OK", id, extra ?? "");

async function call(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(B + path, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setc = res.headers.get("set-cookie");
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, cookie: setc ? setc.split(";")[0] : cookie };
}

async function login(pin, namePart) {
  const d = await call("/api/staff/directory?slug=quan-tu-do");
  const person = (d.data?.people || []).find((p) => String(p.name).includes(namePart));
  if (!person) fail("no person " + namePart);
  const r = await call("/api/staff/session", { method: "POST", body: { slug: "quan-tu-do", staffId: person.id, pin } });
  if (r.status !== 200) fail("login " + namePart + " " + r.status);
  return r.cookie;
}

const admin = await login("5577", "Tâm");
const waiter = await login("1397", "Minh");

const tables = await call("/api/staff/admin?section=tables", { cookie: admin });
if (tables.status !== 200 || !tables.data.tables?.[0]?.qr?.startsWith("data:image/png")) fail("qr png");
ok("QR png data URL", tables.data.tables.length);

const reports = await call("/api/staff/admin?section=reports&range=week", { cookie: admin });
if (reports.status !== 200 || !reports.data.range?.from) fail("reports week");
ok("reports week", reports.data.range);

const menu = await call("/api/staff/admin?section=menu", { cookie: admin });
const cat = menu.data.categories[0];
const extra = await call("/api/staff/admin", {
  method: "POST",
  cookie: admin,
  body: { action: "save_category", name: "Nhóm test " + Date.now() },
});
if (extra.status !== 200 || !extra.data.id) fail("save_category");
const moved = await call("/api/staff/admin", {
  method: "POST",
  cookie: admin,
  body: { action: "delete_category", id: extra.data.id, moveTo: cat.id },
});
if (moved.status !== 200) fail("delete empty category " + JSON.stringify(moved.data));
ok("category CRUD");

const jpeg =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAD/2Q==";
const photo = await call("/api/staff/admin", {
  method: "POST",
  cookie: admin,
  body: { action: "upload_photo", mime: "image/jpeg", data: jpeg, itemId: menu.data.items[0].id },
});
if (photo.status !== 200 || !photo.data.url) fail("upload_photo " + JSON.stringify(photo.data));
const img = await fetch(B + photo.data.url);
if (img.status !== 200 || !img.headers.get("content-type")?.includes("jpeg")) fail("media get");
ok("photo upload", photo.data.url);

const save = await call("/api/staff/admin", {
  method: "POST",
  cookie: admin,
  body: {
    action: "save_item",
    id: menu.data.items[0].id,
    name: menu.data.items[0].name,
    category_id: menu.data.items[0].category_id,
    price_dong: menu.data.items[0].units[0].price_dong,
    image_url: photo.data.url,
  },
});
if (save.status !== 200) fail("save_item edit");
ok("edit item");

const floor = await call("/api/staff/floor", { cookie: waiter });
const free = (floor.data.tables || []).find((t) => !t.orderId);
if (!free) fail("no free table");
const token = free.table.qr_token;
const pub = await call("/api/public/table/" + token);
const dish = (pub.data.items || []).find((i) => !i.sold_out && i.units?.[0]);
const ordered = await call("/api/public/table/" + token, {
  method: "POST",
  body: { action: "order", items: [{ itemId: dish.id, unitId: dish.units[0].id, qty: 1 }] },
});
if (ordered.status !== 200) fail("guest order " + ordered.status);
const line = (ordered.data.items || []).find((i) => i.kitchen_status === "queued");
if (!line) fail("no queued line");
const gone = await call("/api/public/table/" + token, {
  method: "POST",
  body: { action: "cancel_line", itemId: line.id },
});
if (gone.status !== 200) fail("cancel_line " + JSON.stringify(gone.data));
if ((gone.data.ordered || []).some((i) => i.id === line.id && i.kitchen_status !== "cancelled")) fail("line still live");
ok("guest cancel queued");

const ordered2 = await call("/api/public/table/" + token, {
  method: "POST",
  body: { action: "order", items: [{ itemId: dish.id, unitId: dish.units[0].id, qty: 1 }] },
});
const line2 = (ordered2.data.items || []).find((i) => i.kitchen_status === "queued");
const ticket = await call("/api/staff/order/" + ordered2.data.orderId, { cookie: waiter });
const billBefore = ticket.data.bill.total;
const cancelStaff = await call("/api/staff/order/" + ordered2.data.orderId, {
  method: "POST",
  cookie: waiter,
  body: { action: "patch_item", itemId: line2.id, cancel: true, cancelReason: "Khách đổi ý" },
});
if (cancelStaff.status !== 200) fail("staff cancel " + JSON.stringify(cancelStaff.data));
const ticket2 = await call("/api/staff/order/" + ordered2.data.orderId, { cookie: waiter });
if (!(ticket2.data.bill.total < billBefore) && billBefore !== 0) {
  if (ticket2.data.bill.total !== 0) fail("bill after cancel " + ticket2.data.bill.total + " vs " + billBefore);
}
ok("staff cancel bill", ticket2.data.bill.total);

const ordered3 = await call("/api/public/table/" + token, {
  method: "POST",
  body: { action: "order", items: [{ itemId: dish.id, unitId: dish.units[0].id, qty: 1 }] },
});
const pay = await call("/api/staff/order/" + ordered3.data.orderId, {
  method: "POST",
  cookie: waiter,
  body: { action: "pay", method: "cash" },
});
if (pay.status !== 200 || !pay.data.tableReset) fail("pay reset " + JSON.stringify(pay.data));
const after = await call("/api/public/table/" + token);
if (after.data.orderId) fail("table still has open order");
ok("pay then table empty for next QR");

console.log("ops-flow complete");
