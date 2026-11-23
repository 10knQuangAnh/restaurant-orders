import { ApiError, json } from "@/lib/http";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await sql(`select 1 as ok`);
    return json({ ok: true, ready: true });
  } catch (error) {
    const reason =
      error instanceof ApiError && error.code === "database_unconfigured" ? error.code : "database_unavailable";
    return json({ ok: false, ready: false, reason }, 503);
  }
}
