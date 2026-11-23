# restaurant-orders — BACKLOG SỬA + TEST CHO AGENT

> Đối tượng đọc: Cursor agent. Ngày audit: 2026-11-23. Repo: `10knQuangAnh/restaurant-orders` (commit `8362b1f`).
> Phạm vi: **web** (khách quét QR + nhân viên PWA + admin). App iOS native **để sau**, nhưng API phải sạch để app dùng lại.
> Mục tiêu: sửa và test **đến khi hết backlog**. Chỉ dừng khi đạt mục "Definition of Done" cuối file.

---

## 0. ĐỌC TRƯỚC (tiết kiệm token)

**Quy ước nhãn bằng chứng** — mỗi mục backlog có một nhãn, đừng điều tra lại thứ đã biết:
- 🔴 `REPRO:<id>` — đã chạy app thật và tái hiện (script: `probe-audit.mjs`, đi kèm file này). Đã chắc chắn.
- 📖 `CODE` — suy ra từ đọc code, **chưa chạy**. Viết test để xác nhận trước khi sửa.
- 🧩 `GAP` — tính năng nghiệp vụ còn thiếu.
- ⚖️ `LAW` — liên quan quy định/thuế. **Phải xác minh nguồn chính thức trước khi code** (xem mục 3).

**Trạng thái repo hiện tại (đã kiểm chứng):**
- Stack: Next.js 15.5 + React 19 + Postgres (`pg`) / PGlite (dev, **in-memory, mất dữ liệu khi restart**). `tsc --noEmit` pass, `next build` pass. ~4.800 dòng, **0 test, 0 docs cho agent, 0 lint**.
- Chạy local: `env -u DATABASE_URL npm install && env -u DATABASE_URL npm run dev` (cổng 3000). Dev dùng PGlite **in-memory**: restart là mất sạch dữ liệu (theo thiết kế). Khi test tự động nên dùng `next build && next start` + Postgres thật.
- Cấu trúc: `src/app/api/{public/table/[token],staff/{admin,floor,kitchen,menu,order/[id],session}}`, `src/lib/{auth,db,queries,money,cart,...}`, `migrations/001..003`, `cursor/` (thư viện identity của Cursor, **file generated, đừng sửa tay**).
- Multi-tenant: mọi bảng có `tenant_id`; tenant có `name/logo/primary_color/accent_color` + `tenant_settings` (VAT, phí phục vụ, làm tròn, ngân hàng, `features` jsonb).
- Tiền: số nguyên VND (tốt, giữ). Order item có snapshot tên/đơn vị/giá (tốt, giữ). Role check trên route hoạt động đúng (🔴 REPRO:E3,E4: waiter bị 403 ở admin/kitchen).

**Việc agent KHÔNG được tự quyết (hỏi chủ dự án, ghi vào `docs/DECISIONS/`):** hosting (self-host Docker hay Vercel/Cursor), nhà cung cấp HĐĐT, loại máy in/phần cứng, có dùng webhook ngân hàng hay chỉ VietQR tĩnh, chính sách giá khi VAT đổi 8%→10%, phí phục vụ có chịu VAT không, ngôn ngữ cần hỗ trợ, phạm vi multi-branch, khách có được gọi món khi bàn chưa được nhân viên mở hay không.

---

## 1. QUY TRÌNH LÀM VIỆC BẮT BUỘC CỦA AGENT

Vòng lặp cho **mỗi** mục backlog (theo thứ tự P0 → P1 → P2 → P3):

1. Viết **test fail trước** (tái hiện đúng lỗi). Với mục 📖 CODE, test này chính là bước xác nhận.
2. Sửa tối thiểu để test pass. Không refactor ngoài phạm vi mục đó.
3. Chạy **cổng chất lượng**: `typecheck` → `lint` → `unit` → `integration` (Postgres thật) → `e2e` (nếu mục có UI). Không xanh thì không commit.
4. Cập nhật docs liên quan (mục 2) **trong cùng commit**.
5. Nếu gặp lỗi lạ/mất >15 phút: ghi vào `docs/KNOWLEDGE.md` (triệu chứng → nguyên nhân → cách sửa) **trước khi** làm tiếp, để lần sau không lặp lại.
6. Commit nhỏ, message dạng `SEC-03: hash PIN + lockout`. Tick `[x]` mục trong `docs/BACKLOG.md`.

**Quy tắc cứng:**
- Không bỏ qua test hỏng, không `skip`/`only`, không giảm assertion để cho xanh.
- Mọi query dữ liệu nghiệp vụ **phải** lọc theo `tenant_id` từ session (không tin id do client gửi).
- Mọi thao tác ghi nhiều bước **phải** nằm trong transaction.
- Không hardcode thuế suất, ngày hiệu lực, tên quán, PIN, màu thương hiệu trong code. Mọi thứ là config theo tenant.
- Không đưa số liệu pháp lý vào code từ trí nhớ: lấy từ `docs/RESEARCH.md` (đã ghi nguồn + ngày xác minh).
- Gặp mục cần người (⚖️, phần cứng, thiết bị thật, tài khoản bên thứ ba): làm phần code/mock được, **đánh dấu `BLOCKED-HUMAN`** trong backlog kèm đúng thứ cần, rồi làm mục tiếp theo. Đừng đoán.

---

## 2. BỘ TÀI LIỆU CHO AI AGENT (tạo ở giai đoạn đầu, giữ cập nhật)

Mục tiêu: agent đời sau đọc ≤ 5 file là làm việc được, không phải khám phá lại.

```
AGENTS.md                  ≤150 dòng. Lệnh chạy/test, cấu trúc thư mục, quy ước, 10 điều "đã từng sai". Luôn đọc đầu tiên.
docs/ARCHITECTURE.md       Sơ đồ module, luồng dữ liệu, trạng thái order/item (state machine), multi-tenant.
docs/DOMAIN.md             Quy tắc nghiệp vụ: tính bill, VAT, phí phục vụ, giảm giá, tách/gộp, làm tròn. Kèm test vectors.
docs/RESEARCH.md           Cache nghiên cứu: mỗi dòng = sự kiện + URL nguồn + ngày xác minh + độ tin cậy. KHÔNG tra lại thứ đã có.
docs/KNOWLEDGE.md          Nhật ký lỗi: triệu chứng | nguyên nhân gốc | cách sửa | test chặn tái phát.
docs/DECISIONS/ADR-NNNN-*.md  Mỗi quyết định kiến trúc: bối cảnh, lựa chọn, lý do, "không bàn lại trừ khi...".
docs/API.md (hoặc openapi.yaml)  Mọi endpoint: auth, role, body, response, mã lỗi. Là hợp đồng cho app iOS sau này.
docs/TESTING.md            Cách chạy từng tầng test, dữ liệu seed, thiết bị thật cần test, checklist UAT.
docs/RUNBOOK.md            Deploy, backup/restore, đổi thuế suất, tạo tenant, xử lý sự cố ca đông.
docs/BACKLOG.md            Bản sao file này, có checkbox + trạng thái + commit hash.
```
Quy tắc docs: mỗi file có dòng đầu `Last verified: <ngày> · Scope: <...>`; dùng bảng/bullet, không văn xuôi dài; mỗi mục RESEARCH ghi rõ `verified` hay `unverified`.

