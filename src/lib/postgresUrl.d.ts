export function normalizePostgresUrl(raw?: string): string;
export function usablePostgresUrl(...candidates: Array<string | undefined>): string;
export function runtimePostgresUrl(): string;
export function migratePostgresUrl(): string;
export function pgClientSsl(url: string): { rejectUnauthorized: false } | undefined;
