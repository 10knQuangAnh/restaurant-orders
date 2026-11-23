import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { bundledSql } from "./bundledSql";
import { hashPin } from "./pin";
import { pgClientSsl, runtimePostgresUrl } from "./postgresUrl.mjs";
import { ApiError } from "./http";

const databaseUrl = runtimePostgresUrl();

type DbGlobal = typeof globalThis & {
  __printOrderPool?: pg.Pool;
  __printOrderLocal?: Promise<PGlite>;
  __printOrderBoot?: Promise<void>;
};

const g = globalThis as DbGlobal;

export type QueryFn = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

async function loadSql(dir: "migrations" | "seeds"): Promise<{ name: string; sql: string }[]> {
  const folder = join(process.cwd(), dir);
  const names = (await readdir(folder).catch(() => [])).filter((f) => f.endsWith(".sql")).sort();
  if (names.length) {
    return Promise.all(
      names.map(async (name) => ({
        name,
        sql: await readFile(join(folder, name), "utf8"),
      })),
    );
  }
  return bundledSql[dir].map((file) => ({ name: file.name, sql: file.sql }));
}

async function hashPlainPins(q: QueryFn) {
  try {
    const rows = await q<{ id: string; pin: string }>(
      `select id, pin from staff where pin_hash is null or pin_hash = ''`,
    );
    for (const row of rows) {
      await q(`update staff set pin_hash = $1 where id = $2`, [hashPin(row.pin), row.id]);
    }
  } catch {
    /* schema or staff table not ready */
  }
}

async function migratePool(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(7272741)");
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const done = new Set(
      (await client.query("select name from schema_migrations")).rows.map((row: { name: string }) => row.name),
    );
    for (const file of await loadSql("migrations")) {
      if (done.has(file.name)) continue;
      await client.query("begin");
      try {
        await client.query(file.sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file.name]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    try {
      await client.query("select pg_advisory_unlock(7272741)");
    } finally {
      client.release();
    }
  }
}

async function bootPostgres(url: string) {
  const pool = new pg.Pool({
    connectionString: url,
    max: 8,
    ssl: pgClientSsl(url),
    connectionTimeoutMillis: 10_000,
  });
  g.__printOrderPool = pool;
  await migratePool(pool);
  const counted = await pool.query(`select count(*)::int as c from tenants`);
  if (Number(counted.rows[0]?.c || 0) === 0 && demoSeedEnabled()) {
    for (const file of await loadSql("seeds")) {
      await pool.query(file.sql);
    }
  }
  const q: QueryFn = async (text, params = []) => (await pool.query(text, params)).rows as never;
  await hashPlainPins(q);
}

async function bootLocal() {
  const db = new PGlite();
  for (const file of await loadSql("migrations")) {
    await db.exec(file.sql);
  }
  if (demoSeedEnabled()) {
    for (const file of await loadSql("seeds")) {
      await db.exec(file.sql);
    }
  }
  const q: QueryFn = async (text, params = []) => (await db.query(text, params)).rows as never;
  await hashPlainPins(q);
  g.__printOrderLocal = Promise.resolve(db);
}

function boot(): Promise<void> {
  if (!databaseUrl && process.env.NODE_ENV === "production") {
    return Promise.reject(new ApiError(503, "database_unconfigured"));
  }
  g.__printOrderBoot ??= (databaseUrl ? bootPostgres(databaseUrl) : bootLocal()).catch((error: unknown) => {
    g.__printOrderBoot = undefined;
    g.__printOrderPool = undefined;
    g.__printOrderLocal = undefined;
    throw error;
  });
  return g.__printOrderBoot;
}

function demoSeedEnabled(): boolean {
  return process.env.NODE_ENV === "production" ? process.env.SEED_DEMO === "1" : process.env.SEED_DEMO !== "0";
}

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await boot();
  if (g.__printOrderPool) {
    return (await g.__printOrderPool.query(text, params)).rows as T[];
  }
  const local = await (g.__printOrderLocal as Promise<PGlite>);
  return (await local.query<T>(text, params)).rows;
}

export async function withTx<T>(fn: (q: QueryFn) => Promise<T>): Promise<T> {
  await boot();
  if (g.__printOrderPool) {
    const client = await g.__printOrderPool.connect();
    try {
      await client.query("begin");
      const q: QueryFn = async (text, params = []) => (await client.query(text, params)).rows as never;
      const result = await fn(q);
      await client.query("commit");
      return result;
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      client.release();
    }
  }
  const db = await (g.__printOrderLocal as Promise<PGlite>);
  return db.transaction(async (tx) => {
    const q: QueryFn = async (text, params = []) => (await tx.query(text, params)).rows as never;
    return fn(q);
  });
}
