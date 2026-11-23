const B = process.env.PROBE_URL || "http://127.0.0.1:3000";
const out = [];
const log = (id, title, result) => {
  out.push({ id, title, result });
  console.log(`[${id}] ${title}\n    => ${typeof result === "string" ? result : JSON.stringify(result)}`);
};
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
  return { status: res.status, data, setc };
}
async function login(pin, slug = "quan-tu-do", namePart = "") {
  const d = await call("/api/staff/directory?slug=" + slug);
  const people = d.data?.people || [];
  const person =
    (namePart && people.find((p) => String(p.name).includes(namePart))) ||
    people.find((p) => p.role === "admin") ||
    people[0];
  if (!person) return { r: d, cookie: null };
  const r = await call("/api/staff/session", { method: "POST", body: { slug, staffId: person.id, pin } });
  return { r, cookie: r.setc ? r.setc.split(";")[0] : null, staffId: person.id, slug, name: person.name };
}

let r = await call("/api/staff/admin?section=overview");
log("A1", "Admin API with NO cookie/PIN", { status: r.status, role: r.data?.staff?.role, name: r.data?.staff?.name });

const admin = await login("2580", "quan-tu-do", "Lan");
const aC = admin.cookie;
r = await call("/api/staff/admin?section=staff", { cookie: aC });
log("A2", "Admin staff list returns PIN field", {
  status: r.status,
  sample: r.data?.people?.slice(0, 3).map((p) => ({ name: p.name, pin: p.pin })),
});

const dir = await call("/api/staff/directory?slug=quan-tu-do");
const hoa = (dir.data?.people || []).find((p) => String(p.name).includes("Hoa"));
let codes = new Set();
for (let i = 0; i < 40; i++) {
  const x = await call("/api/staff/session", {
    method: "POST",
    body: { slug: "quan-tu-do", staffId: hoa?.id, pin: String(9000 + i) },
  });
  codes.add(x.status);
}
log("A3", "40 wrong PIN attempts in a row — status codes seen", [...codes]);

const w = await login("1397", "quan-tu-do", "Minh");
await call("/api/staff/session", { method: "DELETE", cookie: w.cookie });
r = await call("/api/staff/floor", { cookie: w.cookie });
log("A4", "Waiter cookie reused AFTER logout (DELETE)", { status: r.status });

r = await call("/api/staff/floor", { cookie: aC });
const tables = (r.data.tables || []).map((t) => ({
  id: t.table.id,
  code: t.table.code,
  token: t.table.qr_token,
  orderId: t.orderId,
}));
log("I0", "tables (first 6)", tables.slice(0, 6));
const free = tables.find((t) => !t.orderId);

const menu = (await call("/api/public/table/" + free.token)).data;
const item = menu.items.find((i) => !i.sold_out && i.units.length);
const mk = () =>
  call("/api/public/table/" + free.token, {
    method: "POST",
    body: { items: [{ itemId: item.id, unitId: item.units[0].id, qty: 1 }] },
  });
const rs = await Promise.all([mk(), mk(), mk(), mk(), mk()]);
const orderIds = new Set(rs.map((x) => x.data?.orderId).filter(Boolean));
log("B1", "5 concurrent guest orders on an empty table — distinct open order ids", {
  distinct: orderIds.size,
  ids: [...orderIds],
});

log("B2", "Guest order went straight to kitchen without staff approval", rs[0].data?.items?.map((i) => ({
  name: i.name_snapshot,
  kitchen_status: i.kitchen_status,
})));

const target = menu.items.find((i) => i.id !== item.id && !i.sold_out && i.units.length);
await call("/api/staff/admin", {
  method: "POST",
  cookie: aC,
  body: { action: "save_item", id: target.id, name: target.name, category_id: target.category_id, active: false },
});
r = await call("/api/public/table/" + free.token, {
  method: "POST",
  body: { items: [{ itemId: target.id, unitId: target.units[0].id, qty: 1 }] },
});
log("B3", "Guest orders an item with active=false", { status: r.status, ok: r.data?.ok });
await call("/api/staff/admin", {
  method: "POST",
  cookie: aC,
  body: { action: "save_item", id: target.id, name: target.name, category_id: target.category_id, active: true },
});