---

## 3. SỰ KIỆN PHÁP LÝ / NGHIỆP VỤ ĐÃ TRA (đưa vào `docs/RESEARCH.md`, xác minh lại bản chính thức trước khi release)

> Nguồn dưới đây là báo/ kế toán thứ cấp tra ngày 2026-11-23, **chưa đọc nguyên văn văn bản gốc**. Agent phải đối chiếu `thuvienphapluat.vn` / `chinhphu.vn` / `mof.gov.vn` / `gdt.gov.vn` và ghi lại.

| # | Sự kiện | Mức tin cậy | Hệ quả cho hệ thống |
|---|---|---|---|
| L1 | NQ 204/2025/QH15 + NĐ 174/2025/NĐ-CP: giảm VAT 10%→8% từ 01/07/2025 **đến hết 31/12/2026** | Cao (nhiều nguồn khớp) | Demo đang để cứng 8%. **Còn ~5 tuần** là hết hạn. |
| L2 | Các nguồn kế toán (cập nhật tới ~17/11/2026) cho biết **chưa có văn bản gia hạn**; nếu không gia hạn, từ 01/01/2027 về 10% | Trung bình (nguồn thứ cấp, tình hình có thể đổi) | Phải làm thuế suất **theo hiệu lực ngày** (BILL-05). Kiểm tra lại tin chính thức trước 01/01/2027. |
| L3 | Hàng hóa/dịch vụ **chịu thuế TTĐB** (bia, rượu, thuốc lá…) **không** được giảm → vẫn 10% | Cao | Một bill nhà hàng có **hai mức VAT** (món ăn 8% / bia rượu 10%). Code hiện áp một mức cho cả bill = **sai**. |
| L4 | Nước ngọt có đường: các nguồn **mâu thuẫn** về thời điểm bắt đầu chịu TTĐB (có nguồn nói 01/01/2026, có nguồn nói 01/01/2027) | **Thấp — chưa xác minh** | Để `tax_category` cấu hình được; không hardcode nhóm nước ngọt. Hỏi kế toán. |
| L5 | NĐ 70/2025/NĐ-CP (hiệu lực 01/06/2025): hộ kinh doanh ăn uống/bán lẻ/dịch vụ doanh thu **≥ 1 tỷ/năm** bắt buộc dùng **HĐĐT khởi tạo từ máy tính tiền, kết nối chuyển dữ liệu cho cơ quan thuế**; đăng ký mẫu 01/ĐKTĐ-HĐĐT | Trung bình (thứ cấp) | Hệ thống POS này **không tự là** HĐĐT: cần tích hợp nhà cung cấp HĐĐT (PRINT/INV-03). Chưa rõ chi tiết cho doanh nghiệp (không phải hộ) → xác minh. |
| L6 | Phí phục vụ có chịu VAT hay không; làm tròn tiền mặt có hợp lệ trên hóa đơn không | **Chưa xác minh** | Làm thành cấu hình + hỏi kế toán (BILL-06, BILL-09). |
| L7 | Luật Bảo vệ dữ liệu cá nhân (khách nhập tên + SĐT) — theo hiểu biết có hiệu lực 2026 | **Chưa xác minh** (số hiệu, hiệu lực, yêu cầu đồng ý) | GUEST-07. |
| L8 | Năng lực iOS Safari (Web Push, Web Bluetooth/USB để in) | **Chưa xác minh** | Quyết định cách in + thông báo (PRINT-01, KDS-03). Tra MDN/caniuse/Apple docs, ghi vào RESEARCH. |
| L9 | Chuẩn VietQR/NAPAS 247 (payload EMV, danh sách BIN ngân hàng) | **Chưa xác minh** | PAY-04. Tra tài liệu NAPAS/vietqr chính thức. |

---

## 4. BACKLOG

Ưu tiên: **P0** chặn go-live (bảo mật, sai tiền, mất dữ liệu) · **P1** thiếu nghiệp vụ lõi · **P2** hoàn thiện vận hành · **P3** mở rộng.

### 4.1 P0 — BẢO MẬT & CÔ LẬP TENANT

- [ ] **SEC-01 · Bypass đăng nhập khi deploy ngoài Cursor/Vercel** · 🔴 REPRO:A1
  - Hiện tượng: gọi `/api/staff/admin` **không cookie, không PIN** trả 200 với quyền admin "Nguyễn Thị Lan". Nguyên nhân: `auth.ts` rơi về `getIdentity()`; khi không có `CURSOR_APP_ID`/`VERCEL`, thư viện coi mọi request là viewer giả `dev@example.com`, và seed gán `identity_email='dev@example.com'` cho admin.
  - Sửa: gỡ hẳn đường identity của Cursor khỏi `sessionFromRequest` (hoặc bọc sau adapter bật bằng env và **từ chối `simulated:true`**). Xóa `identity_email` khỏi seed. Cân nhắc xóa thư mục `cursor/` + `cursor-app.json` nếu chọn self-host (quyết định chủ dự án).
  - Test: mọi route `/api/staff/*` không cookie → 401; chạy lại ở môi trường không có biến Cursor/Vercel.

- [ ] **SEC-02 · Seed demo chạy trong production, PIN demo bị lộ** · 🔴 REPRO:A2 · 📖 CODE
  - `migrations/002_seed.sql`, `003_full_demo.sql` là **dữ liệu demo nằm trong migration** nên `scripts/migrate.mjs` sẽ nạp lên DB production (tenant "Quán Tự Do", PIN 2580/1397/4466…). Trang `/staff` in sẵn PIN demo; README cũng liệt kê.
  - Sửa: tách `seeds/demo.sql` + lệnh `npm run seed:demo` bị chặn khi `NODE_ENV=production`; migration chỉ chứa schema. Bỏ PIN khỏi UI/README. Trang chủ `/` hardcode link demo `/t/t9-tu-do` → thay bằng trang trung tính/tenant resolver.
  - Test: DB mới sau `migrate` không có tenant/staff nào; `/staff` không chứa chuỗi PIN.

