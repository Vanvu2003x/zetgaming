CREATE TABLE IF NOT EXISTS order_notifications (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email','telegram')),
  recipient text NOT NULL,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, channel, recipient, event)
);
CREATE INDEX IF NOT EXISTS order_notifications_pending_idx ON order_notifications(status, created_at);
