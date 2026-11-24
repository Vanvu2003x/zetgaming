ALTER TABLE games ADD COLUMN IF NOT EXISTS provider_game_code text;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS provider_package_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_order_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_payload jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_created_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_updated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS games_provider_game_code_uq
  ON games(provider_game_code) WHERE provider_game_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS packages_provider_package_id_uq
  ON packages(provider_package_id) WHERE provider_package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_provider_order_id_idx ON orders(provider_order_id);
