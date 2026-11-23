Last verified: 2026-11-23 · Scope: QR guest, staff PWA, API, PostgreSQL, production build

## Server evidence

- Checked `https://restaurant-orders-dun.vercel.app` using mobile Chromium and read-only requests.
- `/api/readyz` returned 200, `ready: true`; staff directory and QR menu loaded.
- Without a session, `/staff/admin/staff` and `/staff/admin/tables` crashed with `undefined.map`; settings crashed with `undefined.name`; reports crashed with `undefined.orders`.
- No business data was changed on Vercel. Fixes are in the working tree; this audit does not deploy them.

## Fixed defects

| Defect | Correction / regression evidence |
| --- | --- |
| PIN keypad submitted every partial PIN starting at digit four and stopped at six | Explicit submit, 4–8 digits, busy/error state; browser logs in with eight digits |
| Failed pay/void API response could display success and redirect | Check response before success path; browser simulates payment 409 and stays on ticket |
| Admin deep links crashed without a session | Server layout checks session/role; client loaders check failed responses; browser sweeps protected routes |
| Guest ordering again overwrote existing guest details | Write-once SQL on both guest update and order paths; API regression |
| Stock oversold with duplicate lines/concurrent requests | Conditional stock reservation in transaction, full rollback on failure; five concurrent orders against three portions |
| Staff quantity changes ignored stock | Reserve/release quantity delta; reject zero/fractional quantities; regression checks stock |
| Concurrent staff cancellations restored stock repeatedly | Lock order and validate current state inside transaction; five cancellations yield one success |
| First-order creation could race on PostgreSQL's one-open-order constraint | Lock tenant/table before finding or inserting an order; concurrent requests all succeed on one order |
| Concurrent staff calls could duplicate open rows | Lock table and write call/notice together; 15 calls yield one success |
| Split accepted source/busy table and UI opened destination before selecting lines | Require another free table, validate selected lines; select lines then destination in UI |
| Merge discarded source discount | Carry discount forward with lines; transfer/merge regression checks both |
| Foreign staff PIN reset/deactivation could revoke another venue's sessions | Check staff ownership before any mutation; regression verifies foreign session survives |
| Malformed JSON body/line/numeric fields caused 500 or partial orders | Validate object/arrays/quantities, reject whole invalid batch, validate stock/admin numbers and login types |
| Unknown staff/guest action returned success | Reject unknown operation with 400 |
| Cash payment ignored displayed rounded amount and accepted short cash | Persist rounded cash settlement, verify received amount, retain matching snapshot/payment/report total |
| Kitchen transitions could race and notices/stock were separate writes | Lock current order/line, validate and change state with notice inside one transaction |
| Concurrent wrong PINs lost failed-attempt increments | Lock staff row in authentication transaction; 12 attempts yield five wrong-PIN responses then seven locked responses |
| Menu edit lost unit name and reactivated hidden items | Persist unit label, preserve existing active flag when omitted, respect active on insertion |
| PGlite transactions shared manual BEGIN/COMMIT across requests | Use PGlite's serialized transaction callback |
| Runtime retained PostgreSQL migration advisory lock in pool | Unlock before releasing client; direct PostgreSQL lock test passes after boot |
| Production build with real PostgreSQL failed in migration filter | Correct loop variable; full production build and repeat migration CLI pass |
| Production silently used memory / automatically seeded demo | Require persistent DB; opt-in production demo seed; fresh DB has zero tenants and missing DB readiness returns 503 |
| Platform creation/admin multistep writes could commit partially | Use one transaction for related writes |
| Guest cart network failure left submit disabled | Catch network failures, preserve cart and reset busy state; cap quantities to API limit |
| Dependency audit found PostCSS advisories | Override compatible PostCSS 8.x to 8.5.33; `npm audit` reports zero vulnerabilities |

PostCSS references: [path traversal advisory](https://github.com/advisories/GHSA-r28c-9q8g-f849), [incomplete fix advisory](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp). Next.js major version was retained.

## Verification

- `npm run typecheck`, `npm run lint` (currently both run TypeScript), `npm test`: 50 tests pass.
- Production build against isolated PostgreSQL 14; production servers with populated DB, empty DB, and missing DB.
- Existing probe: 32 checks pass. Operations flow: QR PNG, reports, category CRUD, photo upload, item edit, guest/staff cancellation and table reset pass.
- New API regression: 20 scenarios; database suite: repeat migration plus five invariants; platform: creation/import and authentication checks.
- Browser: mobile login, failed-payment handling, authenticated/unauthenticated route sweep, guest order/cancellation, select-lines-before-destination split flow.
- PGlite development mode: API regression, legacy probe and operations flow also pass.
- Run API suites sequentially; fixtures use generated tables/people and modify demo stock/settings.

## Limits

- No Vercel deployment or production write tests were performed.
- Real iPhone Safari/Android/iPad, thermal printer, physical payment/bank webhook and third-party invoice integration still need their respective devices/accounts.
- Existing legal/accounting questions in `docs/BACKLOG.md` remain outside these functional fixes.
- Tenant writes are serialized for consistency; this is not a sustained-load benchmark.
