import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { hashPin } from "./pin";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

type DbGlobal = typeof globalThis & {
  __printOrderPool?: pg.Pool;
  __printOrderLocal?: Promise<PGlite>;
};

const g = globalThis as DbGlobal;

export type QueryFn = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    g.__printOrderPool ??= new pg.Pool({ connectionString: databaseUrl, max: 8 });
    return (await g.__printOrderPool.query(text, params)).rows as T[];
  }
  g.__printOrderLocal ??= startLocal().catch((error: unknown) => {
    g.__printOrderLocal = undefined;
    throw error;
  });
  return (await (await g.__printOrderLocal).query<T>(text, params)).rows;
}

export async function withTx<T>(fn: (q: QueryFn) => Promise<T>): Promise<T> {
  if (databaseUrl !== "") {
    g.__printOrderPool ??= new pg.Pool({ connectionString: databaseUrl, max: 8 });
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
  g.__printOrderLocal ??= startLocal().catch((error: unknown) => {
    g.__printOrderLocal = undefined;
    throw error;
  });
  const db = await g.__printOrderLocal;
  await db.exec("begin");
  try {
    const q: QueryFn = async (text, params = []) => (await db.query(text, params)).rows as never;
    const result = await fn(q);
    await db.exec("commit");
    return result;
  } catch (error) {
    try {
      await db.exec("rollback");
    } catch {
      /* ignore */
    }
    throw error;
  }
}

async function startLocal(): Promise<PGlite> {
  const db = new PGlite();
  const migrations = (await readdir("migrations").catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  const allowSeed = process.env.NODE_ENV !== "production" || process.env.SEED_DEMO === "1";
  if (allowSeed) {
    const seeds = (await readdir("seeds").catch(() => []))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of seeds) {
      await db.exec(await readFile(`seeds/${file}`, "utf8"));
    }
  }
  const rows = await db.query<{ id: string; pin: string }>(
    `select id, pin from staff where pin_hash is null or pin_hash = ''`,
  );
  for (const row of rows.rows) {
    await db.query(`update staff set pin_hash = $1 where id = $2`, [hashPin(row.pin), row.id]);
  }
  return db;
}
