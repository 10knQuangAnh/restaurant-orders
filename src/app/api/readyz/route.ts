import { json } from "@/lib/http";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await sql(`select 1 as ok`);
    return json({ ok: true, ready: true });
  } catch {
    return json({ ok: false, ready: false }, 503);
  }
}
