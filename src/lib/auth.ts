import { cookies } from "next/headers";
import { sql, withTx } from "./db";
import { json } from "./http";
import { nid } from "./ids";
import { STAFF_COOKIE } from "./cookies";
import { hashPin, hashToken, newSessionToken, verifyPin } from "./pin";
import type { Role, Staff } from "./types";

const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;

export type StaffContext = Staff & { tenant_id: string; session_id: string };

function cookieToken(request: Request): string | undefined {
  const raw = request.headers.get("cookie") || "";
  const hit = raw
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${STAFF_COOKIE}=`));
  return hit?.slice(STAFF_COOKIE.length + 1);
}

export async function currentStaff(request?: Request): Promise<StaffContext | null> {
  const token = request ? cookieToken(request) : (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const hashed = hashToken(token);
  const rows = await sql<StaffContext>(
    `select st.id as session_id, s.id, s.tenant_id, s.name, s.role, s.active, s.identity_email
     from staff_sessions st
     join staff s on s.id = st.staff_id
     where st.token = $1 and st.revoked = false and st.expires_at > now()
       and s.active = true`,
    [hashed],
  );
  return rows[0] ?? null;
}

export async function requireStaff(request: Request, roles?: Role[]): Promise<StaffContext | Response> {
  const staff = await currentStaff(request);
  if (!staff) return json({ error: "unauth" }, 401);
  if (roles && !roles.includes(staff.role)) return json({ error: "forbidden" }, 403);
  return staff;
}

export async function loginWithPin(opts: {
  slug: string;
  staffId: string;
  pin: string;
}): Promise<{ staff: StaffContext; token: string } | { error: string; status: number }> {
  const slug = opts.slug.trim().toLowerCase();
  const pin = opts.pin.trim();
  if (!slug || !opts.staffId || !/^\d{4,8}$/.test(pin)) {
    return { error: "bad_login", status: 400 };
  }
  const tenants = await sql<{ id: string }>(`select id from tenants where slug = $1`, [slug]);
  const tenant = tenants[0];
  if (!tenant) return { error: "unknown_tenant", status: 404 };

  return withTx(async (q) => {
    const people = await q<{
      id: string;
      tenant_id: string;
      name: string;
      role: Role;
      pin: string;
      pin_hash: string | null;
      failed_attempts: number;
      locked_until: string | null;
      active: boolean;
    }>(
      `select id, tenant_id, name, role, pin, pin_hash, failed_attempts, locked_until, active
     from staff where id = $1 and tenant_id = $2 for update`,
      [opts.staffId, tenant.id],
    );
    const person = people[0];
    if (!person || !person.active) return { error: "unknown_staff", status: 404 };

    if (person.locked_until && new Date(person.locked_until).getTime() > Date.now()) {
      return { error: "locked", status: 429 };
    }

    let ok = false;
    if (person.pin_hash) ok = verifyPin(pin, person.pin_hash);
    else ok = person.pin === pin;
    if (!ok) {
      const next = Number(person.failed_attempts || 0) + 1;
      const locked = next >= LOCK_AFTER ? new Date(Date.now() + LOCK_MS).toISOString() : null;
      await q(`update staff set failed_attempts = $1, locked_until = $2 where id = $3`, [next, locked, person.id]);
      return { error: "bad_pin", status: 401 };
    }

    if (!person.pin_hash) {
      await q(`update staff set pin_hash = $1 where id = $2`, [hashPin(pin), person.id]);
    }
    await q(`update staff set failed_attempts = 0, locked_until = null where id = $1`, [person.id]);

    const token = newSessionToken();
    const sessionId = nid("ses");
    await q(
      `insert into staff_sessions (id, staff_id, token, expires_at)
     values ($1,$2,$3, now() + interval '12 hours')`,
      [sessionId, person.id, hashToken(token)],
    );
    return {
      token,
      staff: {
        session_id: sessionId,
        id: person.id,
        tenant_id: person.tenant_id,
        name: person.name,
        role: person.role,
        identity_email: null,
        active: true,
      },
    };
  });
}

export async function logoutSession(request: Request): Promise<void> {
  const token = cookieToken(request);
  if (!token) return;
  await sql(`update staff_sessions set revoked = true where token = $1`, [hashToken(token)]);
}
