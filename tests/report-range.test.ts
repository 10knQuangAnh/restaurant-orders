import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mondayOnOrBefore, reportWindow, validYmd } from "../src/lib/time.ts";

describe("report window", () => {
  it("rejects bad dates", () => {
    assert.equal(validYmd("2026-13-01"), null);
    assert.equal(validYmd("2026-11-23"), "2026-11-23");
  });

  it("monday before Wednesday", () => {
    assert.equal(mondayOnOrBefore("2026-11-25"), "2026-11-23");
  });

  it("day / week / month / custom", () => {
    const now = new Date("2026-11-25T10:00:00+07:00");
    const day = reportWindow({ kind: "day", now });
    assert.equal(day.from, "2026-11-25");
    assert.equal(day.to, "2026-11-25");
    const week = reportWindow({ kind: "week", now });
    assert.equal(week.from, "2026-11-23");
    assert.equal(week.to, "2026-11-25");
    const month = reportWindow({ kind: "month", now });
    assert.equal(month.from, "2026-11-01");
    const custom = reportWindow({ kind: "custom", from: "2026-11-20", to: "2026-11-10", now });
    assert.equal(custom.from, "2026-11-10");
    assert.equal(custom.to, "2026-11-20");
  });
});
