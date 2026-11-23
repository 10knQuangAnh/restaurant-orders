Last verified: 2026-11-23 · Scope: how to test

## Layers
1. `npm test` — billing vectors, KDS machine, dates, validation (`node:test`).
2. `npm run typecheck` / `npm run lint` (tsc).
3. `npm run test:probe` against `http://127.0.0.1:3000` (set `PROBE_URL` if needed). Needs demo seed (PGlite `npm run dev` or Postgres + `seed:demo`).
4. Browser: `/staff?slug=quan-tu-do` pick person + PIN; `/t/t9-tu-do` guest (EN/VI, call reasons, PII consent). Waiter/kitchen `/staff/stock` + bell. Ticket **In tạm tính**. `GET /api/readyz` → `{ ready: true }`.

Demo fixture (local/dev only, not printed in UI): tenant `quan-tu-do`; roles admin/waiter/kitchen. Second tenant `quan-sao-bien` shares PIN 2580 for isolation tests.

## Probe expect (fixed)
A1 401 · A2 no `pin` · A3 includes 429 · A4 401 · B3 409 · B4 not overwritten · B5 ok=1 · C1 qty not negative · C2 bill drops · C3 409 · C4 service unchanged · C6 price restored · C7 second 409 · C8 409 void · D1 403 · D3/D4 404 · E1 400 · E2 409 · E3/E4 403 · F1 color still hex.

## UAT devices
BLOCKED-HUMAN: iPhone Safari, low-end Android, iPad KDS, real thermal printer, 3G.
