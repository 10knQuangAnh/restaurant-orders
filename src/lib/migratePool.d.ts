import type pg from "pg";
export function migratePool(pool: pg.Pool, files: { name: string; sql: string }[]): Promise<void>;
