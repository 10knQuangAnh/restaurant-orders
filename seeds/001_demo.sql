insert into tenants (id, slug, name, logo_url, primary_color, accent_color, phone, address)
values (
  'td',
  'quan-tu-do',
  'Quán Tự Do',
  '/logo-tu-do.svg',
  '#E85D04',
  '#FFF1E6',
  '028 3833 2299',
  '48 Nguyễn Thiện Thuật, Phường 2, Quận 3, TP.HCM'
) on conflict (id) do nothing;

insert into tenant_settings (
  tenant_id, vat_rate, vat_included, service_rate, cash_round_to,
  bank_name, bank_account, bank_holder, features
) values (
  'td', 0.08, true, 0.05, 0,
  'Vietcombank', '0071000888888', 'QUAN TU DO',
  '{"guest_order":true,"call_staff":true,"kitchen":true,"vat":true,"service_charge":true,"split_bill":true,"transfer_table":true,"complementary":true,"takeaway":false}'::jsonb
) on conflict (tenant_id) do nothing;

insert into staff (id, tenant_id, name, pin, role, active) values
  ('td-lan', 'td', 'Nguyễn Thị Lan', '2580', 'admin', true),
  ('td-minh', 'td', 'Trần Văn Minh', '1397', 'waiter', true),
  ('td-hoa', 'td', 'Lê Thị Hoa', '2468', 'waiter', true),
  ('td-hung', 'td', 'Phạm Hùng', '4466', 'kitchen', true),
  ('td-duc', 'td', 'Võ Văn Đức', '7788', 'kitchen', true)
on conflict (id) do nothing;

insert into dining_tables (id, tenant_id, code, name, qr_token, zone, seats, sort_order) values
  ('td-t1', 'td', 'T1', 'SÂN VƯỜN', 't1-san-vuon', 'Sân vườn', 4, 1),
  ('td-t2', 'td', 'T2', 'SÂN VƯỜN', 't2-san-vuon', 'Sân vườn', 4, 2),
  ('td-t5', 'td', 'T5', 'LẦU 1', 't5-lau-1', 'Lầu 1', 6, 5),
  ('td-t9', 'td', 'T9', 'TỰ DO', 't9-tu-do', 'Tự do', 4, 9),
  ('td-t10', 'td', 'T10', 'TỰ DO', 't10-tu-do', 'Tự do', 4, 10),
  ('td-vip1', 'td', 'VIP1', 'PHÒNG LẠNH', 'vip1-phong-lanh', 'VIP', 8, 20),
  ('td-quay', 'td', 'Q1', 'QUẦY', 'q1-quay', 'Quầy', 2, 30)
on conflict (id) do nothing;

insert into categories (id, tenant_id, name, sort_order) values
  ('td-cat-anno', 'td', 'Ăn No', 1),
  ('td-cat-khaivi', 'td', 'Khai vị', 2),
  ('td-cat-bia', 'td', 'Bia & Nước', 3),
  ('td-cat-que', 'td', 'Đồng Quê', 4),
  ('td-cat-ech', 'td', 'Ếch', 5),
  ('td-cat-lau', 'td', 'Lẩu', 6)
on conflict (id) do nothing;

