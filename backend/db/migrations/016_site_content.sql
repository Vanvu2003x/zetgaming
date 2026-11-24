CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO site_settings (key, value)
VALUES ('home_hero', '{"eyebrow":"NẠP GAME NHANH","title":"ZETGAMING","description":"Chọn game yêu thích, xem giá trước khi đặt và theo dõi đơn dễ dàng.","image":"/zetgaming-hero-soul-land-v4.png","active":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
