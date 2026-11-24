BEGIN;

INSERT INTO game_categories(id, name) VALUES
  ('category-mobile', 'Mobile'),
  ('category-pc', 'PC')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO games(id, slug, name, mode, image, thumbnail, platform, category_id, input_config, active)
VALUES
  ('seed-game-play-together', 'play-together-vng', 'Play Together VNG', 'login', '/zetgaming-fire-bg.png', '/zetgaming-fire-bg.png', 'mobile', 'category-mobile', '{"guide":"Nhập đúng tài khoản và mật khẩu Play Together VNG.","password_required":true,"custom_fields":[]}', true),
  ('seed-game-roblox', 'roblox', 'Roblox', 'login', '/zetgaming-fire-bg.png', '/zetgaming-fire-bg.png', 'mobile', 'category-mobile', '{"guide":"Nhập thông tin tài khoản Roblox cần nạp.","password_required":true,"custom_fields":[]}', true),
  ('seed-game-valorant', 'valorant', 'VALORANT', 'login', '/zetgaming-fire-bg.png', '/zetgaming-fire-bg.png', 'pc', 'category-pc', '{"guide":"Nhập đúng tài khoản Riot dùng cho VALORANT.","password_required":true,"custom_fields":[]}', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  mode = EXCLUDED.mode,
  image = EXCLUDED.image,
  thumbnail = EXCLUDED.thumbnail,
  platform = EXCLUDED.platform,
  category_id = EXCLUDED.category_id,
  input_config = EXCLUDED.input_config,
  active = EXCLUDED.active;

INSERT INTO packages(id, game_id, name, nominal, image, badge, active)
VALUES
  ('seed-pkg-play-together-1', 'seed-game-play-together', 'Gói 50.000đ', '50.000', '/zetgaming-fire-bg.png', 'Nạp login', true),
  ('seed-pkg-play-together-2', 'seed-game-play-together', 'Gói 100.000đ', '100.000', '/zetgaming-fire-bg.png', 'Phổ biến', true),
  ('seed-pkg-roblox-1', 'seed-game-roblox', 'Gói 50.000đ', '50.000', '/zetgaming-fire-bg.png', 'Nạp login', true),
  ('seed-pkg-roblox-2', 'seed-game-roblox', 'Gói 200.000đ', '200.000', '/zetgaming-fire-bg.png', 'Tiết kiệm', true),
  ('seed-pkg-valorant-1', 'seed-game-valorant', 'Gói 100.000đ', '100.000', '/zetgaming-fire-bg.png', 'Nạp login', true),
  ('seed-pkg-valorant-2', 'seed-game-valorant', 'Gói 500.000đ', '500.000', '/zetgaming-fire-bg.png', 'Phổ biến', true)
ON CONFLICT (id) DO UPDATE SET
  game_id = EXCLUDED.game_id,
  name = EXCLUDED.name,
  nominal = EXCLUDED.nominal,
  image = EXCLUDED.image,
  badge = EXCLUDED.badge,
  active = EXCLUDED.active;

INSERT INTO prices(package_id, tier, customer_cents, ctv_cents)
VALUES
  ('seed-pkg-play-together-1', 'standard', 5000000, 4500000),
  ('seed-pkg-play-together-2', 'standard', 10000000, 9000000),
  ('seed-pkg-roblox-1', 'standard', 5000000, 4500000),
  ('seed-pkg-roblox-2', 'standard', 20000000, 18000000),
  ('seed-pkg-valorant-1', 'standard', 10000000, 9000000),
  ('seed-pkg-valorant-2', 'standard', 50000000, 45000000)
ON CONFLICT (package_id, tier) DO UPDATE SET
  customer_cents = EXCLUDED.customer_cents,
  ctv_cents = EXCLUDED.ctv_cents;

COMMIT;
