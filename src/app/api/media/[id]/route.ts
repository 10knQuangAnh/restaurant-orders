import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id || id.length > 80) return new Response("not found", { status: 404 });
  const rows = await sql<{ mime: string; bytes: string }>(`select mime, bytes from media_files where id = $1`, [id]);
  const row = rows[0];
  if (!row) return new Response("not found", { status: 404 });
  const buf = Buffer.from(row.bytes, "base64");
  return new Response(buf, {
    status: 200,
    headers: {
      "content-type": row.mime,
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
