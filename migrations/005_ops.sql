alter table tenants add column if not exists hours text;
alter table tenants add column if not exists tagline text;

alter table tenant_settings add column if not exists service_charge_taxable boolean not null default false;
alter table tenant_settings add column if not exists day_cut_hour integer not null default 5;

alter table order_items add column if not exists vat_rate numeric;
alter table order_items add column if not exists cancel_reason text;

alter table payments add column if not exists rounding_dong integer not null default 0;
alter table payments add column if not exists idempotency_key text;

create unique index if not exists idx_payments_idem on payments(order_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists idx_one_open_order_per_table on orders(table_id) where status = 'open';

create table if not exists tax_rates (
  id text primary key,
  tenant_id text not null references tenants(id),
  code text not null,
  rate numeric not null,
  effective_from date not null,
  effective_to date
);

create index if not exists idx_tax_rates_lookup on tax_rates(tenant_id, code, effective_from);

create table if not exists audit_log (
  id text primary key,
  tenant_id text not null references tenants(id),
  staff_id text,
  action text not null,
  entity text,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_tenant on audit_log(tenant_id, created_at);
