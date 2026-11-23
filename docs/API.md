Last verified: 2026-11-23 · Scope: HTTP contract

Auth staff: cookie `staff_session` HttpOnly; SameSite=Lax; Secure on HTTPS. Login `POST /api/staff/session` `{ slug, staffId, pin }` → `{ staff, tenant }`. Directory `GET /api/staff/directory?slug=`. Logout `DELETE /api/staff/session` revokes server row.

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/healthz` | public | `{ ok }` |
| GET | `/api/readyz` | public | `{ ok, ready }` 503 if DB down |
| GET | `/api/public/venue?slug=` | public | name + sample guest path |
| GET/POST | `/api/public/table/[token]` | public | menu; order/call/guest. call 429 if open. inactive item 409. PII write-once |
| GET | `/api/staff/session` | cookie | `{ staff: null }` if logged out |
| GET | `/api/staff/floor` | admin,waiter | tables + calls + totals |
| GET/POST | `/api/staff/kitchen` | admin,kitchen (served: +waiter) | op start/done/86/served; 409 bad_transition |
| GET/POST | `/api/staff/order/[id]` | admin,waiter | open/add/patch/transfer/merge/split/pay/void/discount/ack_call/served |
| GET | `/api/staff/menu` | staff | catalog |
| GET/POST | `/api/staff/stock` | staff | 86 + stock_left |
| GET/POST | `/api/staff/inbox` | staff | unread notices |
| GET/POST | `/api/staff/admin` | admin | no `pin` in GET. `add_tenant` 403 |
| POST | `/api/platform/tenants` | `x-platform-secret` | create tenant |
| POST | `/api/platform/seed` | `x-platform-secret` | demo seed if tenants empty; 409 if already seeded |

Errors: `{ error: code }` with 400/401/403/404/409/429. Write requests with foreign Origin → 403 csrf.
