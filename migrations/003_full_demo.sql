alter table tenants add column if not exists hours text;
alter table tenants add column if not exists tagline text;

update tenants set
  hours = '10:00–22:00 mỗi ngày',
  tagline = 'Cơm nhà · bánh xèo · bia hơi · rượu quê',
  phone = '028 3833 2299',
  address = '48 Nguyễn Thiện Thuật, Phường Võ Thị Sáu, Quận 3, TP.HCM'
where id = 'td';

update item_units set price_dong = 129000 where id = 'td-u-ccd';
update item_units set price_dong = 159000 where id = 'td-u-ccg';
update item_units set price_dong = 99000 where id = 'td-u-cct';
update item_units set price_dong = 149000 where id = 'td-u-csn';
update item_units set price_dong = 139000 where id = 'td-u-cga';
update item_units set price_dong = 139000 where id = 'td-u-pho';
update item_units set price_dong = 119000 where id = 'td-u-pho-nho';
update item_units set price_dong = 129000 where id = 'td-u-bunca';
update item_units set price_dong = 129000 where id = 'td-u-bbh';
update item_units set price_dong = 129000 where id = 'td-u-goi';
update item_units set price_dong = 119000 where id = 'td-u-nem';
update item_units set price_dong = 99000 where id = 'td-u-dauhu';
update item_units set price_dong = 55000 where id = 'td-u-biasg';
update item_units set price_dong = 35000 where id = 'td-u-coca';
update item_units set price_dong = 20000 where id = 'td-u-aqua';
update item_units set price_dong = 45000 where id = 'td-u-mia';

insert into staff (id, tenant_id, name, pin, role, active) values
  ('td-mai', 'td', 'Phạm Thị Mai', '3355', 'waiter', true),
  ('td-tam', 'td', 'Ngô Văn Tâm', '5577', 'admin', true)
on conflict (id) do nothing;

insert into dining_tables (id, tenant_id, code, name, qr_token, zone, seats, sort_order) values
  ('td-t3', 'td', 'T3', 'SÂN VƯỜN', 't3-san-vuon', 'Sân vườn', 4, 3),
  ('td-t4', 'td', 'T4', 'SÂN VƯỜN', 't4-san-vuon', 'Sân vườn', 6, 4),
  ('td-t6', 'td', 'T6', 'LẦU 1', 't6-lau-1', 'Lầu 1', 4, 6),
  ('td-t7', 'td', 'T7', 'LẦU 1', 't7-lau-1', 'Lầu 1', 4, 7),
  ('td-t8', 'td', 'T8', 'LẦU 1', 't8-lau-1', 'Lầu 1', 8, 8),
  ('td-vip2', 'td', 'VIP2', 'PHÒNG LẠNH', 'vip2-phong-lanh', 'VIP', 10, 21)
on conflict (id) do nothing;

insert into categories (id, tenant_id, name, sort_order) values
  ('td-cat-xeo', 'td', 'Bánh xèo', 0),
  ('td-cat-goi', 'td', 'Gỏi', 2),
  ('td-cat-thit', 'td', 'Heo · Bò · Cá', 3),
  ('td-cat-rau', 'td', 'Rau & Canh', 4)
on conflict (id) do nothing;

update categories set sort_order = 1 where id = 'td-cat-anno';
update categories set sort_order = 2 where id = 'td-cat-khaivi';
update categories set sort_order = 3 where id = 'td-cat-goi';
update categories set sort_order = 4 where id = 'td-cat-thit';
update categories set sort_order = 5 where id = 'td-cat-rau';
update categories set sort_order = 6 where id = 'td-cat-bia';
update categories set sort_order = 7 where id = 'td-cat-que';
update categories set sort_order = 8 where id = 'td-cat-ech';
update categories set sort_order = 9 where id = 'td-cat-lau';

