CREATE TABLE IF NOT EXISTS customer_tiers (
  code text PRIMARY KEY,
  name text NOT NULL,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO customer_tiers(code,name,discount_percent) VALUES
  ('standard','Standard',0),
  ('bronze','Bronze',3),
  ('silver','Silver',5),
  ('gold','Gold',10)
ON CONFLICT (code) DO NOTHING;
