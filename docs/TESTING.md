Last verified: 2026-11-23 · Scope: how to test

## Layers
1. `npm test` — billing vectors, KDS machine, dates, validation (`node:test`).
2. `npm run typecheck` / `npm run lint` (tsc).
3. `npm run test:probe` against `http://127.0.0.1:3000` (set `PROBE_URL` if needed). Needs demo seed (PGlite `npm run dev` or Postgres + `seed:demo`).
4. Browser: `/staff?slug=quan-tu-do` pick person + PIN; `/t/t9-tu-do` guest (EN/VI, call reasons, PII consent). Waiter/kitchen `/staff/stock` + bell. Ticket **In tạm tính**. `GET /api/readyz` → `{ ready: true }`.
5. Admin menu: sửa món + ảnh; danh mục thêm/đổi tên/xóa (chuyển món). Guest **Món đã gọi** gỡ dòng `queued`. Staff hủy món có lý do. Thu tiền → bàn trống, QR cũ vẫn dùng. Tables tải PNG. Báo cáo hôm nay/tuần/tháng.

## Regression suites added 2026-11-23

Use a disposable database with demo fixtures. Run these suites **sequentially**: they change stock, settings, sessions and orders. `PROBE_URL` defaults to `http://127.0.0.1:3000`.

```bash
npm run test:probe
npm run test:regression
npm run test:ops
npx playwright install chromium
npm run test:browser
npm run test:directory # browser mocks for 404, 500, 503 and network failure; no DB fixture required
TEST_DATABASE_URL=postgres://… npm run test:database
```

- `test:regression`: 20 scenarios, including concurrent first orders, finite stock, edits/cancellation, cash rounding, insufficient cash, split/transfer/merge, tenant isolation, CSRF, concurrent payment, kitchen transitions and PIN lockout.
- `test:browser`: mobile Chromium (390×844), PIN with eight digits, simulated rejected payment, protected/admin route sweep, guest item → cart → order → cancellation, and selecting lines before splitting to a free table. `CHROMIUM_PATH` optionally points to an installed Chromium executable.
- `test:database`: migration CLI twice, advisory lock release, stock/order/payment/snapshot invariants. Use the same disposable database as the server.
- `test:platform`: run against a disposable server started with `PLATFORM_SECRET`, then set `TEST_PLATFORM_SECRET` to that value for the test. Covers unauthorized calls, creating/importing venues, duplicate slugs and new-admin login.
- Production verification: `DATABASE_URL=… npm run build`, then `DATABASE_URL=… npx next start -p 3001`; set `PROBE_URL=http://127.0.0.1:3001`. A fresh production DB must have zero tenants unless demo seeding is explicitly enabled. Missing PostgreSQL must return 503 from readiness.

Evidence and remaining limits: [2026-11-23 audit](TEST-AUDIT-2026-11-23.md).

Verify a deployment without modifying its business data:

```bash
PROBE_URL=https://your-deployment.example PROBE_SLUG=your-venue npm run test:deployment
```

This checks readiness, directory, guest menu, unauthenticated access controls and mobile browser rendering. It must pass against the actual deployed URL after the deployment reports success.

For writes on a real deployment, create a separate `qa-live-*` venue from the tenant template with three staff roles and random PINs saved in a private JSON file, then run:

```bash
PROBE_URL=https://your-deployment.example QA_SPEC_FILE=/private/path/qa-spec.json npm run test:live-ops
```

This tests real logins, role isolation, concurrent calls/orders/payments, finite stock, kitchen transitions, guest cancellation, split/transfer/merge, discounts, QR PNG, reports and mobile guest-to-cash-checkout. It refuses venue slugs outside `qa-live-*`. Remove only that test venue and its dependent rows afterward; keep demo/business venues unchanged.

Demo fixture (local/dev only, not printed in UI): tenant `quan-tu-do`; roles admin/waiter/kitchen. Second tenant `quan-sao-bien` shares PIN 2580 for isolation tests.

## Probe expect (fixed)
A1 401 · A2 no `pin` · A3 includes 429 · A4 401 · B3 409 · B4 not overwritten · B5 ok=1 · C1 qty not negative · C2 bill drops · C3 409 · C4 service unchanged · C6 price restored · C7 second 409 · C8 409 void · D1 403 · D3/D4 404 · E1 400 · E2 409 · E3/E4 403 · F1 color still hex.

## UAT devices
BLOCKED-HUMAN: iPhone Safari, low-end Android, iPad KDS, real thermal printer, 3G.
