import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { bundledSql } from "../src/lib/bundledSql.ts";
import { normalizePostgresUrl, pgClientSsl, usablePostgresUrl } from "../src/lib/postgresUrl.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("normalizePostgresUrl", () => {
  it("accepts Neon / Vercel hosts with a dot", () => {
    const neon = "postgresql://u:p@ep-foo-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    assert.equal(normalizePostgresUrl(neon), neon);
  });

  it("accepts localhost for docker compose builds", () => {
    const local = "postgres://print:print@127.0.0.1:5432/printorder";
    assert.equal(normalizePostgresUrl(local), local);
  });

  it("strips wrapping quotes", () => {
    const inner = "postgres://print:print@localhost:5432/printorder";
    assert.equal(normalizePostgresUrl(`"${inner}"`), inner);
  });

  it("rejects the pg dummy host base", () => {
    assert.equal(normalizePostgresUrl("postgres://base"), "");
    assert.equal(normalizePostgresUrl("postgres://user:pass@base/db"), "");
  });

  it("rejects values pg would resolve against postgres://base", () => {
    assert.equal(normalizePostgresUrl("POSTGRES_URL"), "");
    assert.equal(normalizePostgresUrl("base"), "");
    assert.equal(normalizePostgresUrl("not-a-url"), "");
    assert.equal(normalizePostgresUrl(""), "");
  });

  it("skips a bad candidate then uses POSTGRES_URL", () => {
    const real = "postgres://u:p@ep-x.neon.tech/neondb";
    assert.equal(usablePostgresUrl("POSTGRES_URL", real), real);
  });
});

describe("bundled SQL", () => {
  it("includes demo table token t9-tu-do", () => {
    const text = bundledSql.seeds.map((f) => f.sql).join("\n");
    assert.match(text, /t9-tu-do/);
    assert.ok(bundledSql.migrations.some((f) => f.name === "001_schema.sql"));
  });
});

describe("pgClientSsl", () => {
  it("skips TLS on localhost and enables it for Neon", () => {
    assert.equal(pgClientSsl("postgres://print:print@127.0.0.1:5432/printorder"), undefined);
    assert.deepEqual(pgClientSsl("postgresql://u:p@ep-x.neon.tech/neondb"), { rejectUnauthorized: false });
  });
});

describe("migrate.mjs", () => {
  it("exits 0 when DATABASE_URL is the dummy pg host", () => {
    const r = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: "POSTGRES_URL",
        POSTGRES_URL: "",
        POSTGRES_URL_NON_POOLING: "",
        POSTGRES_PRISMA_URL: "",
        DATABASE_URL_UNPOOLED: "",
      },
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /migrate: skip|nothing to do/);
    assert.doesNotMatch(r.stdout + r.stderr, /ENOTFOUND/);
  });
});
