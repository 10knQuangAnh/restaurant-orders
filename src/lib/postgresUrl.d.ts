export function normalizePostgresUrl(raw?: string): string;
export function usablePostgresUrl(...candidates: Array<string | undefined>): string;
export function runtimePostgresUrl(env?: Record<string, string | undefined>): string;
export function migratePostgresUrl(env?: Record<string, string | undefined>): string;
export function pgClientSsl(url: string): { rejectUnauthorized: false } | undefined;