- [ ] **SEC-03 · Hệ thống PIN yếu** · 🔴 REPRO:A2,A3,A4,D2,E2
  - Vấn đề: PIN lưu **plaintext**; tra PIN **toàn hệ thống không theo quán** (hai quán trùng PIN → đăng nhập nhầm; REPRO:D2 PIN 2580 luôn vào Quán Tự Do); 4 chữ số; không giới hạn thử (REPRO:A3: 40 lần sai liên tiếp đều 401, không khóa); đăng xuất **không hủy session ở server** (REPRO:A4: cookie còn dùng được sau logout); cookie thiếu `Secure`; admin xem được PIN của mọi người (REPRO:A2); cho tạo PIN trùng (REPRO:E2).
  - Sửa: luồng đăng nhập = **mã quán/slug → chọn nhân viên → PIN**; hash PIN (scrypt/argon2id), PIN 4–6 số, unique **trong tenant**; khóa tạm sau N lần sai theo (nhân viên + IP); lưu **hash** của session token (token ≥32 byte ngẫu nhiên), `DELETE session` xóa row, cookie `HttpOnly; Secure; SameSite=Lax`; admin chỉ **reset PIN**, không bao giờ xem được PIN; dọn session hết hạn; tùy chọn tài khoản email+mật khẩu cho admin/chủ quán.
  - Test: trùng PIN 2 tenant vẫn đăng nhập đúng quán; sai 5 lần → bị khóa; sau logout cookie cũ → 401; API không bao giờ trả trường `pin`.

- [ ] **SEC-04 · Lọt dữ liệu giữa các tenant** · 🔴 REPRO:D3,D4 · 📖 CODE
  - Hiện tượng: admin tenant C gọi `open` trên bàn của tenant TD nhận về `orderId` của TD (D3); gọi `transfer` đơn của mình sang bàn TD → **items bị gộp vào đơn của TD** (D4, `merged:true`). Nguyên nhân: `tableId`/`otherOrderId`/`itemIds` do client gửi không được kiểm tra thuộc tenant; `merge`, `split`, `transfer` cập nhật theo id trần.
  - Sửa: mọi lookup kèm `tenant_id` của session; thêm FK phức hợp `(tenant_id, id)` hoặc Postgres RLS; rà **mọi** chỗ nhận id từ body/query (`order`, `admin`, `kitchen`, `floor`).
  - Test: bộ **fuzz cô lập tenant** — với mỗi endpoint ghi/đọc, thử id của tenant khác → luôn 404/403 và không đổi dữ liệu. Chạy trong CI, thêm endpoint mới phải thêm case.

- [ ] **SEC-05 · Ai là admin quán cũng tạo được tenant mới** · 🔴 REPRO:D1
  - `add_tenant` nằm trong `/api/staff/admin` (role admin của quán). Mặc định PIN `1234`, slug không kiểm tra trùng/định dạng.
  - Sửa: tách **platform admin** (đăng nhập riêng, secret env hoặc bảng riêng), chuyển `add_tenant` + trang `/staff/platform` sang đó; wizard tạo quán (tên, slug unique, admin đầu tiên với PIN do người dùng đặt, bảng thuế mặc định theo thời điểm). Xem ADMIN-06.
  - Test: admin quán gọi tạo tenant → 403.

- [ ] **SEC-06 · Không validate đầu vào** · 🔴 REPRO:C1,E1,F1
  - Đã thấy: `qty=-3` hạ tổng bill (C1); `vat_rate=8` và `service_rate=-1` được lưu (E1); `primary_color` nhận chuỗi tùy ý `red;} body{display:none} /*` (F1, 📖 chưa kiểm tra chỗ render → nguy cơ CSS injection); body JSON hỏng → 500.
  - Sửa: schema (zod) cho **mọi** body; qty số nguyên 1–99 (hoặc decimal có giới hạn cho món theo cân — MENU-03); `vat_rate`/`service_rate` 0–1 (UI nhập % và chuyển đổi); màu theo regex hex; `logo_url` allowlist giao thức; độ dài chuỗi; trả 400 có mã lỗi chuẩn.
  - Test: bảng test giá trị biên cho từng field; không có input nào gây 500.

- [ ] **SEC-07 · Endpoint khách quét QR dễ bị lạm dụng** · 🔴 REPRO:B3,B4,B5,G1 · 📖 CODE
  - QR token tĩnh, ai có link đều gọi món/ghi đè tên-SĐT khách (B4)/spam gọi nhân viên (B5: 30 request đều được nhận)/gọi món đã tắt `active=false` (B3). Token seed đoán được (`t1-san-vuon`… — 🔴 REPRO:G1). Sau khi bàn thanh toán, link cũ vẫn tạo **order mới** (📖 CODE).
  - Sửa: **phiên bàn** (table session): quét QR → cookie ký, hết hạn khi bàn đóng/thanh toán; chế độ "cần nhân viên mở bàn/duyệt" (cấu hình); rate limit theo IP + bàn; dedupe gọi nhân viên (1 yêu cầu mở/lý do); token bàn mới ≥128-bit ngẫu nhiên + chức năng xoay token; kiểm tra `active`, giờ bán, tồn kho khi đặt; không cho ghi đè PII; idempotency key chống bấm đúp.
  - Test: sau thanh toán QR cũ không tạo order; 30 call liên tiếp → 1 bản ghi mở + 429 phần còn lại; món `active=false` → 409.

- [ ] **SEC-08 · Header/CSRF/log** · 📖 CODE
  - Thêm CSP, HSTS, `X-Content-Type-Options`, `frame-ancestors`; kiểm tra `Origin` cho request ghi dùng cookie; không log PII/PIN/token; thông báo lỗi không lộ stack/SQL; font Google Fonts load ngoài → self-host (quán wifi yếu).
  - Test: header có mặt trên mọi response; request ghi từ origin lạ → 403.

### 4.2 P0 — TÍNH TIỀN & THANH TOÁN (sai ở đây là mất tiền thật)

- [ ] **BILL-01 · Thanh toán không idempotent, trả được đơn đã hủy** · 🔴 REPRO:C7,C8
  - C7: trả cùng đơn 2 lần → 2 bản ghi payment (344.000 tiền mặt + 344.400 chuyển khoản) → doanh thu báo cáo gấp đôi. C8: đơn `void` vẫn trả được và đổi thành `paid`. Nguyên nhân: route cho phép action `pay` bỏ qua kiểm tra `status='open'`.
  - Sửa: transaction + `SELECT … FOR UPDATE` trên order; máy trạng thái `open → paid | void` chặt chẽ; `idempotency_key` unique cho payment; `pay` chỉ khi `open`.
  - Test: 10 request `pay` song song trên Postgres thật → đúng 1 thành công; pay đơn void/paid → 409.

- [ ] **BILL-02 · Món bếp báo hết (86) vẫn bị tính tiền** · 🔴 REPRO:C2
  - Bếp bấm 86 → dòng chuyển `kitchen_status='86'` nhưng giữ `qty` và giá; `computeBill` chỉ loại `complementary` → tổng bill **không đổi**. Báo cáo `top`/`open value` cũng chỉ loại `cancelled`, không loại `86`/đơn void/đơn chưa trả.
  - Sửa: định nghĩa **billable line** ở một nơi (`lib/billing`) = không cancelled/86/void; dùng chung cho bill, floor, report. Không đặt `qty=0` khi hủy (mất dấu vết) — dùng `voided_qty` + lý do (xem BILL-13).
  - Test: bảng ma trận trạng thái dòng × có tính tiền không.

