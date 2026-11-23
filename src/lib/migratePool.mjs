/** Run schema bootstrap in one transaction, including its advisory lock.
 * Session locks are unsafe on transaction poolers such as Neon/PgBouncer.
 * @param {import('pg').Pool} pool
 * @param {{ name: string, sql: string }[]} files
 */
export async function migratePool(pool, files) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '15s'");
    await client.query("select pg_advisory_xact_lock(7272741)");
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const done = new Set((await client.query("select name from schema_migrations")).rows.map((row) => row.name));
    for (const file of files) {
      if (done.has(file.name)) continue;
      await client.query(file.sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file.name]);
    }
    await client.query("commit");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      /* Preserve the original bootstrap error. */
    }
    throw error;
  } finally {
    client.release();
  }
}
