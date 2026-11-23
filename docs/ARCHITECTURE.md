Last verified: 2026-11-23 · Scope: module map + state machines

# Architecture

## Clients
- Guest: `/t/[qr_token]` public menu/cart/order/call
- Staff PWA: `/staff` login → `/staff/floor` waiter, `/staff/kitchen` KDS, `/staff/stock` menu+qty, `/staff/admin/*`
- Platform: `/staff/platform` + `POST /api/platform/tenants`

## Data
Postgres (`DATABASE_URL`) or PGlite singleton on `globalThis` (dev). Schema in `migrations/001` + `004_hardening` + `005_ops` + `006_media`. Demo in `seeds/`. Item photos in `media_files`, served at `/api/media/[id]`. Guest may `cancel_line` while `queued`. Admin menu edit + category CRUD; reports day/week/month.

Every business row is scoped by `tenant_id`. Staff session: random 32-byte token, **hashed** in `staff_sessions.token`, `revoked` on logout.

## Order status
`open → paid | void | merged`

One open order per table (`unique` partial index). Merge sets `merged` + `merged_into`.

## Line kitchen_status
`queued → preparing → done → served` plus `cancelled`, `86`. Transitions in `src/lib/kds.ts`. 86 also sets `items.sold_out` and notifies waiters.

## Bill
`computeBill` / `isBillableLine` in `src/lib/money.ts`. Open bills use `orders.vat_rate/service_rate/vat_included` (snapshotted at open). Pay writes `orders.bill_snapshot` and one `payments` row (`amount_dong = total`, `rounding_dong` for cash).

Per-line `vat_rate` from `tax_rates` × `items.tax_category` at insert time.

## Notifications
`notifications` table. Kitchen `done`/`86` and guest order/call insert rows. Staff UI polls `/api/staff/inbox` (pauses when tab hidden) and beeps.

## PWA / health
`public/sw.js` registers from `RegisterSw` (network-first, no offline menu cache). `GET /api/healthz` liveness; `GET /api/readyz` runs `select 1`. Guest menu polls 8s; ordered page 4s; both pause when hidden.

## Print
Staff ticket `window.print()` + `@media print` hide nav. Thermal ESC/POS is BLOCKED-HUMAN (PRINT-01). Table QR PNG download + print sheet at `/staff/admin/tables`.

Pay / void closes the open ticket, acks staff calls, and leaves the same QR for the next guest (one `open` order per table).

## New venue from JSON
`npm run seed:tenant -- seeds/templates/quan-sample.json` (needs `DATABASE_URL`) or `POST /api/platform/tenants/import`.
