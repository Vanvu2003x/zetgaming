ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_by text REFERENCES users(id);
CREATE INDEX IF NOT EXISTS users_role_active_idx ON users(role, active);
