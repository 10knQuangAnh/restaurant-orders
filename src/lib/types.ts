export type Tenant = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  phone: string | null;
  address: string | null;
  hours?: string | null;
  tagline?: string | null;
};

export type TenantSettings = {
  tenant_id: string;
  vat_rate: number;
  vat_included: boolean;
  service_rate: number;
  cash_round_to: number;
  bank_name: string | null;
  bank_account: string | null;
  bank_holder: string | null;
  features: Record<string, boolean>;
  timezone: string;
};

export type Role = "admin" | "waiter" | "kitchen";

export type Staff = {
  id: string;
  tenant_id: string;
  name: string;
  role: Role;
  identity_email: string | null;
  active: boolean;
};

export type DiningTable = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  qr_token: string;
  zone: string | null;
  seats: number;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  category_id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  image_url: string | null;
  sold_out: boolean;
  active?: boolean;
  stock_left?: number | null;
  daily_limit?: number | null;
  tax_category?: string;
  units: ItemUnit[];
};

export type ItemUnit = {
  id: string;
  name: string;
  price_dong: number;
  is_default: boolean;
};

export type Order = {
  id: string;
  tenant_id: string;
  table_id: string;
  status: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_note: string | null;
  vat_rate: number;
  vat_included: boolean;
  service_rate: number;
  discount_dong: number;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  item_id: string;
  unit_id: string;
  name_snapshot: string;
  unit_snapshot: string;
  unit_price_dong: number;
  qty: number;
  note: string | null;
  rush: boolean;
  complementary: boolean;
  kitchen_status: string;
  sent_at: string | null;
  started_at: string | null;
  done_at: string | null;
  created_at: string;
  vat_rate?: number | null;
  original_price_dong?: number | null;
};

export type CartLine = {
  itemId: string;
  unitId: string;
  qty: number;
  note: string;
};
