Last verified: 2026-11-23 · Scope: bugs already paid for

| Symptom | Root cause | Fix | Regression |
|---|---|---|---|
| `/api/staff/admin` 200 with no cookie | `getIdentity()` simulated `dev@example.com` mapped to Lan | Session = cookie only | probe A1 → 401 |
| Login PIN 2580 always Quán Tự Do | PIN unique globally | slug + staffId + PIN | D2 |
| Logout cookie still works | DELETE only cleared cookie | `staff_sessions.revoked` | A4 |
| 86 still billed | `computeBill` ignored kitchen_status | `isBillableLine` | C2 |
| Pay void/paid twice | `pay` skipped status check | tx + `FOR UPDATE` + 409 | C7 C8 |
| Transfer to other tenant | `tableId` trusted | lookup `tenant_id` | D4 |
| Settings `vat_rate=8` | no validation | 0–1 or percent 1–100; reject <0 | E1 |
| CSS injection via color | raw string in branding | hex-only | F1 |
| Call-staff spam | insert every POST | one open call / table | B5 |
| Complementary irreversible | price zeroed | keep `unit_price_dong` | C6 |
| PGlite empty after restart | in-memory by design | document; Postgres for persist | — |
| Guest confirm 500 on name | `$3` untyped null | `nullif($1::text,'')` | guest guestName |
| Staff 404 after guest order | PGlite per-route instance | `globalThis` singleton | session after order |
| Login 403 csrf on `127.0.0.1` | Next `request.url` origin is `localhost` while browser Origin is `127.0.0.1` | Treat loopback hosts as equivalent; also compare `Host` | browser POST from 127.0.0.1 with Origin header |
| GitHub compare “unrelated histories” | Cloud branch vs empty/other main | User `git merge --abort` then force-push their HEAD to main | — |
| publish-app refuses | Needs commit **and** origin push | User pushes; agent does not wait on GitHub MCP | — |
| QR PNG link says localhost | Next `request.url` origin is localhost | Use `Host` / `x-forwarded-host` | tables page |
| Món đã gọi blank after Gỡ last line | empty copy keyed off `items.length` including cancelled | Filter live lines | guest ordered |

# Audit fixes — 2026-11-23

- Production `npm run build` failed only when PostgreSQL was configured: migration filter referenced loop variable `file` before initialization. Use filter parameter `f`; `test:database` runs migration CLI twice.
- Serverless instances could wait indefinitely on migration: runtime returned a connection holding `pg_advisory_lock` to its pool. Explicitly unlock in `finally` before releasing the client; test lock availability after boot.
- API success in isolated unit tests did not cover concurrent request races. Reproduce on disposable PostgreSQL; stock reservation, kitchen/cancellation/payment and failed-PIN updates must validate under transaction locks.
- Do not run mutation suites concurrently on shared demo fixtures: an operations test can pay the order another probe is inspecting. Run suites sequentially and generate separate tables.

## Neon pooled bootstrap — 2026-11-23

- Reproduced on Vercel/Neon: initial readiness/menu passed, but concurrent payments timed out. PostgreSQL showed one held bootstrap advisory lock and another waiting connection.
- Neon uses transaction pooling and does not support session advisory locks. An explicit session unlock can run on a different backend and leave the original lock held. See [Neon pooling limitations](https://neon.com/docs/connect/connection-pooling#connection-pooling-in-transaction-mode).
- Runtime and migration CLI now share a single transaction with `pg_advisory_xact_lock`, a transaction-local lock timeout and rollback/release on error. Failed runtime boot closes its pool before retrying.
- Regressions: `tests/migration-pool.test.ts`, concurrent bootstrap in `test:database`, and `test:live-ops` against a separate temporary QA venue.
