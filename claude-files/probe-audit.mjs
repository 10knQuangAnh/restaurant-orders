const B = "http://127.0.0.1:3000";
const out = [];
const log = (id, title, result) => { out.push({ id, title, result }); console.log(`[${id}] ${title}\n    => ${typeof result === 'string' ? result : JSON.stringify(result)}`); };
async function call(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const setc = res.headers.get("set-cookie");
  let data; try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, setc };
}
async function login(pin) { const r = await call("/api/staff/session", { method: "POST", body: { pin } }); return { r, cookie: r.setc ? r.setc.split(";")[0] : null }; }

// A1: no-cookie access (Cursor dev identity fallback)
let r = await call("/api/staff/admin?section=overview");
log("A1", "Admin API with NO cookie/PIN", { status: r.status, role: r.data?.staff?.role, name: r.data?.staff?.name });

const admin = await login("2580");
const aC = admin.cookie;
// A2: plaintext PINs exposed
r = await call("/api/staff/admin?section=staff", { cookie: aC });
log("A2", "Admin staff list returns PIN field", { status: r.status, sample: r.data?.people?.slice(0,3).map(p => ({ name: p.name, pin: p.pin })) });

// A3: brute force no lockout
let codes = new Set();
for (let i = 0; i < 40; i++) { const x = await call("/api/staff/session", { method: "POST", body: { pin: String(9000 + i) } }); codes.add(x.status); }
log("A3", "40 wrong PIN attempts in a row — status codes seen", [...codes]);

// A4: logout doesn't invalidate server session
const w = await login("1397");
await call("/api/staff/session", { method: "DELETE", cookie: w.cookie });
r = await call("/api/staff/floor", { cookie: w.cookie });
log("A4", "Waiter cookie reused AFTER logout (DELETE)", { status: r.status });

// floor + tables
r = await call("/api/staff/floor", { cookie: aC });
const tables = r.data.tables.map(t => ({ id: t.table.id, code: t.table.code, token: t.table.qr_token, orderId: t.orderId }));
log("I0", "tables (first 6)", tables.slice(0, 6));
const free = tables.find(t => !t.orderId);

// B1: concurrent guest orders on empty table -> duplicate open orders?
const menu = (await call("/api/public/table/" + free.token)).data;
const item = menu.items.find(i => !i.sold_out && i.units.length);
const mk = () => call("/api/public/table/" + free.token, { method: "POST", body: { items: [{ itemId: item.id, unitId: item.units[0].id, qty: 1 }] } });
const rs = await Promise.all([mk(), mk(), mk(), mk(), mk()]);
const orderIds = new Set(rs.map(x => x.data?.orderId));
log("B1", "5 concurrent guest orders on an empty table — distinct open order ids", { distinct: orderIds.size, ids: [...orderIds] });

// B2: guest order with no table session — token only
log("B2", "Guest order went straight to kitchen without staff approval", rs[0].data?.items?.map(i => ({ name: i.name_snapshot, kitchen_status: i.kitchen_status })));

// B3: inactive item orderable?  (deactivate via save_item then order)
const target = menu.items.find(i => i.id !== item.id && !i.sold_out && i.units.length);
await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "save_item", id: target.id, name: target.name, category_id: target.category_id, active: false } });
r = await call("/api/public/table/" + free.token, { method: "POST", body: { items: [{ itemId: target.id, unitId: target.units[0].id, qty: 1 }] } });
log("B3", "Guest orders an item with active=false", { status: r.status, ok: r.data?.ok });
await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "save_item", id: target.id, name: target.name, category_id: target.category_id, active: true } });

// B4: guest overwrites PII on an open order with no auth
r = await call("/api/public/table/" + free.token, { method: "POST", body: { action: "guest", guestName: "KẺ PHÁ", guestPhone: "0000" } });
const chk = await call("/api/staff/floor", { cookie: aC });
log("B4", "Anyone with QR link can overwrite guest name on open order", chk.data.tables.find(t => t.table.id === free.id)?.guestName);

// B5: call-staff spam, no rate limit
let okc = 0; for (let i = 0; i < 30; i++) { const x = await call("/api/public/table/" + free.token, { method: "POST", body: { action: "call", reason: "x".repeat(5) } }); if (x.status === 200) okc++; }
log("B5", "30 call-staff requests accepted (no rate limit / dedupe)", okc);

