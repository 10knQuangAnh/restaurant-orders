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
