import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseTenantSpec } from "../src/lib/tenantSpec.ts";

describe("tenant JSON spec", () => {
  it("parses sample template", () => {
    const raw = JSON.parse(readFileSync("seeds/templates/quan-sample.json", "utf8"));
    const spec = parseTenantSpec(raw);
    assert.equal(spec.tenant.slug, "quan-gio");
    assert.equal(spec.tables.length, 3);
    assert.equal(spec.categories[0].items[0].price_dong, 69000);
    assert.equal(spec.admin.pin, "2468");
  });

  it("rejects short slug", () => {
    assert.throws(() => parseTenantSpec({ tenant: { slug: "ab", name: "X" }, admin: { pin: "1234" }, tables: [{ code: "T1" }], categories: [{ name: "A", items: [] }] }));
  });
});
