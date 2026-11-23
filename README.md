# print-order

Multi-tenant restaurant OS: guest QR menu + staff PWA (admin / waiter / kitchen). Demo tenant is **Quán Tự Do**.

## Run

```bash
env -u DATABASE_URL npm install
env -u DATABASE_URL npm run dev
```

Local data uses PGlite (in-memory, seeded from `migrations/`). Production uses Postgres via `DATABASE_URL` after publish-app.

## Demo

- Guest table T9: `/t/t9-tu-do`
- Staff PIN login: `/staff`
  - Admin Lan `2580`
  - Waiter Minh `1397` / Hoa `2468`
  - Kitchen Hùng `4466` / Đức `7788`

Guest QR is unauthenticated. Staff uses restaurant PIN; if the app is published private/team, Cursor identity email can map onto a staff row (`identity_email`).

## Publish

`cursor-app.json` declares Postgres. Staff routes send `Cache-Control: private, no-store`. Choose **public** if diners must open table QR without a Cursor account; staff still use PIN. Choose **team** if only teammates should open the app (QR guests would need to sign in).

GitHub Pages will not run this app (Next.js + database). After `git push origin main`, import the repo on Vercel (GitHub OAuth — no separate password) and point a subdomain CNAME at Vercel.

## Demo tenant

Quán Tự Do — cơm nhà / bánh xèo / bia / rượu quê. Giá tham khảo nhà hàng món Việt TP.HCM 2026 (tầm trung Q1–Q3), **không** copy thương hiệu quán thật. VAT 8% gồm trong giá menu; phí phục vụ 5% lúc thu.
