import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { bundledSql } from "./bundledSql";
import { hashPin } from "./pin";
import { sql } from "./db";

export async function applyDemoSeeds(): Promise<{ files: string[]; hashed: number }> {
  const folder = join(process.cwd(), "seeds");
  const names = (await readdir(folder).catch(() => [])).filter((f) => f.endsWith(".sql")).sort();
  const files = names.length
    ? await Promise.all(names.map(async (name) => ({ name, sql: await readFile(join(folder, name), "utf8") })))
    : bundledSql.seeds.map((file) => ({ name: file.name, sql: file.sql }));
  for (const file of files) {
    await sql(file.sql);
  }
  const rows = await sql<{ id: string; pin: string }>(
    `select id, pin from staff where pin_hash is null or pin_hash = ''`,
  );
  for (const row of rows) {
    await sql(`update staff set pin_hash = $1 where id = $2`, [hashPin(row.pin), row.id]);
  }
  return { files: files.map((f) => f.name), hashed: rows.length };
}
