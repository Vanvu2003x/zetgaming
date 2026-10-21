CREATE TABLE oauth_identities (
  provider text NOT NULL CHECK (provider = 'google'),
  subject text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject),
  UNIQUE (provider, user_id)
);
CREATE TABLE oauth_login_attempts (
  state_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  nonce text NOT NULL,
  code_verifier text NOT NULL,
  next_path text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
CREATE INDEX oauth_login_attempts_expiry ON oauth_login_attempts(expires_at);