// C: billing
const orderId = orderIds.values().next().value;
const oid = [...orderIds][0];
let t = await call("/api/staff/order/" + oid, { cookie: aC });
log("C0", "bill before", t.data?.bill);

// C1: negative qty via staff add
await call("/api/staff/order/" + oid, { method: "POST", cookie: aC, body: { action: "add", items: [{ itemId: item.id, unitId: item.units[0].id, qty: -3 }] } });
t = await call("/api/staff/order/" + oid, { cookie: aC });
log("C1", "bill after staff 'add' qty=-3", { bill: t.data?.bill, qtys: t.data?.ticket?.items?.map(i => i.qty) });

// C2: kitchen 86 an item -> still billed?
const kit = await login("4466");
const q = await call("/api/staff/kitchen", { cookie: kit.cookie });
const tk = q.data.tickets.find(x => x.order_id === oid && x.qty > 0);
const before = (await call("/api/staff/order/" + oid, { cookie: aC })).data.bill.total;
await call("/api/staff/kitchen", { method: "POST", cookie: kit.cookie, body: { itemId: tk.id, op: "86" } });
const after = (await call("/api/staff/order/" + oid, { cookie: aC })).data.bill.total;
log("C2", "Kitchen marks one line '86' (cannot cook) — bill total before/after", { before, after, charged_still: before === after });

// C3: kitchen state machine: done -> start
const q2 = await call("/api/staff/kitchen", { cookie: kit.cookie });
const tk2 = q2.data.tickets.find(x => x.order_id === oid);
if (tk2) {
  await call("/api/staff/kitchen", { method: "POST", cookie: kit.cookie, body: { itemId: tk2.id, op: "done" } });
  const rr = await call("/api/staff/kitchen", { method: "POST", cookie: kit.cookie, body: { itemId: tk2.id, op: "start" } });
  log("C3", "Kitchen can move a DONE line back to 'preparing' (no state machine) — API status", rr.status);
}

// C4: changing settings mid-order changes open bill (order snapshot ignored)
const b1 = (await call("/api/staff/order/" + oid, { cookie: aC })).data.bill;
await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "settings", service_rate: 0.15 } });
const b2 = (await call("/api/staff/order/" + oid, { cookie: aC })).data.bill;
await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "settings", service_rate: 0.05 } });
log("C4", "Order bill after tenant service_rate 5%→15% (order has its own snapshot)", { before: b1.service, after: b2.service });

// C5: discount — any API?
t = await call("/api/staff/order/" + oid, { method: "POST", cookie: aC, body: { action: "discount", amount: 10000 } });
const t2 = await call("/api/staff/order/" + oid, { cookie: aC });
log("C5", "Is there any way to apply a discount/voucher? (discount_dong after attempt)", { discount_dong: t2.data.ticket.order.discount_dong, billDiscount: t2.data.bill.discount });

// C6: complementary is irreversible (price zeroed)
const li = t2.data.ticket.items.find(i => i.qty > 0 && i.kitchen_status !== "86");
const pBefore = li.unit_price_dong;
await call("/api/staff/order/" + oid, { method: "POST", cookie: aC, body: { action: "patch_item", itemId: li.id, complementary: true } });
await call("/api/staff/order/" + oid, { method: "POST", cookie: aC, body: { action: "patch_item", itemId: li.id, complementary: false } });
const li2 = (await call("/api/staff/order/" + oid, { cookie: aC })).data.ticket.items.find(i => i.id === li.id);
log("C6", "Comp item then un-comp: original price restored?", { before: pBefore, after: li2.unit_price_dong });

// C7: double payment
const p1 = await call("/api/staff/order/" + oid, { method: "POST", cookie: aC, body: { action: "pay", method: "cash", received: 999999 } });
const p2 = await call("/api/staff/order/" + oid, { method: "POST", cookie: aC, body: { action: "pay", method: "transfer" } });
const t3 = await call("/api/staff/order/" + oid, { cookie: aC });
log("C7", "Pay the same order twice", { first: p1.data, second: p2.data, payments: t3.data.ticket.payments.map(p => ({ method: p.method, amount: p.amount_dong })) });