insert into items (id, tenant_id, category_id, name, name_en, description, image_url, sold_out, sort_order) values
  ('td-i-xeohs', 'td', 'td-cat-xeo', 'Bánh xèo hải sản', 'Seafood sizzling pancake', 'Tôm, mực, giá, bột gạo vàng, rau sống.', '/dishes/com-chien-ghe.svg', false, 1),
  ('td-i-xeott', 'td', 'td-cat-xeo', 'Bánh xèo tôm thịt', 'Prawn & pork sizzling pancake', 'Tôm đất, thịt ba rọi, giá đỗ.', '/dishes/com-suon.svg', false, 2),
  ('td-i-xeonam', 'td', 'td-cat-xeo', 'Bánh xèo nấm', 'Mushroom sizzling pancake', 'Nấm đùi gà, nấm rơm, không tôm.', '/dishes/dau-hu.svg', false, 3),
  ('td-i-goicuon', 'td', 'td-cat-goi', 'Gỏi cuốn tôm thịt', 'Fresh spring rolls', 'Bánh tráng, bún, tôm, thịt, húng lủi. 2 cuốn.', '/dishes/goi-bo.svg', false, 1),
  ('td-i-chagio', 'td', 'td-cat-goi', 'Chả giò thịt', 'Fried spring rolls', 'Ram giòn, nước mắm chua ngọt.', '/dishes/nem-nuong.svg', false, 2),
  ('td-i-goixoai', 'td', 'td-cat-goi', 'Gỏi xoài khô cá dứa', 'Green mango salad', 'Xoài sống, khô cá dứa, tỏi ớt, rau răm.', '/dishes/goi-bo.svg', false, 3),
  ('td-i-goisen', 'td', 'td-cat-goi', 'Gỏi ngó sen tôm thịt', 'Lotus stem salad', 'Ngó sen giòn, tôm, thịt, đậu phộng.', '/dishes/goi-bo.svg', false, 4),
  ('td-i-bolac', 'td', 'td-cat-thit', 'Bò lúc lắc khoai tây', 'Shaking beef', 'Thăn bò, khoai tây chiên, sốt tiêu.', '/dishes/com-suon.svg', false, 1),
  ('td-i-suonngot', 'td', 'td-cat-thit', 'Sườn xào chua ngọt', 'Sweet & sour spare ribs', 'Sườn cốt lết, ớt chuông, thơm.', '/dishes/com-suon.svg', false, 2),
  ('td-i-thitkho', 'td', 'td-cat-thit', 'Thịt kho trứng', 'Caramel pork & egg', 'Ba rọi kho nước dừa, trứng gà.', '/dishes/com-ga.svg', false, 3),
  ('td-i-cahukho', 'td', 'td-cat-thit', 'Cá hú kho tộ', 'Claypot catfish', 'Cá hú đồng, nước màu, ớt hiểm.', '/dishes/pho-bo.svg', false, 4),
  ('td-i-tomtoi', 'td', 'td-cat-thit', 'Tôm sú cháy tỏi', 'Garlic grilled tiger prawns', 'Tôm sú, tỏi phi, muối ớt.', '/dishes/lau-thai.svg', false, 5),
  ('td-i-mucmam', 'td', 'td-cat-thit', 'Mực chiên nước mắm', 'Fish-sauce fried squid', 'Mực ống, sả, ớt.', '/dishes/lau-ech.svg', false, 6),
  ('td-i-raumuong', 'td', 'td-cat-rau', 'Rau muống xào tỏi', 'Morning glory with garlic', 'Xào lửa lớn, tỏi phi.', '/dishes/goi-bo.svg', false, 1),
  ('td-i-canhchua', 'td', 'td-cat-rau', 'Canh chua tôm', 'Sweet & sour prawn soup', 'Thơm, bạc hà, giá, me, tôm sú.', '/dishes/pho-bo.svg', false, 2),
  ('td-i-canhcua', 'td', 'td-cat-rau', 'Canh cua rau đay', 'Crab soup with jute', 'Cua đồng giã, mướp, rau đay.', '/dishes/lau-ga.svg', false, 3),
  ('td-i-comtrang', 'td', 'td-cat-anno', 'Cơm trắng', 'Steamed rice', 'Tô nhỏ.', '/dishes/com-chien-trung.svg', false, 20),
  ('td-i-tiger', 'td', 'td-cat-bia', 'Tiger Beer', 'Tiger', 'Chai 330ml.', '/dishes/bia-saigon.svg', false, 9),
  ('td-i-heineken', 'td', 'td-cat-bia', 'Heineken', 'Heineken', 'Chai 330ml.', '/dishes/bia-saigon.svg', false, 10),
  ('td-i-dua', 'td', 'td-cat-bia', 'Dừa tươi', 'Fresh coconut', 'Dừa xiêm, ống hút.', '/dishes/nuoc-mia.svg', false, 11),
  ('td-i-cam', 'td', 'td-cat-bia', 'Nước ép cam tươi', 'Fresh orange juice', 'Cam sành, đá.', '/dishes/tra-dao.svg', false, 12),
  ('td-i-cafe', 'td', 'td-cat-bia', 'Cà phê sữa đá', 'Iced milk coffee', 'Phin, sữa đặc.', '/dishes/nep-cam.svg', false, 13)
on conflict (id) do nothing;

insert into item_units (id, item_id, name, price_dong, is_default, sort_order) values
  ('td-u-xeohs', 'td-i-xeohs', 'Cái', 179000, true, 1),
  ('td-u-xeott', 'td-i-xeott', 'Cái', 169000, true, 1),
  ('td-u-xeonam', 'td-i-xeonam', 'Cái', 149000, true, 1),
  ('td-u-goicuon', 'td-i-goicuon', 'Phần', 89000, true, 1),
  ('td-u-chagio', 'td-i-chagio', 'Phần', 129000, true, 1),
  ('td-u-goixoai', 'td-i-goixoai', 'Dĩa', 129000, true, 1),
  ('td-u-goisen', 'td-i-goisen', 'Dĩa', 169000, true, 1),
  ('td-u-bolac', 'td-i-bolac', 'Phần', 149000, true, 1),
  ('td-u-suonngot', 'td-i-suonngot', 'Phần', 149000, true, 1),
  ('td-u-thitkho', 'td-i-thitkho', 'Phần', 139000, true, 1),
  ('td-u-cahukho', 'td-i-cahukho', 'Phần', 129000, true, 1),
  ('td-u-tomtoi', 'td-i-tomtoi', 'Phần', 149000, true, 1),
  ('td-u-mucmam', 'td-i-mucmam', 'Phần', 159000, true, 1),
  ('td-u-raumuong', 'td-i-raumuong', 'Dĩa', 89000, true, 1),
  ('td-u-canhchua', 'td-i-canhchua', 'Tô', 129000, true, 1),
  ('td-u-canhcua', 'td-i-canhcua', 'Tô', 129000, true, 1),
  ('td-u-comtrang', 'td-i-comtrang', 'Tô', 15000, true, 1),
  ('td-u-tiger', 'td-i-tiger', 'Chai', 55000, true, 1),
  ('td-u-heineken', 'td-i-heineken', 'Chai', 45000, true, 1),
  ('td-u-dua', 'td-i-dua', 'Trái', 40000, true, 1),
  ('td-u-cam', 'td-i-cam', 'Ly', 45000, true, 1),
  ('td-u-cafe', 'td-i-cafe', 'Ly', 45000, true, 1)
