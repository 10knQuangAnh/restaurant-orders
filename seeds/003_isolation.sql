-- Isolation fixture: second tenant shares PIN 2580 with Quán Tự Do.
insert into tenants (id, slug, name, primary_color, accent_color, phone, address)
values (
  'sb',
  'quan-sao-bien',
  'Quán Sao Biển',
  '#0B6E99',
  '#E7F6FB',
  '028 0000 0000',
  'Demo cô lập tenant'
) on conflict (id) do nothing;

insert into tenant_settings (tenant_id, vat_rate, vat_included, service_rate, cash_round_to, features)
values (
  'sb', 0.08, true, 0.05, 0,
  '{"guest_order":true,"call_staff":true,"kitchen":true,"vat":true,"service_charge":true,"split_bill":true,"transfer_table":true,"complementary":true}'::jsonb
) on conflict (tenant_id) do nothing;

insert into staff (id, tenant_id, name, pin, role, active) values
  ('sb-lan', 'sb', 'Admin Sao Biển', '2580', 'admin', true)
on conflict (id) do nothing;

insert into dining_tables (id, tenant_id, code, name, qr_token, zone, seats, sort_order) values
  ('sb-t1', 'sb', 'S1', 'Bàn 1', 'sb-t1-a7f3c91e2b44d0', 'Trong nhà', 4, 1)
on conflict (id) do nothing;

insert into categories (id, tenant_id, name, sort_order) values
  ('sb-cat', 'sb', 'Món', 1)
on conflict (id) do nothing;

insert into items (id, tenant_id, category_id, name, sold_out, sort_order, tax_category) values
  ('sb-i1', 'sb', 'sb-cat', 'Cơm chiên', false, 1, 'food')
on conflict (id) do nothing;

insert into item_units (id, item_id, name, price_dong, is_default) values
  ('sb-u1', 'sb-i1', 'Phần', 45000, true)
on conflict (id) do nothing;

insert into tax_rates (id, tenant_id, code, rate, effective_from, effective_to) values
  ('td-tax-food-8', 'td', 'food', 0.08, '2025-07-01', '2026-12-31'),
  ('td-tax-food-10', 'td', 'food', 0.10, '2027-01-01', null),
  ('td-tax-alc', 'td', 'alcohol', 0.10, '2025-01-01', null),
  ('sb-tax-food-8', 'sb', 'food', 0.08, '2025-07-01', '2026-12-31'),
  ('sb-tax-food-10', 'sb', 'food', 0.10, '2027-01-01', null),
  ('sb-tax-alc', 'sb', 'alcohol', 0.10, '2025-01-01', null)
on conflict (id) do nothing;

update items set tax_category = 'alcohol'
where tenant_id = 'td' and category_id in ('td-cat-bia', 'td-cat-que');

update tenant_settings set cash_round_to = 0 where tenant_id = 'td';
