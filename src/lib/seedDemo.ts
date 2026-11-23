import { readdir, readFile } from "node:fs/promises";
import { hashPin } from "./pin";
import { sql } from "./db";

export async function applyDemoSeeds(): Promise<{ files: string[]; hashed: number }> {
  const files = (await readdir("seeds").catch(() => [])).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await sql(await readFile(`seeds/${file}`, "utf8"));
  }
  const rows = await sql<{ id: string; pin: string }>(
    `select id, pin from staff where pin_hash is null or pin_hash = ''`,
  );
  for (const row of rows) {
    await sql(`update staff set pin_hash = $1 where id = $2`, [hashPin(row.pin), row.id]);
  }
  return { files, hashed: rows.length };
}