// C8: pay a VOIDED order
const ord2 = (await call("/api/staff/order/new", { method: "POST", cookie: aC, body: { action: "open", tableId: tables[tables.length - 1].id } })).data.orderId;
await call("/api/staff/order/" + ord2, { method: "POST", cookie: aC, body: { action: "add", items: [{ itemId: item.id, unitId: item.units[0].id, qty: 1 }] } });
await call("/api/staff/order/" + ord2, { method: "POST", cookie: aC, body: { action: "void" } });
const pv = await call("/api/staff/order/" + ord2, { method: "POST", cookie: aC, body: { action: "pay", method: "cash" } });
const tv = await call("/api/staff/order/" + ord2, { cookie: aC });
log("C8", "Pay an order that was VOIDED", { payResp: pv.data, finalStatus: tv.data.ticket.order.status });

// C9: reports counts paid revenue; check rounding mismatch bill.total vs payment
const rep = await call("/api/staff/admin?section=reports", { cookie: aC });
log("C9", "report today", rep.data?.today);

// D: multi-tenant
const nt = await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "add_tenant", name: "Quán Test B", slug: "quan-b", pin: "2580" } });
log("D1", "Demo-tenant admin creates a NEW tenant via /api/staff/admin add_tenant (should be platform-only)", nt.data);
const dup = await login("2580");
log("D2", "Login with PIN 2580 now that two tenants share it — which tenant?", dup.r.data?.tenant?.name);
const nt2 = await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "add_tenant", name: "Quán Test C", slug: "quan-c", pin: "7777" } });
const c = await login("7777");
const foreignTable = tables[0].id;
const o = await call("/api/staff/order/new", { method: "POST", cookie: c.cookie, body: { action: "open", tableId: foreignTable } });
log("D3", "Tenant C admin 'open' an order on tenant TD's table (cross-tenant)", o.data);
const tr = await call("/api/staff/order/" + (nt2.data?.tenantId ? "x" : "x"), { cookie: c.cookie });
// D4: transfer own order to foreign table
const ownTbl = await call("/api/staff/admin", { method: "POST", cookie: c.cookie, body: { action: "add_table", code: "C1", name: "C1", zone: "A", seats: 4 } });
const ownTables = await call("/api/staff/admin?section=tables", { cookie: c.cookie });
const ownTableId = ownTables.data.tables[0].id;
const oc = await call("/api/staff/order/new", { method: "POST", cookie: c.cookie, body: { action: "open", tableId: ownTableId } });
const tf = await call("/api/staff/order/" + oc.data.orderId, { method: "POST", cookie: c.cookie, body: { action: "transfer", tableId: foreignTable } });
log("D4", "Tenant C transfers its order onto tenant TD's table", { status: tf.status, merged: tf.data?.merged, orderId: tf.data?.orderId });

// E: settings validation
const bad = await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "settings", vat_rate: 8, service_rate: -1 } });
const sv = await call("/api/staff/admin?section=settings", { cookie: aC });
log("E1", "Admin sets vat_rate=8 (not 0.08) & service_rate=-1 — accepted?", { resp: bad.data, stored: { vat: sv.data.settings.vat_rate, svc: sv.data.settings.service_rate } });
await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "settings", vat_rate: 0.08, service_rate: 0.05 } });

// E2: duplicate PIN inside tenant + non digits
const d1 = await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "add_staff", name: "Trùng PIN", pin: "1397", role: "waiter" } });
log("E2", "add_staff with PIN equal to existing waiter 1397 — accepted?", d1.data);
// E3: waiter permissions (comp, void) – role check on admin API
const wl = await login("1397");
const wa = await call("/api/staff/admin?section=staff", { cookie: wl.cookie });
log("E3", "Waiter calls admin API", wa.status);
const wkitchen = await call("/api/staff/kitchen", { cookie: wl.cookie });
log("E4", "Waiter calls kitchen API", wkitchen.status);

// F: XSS via branding color (check style injection later in UI)
const col = await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "branding", primary_color: "red;} body{display:none} /*" } });
const gp = await call("/api/public/table/t9-tu-do");
log("F1", "Branding primary_color accepts arbitrary string", gp.data?.tenant?.primary_color);
await call("/api/staff/admin", { method: "POST", cookie: aC, body: { action: "branding", primary_color: "#E85D04" } });

// G: unknown token timing / enumeration, token entropy
log("G1", "QR tokens sample (static, guessable pattern?)", tables.slice(0, 8).map(x => x.token));
