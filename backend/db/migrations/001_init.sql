CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'ctv', 'admin')),
  tier text NOT NULL DEFAULT 'standard',
  wallet_cents bigint NOT NULL DEFAULT 0 CHECK (wallet_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('uid', 'login')),
  image text NOT NULL,
  platform text NOT NULL DEFAULT 'mobile',
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS packages (
  id text PRIMARY KEY,
  game_id text NOT NULL REFERENCES games(id),
  name text NOT NULL,
  nominal text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS prices (
  package_id text NOT NULL REFERENCES packages(id),
  tier text NOT NULL,
  customer_cents bigint NOT NULL CHECK (customer_cents >= 0),
  ctv_cents bigint NOT NULL CHECK (ctv_cents >= 0),
  PRIMARY KEY (package_id, tier)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  customer_id text NOT NULL REFERENCES users(id),
  package_id text NOT NULL REFERENCES packages(id),
  game_id text NOT NULL REFERENCES games(id),
  tier text NOT NULL,
  price_cents bigint NOT NULL CHECK (price_cents >= 0),
  ctv_cents bigint NOT NULL CHECK (ctv_cents >= 0),
  target_encrypted text NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('wallet', 'direct')),
  status text NOT NULL CHECK (status IN ('awaiting_payment', 'pending_admin', 'ready', 'claimed', 'review', 'completed', 'cancelled')),
  assigned_ctv_id text REFERENCES users(id),
  dispatched_ctv_ids text[] NOT NULL DEFAULT '{}',
  idempotency_key text NOT NULL,
  idempotency_payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS ledger (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  order_id text REFERENCES orders(id),
  kind text NOT NULL,
  amount_cents bigint NOT NULL,
  reference text NOT NULL UNIQUE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  actor_id text REFERENCES users(id),
  action text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