insert into items (id, tenant_id, category_id, name, name_en, description, image_url, sold_out, sort_order) values
  ('td-i-ccd', 'td', 'td-cat-anno', 'Cơm Chiên Dưa Bò', 'Fried rice with beef & pickles', 'Cơm chiên lửa lớn, dưa muối, bò xào mềm.', '/dishes/com-chien-dua-bo.svg', false, 1),
  ('td-i-ccg', 'td', 'td-cat-anno', 'Cơm chiên ghẹ', 'Crab fried rice', 'Ghẹ tươi xé, cơm chiên trứng, hành lá.', '/dishes/com-chien-ghe.svg', false, 2),
  ('td-i-cct', 'td', 'td-cat-anno', 'Cơm chiên Trứng', 'Fried rice with omelet', 'Cơm chiên trứng ốp, hành, nước tương.', '/dishes/com-chien-trung.svg', false, 3),
  ('td-i-csn', 'td', 'td-cat-anno', 'Cơm sườn nướng', 'Grilled pork chop rice', 'Sườn cốt lết nướng mật ong, dưa chua, mỡ hành.', '/dishes/com-suon.svg', false, 4),
  ('td-i-cga', 'td', 'td-cat-anno', 'Cơm gà Hội An', 'Hoi An chicken rice', 'Gà ta xé, cơm nghệ, nước mắm gừng.', '/dishes/com-ga.svg', false, 5),
  ('td-i-pho', 'td', 'td-cat-anno', 'Phở bò tái nạm', 'Beef pho', 'Nước dùng ninh xương 12 giờ, tái nạm, hành, ngò.', '/dishes/pho-bo.svg', false, 6),
  ('td-i-bunca', 'td', 'td-cat-anno', 'Bún chả Hà Nội', 'Hanoi bun cha', 'Chả viên, chả miếng, bún, rau sống, nước mắm chua ngọt.', '/dishes/bun-cha.svg', false, 7),
  ('td-i-bbh', 'td', 'td-cat-anno', 'Bún bò Huế', 'Hue beef noodle', 'Bún sợi to, giò, nạm, huyết, sả ớt.', '/dishes/bun-bo-hue.svg', false, 8),
  ('td-i-goi', 'td', 'td-cat-khaivi', 'Gỏi bò bóp thấu', 'Rare beef salad', 'Bò tái chanh, rau răm, hành tây, đậu phộng.', '/dishes/goi-bo.svg', false, 1),
  ('td-i-nem', 'td', 'td-cat-khaivi', 'Nem nướng Nha Trang', 'Nha Trang grilled pork sausage', 'Nem than hoa, bánh tráng, đồ chua, tương ớt.', '/dishes/nem-nuong.svg', false, 2),
  ('td-i-dauhu', 'td', 'td-cat-khaivi', 'Đậu hũ chiên sả', 'Lemongrass fried tofu', 'Đậu hũ vàng, sả băm, ớt hiểm.', '/dishes/dau-hu.svg', false, 3),
  ('td-i-ckxoai', 'td', 'td-cat-bia', 'Cocktail xoài muối ớt (300ml)', 'Mango chili salt cocktail', 'Xoài cát, muối ớt, soda, đá xay.', '/dishes/cocktail-xoai.svg', false, 1),
  ('td-i-ximuoi', 'td', 'td-cat-bia', 'Cốc tai xí muội quế (300ml)', 'Preserved plum cinnamon cocktail', 'Xí muội, quế, chanh, soda.', '/dishes/cocktail-xi-muoi.svg', false, 2),
  ('td-i-biahoi', 'td', 'td-cat-bia', 'Bia hơi Hà Nội', 'Hanoi draught beer', 'Rót tại quầy, ly 330ml.', '/dishes/bia-hoi.svg', false, 3),
  ('td-i-biasg', 'td', 'td-cat-bia', 'Bia Sài Gòn Special', 'Saigon Special', 'Chai 330ml, ướp lạnh.', '/dishes/bia-saigon.svg', false, 4),
  ('td-i-coca', 'td', 'td-cat-bia', 'Coca-Cola', null, 'Lon 330ml.', '/dishes/coca.svg', false, 5),
  ('td-i-aqua', 'td', 'td-cat-bia', 'suối (Aquafina Bottle Water)', 'Aquafina', 'Chai 500ml.', '/dishes/aquafina.svg', false, 6),
  ('td-i-mia', 'td', 'td-cat-bia', 'Nước mía', 'Sugarcane juice', 'Ép tại chỗ, tắc, đá.', '/dishes/nuoc-mia.svg', false, 7),
  ('td-i-tradao', 'td', 'td-cat-bia', 'Trà đào cam sả', 'Peach orange lemongrass tea', 'Đào ngâm, cam, sả tươi.', '/dishes/tra-dao.svg', false, 8),
  ('td-i-taomeo', 'td', 'td-cat-que', 'Táo mèo. Apple Wine (Tao Meo) 300ml', 'Tao Meo apple wine', 'Rượu táo mèo Tây Bắc, chai 300ml.', '/dishes/tao-meo.svg', false, 1),
  ('td-i-tule', 'td', 'td-cat-que', 'Nếp tú lệ. Tu Le Sticky Rice Wine (300ml)', 'Tu Le sticky rice wine', 'Nếp Tú Lệ, Yên Bái, uống lạnh.', '/dishes/nep-tu-le.svg', false, 2),
  ('td-i-nepcam', 'td', 'td-cat-que', 'nếp cẩm. Black Glutinous Rice Wine 300ml', 'Black glutinous rice wine', 'Rượu nếp cẩm, vị ngọt dịu.', '/dishes/nep-cam.svg', false, 3),
  ('td-i-hoavang', 'td', 'td-cat-que', 'nếp cái hoa vàng. Yellow Flower Rice Wine 300ml', 'Yellow flower sticky rice wine', 'Nếp cái hoa vàng, Bắc Ninh.', '/dishes/nep-hoa-vang.svg', false, 4),
  ('td-i-nepthan', 'td', 'td-cat-que', 'Rượu nếp than 300ml', 'Black sticky rice wine', 'Nếp than rang, hậu vị khói nhẹ.', '/dishes/nep-than.svg', false, 5),
  ('td-i-echxao', 'td', 'td-cat-ech', 'Ếch xào sả ớt', 'Frog stir-fried lemongrass chili', 'Ếch đồng, sả, ớt hiểm, rau răm.', '/dishes/ech-xao.svg', false, 1),
  ('td-i-echom', 'td', 'td-cat-ech', 'Ếch om chuối đậu', 'Frog with banana blossom & tofu', 'Ếch om, chuối xanh, đậu hũ, nước dừa.', '/dishes/ech-om.svg', false, 2),
  ('td-i-lauech', 'td', 'td-cat-ech', 'Lẩu ếch măng chua', 'Sour bamboo frog hotpot', 'Nồi 2–3 người, măng chua, rau.', '/dishes/lau-ech.svg', false, 3),
  ('td-i-lautt', 'td', 'td-cat-lau', 'Lẩu thái hải sản', 'Tom yum seafood hotpot', 'Tôm, mực, nghêu, nấm, rau.', '/dishes/lau-thai.svg', false, 1),
  ('td-i-lauga', 'td', 'td-cat-lau', 'Lẩu gà lá é', 'Chicken hotpot with Vietnamese basil', 'Gà ta, lá é, nấm, bắp.', '/dishes/lau-ga.svg', false, 2)
