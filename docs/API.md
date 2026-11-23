Last verified: 2026-11-23 · Scope: HTTP contract

Auth staff: cookie `staff_session` HttpOnly; SameSite=Lax; Secure on HTTPS. Login `POST /api/staff/session` `{ slug, staffId, pin }` → `{ staff, tenant }`. Directory `GET /api/staff/directory?slug=`. Logout `DELETE /api/staff/session` revokes server row.

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/healthz` | public | `{ ok }` |
| GET | `/api/readyz` | public | `{ ok, ready }` 503 if DB down |
| GET | `/api/public/venue?slug=` | public | name + sample guest path |
| GET/POST | `/api/public/table/[token]` | public | menu; order/call/guest/cancel_line (queued only, 409 already_sent). call 429 if open. inactive item 409. PII write-once |
| GET | `/api/media/[id]` | public | item photo bytes |
| GET | `/api/staff/session` | cookie | `{ staff: null }` if logged out |
| GET | `/api/staff/floor` | admin,waiter | tables + calls + totals |
| GET/POST | `/api/staff/kitchen` | admin,kitchen (served: +waiter) | op start/done/86/served; 409 bad_transition |
| GET/POST | `/api/staff/order/[id]` | admin,waiter | open/add/patch/transfer/merge/split/pay/void/discount/ack_call/served |
| GET | `/api/staff/menu` | staff | catalog |
| GET/POST | `/api/staff/stock` | staff | 86 + stock_left |
| GET/POST | `/api/staff/inbox` | staff | unread notices |
| GET/POST | `/api/staff/admin` | admin | no `pin` in GET. `add_tenant` 403. menu save/edit/upload_photo/save_category/delete_category. reports `range=day\|week\|month\|custom&from=&to=` |
| POST | `/api/platform/tenants` | `x-platform-secret` | create tenant |
| POST | `/api/platform/tenants/import` | `x-platform-secret` | JSON tenant (see `seeds/templates/quan-sample.json`) |
| POST | `/api/platform/seed` | `x-platform-secret` | demo seed if tenants empty; 409 if already seeded |

Errors: `{ error: code }` with 400/401/403/404/409/429. Write requests with foreign Origin → 403 csrf.

Audit clarifications (2026-11-23):

- PIN is a string of 4–8 digits. Malformed login fields return 400; concurrent failed attempts count toward the same lockout.
- Bodies must be JSON objects. Order batches must contain 1–100 valid lines, each with integer quantity 1–99 and matching item/unit IDs. Invalid lines reject the whole batch. Quantity zero is rejected; cancellation uses `cancel: true` plus a reason.
- Finite stock is reserved atomically for guest/staff adds and positive quantity changes; negative quantity deltas and cancellation restore stock once.
- Split requires `itemIds` and a different free `tableId`: 400 `need_items` / `need_table`, 409 `same_table` / `table_busy`. Transfer/merge carry existing discounts forward.
- Cash `pay` settles `bill.cashTotal`; transfer settles `bill.total`. An optional `received` must be a safe integer at least equal to the settlement amount, otherwise 400 `insufficient_cash`. Successful response `paid`, payment amount and frozen snapshot total match.
- Foreign staff IDs on `reset_pin` / `set_staff_active` return 404 before changing credentials or sessions.
