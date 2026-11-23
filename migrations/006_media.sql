create table if not exists media_files (
  id text primary key,
  tenant_id text not null references tenants(id),
  kind text not null default 'item_photo',
  mime text not null,
  bytes text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_media_tenant on media_files(tenant_id);