on conflict (id) do nothing;

insert into item_units (id, item_id, name, price_dong, is_default, sort_order) values
  ('td-u-ccd', 'td-i-ccd', 'Phần', 106920, true, 1),
  ('td-u-ccg', 'td-i-ccg', 'Phần', 106920, true, 1),
  ('td-u-cct', 'td-i-cct', 'Phần', 89000, true, 1),
  ('td-u-csn', 'td-i-csn', 'Phần', 95000, true, 1),
  ('td-u-cga', 'td-i-cga', 'Phần', 89000, true, 1),
  ('td-u-pho', 'td-i-pho', 'Tô', 79000, true, 1),
  ('td-u-pho-nho', 'td-i-pho', 'Tô nhỏ', 59000, false, 2),
  ('td-u-bunca', 'td-i-bunca', 'Phần', 85000, true, 1),
  ('td-u-bbh', 'td-i-bbh', 'Tô', 79000, true, 1),
  ('td-u-goi', 'td-i-goi', 'Dĩa', 98000, true, 1),
  ('td-u-nem', 'td-i-nem', 'Phần', 75000, true, 1),
  ('td-u-dauhu', 'td-i-dauhu', 'Dĩa', 45000, true, 1),
  ('td-u-ckxoai', 'td-i-ckxoai', 'Ly', 97900, true, 1),
  ('td-u-ximuoi', 'td-i-ximuoi', 'Ly', 97900, true, 1),
  ('td-u-biahoi', 'td-i-biahoi', 'Ly', 25000, true, 1),
  ('td-u-biahoi-binh', 'td-i-biahoi', 'Bình 2L', 140000, false, 2),
  ('td-u-biasg', 'td-i-biasg', 'Chai', 35000, true, 1),
  ('td-u-coca', 'td-i-coca', 'Lon', 22000, true, 1),
  ('td-u-aqua', 'td-i-aqua', 'Chai', 10800, true, 1),
  ('td-u-mia', 'td-i-mia', 'Ly', 25000, true, 1),
  ('td-u-tradao', 'td-i-tradao', 'Ly', 45000, true, 1),
  ('td-u-taomeo', 'td-i-taomeo', 'Bình', 75900, true, 1),
  ('td-u-tule', 'td-i-tule', 'Bình', 75900, true, 1),
  ('td-u-nepcam', 'td-i-nepcam', 'Bình', 75900, true, 1),
  ('td-u-hoavang', 'td-i-hoavang', 'Bình', 75900, true, 1),
  ('td-u-nepthan', 'td-i-nepthan', 'Bình', 69000, true, 1),
  ('td-u-echxao', 'td-i-echxao', 'Phần', 129000, true, 1),
  ('td-u-echom', 'td-i-echom', 'Phần', 139000, true, 1),
  ('td-u-lauech', 'td-i-lauech', 'Nồi', 249000, true, 1),
  ('td-u-lautt', 'td-i-lautt', 'Nồi', 289000, true, 1),
  ('td-u-lauga', 'td-i-lauga', 'Nồi', 259000, true, 1)