on conflict (id) do nothing;

insert into orders (id, tenant_id, table_id, status, guest_name, vat_rate, vat_included, service_rate, created_at, closed_at)
values
  ('td-o-paid-t2', 'td', 'td-t2', 'paid', 'Chị Hạnh', 0.08, true, 0.05, now() - interval '3 hours', now() - interval '90 minutes'),
  ('td-o-paid-t4', 'td', 'td-t4', 'paid', 'Anh Dũng', 0.08, true, 0.05, now() - interval '5 hours', now() - interval '4 hours'),
  ('td-o-paid-q1', 'td', 'td-quay', 'paid', 'Take-in', 0.08, true, 0.05, now() - interval '80 minutes', now() - interval '70 minutes'),
  ('td-o-t3', 'td', 'td-t3', 'open', 'Bạn Linh', 0.08, true, 0.05, now() - interval '11 minutes', null)
on conflict (id) do nothing;

insert into order_items (id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, qty, note, complementary, kitchen_status, sent_at, started_at, done_at, created_at) values
  ('td-oi-p1', 'td-o-paid-t2', 'td-i-xeohs', 'td-u-xeohs', 'Bánh xèo hải sản', 'Cái', 179000, 2, null, false, 'done', now() - interval '3 hours', now() - interval '170 minutes', now() - interval '155 minutes', now() - interval '3 hours'),
  ('td-oi-p2', 'td-o-paid-t2', 'td-i-canhchua', 'td-u-canhchua', 'Canh chua tôm', 'Tô', 129000, 1, 'Ít me', false, 'done', now() - interval '3 hours', now() - interval '165 minutes', now() - interval '150 minutes', now() - interval '3 hours'),
  ('td-oi-p3', 'td-o-paid-t2', 'td-i-tiger', 'td-u-tiger', 'Tiger Beer', 'Chai', 55000, 4, null, false, 'done', now() - interval '3 hours', now() - interval '175 minutes', now() - interval '174 minutes', now() - interval '3 hours'),
  ('td-oi-p4', 'td-o-paid-t4', 'td-i-lautt', 'td-u-lautt', 'Lẩu thái hải sản', 'Nồi', 289000, 1, 'Cay vừa', false, 'done', now() - interval '5 hours', now() - interval '280 minutes', now() - interval '260 minutes', now() - interval '5 hours'),
  ('td-oi-p5', 'td-o-paid-t4', 'td-i-heineken', 'td-u-heineken', 'Heineken', 'Chai', 45000, 6, null, false, 'done', now() - interval '5 hours', now() - interval '5 hours', now() - interval '5 hours', now() - interval '5 hours'),
  ('td-oi-p6', 'td-o-paid-q1', 'td-i-cafe', 'td-u-cafe', 'Cà phê sữa đá', 'Ly', 45000, 2, null, false, 'done', now() - interval '80 minutes', now() - interval '78 minutes', now() - interval '75 minutes', now() - interval '80 minutes'),
  ('td-oi-p7', 'td-o-t3', 'td-i-goicuon', 'td-u-goicuon', 'Gỏi cuốn tôm thịt', 'Phần', 89000, 2, null, false, 'queued', now() - interval '10 minutes', null, null, now() - interval '10 minutes'),
  ('td-oi-p8', 'td-o-t3', 'td-i-bolac', 'td-u-bolac', 'Bò lúc lắc khoai tây', 'Phần', 149000, 1, 'Chín vừa', false, 'preparing', now() - interval '10 minutes', now() - interval '6 minutes', null, now() - interval '10 minutes')
on conflict (id) do nothing;

insert into payments (id, order_id, method, amount_dong, received_dong, staff_id, created_at) values
  ('td-pay-1', 'td-o-paid-t2', 'cash', 837000, 900000, 'td-hoa', now() - interval '90 minutes'),
  ('td-pay-2', 'td-o-paid-t4', 'transfer', 587000, 587000, 'td-minh', now() - interval '4 hours'),
  ('td-pay-3', 'td-o-paid-q1', 'cash', 95000, 100000, 'td-mai', now() - interval '70 minutes')
on conflict (id) do nothing;