- [ ] **BILL-03 · Số lượng âm/0/quá lớn** · 🔴 REPRO:C1 → gộp vào SEC-06; thêm test tổng bill không bao giờ < 0 và ≠ tổng dòng hợp lệ.

- [ ] **BILL-04 · Bill đọc cấu hình *hiện tại* của quán, không đọc snapshot của order** · 🔴 REPRO:C4
  - Đổi phí phục vụ 5%→15% làm bill của đơn **đang mở** đổi theo (service 25.350 → 76.050); đơn **đã trả** in lại cũng đổi. `orders` có cột `vat_rate/service_rate` nhưng không được dùng khi tính.
  - Sửa: tính theo snapshot của order; khi thanh toán lưu **`bill_snapshot` bất biến** (subtotal, từng dòng thuế, phí PV, giảm giá, tổng, làm tròn, người thu, thời điểm). In lại/báo cáo đọc snapshot.
  - Test: đổi settings sau khi order mở/đã trả → bill không đổi.

- [ ] **BILL-05 · ⚖️ Thuế suất theo nhóm hàng + theo ngày hiệu lực (khẩn: 01/01/2027)** · 📖 CODE · L1–L4
  - Hiện: một `vat_rate` toàn quán, một cờ `vat_included`. Thực tế một bill có món ăn 8% và bia/rượu 10% (L3); và **thuế suất đổi theo ngày** (L1/L2).
  - Sửa: bảng `tax_rates(tenant_id, code, rate, effective_from, effective_to)`; `items.tax_category`; thuế suất chọn theo **thời điểm lập bill** theo múi giờ `Asia/Ho_Chi_Minh`; UI admin quản lý; hỗ trợ **giá niêm yết đã gồm VAT** (giữ nguyên giá khách trả, tách VAT lại theo thuế suất mới) lẫn chưa gồm; seed mặc định *không* hardcode — theo cấu hình tenant + hướng dẫn trong RUNBOOK cách đổi.
  - Test (bắt buộc): bill lập `2026-12-31T23:59:59+07:00` dùng 8%, `2027-01-01T00:00:00+07:00` dùng 10% (nếu không có gia hạn); bill trộn món ăn + bia; làm tròn VAT theo dòng vs theo bill thống nhất một quy tắc, ghi `DOMAIN.md`; **property test**: tổng thuế từng dòng + tiền hàng = tổng bill.
  - BLOCKED-HUMAN: kế toán xác nhận chính sách giá sau 01/01/2027 và nhóm nước ngọt có đường (L4).

- [ ] **BILL-06 · ⚖️ Phí phục vụ** · L6
  - Hiện tính 5% trên số đã gồm VAT; VAT chỉ tính trên món. Chưa rõ phí phục vụ có chịu VAT. Làm cấu hình `service_charge_taxable` + `service_base` (trước/sau giảm giá) + miễn theo bàn/khu/loại đơn (mang về không phụ thu). Test vector được kế toán duyệt trước khi coi là chuẩn. BLOCKED-HUMAN: kế toán.

- [ ] **BILL-07 · Chưa có giảm giá/voucher** · 🔴 REPRO:C5 · 🧩 GAP
  - Cột `discount_dong` tồn tại nhưng **không có API/UI nào đặt**. Cần: giảm % hoặc số tiền, theo bill hoặc theo món, lý do bắt buộc, ngưỡng cần admin duyệt (PIN admin), mã voucher (hạn dùng, giới hạn lần), giảm giá khách quen/nhân viên, phân bổ giảm giá xuống dòng để tính thuế đúng. Test: giảm 100% bill; giảm > tổng; giảm rồi tách bill → tổng các phần = tổng gốc.

- [ ] **BILL-08 · "Tặng món" (complementary) không hoàn tác được, không lý do** · 🔴 REPRO:C6
  - Tặng rồi bỏ tặng: giá 179.000 → **0 vĩnh viễn**. Sửa: giữ `unit_price` gốc, thêm `comp_reason/comp_by/comp_at`; bill dùng cờ; cần PIN admin nếu vượt ngưỡng; ghi audit (ADMIN-02).

- [ ] **BILL-09 · ⚖️ Làm tròn tiền mặt làm lệch số liệu** · 🔴 REPRO:C7 · L6
  - Thu tiền mặt ghi `amount_dong = cashTotal` (đã làm tròn 1.000: 344.000) trong khi bill = 344.400 → doanh thu ≠ hóa đơn ≠ tiền thu. Sửa: ghi tổng đúng + dòng `rounding_adjust` tường minh; mặc định **tắt** làm tròn đến khi kế toán duyệt. Test: tổng payments = bill.total + rounding_adjust.

- [ ] **BILL-10 · Thanh toán chia/nhiều phương thức** · 🧩 GAP
  - Hiện 1 payment, 2 phương thức (`cash|transfer`). Cần: nhiều payment trên 1 bill (tiền mặt + chuyển khoản), thanh toán từng phần, đặt cọc, thẻ (POS máy quẹt), ví (MoMo/ZaloPay/VNPay… ghi nhận thủ công), tip, tiền thối server tính, trả thừa/thiếu, hoàn tiền (refund có lý do + quyền), `payment_status`. Test: tổng các khoản = bill; thiếu → bill chưa đóng; thừa → tiền thối.

- [ ] **BILL-11 · Tách bill đầy đủ** · 🧩 GAP · 📖 CODE
  - Hiện chỉ tách **nguyên dòng**. Cần: tách theo số lượng (2 → 1+1), chia đều N người (phần dư dồn đúng quy tắc), chia theo số tiền, mỗi phần có VAT/phí PV/giảm giá phân bổ đúng, mỗi phần thanh toán/xuất hóa đơn riêng.
  - Test vector: 1.000.000 chia 3 → 333.333 + 333.333 + 333.334; tổng các phần luôn = bill gốc, kể cả khi có giảm giá + phí PV + 2 thuế suất.

- [ ] **BILL-12 · Gộp/chuyển bàn làm mất lịch sử** · 📖 CODE
  - `merge`/`transfer` đánh dấu đơn nguồn `void` → lẫn với đơn hủy thật, mất thời điểm gọi gốc. Sửa: trạng thái `merged` + `merged_into`, giữ nguyên `created_at`/bàn gốc của từng dòng, ghi audit. Test: chuyển sang bàn đang có khách; chuyển sang chính bàn đó; chuyển bàn khác tenant (bị chặn); gộp 3 bàn.

