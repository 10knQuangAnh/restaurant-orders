create table if not exists tenants (
  id text primary key,
  slug text unique not null,
  name text not null,
  logo_url text,
  primary_color text not null default '#E85D04',
  accent_color text not null default '#FFF1E6',
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists tenant_settings (
  tenant_id text primary key references tenants(id),
  vat_rate numeric not null default 0.08,
  vat_included boolean not null default true,
  service_rate numeric not null default 0.05,
  cash_round_to integer not null default 1000,
  bank_name text,
  bank_account text,
  bank_holder text,
  features jsonb not null default '{}'::jsonb,
  timezone text not null default 'Asia/Ho_Chi_Minh'
);

create table if not exists staff (
  id text primary key,
  tenant_id text not null references tenants(id),
  name text not null,
  pin text not null,
  role text not null check (role in ('admin', 'waiter', 'kitchen')),
  identity_email text,
  identity_sub text,
  active boolean not null default true
);

create table if not exists dining_tables (
  id text primary key,
  tenant_id text not null references tenants(id),
  code text not null,
  name text not null,
  qr_token text unique not null,
  zone text,
  seats integer not null default 4,
  sort_order integer not null default 0
);

create table if not exists categories (
  id text primary key,
  tenant_id text not null references tenants(id),
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists items (
  id text primary key,
  tenant_id text not null references tenants(id),
  category_id text not null references categories(id),
  name text not null,
  name_en text,
  description text,
  image_url text,
  sold_out boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists item_units (
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  name text not null,
  price_dong integer not null,
  is_default boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists orders (
  id text primary key,
  tenant_id text not null references tenants(id),
  table_id text not null references dining_tables(id),
  status text not null default 'open',
  guest_name text,
  guest_phone text,
  guest_note text,
  vat_rate numeric not null default 0,
  vat_included boolean not null default true,
  service_rate numeric not null default 0,
  discount_dong integer not null default 0,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists order_items (
  id text primary key,
  order_id text not null references orders(id) on delete cascade,
  item_id text not null,
  unit_id text not null,
  name_snapshot text not null,
  unit_snapshot text not null,
  unit_price_dong integer not null,
  qty integer not null,
  note text,
  rush boolean not null default false,
  complementary boolean not null default false,
  kitchen_status text not null default 'queued',
  sent_at timestamptz,
  started_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  order_id text not null references orders(id),
  method text not null,
  amount_dong integer not null,
  received_dong integer,
  note text,
  created_at timestamptz not null default now(),
  staff_id text
);

create table if not exists staff_calls (
  id text primary key,
  tenant_id text not null references tenants(id),
  table_id text not null references dining_tables(id),
  reason text not null default 'staff',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  ack_at timestamptz
);

create table if not exists staff_sessions (
  id text primary key,
  staff_id text not null references staff(id),
  token text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_tables_tenant on dining_tables(tenant_id);
create index if not exists idx_items_cat on items(category_id);
create index if not exists idx_orders_table on orders(table_id, status);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_order_items_kitchen on order_items(kitchen_status);
create index if not exists idx_calls_open on staff_calls(tenant_id, status);
create index if not exists idx_staff_pin on staff(pin);
create index if not exists idx_staff_email on staff(identity_email);
