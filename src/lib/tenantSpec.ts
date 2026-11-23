export type TenantItemSpec = {
  name: string;
  name_en?: string;
  description?: string;
  price_dong: number;
  unit?: string;
  image_url?: string;
  tax_category?: string;
};

export type TenantCategorySpec = {
  name: string;
  items: TenantItemSpec[];
};

export type TenantSpec = {
  tenant: {
    slug: string;
    name: string;
    primary_color?: string;
    accent_color?: string;
    phone?: string;
    address?: string;
    hours?: string;
    tagline?: string;
  };
  admin: { name: string; pin: string };
  staff?: { name: string; role: "admin" | "waiter" | "kitchen"; pin: string }[];
  settings?: {
    vat_rate?: number;
    service_rate?: number;
    cash_round_to?: number;
    bank_name?: string;
    bank_account?: string;
    bank_holder?: string;
  };
  tables: { code: string; name: string; zone?: string; seats?: number }[];
  categories: TenantCategorySpec[];
};

function str(v: unknown, max: number): string {
  return String(v || "").trim().slice(0, max);
}

function pinOf(v: unknown): string {
  return String(v || "").replace(/\D/g, "");
}

export function parseTenantSpec(raw: unknown): TenantSpec {
  if (!raw || typeof raw !== "object") throw new Error("bad_json");
  const o = raw as Record<string, unknown>;
  const tenantIn = (o.tenant && typeof o.tenant === "object" ? o.tenant : o) as Record<string, unknown>;
  const slug = str(tenantIn.slug, 40)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const name = str(tenantIn.name, 80);
  if (slug.length < 3) throw new Error("bad_slug");
  if (!name) throw new Error("need_name");
  const adminIn = (o.admin && typeof o.admin === "object" ? o.admin : {}) as Record<string, unknown>;
  const adminPin = pinOf(adminIn.pin);
  if (!/^\d{4,8}$/.test(adminPin)) throw new Error("bad_pin");
  const tablesRaw = Array.isArray(o.tables) ? o.tables : [];
  const catsRaw = Array.isArray(o.categories) ? o.categories : [];
  if (tablesRaw.length < 1) throw new Error("need_tables");
  if (catsRaw.length < 1) throw new Error("need_categories");
  const staffRaw = Array.isArray(o.staff) ? o.staff : [];
  const settingsIn = (o.settings && typeof o.settings === "object" ? o.settings : {}) as Record<string, unknown>;
  return {
    tenant: {
      slug,
      name,
      primary_color: str(tenantIn.primary_color, 7) || undefined,
      accent_color: str(tenantIn.accent_color, 7) || undefined,
      phone: str(tenantIn.phone, 30) || undefined,
      address: str(tenantIn.address, 160) || undefined,
      hours: str(tenantIn.hours, 80) || undefined,
      tagline: str(tenantIn.tagline, 120) || undefined,
    },
    admin: { name: str(adminIn.name, 80) || "Chủ quán", pin: adminPin },
    staff: staffRaw.map((row) => {
      const s = row as Record<string, unknown>;
      const role = s.role === "kitchen" || s.role === "admin" ? s.role : "waiter";
      const pin = pinOf(s.pin);
      if (!/^\d{4,8}$/.test(pin)) throw new Error("bad_pin");
      return { name: str(s.name, 80) || "Nhân viên", role, pin };
    }),
    settings: {
      vat_rate: settingsIn.vat_rate == null ? undefined : Number(settingsIn.vat_rate),
      service_rate: settingsIn.service_rate == null ? undefined : Number(settingsIn.service_rate),
      cash_round_to: settingsIn.cash_round_to == null ? undefined : Number(settingsIn.cash_round_to),
      bank_name: str(settingsIn.bank_name, 80) || undefined,
      bank_account: str(settingsIn.bank_account, 40) || undefined,
      bank_holder: str(settingsIn.bank_holder, 80) || undefined,
    },
    tables: tablesRaw.map((row) => {
      const t = row as Record<string, unknown>;
      return {
        code: str(t.code, 12) || "T1",
        name: str(t.name, 40) || str(t.code, 12) || "Bàn",
        zone: str(t.zone, 40) || undefined,
        seats: Math.min(20, Math.max(1, Number(t.seats) || 4)),
      };
    }),
    categories: catsRaw.map((row) => {
      const c = row as Record<string, unknown>;
      const items = Array.isArray(c.items) ? c.items : [];
      return {
        name: str(c.name, 80) || "Nhóm",
        items: items.map((it) => {
          const i = it as Record<string, unknown>;
          return {
            name: str(i.name, 120) || "Món",
            name_en: str(i.name_en, 120) || undefined,
            description: str(i.description, 240) || undefined,
            price_dong: Math.max(0, Math.floor(Number(i.price_dong) || 0)),
            unit: str(i.unit, 20) || "Phần",
            image_url: str(i.image_url, 180) || undefined,
            tax_category: str(i.tax_category, 20) || "food",
          };
        }),
      };
    }),
  };
}
