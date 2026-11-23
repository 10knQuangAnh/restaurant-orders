import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migratePool } from "../src/lib/migratePool.mjs";

function transactionPool(failSql = "", rollbackFails = false) {
  const statements: string[] = [];
  let inTransaction = false;
  let released = false;
  const failure = new Error("bootstrap_failed");
  const client = {
    async query(sql: string) {
      statements.push(sql);
      if (sql === "begin") inTransaction = true;
      if (sql.includes("pg_advisory_lock(")) throw new Error("Session locks unsupported");
      if (sql.includes("pg_advisory_xact_lock") && !inTransaction) throw new Error("Transaction required");
      if (sql === failSql) throw failure;
      if (sql === "rollback" && rollbackFails) throw new Error("rollback_failed");
      if (sql === "commit" || sql === "rollback") inTransaction = false;
      if (sql === "select name from schema_migrations") return { rows: [{ name: "already-applied.sql" }] };
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  return {
    pool: { connect: async () => client },
    statements,
    failure,
    released: () => released,
    inTransaction: () => inTransaction,
  };
}

describe("transaction-pooled schema bootstrap", () => {
  it("works with a pooler that rejects session locks and skips applied migrations", async () => {
    const p = transactionPool();
    await migratePool(p.pool, [
      { name: "already-applied.sql", sql: "must_not_run" },
      { name: "new.sql", sql: "create table example(id int)" },
    ]);
    assert.equal(p.statements.includes("must_not_run"), false);
    assert.equal(p.statements.includes("create table example(id int)"), true);
    assert.equal(p.statements.at(-1), "commit");
    assert.equal(p.inTransaction(), false);
    assert.equal(p.released(), true);
  });
  it("rolls back the whole bootstrap on migration failure and releases the client", async () => {
    const p = transactionPool("invalid migration");
    await assert.rejects(
      migratePool(p.pool, [{ name: "bad.sql", sql: "invalid migration" }]),
      (error) => error === p.failure,
    );
    assert.equal(p.statements.includes("commit"), false);
    assert.equal(p.statements.at(-1), "rollback");
    assert.equal(p.released(), true);
  });
  it("preserves the original failure if rollback itself fails", async () => {
    const p = transactionPool("invalid migration", true);
    await assert.rejects(
      migratePool(p.pool, [{ name: "bad.sql", sql: "invalid migration" }]),
      (error) => error === p.failure,
    );
    assert.equal(p.released(), true);
  });
});
