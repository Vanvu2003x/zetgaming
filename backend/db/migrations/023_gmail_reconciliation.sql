CREATE TABLE IF NOT EXISTS gmail_watch_state (
  mailbox text PRIMARY KEY,
  history_id text NOT NULL,
  expiration timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
