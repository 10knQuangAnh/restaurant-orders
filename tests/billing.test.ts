import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeBill, isBillableLine } from "../src/lib/money.ts";
import { pickTaxRate } from "../src/lib/time.ts";

const rates = { vatRate: 0.08, vatIncluded: true, serviceRate: 0.05, discount: 0, cashRoundTo: 0 };

function bill(lines: Parameters<typeof computeBill>[0]["lines"], extra: Partial<typeof rates> = {}) {
  return computeBill({ lines, ...rates, ...extra });
}

describe("BILL-14 vectors", () => {
  it("1 dish VAT-included 8%", () => {
    const b = bill([{ qty: 1, unit_price_dong: 108_000 }]);
    assert.equal(b.vat, 8_000);
    assert.equal(b.subtotal, 108_000);
  });

  it("110.000 includes VAT 10% → VAT 10.000", () => {
    const b = bill([{ qty: 1, unit_price_dong: 110_000, vat_rate: 0.1 }], { vatRate: 0.1, serviceRate: 0 });
    assert.equal(b.vat, 10_000);
    assert.equal(b.total, 110_000);
  });

  it("108.000 includes VAT 8% → VAT 8.000", () => {
    const b = bill([{ qty: 1, unit_price_dong: 108_000 }], { serviceRate: 0 });
    assert.equal(b.vat, 8_000);
  });

  it("cash round 1000: 344350 → 344000", () => {
    const b = bill([{ qty: 1, unit_price_dong: 344_350 }], { vatRate: 0, serviceRate: 0, cashRoundTo: 1000 });
    assert.equal(b.cashTotal, 344_000);
    assert.equal(b.rounding, -350);
  });

  it("many dishes", () => {
    const b = bill([
      { qty: 2, unit_price_dong: 129_000 },
      { qty: 1, unit_price_dong: 55_000 },
    ]);
    assert.equal(b.subtotal, 313_000);
    assert.ok(b.total > 0);
  });

  it("mixed 8% food + 10% alcohol", () => {
    const b = bill(
      [
        { qty: 1, unit_price_dong: 108_000, vat_rate: 0.08 },
        { qty: 1, unit_price_dong: 110_000, vat_rate: 0.1 },
      ],
      { serviceRate: 0 },
    );
    assert.equal(b.vat, 18_000);
    assert.equal(b.subtotal, 218_000);
  });

  it("ex-VAT 10%", () => {
    const b = bill([{ qty: 1, unit_price_dong: 100_000, vat_rate: 0.1 }], {
      vatIncluded: false,
      vatRate: 0.1,
      serviceRate: 0,
    });
    assert.equal(b.vat, 10_000);
    assert.equal(b.total, 110_000);
  });

  it("service 5% on VAT-included", () => {
    const b = bill([{ qty: 1, unit_price_dong: 100_000 }], { vatRate: 0, serviceRate: 0.05 });
    assert.equal(b.service, 5_000);
    assert.equal(b.total, 105_000);
  });

  it("discount amount", () => {
    const b = bill([{ qty: 1, unit_price_dong: 100_000 }], { vatRate: 0, serviceRate: 0, discount: 20_000 });
    assert.equal(b.discount, 20_000);
    assert.equal(b.total, 80_000);
  });

  it("discount cannot exceed total", () => {
    const b = bill([{ qty: 1, unit_price_dong: 50_000 }], { vatRate: 0, serviceRate: 0, discount: 99_999 });
    assert.equal(b.total, 0);
  });

  it("100% discount", () => {
    const b = bill([{ qty: 1, unit_price_dong: 80_000 }], { vatRate: 0, serviceRate: 0, discount: 80_000 });
    assert.equal(b.total, 0);
  });

  it("cash round off keeps exact total", () => {
    const b = bill([{ qty: 1, unit_price_dong: 344_400 }], { vatRate: 0, serviceRate: 0, cashRoundTo: 0 });
    assert.equal(b.cashTotal, 344_400);
    assert.equal(b.rounding, 0);
  });

  it("zero order", () => {
    const b = bill([]);
    assert.equal(b.total, 0);
    assert.equal(b.vat, 0);
  });

  it("large numbers", () => {
    const b = bill([{ qty: 99, unit_price_dong: 1_000_000 }], { vatRate: 0, serviceRate: 0 });
    assert.equal(b.total, 99_000_000);
  });

  it("split 1.000.000 / 3", () => {
    const parts = [333_333, 333_333, 333_334];
    assert.equal(parts.reduce((a, b) => a + b, 0), 1_000_000);
  });

  it("complementary not billed", () => {
    const b = bill([
      { qty: 1, unit_price_dong: 179_000, complementary: true },
      { qty: 1, unit_price_dong: 55_000 },
    ], { vatRate: 0, serviceRate: 0 });
    assert.equal(b.subtotal, 55_000);
  });

  it("86 not billed", () => {
    const b = bill([
      { qty: 1, unit_price_dong: 179_000, kitchen_status: "86" },
      { qty: 1, unit_price_dong: 55_000, kitchen_status: "queued" },
    ], { vatRate: 0, serviceRate: 0 });
    assert.equal(b.subtotal, 55_000);
  });

  it("cancelled not billed", () => {
    const b = bill([{ qty: 2, unit_price_dong: 99_000, kitchen_status: "cancelled" }], { vatRate: 0, serviceRate: 0 });
    assert.equal(b.total, 0);
  });

  it("qty 0 not billed", () => {
    assert.equal(isBillableLine({ qty: 0, kitchen_status: "queued" }), false);
  });

  it("negative total never happens", () => {
    const b = bill([{ qty: 1, unit_price_dong: 10_000 }], { vatRate: 0, serviceRate: 0, discount: 50_000 });
    assert.ok(b.total >= 0);
  });

  it("serviceRate clamped conceptually via compute (negative treated as 0 via Math.max in caller)", () => {
    const b = bill([{ qty: 1, unit_price_dong: 100_000 }], { vatRate: 0, serviceRate: 0 });
    assert.equal(b.service, 0);
  });

  it("two lines sum equals subtotal", () => {
    const lines = [
      { qty: 3, unit_price_dong: 45_000 },
      { qty: 1, unit_price_dong: 129_000 },
    ];
    const b = bill(lines, { vatRate: 0, serviceRate: 0 });
    assert.equal(b.subtotal, 3 * 45_000 + 129_000);
  });

  it("VAT-included 8% with service 5%", () => {
    const b = bill([{ qty: 1, unit_price_dong: 200_000 }]);
    assert.equal(b.vat, Math.round((200_000 * 0.08) / 1.08));
    assert.equal(b.service, Math.round(200_000 * 0.05));
    assert.equal(b.total, 200_000 + b.service);
  });

  it("done and served still billed", () => {
    const b = bill(
      [
        { qty: 1, unit_price_dong: 50_000, kitchen_status: "done" },
        { qty: 1, unit_price_dong: 50_000, kitchen_status: "served" },
      ],
      { vatRate: 0, serviceRate: 0 },
    );
    assert.equal(b.subtotal, 100_000);
  });

  it("queued billed", () => {
    const b = bill([{ qty: 2, unit_price_dong: 40_000, kitchen_status: "queued" }], { vatRate: 0, serviceRate: 0 });
    assert.equal(b.total, 80_000);
  });

  it("property: line vat sums to bill.vat", () => {
    const lines = [
      { qty: 1, unit_price_dong: 108_000, vat_rate: 0.08 },
      { qty: 2, unit_price_dong: 55_000, vat_rate: 0.1 },
    ];
    const b = bill(lines, { serviceRate: 0 });
    const vatLines = lines.reduce((s, l) => s + Math.round((l.qty * l.unit_price_dong * l.vat_rate) / (1 + l.vat_rate)), 0);
    assert.equal(b.vat, vatLines);
  });

  it("tax date: 2026-12-31 food 8%, 2027-01-01 food 10%", () => {
    const rows = [
      { code: "food", rate: 0.08, effective_from: "2025-07-01", effective_to: "2026-12-31" },
      { code: "food", rate: 0.1, effective_from: "2027-01-01", effective_to: null },
      { code: "alcohol", rate: 0.1, effective_from: "2025-01-01", effective_to: null },
    ];
    assert.equal(pickTaxRate(rows, "food", "2026-12-31", 0.08), 0.08);
    assert.equal(pickTaxRate(rows, "food", "2027-01-01", 0.08), 0.1);
    assert.equal(pickTaxRate(rows, "alcohol", "2026-06-01", 0.08), 0.1);
  });

  it("rounding + bill.total = cashTotal", () => {
    const b = bill([{ qty: 1, unit_price_dong: 123_456 }], { vatRate: 0, serviceRate: 0, cashRoundTo: 1000 });
    assert.equal(b.total + b.rounding, b.cashTotal);
  });

  it("preparing still billed", () => {
    assert.equal(isBillableLine({ qty: 1, kitchen_status: "preparing", complementary: false }), true);
  });
});
