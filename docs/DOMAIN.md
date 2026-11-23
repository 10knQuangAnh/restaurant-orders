Last verified: 2026-11-23 · Scope: money rules + vectors

# Domain — money

- Currency: integer VND.
- Listed prices VAT-included unless `vat_included=false`.
- Line VAT = `round(line * r / (1+r))` if included, else `round(line * r)`.
- Mix: food vs alcohol can differ (`tax_category` + `tax_rates` by date, timezone `Asia/Ho_Chi_Minh`).
- Service: `round(net * service_rate)` on VAT-included subtotal (or subtotal+VAT if exclusive). `service_charge_taxable` exists but default false — **BLOCKED-HUMAN accounting**.
- Discount: `discount_dong` on order, capped at net+service. Waiter up to 50_000đ; more needs admin.
- Cash round: `cash_round_to` (0 = off, default off). Payment stores exact `total` + `rounding_dong`.
- Complementary: flag only; `unit_price_dong` kept; not billed.
- 86 / cancelled / qty≤0: not billed.

## Vectors (unit-tested)
| Input | Expect |
|---|---|
| 108.000 includes 8% | VAT 8.000 |
| 110.000 includes 10% | VAT 10.000 |
| 344.350 round 1.000 | cash 344.000, rounding -350 |
| 1.000.000 split 3 | 333.333 + 333.333 + 333.334 |
| food 2026-12-31 | 8% |
| food 2027-01-01 | 10% (if no extension) |
| alcohol any demo date | 10% |
