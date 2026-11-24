ALTER TABLE orders ADD COLUMN IF NOT EXISTS gross_price_cents bigint;
UPDATE orders SET gross_price_cents=price_cents WHERE gross_price_cents IS NULL;
ALTER TABLE orders ADD CONSTRAINT orders_gross_price_check CHECK (gross_price_cents >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount_cents bigint NOT NULL DEFAULT 0;
ALTER TABLE orders ADD CONSTRAINT orders_coupon_discount_check CHECK (coupon_discount_cents >= 0 AND coupon_discount_cents <= gross_price_cents);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id text;

CREATE TABLE IF NOT EXISTS coupons (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  source_order_id text NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  redeemed_order_id text UNIQUE REFERENCES orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','redeemed','revoked','expired')),
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  redeemed_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS coupons_status_created_idx ON coupons(status, created_at DESC);
CREATE INDEX IF NOT EXISTS coupons_source_order_idx ON coupons(source_order_id);
CREATE INDEX IF NOT EXISTS coupons_redeemed_order_idx ON coupons(redeemed_order_id);