await call("/api/public/table/" + free.token, {
  method: "POST",
  body: { action: "guest", guestName: "Bạn A", guestPhone: "0900000001" },
});
const beforeName = (await call("/api/staff/floor", { cookie: aC })).data.tables.find((t) => t.table.id === free.id)
  ?.guestName;
r = await call("/api/public/table/" + free.token, {
  method: "POST",
  body: { action: "guest", guestName: "KẺ PHÁ", guestPhone: "0000" },
});
const chk = await call("/api/staff/floor", { cookie: aC });
const afterName = chk.data.tables.find((t) => t.table.id === free.id)?.guestName;
log("B4", "Anyone with QR link can overwrite guest name on open order", {
  before: beforeName,
  after: afterName,
  overwritten: afterName === "KẺ PHÁ",
});

let okc = 0;
let limited = 0;
for (let i = 0; i < 30; i++) {
  const x = await call("/api/public/table/" + free.token, { method: "POST", body: { action: "call", reason: "x".repeat(5) } });
  if (x.status === 200) okc++;
  if (x.status === 429) limited++;
}
log("B5", "30 call-staff requests accepted (no rate limit / dedupe)", { ok: okc, limited });

const oid = [...orderIds][0];
let t = await call("/api/staff/order/" + oid, { cookie: aC });
log("C0", "bill before", t.data?.bill);

const c1add = await call("/api/staff/order/" + oid, {
  method: "POST",
  cookie: aC,
  body: { action: "add", items: [{ itemId: item.id, unitId: item.units[0].id, qty: -3 }] },
});
t = await call("/api/staff/order/" + oid, { cookie: aC });
log("C1", "bill after staff 'add' qty=-3", { bill: t.data?.bill, qtys: t.data?.ticket?.items?.map((i) => i.qty), addStatus: c1add.status });

const kit = await login("4466", "quan-tu-do", "Hùng");
const q = await call("/api/staff/kitchen", { cookie: kit.cookie });
const tk = q.data.tickets.find((x) => x.order_id === oid && x.qty > 0);
const before = (await call("/api/staff/order/" + oid, { cookie: aC })).data.bill.total;
await call("/api/staff/kitchen", { method: "POST", cookie: kit.cookie, body: { itemId: tk.id, op: "86" } });
const after = (await call("/api/staff/order/" + oid, { cookie: aC })).data.bill.total;
log("C2", "Kitchen marks one line '86' (cannot cook) — bill total before/after", {
  before,
  after,
  charged_still: before === after,
});

const q2 = await call("/api/staff/kitchen", { cookie: kit.cookie });
const tk2 = q2.data.tickets.find((x) => x.order_id === oid);
if (tk2) {
  await call("/api/staff/kitchen", { method: "POST", cookie: kit.cookie, body: { itemId: tk2.id, op: "done" } });
  const rr = await call("/api/staff/kitchen", { method: "POST", cookie: kit.cookie, body: { itemId: tk2.id, op: "start" } });
  log("C3", "Kitchen can move a DONE line back to 'preparing' (no state machine) — API status", rr.status);
} else {
  log("C3", "Kitchen can move a DONE line back to 'preparing' (no state machine) — API status", "no-ticket");
}

const b1 = (await call("/api/staff/order/" + oid, { cookie: aC })).data.bill;
await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "settings", service_rate: 0.15 } });
const b2 = (await call("/api/staff/order/" + oid, { cookie: aC })).data.bill;
await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "settings", service_rate: 0.05 } });
log("C4", "Order bill after tenant service_rate 5%→15% (order has its own snapshot)", {
  before: b1.service,
  after: b2.service,
});

t = await call("/api/staff/order/" + oid, { method: "POST", cookie: aC, body: { action: "discount", amount: 10000 } });
const t2 = await call("/api/staff/order/" + oid, { cookie: aC });
log("C5", "Is there any way to apply a discount/voucher? (discount_dong after attempt)", {
  discount_dong: t2.data.ticket.order.discount_dong,
  billDiscount: t2.data.bill.discount,
});

