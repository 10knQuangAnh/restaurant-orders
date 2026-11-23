alter table staff add column if not exists pin_hash text;
alter table staff add column if not exists failed_attempts integer not null default 0;
alter table staff add column if not exists locked_until timestamptz;
alter table staff_sessions add column if not exists revoked boolean not null default false;
alter table items add column if not exists daily_limit integer;
alter table items add column if not exists stock_left integer;
alter table items add column if not exists tax_category text not null default 'food';
alter table order_items add column if not exists original_price_dong integer;
alter table orders add column if not exists bill_snapshot jsonb;
alter table orders add column if not exists merged_into text;

create table if not exists notifications (
  id text primary key,
  tenant_id text not null references tenants(id),
  kind text not null,
  table_id text,
  order_id text,
  item_id text,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_notifications_tenant on notifications(tenant_id, created_at);
create unique index if not exists idx_staff_tenant_pin on staff(tenant_id, pin) where active = true;