- [ ] **BILL-13 · Sửa/hủy món sau khi đã gửi bếp** · 🔴 REPRO:C1 · 📖 CODE
  - Giảm/tăng qty, hủy món **không báo bếp**, không lý do, hủy được cả món đã nấu xong, UI nút "Hủy" bấm là mất (không xác nhận). Cần: lý do hủy bắt buộc (hết món/khách đổi ý/nhầm/chờ lâu…), phân loại **hao hụt** (đã chế biến), quyền (waiter hủy món chưa nấu; đã nấu cần admin), **phiếu hủy gửi bếp**, phiếu "+1" khi tăng, xác nhận trước khi hủy.

- [ ] **BILL-14 · Bộ test vector tính tiền** — tạo `src/lib/billing/__tests__` với ≥30 case: 1 món; nhiều món; 2 mức thuế; giá đã/chưa gồm VAT; phí PV có/không chịu thuế; giảm % + số tiền; làm tròn bật/tắt; tách bill; đơn 0 đồng; số rất lớn; chia đều số lẻ. Vector số học thuần (không phụ thuộc luật): `110.000 gồm VAT 10% → VAT 10.000`; `108.000 gồm VAT 8% → VAT 8.000`; `344.350 làm tròn 1.000 → 344.000`. Vector phụ thuộc luật chỉ chốt sau khi kế toán duyệt.

### 4.3 P1 — DỮ LIỆU, ĐỒNG THỜI, HẠ TẦNG

- [ ] **DATA-01 · Không có transaction** · 📖 CODE
  - Mọi luồng ghi là chuỗi `await sql()` rời rạc (đặt món lặp từng dòng, merge/split/pay). Lỗi giữa chừng để lại order dở. Sửa: helper `withTx()`; insert theo lô. Test: chèn lỗi ở dòng thứ N → không có dòng nào được ghi.

- [ ] **DATA-02 · Không ràng buộc "mỗi bàn một order đang mở"** · 🔴 REPRO:B1 (**không tái hiện được trên PGlite** vì PGlite tuần tự hóa query; rủi ro vẫn còn trên Postgres thật có pool)
  - Sửa: unique index một phần `orders(table_id) where status='open'`; xử lý xung đột bằng `ON CONFLICT`/retry. **Test bắt buộc chạy trên Postgres thật** với 20 request song song.

- [ ] **DATA-03 · Schema/migration** · 📖 CODE
  - Thêm: CHECK status/qty≥0/price≥0, FK còn thiếu (`order_items.item_id/unit_id`, `payments.staff_id`), unique `(tenant_id, code)` cho bàn, unique `(tenant_id, slug)`, index theo truy vấn thật, xóa mềm cho món/bàn/nhân viên (không xóa cứng vì order tham chiếu), cột `updated_at`. Migration có test "lên từ trống" và "lên từ bản cũ". Bỏ `if not exists` rải rác nếu gây che lỗi.

- [ ] **DATA-04 · Môi trường dev/test** · 🔴 (quan sát: restart dev server mất sạch dữ liệu PGlite)
  - Thêm `docker-compose.yml` Postgres cho dev + test; PGlite chỉ dùng cho unit test nhanh. Script `npm run test:db` tự dựng DB sạch.

- [ ] **DATA-05 · Hiệu năng & realtime** · 📖 CODE
  - `floor` route lặp `openOrderForTable` cho **từng bàn** (N+1). Màn bếp poll 3s, sàn poll 4s, **không dừng khi tab ẩn**, không backoff; khách không có cập nhật trạng thái món (không thấy polling ở trang khách). Sửa: một query tổng hợp; SSE hoặc WebSocket (hoặc Postgres `LISTEN/NOTIFY`) + polling dự phòng, tạm dừng khi ẩn, tự nối lại; hiển thị trạng thái kết nối. Load test: 60 bàn × 3 điện thoại + 3 màn bếp + 5 waiter, p95 < 500ms.

- [ ] **DATA-06 · Múi giờ & "ngày kinh doanh"** · 📖 CODE
  - Báo cáo dùng `current_date`/`created_at::date` theo múi giờ DB (thường UTC) → doanh thu 00:00–07:00 giờ VN rơi vào "hôm qua". Quán nhậu đóng sau nửa đêm. Sửa: dùng `tenant_settings.timezone` + **giờ cắt ngày kinh doanh** cấu hình (vd 05:00). Test với đồng hồ giả lập 23:30, 00:30, 04:59, 05:01.

- [ ] **DATA-07 · Vận hành** — pool size theo env; `/healthz` + `/readyz`; shutdown êm; log có cấu trúc (không PII); báo lỗi (Sentry hoặc tương đương); hướng dẫn backup/restore **đã thử restore thật**; `Dockerfile` + `docker-compose` prod + reverse proxy + HTTPS; tách phụ thuộc Cursor (xem SEC-01).

- [ ] **DATA-08 · Ảnh món** — hiện toàn bộ ảnh là SVG minh họa tạo bằng script, món mới admin thêm luôn gán `/dishes/com-chien-trung.svg` (📖 CODE). Cần upload ảnh thật (lưu object storage/S3-compatible hoặc volume), resize + WebP, `alt`, lazy-load.

### 4.4 P1 — BẾP / QUẦY BAR (KDS)

- [ ] **KDS-01 · Máy trạng thái món** · 🔴 REPRO:C3
  - Bếp chuyển được món `done` quay lại `preparing` (API 200), thao tác trên đơn đã đóng. Cần: `queued → preparing → ready → served` (+ `cancelled`, `86`), chặn đi lùi (trừ admin có lý do), chặn đơn đã paid/void; ghi thời điểm từng bước để đo SLA. Thêm bước **`served`** (waiter xác nhận đã bưng) và thông báo **"món đã xong"** cho waiter (hiện bếp bấm xong thì waiter không biết).
- [ ] **KDS-02 · Phân trạm** — `items.station_id` (bếp nóng/lạnh/nướng/lẩu/bar/quầy nước), mỗi màn KDS lọc theo trạm; đơn nhiều trạm tách phiếu. 🧩 GAP
- [ ] **KDS-03 · Thông báo & chống ngủ màn hình** — chưa có âm thanh/rung/notification/wake lock (📖 grep không thấy). Cần chuông món mới, nhấn mạnh món gấp, Wake Lock API, cảnh báo quá thời gian theo màu. Cách đẩy thông báo trên iOS: phụ thuộc L8 (xác minh).
- [ ] **KDS-04 · Luồng 86 (hết món)** — hiện đặt `items.sold_out=true` vĩnh viễn, bếp không bỏ được, waiter/khách không được báo, dòng vẫn tính tiền (BILL-02). Cần: lý do, báo waiter + khách, gợi ý món thay thế, **tự reset đầu ngày**, tồn kho theo số lượng (`daily_limit`, tự 86 khi về 0).
- [ ] **KDS-05 · Hiển thị yêu cầu đặc biệt** — tùy chọn (cay/không hành/ít đá), ghi chú dị ứng nổi bật, phiếu hủy/sửa; gom theo món ("cần làm: 5 bánh xèo") và theo bàn; màn **pass/expo** cho người ra món.
- [ ] **KDS-06 · Giữ/bắn món theo course (hold & fire)** — khai vị trước, món chính sau, "gấp" đã có (`rush`). 🧩 GAP
- [ ] **KDS-07 · Mạng chập chờn** — hàng đợi thao tác + retry + chỉ báo offline (bếp bấm xong mà mất mạng không được mất thao tác).

