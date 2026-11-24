CREATE TABLE IF NOT EXISTS wallet_topups (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 100000),
  status text NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment','completed','cancelled')),
  transaction_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  idempotency_key text NOT NULL,
  UNIQUE(user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS wallet_topups_user_created_idx ON wallet_topups(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_topups_status_idx ON wallet_topups(status, created_at DESC);

ALTER TABLE payment_events ADD COLUMN IF NOT EXISTS matched_wallet_topup_id text REFERENCES wallet_topups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS payment_events_wallet_topup_idx ON payment_events(matched_wallet_topup_id, created_at DESC);
