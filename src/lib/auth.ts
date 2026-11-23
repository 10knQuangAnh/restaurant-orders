import { getIdentity } from "../../cursor/identity";
import { clearSessionCookie, readCookie, sessionCookie } from "./cookies";
import { sql } from "./db";
import { nid } from "./ids";
import type { Staff } from "./types";

type StaffRow = Staff & { pin?: string };

export async function staffById(id: string): Promise<Staff | null> {
  const rows = await sql<Staff>(
    `select id, tenant_id, name, role, identity_email, active from staff where id = $1 and active = true`,
    [id],
  );
  return rows[0] ?? null;
}

export async function loginWithPin(pin: string): Promise<{ staff: Staff; token: string } | null> {
  const cleaned = pin.replace(/\D/g, "").slice(0, 8);
  if (cleaned.length < 4) return null;
  const rows = await sql<StaffRow>(
    `select id, tenant_id, name, role, identity_email, active from staff where pin = $1 and active = true limit 1`,
    [cleaned],
  );
  const staff = rows[0];
  if (!staff) return null;
  const token = nid("ses");
  await sql(
    `insert into staff_sessions (id, staff_id, token, expires_at) values ($1, $2, $3, now() + interval '12 hours')`,
    [nid("sid"), staff.id, token],
  );
  return { staff, token };
}

export async function sessionFromRequest(request: Request): Promise<Staff | null> {
  const token = readCookie(request.headers.get("cookie"), "staff_session");
  if (token) {
    const rows = await sql<Staff>(
      `select s.id, s.tenant_id, s.name, s.role, s.identity_email, s.active
       from staff_sessions ss
       join staff s on s.id = ss.staff_id
       where ss.token = $1 and ss.expires_at > now() and s.active = true
       limit 1`,
      [token],
    );
    if (rows[0]) return rows[0];
  }

  const identity = await getIdentity(request);
  if (!identity.verified || identity.kind !== "person") return null;
  const email = identity.email?.trim().toLowerCase();
  if (!email) return null;
  const mapped = await sql<Staff>(
    `select id, tenant_id, name, role, identity_email, active
     from staff where lower(identity_email) = $1 and active = true limit 1`,
    [email],
  );
  return mapped[0] ?? null;
}

export async function requireStaff(
  request: Request,
  roles?: Staff["role"][],
): Promise<Staff | Response> {
  const staff = await sessionFromRequest(request);
  if (!staff) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "private, no-store" } },
    );
  }
  if (roles && !roles.includes(staff.role)) {
    return Response.json(
      { error: "forbidden", role: staff.role },
      { status: 403, headers: { "cache-control": "private, no-store" } },
    );
  }
  return staff;
}

export function withSessionHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = { "cache-control": "private, no-store" };
  if (token) headers["set-cookie"] = sessionCookie(token);
  return headers;
}

export function logoutHeaders(): HeadersInit {
  return { "cache-control": "private, no-store", "set-cookie": clearSessionCookie() };
}