### 4.5 P1 — THỰC ĐƠN

- [ ] **MENU-01 · Tùy chọn/topping/combo** · 🧩 GAP — hiện chỉ có biến thể (`item_units`) + ghi chú tự do. Cần nhóm tùy chọn (size, độ cay, đá/đường, topping) có phụ thu, bắt buộc/tùy chọn, min/max; combo/set menu (chọn món trong set); chip ghi chú nhanh.
- [ ] **MENU-02 · CRUD admin đầy đủ** · 📖 CODE — API **không có** thêm/sửa/xóa/sắp xếp **danh mục**; API sửa được tên/mô tả/danh mục/giá đơn vị mặc định nhưng UI chỉ có "thêm món" + bật/tắt hết món; không thêm/xóa đơn vị; không xóa/lưu trữ món; không sửa/xóa bàn; không reset PIN; không upload ảnh. Cần đủ CRUD + kéo sắp xếp + import/export CSV/Excel + thẻ (cay/chay/hải sản) + dị ứng + tên đa ngôn ngữ + giờ bán (trưa/tối, bia hơi) + `tax_category` + trạm bếp.
- [ ] **MENU-03 · Món bán theo cân & đơn vị lớn** · 🧩 GAP · *rất đặc thù Việt Nam* — hải sản/lẩu bán theo **kg** (giá/kg, cân tại bàn, số lượng thập phân, cân xong mới chốt tiền), bia theo **két/thùng/chai**, món "theo con". `qty` hiện là số nguyên → cần `numeric(10,3)` + đơn vị cân + bước nhập "cân thực tế".
- [ ] **MENU-04 · Giá theo giờ/khu (happy hour, phòng lạnh/sân vườn)** · P3.

### 4.6 P1 — VẬN HÀNH SÀN (NHÂN VIÊN PHỤC VỤ)

- [ ] **FLOOR-01 · Sơ đồ bàn & trạng thái** — thêm số khách, trạng thái (trống/đang ăn/chờ thanh toán/cần dọn/đặt trước), thời gian ngồi, khu vực, ghép bàn cho đoàn, đặt bàn cơ bản.
- [ ] **FLOOR-02 · Gọi món bởi nhân viên** — hiện mỗi món thêm là **gửi bếp ngay**. Cần "giữ" rồi **Gửi bếp** theo lượt, tùy chọn/ghi chú đầy đủ, tìm kiếm, gọi lại món cũ.
- [ ] **FLOOR-03 · Hộp thư đơn khách tự gọi** — chế độ duyệt/tự nhận; nhận/từ chối kèm lý do; hiện tại đơn khách vào thẳng bếp (🔴 REPRO:B2). Tắt/bật theo quán.
- [ ] **FLOOR-04 · Gọi nhân viên** — lý do (thêm nước, thanh toán, hỏi món…), người nhận, trạng thái đã xử lý, âm thanh, dedupe (SEC-07).
- [ ] **FLOOR-05 · "Gọi thanh toán"** từ khách → bàn chuyển "chờ thanh toán"; in/hiện bill tạm tính.
- [ ] **FLOOR-06 · Mang về / tại quầy / giao hàng** · 🧩 GAP — cờ `takeaway:false` có trong settings nhưng **không có chức năng**. Cần đơn không bàn (số thứ tự/tên/SĐT), nguồn đơn (`source`: tại bàn/mang về/Grab/Shopee/Be… nhập tay), thanh toán tại quầy, không thu phí PV.
- [ ] **FLOOR-07 · Cờ tính năng chỉ là trang trí** · 📖 CODE — trang settings có 9 cờ (`vat, kitchen, takeaway, call_staff, split_bill, guest_order, complementary, service_charge, transfer_table`) nhưng **chỉ `call_staff` được kiểm tra** ở server (grep `features.` chỉ ra 1 chỗ). Mỗi cờ phải được ép ở **server** và ẩn ở UI. Test mỗi cờ: tắt → API 403 + UI không hiện. Đặc biệt quán nhỏ 1 người tắt `kitchen` → waiter tự đánh dấu món xong.
- [ ] **FLOOR-08 · Ca làm việc & két tiền** — mở/đóng ca, tiền đầu ca, kiểm đếm so với số liệu hệ thống, chênh lệch, báo cáo X/Z, thanh toán gắn ca.

### 4.7 P1 — IN ẤN, HÓA ĐƠN, THANH TOÁN QR

- [ ] **PRINT-01 · In phiếu bếp/bar** · 🧩 GAP · L8 — hiện **không có in** (grep không thấy `window.print`/`@media print`). Web không nói chuyện trực tiếp với máy in LAN/Bluetooth; cần chọn kiến trúc (cầu nối in cục bộ poll server / in qua trình duyệt / ESC/POS). BLOCKED-HUMAN: loại máy in thực tế + xác minh L8. Làm trước phần không phụ thuộc phần cứng: template phiếu 58/80mm, hàng đợi in, in lại, trạng thái lỗi.
- [ ] **PRINT-02 · Bill/phiếu tạm tính** — CSS in 80mm, thương hiệu tenant, QR VietQR, "BẢN SAO" khi in lại, mã order.
- [ ] **INV-03 · ⚖️ Hóa đơn điện tử** · L5 — lưu thông tin người mua (MST, tên công ty, địa chỉ, email) lúc thanh toán; tích hợp **một** nhà cung cấp HĐĐT qua adapter (quyết định chủ dự án); trạng thái hóa đơn, retry, hủy/thay thế, lưu trữ. BLOCKED-HUMAN: chọn nhà cung cấp + sandbox key + xác nhận yêu cầu cho từng loại hình kinh doanh.
- [ ] **PAY-04 · VietQR động** · L9 — hiện chỉ in text ngân hàng/STK. Cần QR có **số tiền + nội dung = mã order**, danh sách ngân hàng chuẩn khi cấu hình, xác nhận chuyển khoản (thủ công trước; webhook ngân hàng là phương án sau, cần quyết định). Test: QR decode ra đúng số tiền/nội dung.

### 4.8 P2 — QUẢN TRỊ & BÁO CÁO

