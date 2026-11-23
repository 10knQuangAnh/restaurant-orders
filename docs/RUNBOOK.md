Last verified: 2026-11-23 · Scope: operate a venue

## New Postgres
1. `docker compose up -d db`
2. `DATABASE_URL=... node scripts/migrate.mjs` (schema only — empty tenants)
3. Create venue: `PLATFORM_SECRET` + `POST /api/platform/tenants` `{ name, slug, pin }`
4. Admin login: slug → person → PIN. Add tables, menu, tax already seeded 8%/10% windows.
5. Print QR from `/staff/admin/tables`. Rotate token if leaked.
6. Staff clock in on shared device: **Kết ca** then pick the next person (do not share one session).

## VAT change 01/01/2027
`tax_rates` already has food 10% from 2027-01-01. Confirm extension (L2) before New Year. Listed prices stay VAT-included; VAT share is recalculated from line `vat_rate` at order time.

## Demo seed
`npm run seed:demo` refused in production. Never put PINs in UI or README.
Empty hosted Postgres: `POST /api/platform/seed` with `x-platform-secret` (409 if tenants already exist). Local PGlite seeds on first boot.

Production requires a valid PostgreSQL URL (`DATABASE_URL`, `POSTGRES_URL` or `POSTGRES_PRISMA_URL`). It no longer falls back to memory when configuration is missing/invalid; `/api/readyz` returns 503. Automatic demo seeding in production is disabled by default; `SEED_DEMO=1` explicitly enables it on an empty DB. Existing data is preserved.

After deploying this audit's changes, verify readiness, staff login and a test order in a test venue. Order mutations acquire a short tenant row lock inside the transaction to serialize conflicting open/pay/transfer/split/kitchen actions; load testing for very large venues remains separate from functional testing.

## New restaurant from JSON
Template: `seeds/templates/quan-sample.json` (slug, PIN, tables, categories, items). Copy and edit.

Postgres:

```bash
DATABASE_URL=postgres://… npm run seed:tenant -- seeds/templates/quan-sample.json
```

Hosted: `POST /api/platform/tenants/import` with header `x-platform-secret` and the JSON body. 409 if slug exists. Then staff login slug → person → PIN. Print QR at `/staff/admin/tables`.

## Incidents
- Login displays “Không tìm thấy quán”: check `GET /api/staff/directory?slug=…` and `/api/readyz` separately. Directory 404 means absent tenant; directory 500 plus readiness 503 means a database/bootstrap failure, not evidence that the slug is wrong. In Vercel, check runtime logs and the Production PostgreSQL environment variables, then redeploy after correcting environment configuration. Do not seed or replace an existing database to resolve a connection failure. Once readiness is 200, investigate missing tenant data only if directory returns 404.
- Locked PIN: wait 15 min or admin **Đặt lại PIN** (revokes sessions).
- Double pay: second pay is 409; reports use `bill_snapshot` on `paid`.
- Wrong tenant table: APIs 404, no merge.
