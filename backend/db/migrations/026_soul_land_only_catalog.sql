-- VPS catalog scope: keep only the Soul Land top-up game visible to customers.
INSERT INTO game_categories(id, name)
VALUES ('category-login', 'Nạp login')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO games(id, slug, name, mode, image, thumbnail, platform, category_id, input_config, active)
VALUES (
  'soul-land-dau-la-dai-luc',
  'dau-la-dai-luc',
  'Đấu La Đại Lục',
  'login',
  '/zetgaming-hero-soul-land-v4.png',
  '/zetgaming-hero-characters-v3.png',
  'mobile',
  'category-login',
  '{"guide":"Nhập đúng tài khoản và mật khẩu Đấu La Đại Lục để được xử lý đơn.","password_required":true,"custom_fields":[]}'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  mode = EXCLUDED.mode,
  image = EXCLUDED.image,
  thumbnail = EXCLUDED.thumbnail,
  category_id = EXCLUDED.category_id,
  input_config = EXCLUDED.input_config,
  active = true;

UPDATE games
SET active = (slug = 'dau-la-dai-luc');

INSERT INTO packages(id, game_id, name, nominal, image, badge, active)
VALUES
  ('soul-land-package-060', 'soul-land-dau-la-dai-luc', 'Gói 60 Hồn lực', '60', '/zetgaming-hero-characters-v3.png', 'Phổ biến', true),
  ('soul-land-package-300', 'soul-land-dau-la-dai-luc', 'Gói 300 Hồn lực', '300', '/zetgaming-hero-characters-v3.png', 'Tiết kiệm', true),
  ('soul-land-package-980', 'soul-land-dau-la-dai-luc', 'Gói 980 Hồn lực', '980', '/zetgaming-hero-characters-v3.png', 'Nhiều người chọn', true)
ON CONFLICT (id) DO UPDATE SET
  game_id = EXCLUDED.game_id,
  name = EXCLUDED.name,
  nominal = EXCLUDED.nominal,
  image = EXCLUDED.image,
  badge = EXCLUDED.badge,
  active = true;

INSERT INTO prices(package_id, tier, customer_cents, ctv_cents)
VALUES
  ('soul-land-package-060', 'standard', 2000000, 1800000),
  ('soul-land-package-300', 'standard', 5000000, 4500000),
  ('soul-land-package-980', 'standard', 15000000, 13500000)
ON CONFLICT (package_id, tier) DO UPDATE SET
  customer_cents = EXCLUDED.customer_cents,
  ctv_cents = EXCLUDED.ctv_cents;