- [ ] **ADMIN-01 · Báo cáo** · 📖 CODE — hiện chỉ có "hôm nay" + top 8 (đếm cả đơn hủy/chưa trả/86, xem BILL-02, DATA-06). Cần: khoảng ngày, theo phương thức/món/nhóm/nhân viên/giờ, hủy-tặng-giảm giá (đối soát), AOV, vòng quay bàn, thời gian bếp, xuất CSV/Excel. Doanh thu chỉ tính đơn `paid`, đọc `bill_snapshot`.
- [ ] **ADMIN-02 · Nhật ký thao tác (audit log)** — bảng append-only: ai/lúc nào/làm gì/giá trị trước-sau cho hủy, tặng, giảm giá, đổi giá, đổi cài đặt, đăng nhập, reset PIN, mở/đóng ca.
- [ ] **ADMIN-03 · Vai trò & quyền** — hiện cứng 3 role. Thêm quản lý/thu ngân/bưng bê + ma trận quyền cấu hình theo quán (ai được hủy/tặng/giảm giá/hoàn tiền, ngưỡng cần duyệt), duyệt bằng PIN quản lý.
- [ ] **ADMIN-04 · Thương hiệu theo tenant** · 📖 CODE — `layout.tsx` hardcode `themeColor #E85D04` + tiêu đề "Gọi món tại bàn"; `manifest.webmanifest` tĩnh tên "Nhân viên nhà hàng"; `apple-touch-icon` là **SVG** (iOS thường cần PNG — L8, xác minh). Cần manifest/theme/icon **động theo tenant**, upload logo, màu (validate), giờ mở cửa (đã xác nhận: chỉ hiển thị ở đầu trang khách, không chặn đặt món khi đóng cửa), wifi, mạng xã hội, subdomain/domain riêng, mẫu **in QR bàn** (A5/A6 PDF có logo + số bàn), xoay QR.
- [ ] **ADMIN-05 · UX cài đặt** — `coalesce` khiến **không thể xóa** trường (vd xóa tài khoản ngân hàng); nhập thuế theo % (người dùng gõ "8" = 8%); chọn ngân hàng từ danh sách.
- [ ] **ADMIN-06 · Bảng điều khiển nền tảng** — tạo/ngưng tenant, gói tính năng (feature entitlement), thống kê dùng, xuất/xóa dữ liệu tenant.
- [ ] **ADMIN-07 · Đa chi nhánh** · P3 — thiết kế schema chừa chỗ (`tenant → branch`), menu/giá ghi đè theo chi nhánh, dashboard chủ chuỗi. Chưa làm UI.
- [ ] **ADMIN-08 · Kho/công thức** · P3.

### 4.9 P2 — WEB KHÁCH (QUÉT QR)

- [ ] **GUEST-01 · Nhiều người cùng bàn** — giỏ hàng nằm ở `localStorage` từng máy (📖 CODE) → không chia sẻ; thấy toàn bộ món đã gọi của người khác nhưng không biết ai gọi. Cần giỏ chung theo phiên bàn (tùy chọn), "Lượt gọi 1, 2, …", hiện người gọi.
- [ ] **GUEST-02 · Trạng thái món & hủy** — theo dõi (chờ/đang làm/đã ra) cập nhật tự động; cho hủy trong N giây trước khi bếp nhận; xem lại giỏ + xác nhận trước khi gửi.
- [ ] **GUEST-03 · Trang món** — tùy chọn/topping (MENU-01), món hết hàng hiển thị rõ, thanh danh mục dính, ảnh lazy/WebP, **chuyển ngôn ngữ** (`name_en` có dữ liệu nhưng đã xác nhận chỉ dùng cho tìm kiếm, chưa có nút đổi ngôn ngữ).
- [ ] **GUEST-04 · Trợ năng** · 🔴 `maximumScale:1` trong `layout.tsx` **chặn zoom**; chữ 11px; chỉ 3 `aria-` trong trang menu; mục chạm ≥44px; tương phản; kiểm tra bằng axe.
- [ ] **GUEST-05 · Trạng thái lỗi/trống** — QR sai/bàn đóng/quán đóng cửa/mất mạng/bấm đúp (idempotency).
- [ ] **GUEST-06 · Xem bill, thanh toán VietQR trên máy khách, yêu cầu xuất hóa đơn (nhập MST), đánh giá sau bữa.**
- [ ] **GUEST-07 · ⚖️ Đồng ý dữ liệu cá nhân** — thông báo + đồng ý trước khi nhập tên/SĐT, thời hạn lưu, yêu cầu xóa. L7 chưa xác minh.
- [ ] **GUEST-08 · Chống lạm dụng** — giới hạn số lượt/giây, ngưỡng số lượng/bill cần nhân viên duyệt, phiên bàn hết hạn (SEC-07).

### 4.10 P2 — PWA NHÂN VIÊN

- [ ] **PWA-01** — hiện chỉ có `manifest`, **không có service worker**, không offline; chuyển nhanh người dùng trên máy dùng chung (màn hình khóa PIN); phiên 12h hết giữa ca đông phải mượt; giữ màn hình sáng; rung/âm.
- [ ] **PWA-02 · Giao diện** — thiết kế theo **ảnh tham khảo chủ dự án sẽ gửi** (chưa nhận ở thời điểm audit). Làm design tokens + component kit + đủ trạng thái (loading/empty/error), chế độ tối cho bếp, bố cục tablet/ngang cho bếp & thu ngân, mục chạm lớn. Không dùng giao diện "AI mặc định".
- [ ] **PWA-03 · i18n** — vi mặc định, en; chuỗi ra khỏi JSX.

---

## 5. KẾ HOẠCH TEST

### 5.1 Hạ tầng test (làm đầu tiên — TEST-00)
- Chọn runner (vitest hoặc `node:test`), `fast-check` cho property test, Playwright cho E2E + axe-core, k6 cho tải. Postgres thật qua docker-compose/testcontainers; PGlite chỉ cho unit.
- Dùng `probe-audit.mjs` làm **đặc tả hồi quy**: mỗi `REPRO:<id>` → 1 test tự động (fail trước, pass sau khi sửa). Lưu ý script phụ thuộc dữ liệu seed demo (PIN, bàn); chuyển sang fixture riêng không dùng PIN thật.
- CI: typecheck + lint + unit + integration + e2e; chặn merge nếu đỏ.

