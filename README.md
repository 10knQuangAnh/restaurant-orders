# print-order

Multi-tenant Vietnamese restaurant OS: guest QR menu + staff PWA (admin / waiter / kitchen).

## Run

```bash
env -u DATABASE_URL npm install
env -u DATABASE_URL npm run dev
```

Open `http://127.0.0.1:3000`, enter the venue slug, then staff **Vào ca**. Local data is PGlite (in-memory; restart clears it). Production uses Postgres (`DATABASE_URL`) after migrate. Demo seed is **not** applied by migrate; `npm run seed:demo` is blocked when `NODE_ENV=production`.

Staff login is **slug → person → PIN**. PINs are hashed; they are not shown in the UI. Ask the manager for your PIN. On a shared phone, tap **Kết ca** before the next person clocks in.

Guest QR is unauthenticated. Staff session is a server-side cookie (no Cursor identity fallback).

## Publish

`cursor-app.json` declares Postgres. Choose **public** if diners open table QR without a Cursor account. GitHub Pages will not run this app.