on conflict (id) do nothing;

insert into orders (id, tenant_id, table_id, status, guest_name, vat_rate, vat_included, service_rate, created_at)
values
  ('td-o-t1', 'td', 'td-t1', 'open', 'Anh Khoa', 0.08, true, 0.05, now() - interval '18 minutes'),
  ('td-o-t5', 'td', 'td-t5', 'open', 'Chị Mai', 0.08, true, 0.05, now() - interval '7 minutes'),
  ('td-o-vip', 'td', 'td-vip1', 'open', 'Bàn đoàn', 0.08, true, 0.05, now() - interval '32 minutes')
on conflict (id) do nothing;

insert into order_items (id, order_id, item_id, unit_id, name_snapshot, unit_snapshot, unit_price_dong, qty, note, kitchen_status, sent_at, started_at, created_at) values
  ('td-oi-1', 'td-o-t1', 'td-i-pho', 'td-u-pho', 'Phở bò tái nạm', 'Tô', 79000, 2, 'Tái nhiều, ít hành', 'preparing', now() - interval '17 minutes', now() - interval '12 minutes', now() - interval '17 minutes'),
  ('td-oi-2', 'td-o-t1', 'td-i-biahoi', 'td-u-biahoi', 'Bia hơi Hà Nội', 'Ly', 25000, 4, null, 'done', now() - interval '17 minutes', now() - interval '16 minutes', now() - interval '17 minutes'),
  ('td-oi-3', 'td-o-t5', 'td-i-ccg', 'td-u-ccg', 'Cơm chiên ghẹ', 'Phần', 106920, 1, null, 'queued', now() - interval '6 minutes', null, now() - interval '6 minutes'),
  ('td-oi-4', 'td-o-t5', 'td-i-tule', 'td-u-tule', 'Nếp tú lệ. Tu Le Sticky Rice Wine (300ml)', 'Bình', 75900, 1, 'Ướp lạnh', 'queued', now() - interval '6 minutes', null, now() - interval '6 minutes'),
  ('td-oi-5', 'td-o-vip', 'td-i-lautt', 'td-u-lautt', 'Lẩu thái hải sản', 'Nồi', 289000, 1, 'Ít cay', 'preparing', now() - interval '30 minutes', now() - interval '22 minutes', now() - interval '30 minutes'),
  ('td-oi-6', 'td-o-vip', 'td-i-goi', 'td-u-goi', 'Gỏi bò bóp thấu', 'Dĩa', 98000, 2, null, 'done', now() - interval '30 minutes', now() - interval '28 minutes', now() - interval '30 minutes'),
  ('td-oi-7', 'td-o-vip', 'td-i-biasg', 'td-u-biasg', 'Bia Sài Gòn Special', 'Chai', 35000, 8, null, 'done', now() - interval '30 minutes', now() - interval '29 minutes', now() - interval '30 minutes')
on conflict (id) do nothing;

insert into staff_calls (id, tenant_id, table_id, reason, status, created_at)
values ('td-call-1', 'td', 'td-t5', 'staff', 'open', now() - interval '2 minutes')
on conflict (id) do nothing;
