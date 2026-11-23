Last verified: 2026-11-23 · Scope: web (QR guest + staff PWA)

# Agent notes

## Run
```
env -u DATABASE_URL npm install
env -u DATABASE_URL npm run dev          # PGlite in-memory + seeds (lost on restart)
npm run typecheck && npm run lint && npm test
env -u DATABASE_URL npm run dev & npm run test:probe   # API regression
```
Postgres: `docker compose up -d db` then `DATABASE_URL=postgres://print:print@127.0.0.1:5432/printorder npm run build` then `npm run seed:demo` (blocked when `NODE_ENV=production` unless `ALLOW_DEMO_SEED=1`).

## Layout
- `src/app/api/public/*` guest QR
- `src/app/api/staff/*` cookie session (slug → staff → PIN)
- `src/app/api/platform/{tenants,seed}` `x-platform-secret`
- `GET /api/healthz` · `GET /api/readyz`
- `src/lib/{auth,billing,money,kds,db,queries,pin,time}.ts`
- `migrations/` schema only · `seeds/` demo only
- `tests/probe-audit.mjs` REPRO ids A1–G1

## Rules
1. Tenant from **session**, never trust client `tenant_id` / foreign `tableId`.
2. Multi-step writes use `withTx()`.
3. Billable line = not cancelled/86/complementary/qty≤0 (`isBillableLine`).
4. Bill uses **order snapshot** rates, `bill_snapshot` after pay.
5. PIN hashed (scrypt); API never returns `pin`.
6. No Cursor `getIdentity` fallback. Simulated identity is not a session.
7. Guest PII is write-once; staff calls dedupe to 1 open row.
8. Kitchen: queued→preparing→done→served; no reverse except new ticket.
9. Waiter/kitchen manage stock at `/staff/stock`. Inbox `/api/staff/inbox`.
10. Legal rates live in `tax_rates` + `docs/RESEARCH.md`. Do not hardcode 8% in logic.

## Known traps
- PGlite is empty after restart; do not treat that as a prod data-loss bug.
- `pkill -f next` can kill the shell that contains the word next.
- Login body is `{ slug, staffId, pin }` — PIN alone is 400.
- `add_tenant` on `/api/staff/admin` is 403; use platform secret.
- VAT `8` in admin is interpreted as 8% (0.08); `service_rate: -1` is 400.
