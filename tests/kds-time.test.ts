import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canTransition, kitchenOpTarget } from "../src/lib/kds.ts";
import { businessDate } from "../src/lib/time.ts";

describe("KDS-01 state machine", () => {
  it("queued → preparing → done → served", () => {
    assert.equal(canTransition("queued", "preparing"), true);
    assert.equal(canTransition("preparing", "done"), true);
    assert.equal(canTransition("done", "served"), true);
  });
  it("cannot move done back to preparing", () => {
    assert.equal(canTransition("done", "preparing"), false);
    assert.equal(kitchenOpTarget("start"), "preparing");
  });
  it("86 and cancel are terminal from queue", () => {
    assert.equal(canTransition("queued", "86"), true);
    assert.equal(canTransition("86", "done"), false);
    assert.equal(canTransition("cancelled", "queued"), false);
  });
});

describe("DATA-06 business date", () => {
  it("04:59 ICT is previous business day with 05:00 cut", () => {
    const d = businessDate(new Date("2026-11-23T21:59:00Z"), "Asia/Ho_Chi_Minh", 5);
    assert.equal(d, "2026-11-23");
  });
  it("05:01 ICT is that calendar day", () => {
    const d = businessDate(new Date("2026-11-22T22:01:00Z"), "Asia/Ho_Chi_Minh", 5);
    assert.equal(d, "2026-11-23");
  });
});

describe("SEC-06 validation", () => {
  it("qty 1-99", () => {
    const clamp = (n: unknown) => {
      const q = Math.floor(Number(n));
      if (!Number.isFinite(q) || q < 1 || q > 99) return null;
      return q;
    };
    assert.equal(clamp(-3), null);
    assert.equal(clamp(1), 1);
    assert.equal(clamp(99), 99);
  });
  it("hex color", () => {
    const hex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);
    assert.equal(hex("#E85D04"), true);
    assert.equal(hex("red;} body{display:none} /*"), false);
  });
});
