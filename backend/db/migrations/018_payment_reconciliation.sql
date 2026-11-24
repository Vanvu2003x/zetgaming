CREATE TABLE IF NOT EXISTS payment_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  transaction_ref text,
  content text NOT NULL DEFAULT '',
  raw_payload jsonb NOT NULL DEFAULT '{}',
  matched_order_id text REFERENCES orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','matched','ignored','rejected')),
  occurred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS payment_events_order_idx ON payment_events(matched_order_id, created_at DESC);