const li = t2.data.ticket.items.find((i) => i.qty > 0 && i.kitchen_status !== "86");
const pBefore = li.unit_price_dong;
await call("/api/staff/order/" + oid, {
  method: "POST",
  cookie: aC,
  body: { action: "patch_item", itemId: li.id, complementary: true },
});
await call("/api/staff/order/" + oid, {
  method: "POST",
  cookie: aC,
  body: { action: "patch_item", itemId: li.id, complementary: false },
});
const li2 = (await call("/api/staff/order/" + oid, { cookie: aC })).data.ticket.items.find((i) => i.id === li.id);
log("C6", "Comp item then un-comp: original price restored?", { before: pBefore, after: li2.unit_price_dong });

const p1 = await call("/api/staff/order/" + oid, {
  method: "POST",
  cookie: aC,
  body: { action: "pay", method: "cash", received: 999999 },
});
const p2 = await call("/api/staff/order/" + oid, {
  method: "POST",
  cookie: aC,
  body: { action: "pay", method: "transfer" },
});
const t3 = await call("/api/staff/order/" + oid, { cookie: aC });
log("C7", "Pay the same order twice", {
  first: p1.status,
  second: p2.status,
  payments: t3.data.ticket.payments.map((p) => ({ method: p.method, amount: p.amount_dong })),
});

const ord2 = (
  await call("/api/staff/order/new", {
    method: "POST",
    cookie: aC,
    body: { action: "open", tableId: tables[tables.length - 1].id },
  })
).data.orderId;
await call("/api/staff/order/" + ord2, {
  method: "POST",
  cookie: aC,
  body: { action: "add", items: [{ itemId: item.id, unitId: item.units[0].id, qty: 1 }] },
});
await call("/api/staff/order/" + ord2, { method: "POST", cookie: aC, body: { action: "void" } });
const pv = await call("/api/staff/order/" + ord2, { method: "POST", cookie: aC, body: { action: "pay", method: "cash" } });
const tv = await call("/api/staff/order/" + ord2, { cookie: aC });
log("C8", "Pay an order that was VOIDED", { payStatus: pv.status, payResp: pv.data, finalStatus: tv.data.ticket.order.status });

const rep = await call("/api/staff/admin?section=reports", { cookie: aC });
log("C9", "report today", rep.data?.today);

const nt = await call("/api/staff/admin", {
  method: "POST",
  cookie: aC,
  body: { action: "add_tenant", name: "Quán Test B", slug: "quan-b", pin: "2580" },
});
log("D1", "Demo-tenant admin creates a NEW tenant via /api/staff/admin add_tenant (should be platform-only)", {
  status: nt.status,
  data: nt.data,
});
const dup = await login("2580", "quan-tu-do", "Lan");
const dupSb = await login("2580", "quan-sao-bien", "Sao");
log("D2", "Login with PIN 2580 now that two tenants share it — which tenant?", {
  tudo: dup.r.data?.tenant?.name,
  saobien: dupSb.r.data?.tenant?.name,
});

const sb = await login("2580", "quan-sao-bien", "Sao");
const foreignTable = tables[0].id;
const o = await call("/api/staff/order/new", {
  method: "POST",
  cookie: sb.cookie,
  body: { action: "open", tableId: foreignTable },
});
log("D3", "Tenant C admin 'open' an order on tenant TD's table (cross-tenant)", { status: o.status, data: o.data });

const ownTables = await call("/api/staff/admin?section=tables", { cookie: sb.cookie });
const ownTableId = ownTables.data.tables[0].id;
const oc = await call("/api/staff/order/new", {
  method: "POST",
  cookie: sb.cookie,
  body: { action: "open", tableId: ownTableId },
});
const tf = await call("/api/staff/order/" + oc.data.orderId, {
  method: "POST",
  cookie: sb.cookie,
  body: { action: "transfer", tableId: foreignTable },
});
log("D4", "Tenant C transfers its order onto tenant TD's table", {
  status: tf.status,
  merged: tf.data?.merged,
  orderId: tf.data?.orderId,
});