### 5.2 Các tầng bắt buộc
| Tầng | Nội dung | Ngưỡng |
|---|---|---|
| Unit | `billing/*` (vector mục BILL-14), tax by date, split, rounding, state machine món/order | cover ≥ 95% billing |
| Property | Σ dòng = tổng; tách bill Σ phần = gốc; bill ≥ 0; thuế không âm | 1.000 mẫu/ngẫu nhiên |
| Integration API (Postgres thật) | Từng endpoint × từng role | ma trận dưới |
| **Ma trận phân quyền** | role (none, waiter, kitchen, admin, platform) × endpoint × kết quả mong đợi (200/401/403) — sinh bảng tự động | 100% endpoint |
| **Cô lập tenant** | fuzz id chéo tenant (SEC-04) | 0 rò rỉ |
| **Đồng thời** | 20 pay song song; 20 đặt món cùng bàn trống; gộp/tách song song; 2 bếp bấm cùng món | đúng 1 kết quả hợp lệ, không dữ liệu dở |
| Bảo mật | brute force PIN, session sau logout, header, input độc, XSS/CSS injection qua tên/ghi chú/màu | 0 high |
| E2E (Playwright, viewport iPhone/Android/iPad) | luồng khách, waiter, bếp, thu ngân, admin (mục 5.3) | mọi kịch bản xanh, lưu video khi fail |
| Trợ năng | axe: 0 lỗi nghiêm trọng; zoom được; điều hướng bằng bàn phím | — |
| Tải | 60 bàn × 3 máy khách + 3 màn bếp + 5 waiter, giờ cao điểm 10 phút | p95 < 500ms, lỗi < 0.1% |
| Chaos | mất mạng giữa lúc thanh toán; restart server khi đang gửi bếp; DB chậm | không mất/đúp tiền, UI báo rõ |
| Migration | lên từ DB trống; lên từ bản `8362b1f`; restore backup | dữ liệu nguyên vẹn |

### 5.3 Ma trận kịch bản theo loại hình Việt Nam (mỗi dòng → ít nhất 1 test E2E + 1 test bill)
| Loại hình | Kịch bản bắt buộc test |
|---|---|
| **Quán nhậu / bia hơi** | Gọi bia liên tục nhiều đợt từ 3 điện thoại cùng bàn; bia (10%) trộn món ăn (8%/10%); đơn vị chai/két; gộp 2 bàn khi nhóm kéo đến; chia bill 4 người tiền mặt + chuyển khoản; thanh toán lúc 00:30 (ngày kinh doanh); khách bỏ về nửa chừng (void có lý do). |
| **Quán lẩu / nướng** | Set lẩu + topping tùy chọn; thêm nước lẩu/rau; món lên theo thứ tự (hold & fire); nồi hết nước lẩu 86; tính theo đầu người. |
| **Cơm / bún / phở (nhanh)** | Gọi tại quầy lấy số; mang về không phí PV; tắt `kitchen` cho quán 1–2 người; bill nhỏ liên tục (hiệu năng). |
| **Hải sản** | Món theo kg: báo giá → cân → chốt tiền; thay đổi cách chế biến; hủy sau khi đã cân (hao hụt); tách bill theo món đắt. |
| **Cafe / trà sữa** | Tùy chọn đá/đường/size/topping; mang về; gọi số/buzzer; 50 đơn trong 10 phút; hết topping giữa ca. |
| **Nhà hàng cao cấp / tiệc** | Set menu theo course; phí PV 5–10% + VAT; đặt cọc trừ vào bill; xuất HĐĐT công ty (MST); giảm giá có duyệt admin; nhiều khách chia riêng. |
| **Buffet** | Giá theo đầu người (người lớn/trẻ em), phụ thu đồ uống, timer. |
| **Hộ gia đình nhỏ** | 1 người kiêm admin/waiter/bếp; tắt cờ không dùng; UI không rối. |
| **Sân vườn / tầng / phòng VIP** | Khu vực, phụ thu phòng/min-spend, phân công nhân viên theo khu. |
| **Chuỗi nhiều chi nhánh** | Cô lập dữ liệu chi nhánh, menu ghi đè, báo cáo tổng. |
| **Tình huống chung** | Khách quét QR cũ sau khi đã thanh toán; QR bị chụp gửi người ở xa; hai khách bấm gửi cùng lúc; hết điện thoại khách giữa lượt gọi; wifi yếu; đổi thuế suất đúng nửa đêm 31/12→01/01; nhân viên nghỉ giữa ca (vô hiệu hóa → mất phiên ngay). |

### 5.4 UAT trên thiết bị thật (`BLOCKED-HUMAN`, ghi kết quả vào `docs/TESTING.md`)
iPhone Safari (≥2 đời iOS), Android Chrome tầm thấp, iPad cho bếp, máy in nhiệt thật, mạng 3G/wifi chập chờn, một ca chạy thử thật ở một quán với 3 nhân viên + 1 bếp. Checklist: đăng nhập, gọi món, bếp nhận, in phiếu, thanh toán 3 phương thức, tách bill, đóng ca, báo cáo khớp tiền mặt.

---

## 6. DEFINITION OF DONE (chỉ dừng khi đạt TẤT CẢ)

1. Mọi mục **P0 và P1** `[x]`, mọi mục **P2** `[x]` hoặc có ADR ghi rõ lý do hoãn + người duyệt. P3 có thể hoãn.
2. Mọi `REPRO:*` có test hồi quy xanh; ma trận phân quyền + cô lập tenant + đồng thời xanh **trên Postgres thật**.
3. Toàn bộ cổng CI xanh liên tục 3 lần chạy; cover billing ≥ 95%; axe 0 lỗi nghiêm trọng; tải đạt ngưỡng.
4. Không còn thứ gì hardcode theo quán demo; DB mới không chứa dữ liệu demo; không PIN/secret trong repo.
5. Bộ tài liệu mục 2 đầy đủ, `AGENTS.md` ≤150 dòng, `RESEARCH.md` ghi nguồn + ngày xác minh cho mọi sự kiện pháp lý; các mục L4/L6/L7/L8/L9 đã xác minh hoặc ghi rõ `BLOCKED-HUMAN`.
6. Danh sách `BLOCKED-HUMAN` được tổng hợp ở đầu `docs/BACKLOG.md` kèm đúng thứ cần từ chủ dự án (kế toán duyệt thuế/phí PV/làm tròn, nhà cung cấp HĐĐT, máy in, thiết bị thật, ảnh thiết kế).
7. Một lần chạy thử từ đầu theo `RUNBOOK.md` trên máy sạch: tạo tenant → cấu hình menu/bàn/thuế → in QR → chạy một ca đủ luồng → đóng ca → đối soát khớp. Ghi lại kết quả.

---

## 7. ĐÃ BIẾT & KHÔNG CẦN LÀM LẠI
- Đã xác nhận `tsc --noEmit` và `next build` pass trên commit `8362b1f`; Node 22, Next 15.5.29, React 19.
- Role-gating route hoạt động (waiter → 403 ở admin/kitchen). Giữ nguyên cách làm, chỉ thêm ma trận test.
- Tiền số nguyên VND, snapshot tên/giá trên order item: giữ.
- `scripts/migrate.mjs` dùng advisory lock + bảng `schema_migrations` + transaction mỗi file: cơ chế tốt, chỉ cần tách seed ra khỏi migration (SEC-02).
- Lưu ý môi trường khi audit: tiến trình chạy nền bị dừng khi lệnh shell kết thúc (cần `setsid nohup … &`); PGlite mất dữ liệu khi restart (theo thiết kế). Đừng dùng `pkill -f next` trong lệnh có chứa chữ "next" (tự giết shell).
