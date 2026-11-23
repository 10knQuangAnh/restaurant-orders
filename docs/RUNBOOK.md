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

## New restaurant from JSON
Template: `seeds/templates/quan-sample.json` (slug, PIN, tables, categories, items). Copy and edit.

Postgres:

```bash
DATABASE_URL=postgres://… npm run seed:tenant -- seeds/templates/quan-sample.json
```

Hosted: `POST /api/platform/tenants/import` with header `x-platform-secret` and the JSON body. 409 if slug exists. Then staff login slug → person → PIN. Print QR at `/staff/admin/tables`.

## Incidents
- Locked PIN: wait 15 min or admin **Đặt lại PIN** (revokes sessions).
- Double pay: second pay is 409; reports use `bill_snapshot` on `paid`.
- Wrong tenant table: APIs 404, no merge.