const bad = await call("/api/staff/admin", {
  method: "POST",
  cookie: aC,
  body: { action: "settings", vat_rate: 8, service_rate: -1 },
});
const sv = await call("/api/staff/admin?section=settings", { cookie: aC });
log("E1", "Admin sets vat_rate=8 (not 0.08) & service_rate=-1 — accepted?", {
  resp: bad.data,
  stored: { vat: sv.data.settings.vat_rate, svc: sv.data.settings.service_rate },
});
await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "settings", vat_rate: 0.08, service_rate: 0.05 } });

const d1 = await call("/api/staff/admin", {
  method: "POST",
  cookie: aC,
  body: { action: "add_staff", name: "Trùng PIN", pin: "1397", role: "waiter" },
});
log("E2", "add_staff with PIN equal to existing waiter 1397 — accepted?", { status: d1.status, data: d1.data });
const wl = await login("1397", "quan-tu-do", "Minh");
const wa = await call("/api/staff/admin?section=staff", { cookie: wl.cookie });
log("E3", "Waiter calls admin API", wa.status);
const wkitchen = await call("/api/staff/kitchen", { cookie: wl.cookie });
log("E4", "Waiter calls kitchen API", wkitchen.status);

const col = await call("/api/staff/admin", {
  method: "POST",
  cookie: aC,
  body: { action: "branding", primary_color: "red;} body{display:none} /*" },
});
const gp = await call("/api/public/table/t9-tu-do");
log("F1", "Branding primary_color accepts arbitrary string", {
  post: col.status,
  color: gp.data?.tenant?.primary_color,
});
await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "branding", primary_color: "#E85D04" } });

log("G1", "QR tokens sample (static, guessable pattern?)", tables.slice(0, 8).map((x) => x.token));

const inbox = await call("/api/staff/inbox", { cookie: aC });
log("N1", "Staff inbox unread", { status: inbox.status, unread: inbox.data?.unread });

const stock = await call("/api/staff/stock", { cookie: wl.cookie });
log("N2", "Waiter can load stock/menu", { status: stock.status, items: stock.data?.items?.length });

const fail = [];
const need = (id, ok, why) => {
  if (!ok) fail.push(id + ": " + why);
};
const g = (id) => out.find((x) => x.id === id)?.result;
need("A1", g("A1").status === 401, "admin without cookie must 401");
need("A2", g("A2").sample.every((p) => p.pin == null), "staff list must not include pin");
need("A3", g("A3").includes(429), "lockout must 429");
need("A4", g("A4").status === 401, "logout must revoke");
need("B3", g("B3").status === 409, "inactive item 409");
need("B4", g("B4").overwritten === false, "guest PII write-once");
need("B5", g("B5").ok === 1 && g("B5").limited >= 29, "call dedupe");
need("C1", g("C1").addStatus === 400, "qty -3 rejected");
need("C2", g("C2").charged_still === false, "86 not billed");
need("C3", g("C3") === 409, "no reverse kitchen");
need("C4", g("C4").before === g("C4").after, "order snapshot");
need("C6", g("C6").before === g("C6").after, "comp restore");
need("C7", g("C7").second === 409 && g("C7").payments.length === 1, "pay idempotent");
need("C8", g("C8").payStatus === 409 && g("C8").finalStatus === "void", "no pay void");
need("D1", g("D1").status === 403, "add_tenant platform only");
need("D2", g("D2").tudo === "Quán Tự Do" && g("D2").saobien === "Quán Sao Biển", "slug isolates PIN");
need("D3", g("D3").status === 404, "cross-tenant open");
need("D4", g("D4").status === 404, "cross-tenant transfer");
need("E1", g("E1").resp?.error && Number(g("E1").stored.svc) === 0.05, "bad rates rejected");
need("E2", g("E2").status === 409, "dup PIN");
need("E3", g("E3") === 403, "waiter vs admin");
need("E4", g("E4") === 403, "waiter vs kitchen");
need("F1", g("F1").post === 400 && g("F1").color === "#E85D04", "hex color");
need("N2", g("N2").status === 200 && g("N2").items > 0, "waiter stock");
if (fail.length) {
  console.error("\nPROBE FAIL\n" + fail.join("\n"));
  process.exit(1);
}
console.log("\n--- probe complete, " + out.length + " checks, all assertions passed ---");

