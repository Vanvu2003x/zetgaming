CREATE TABLE IF NOT EXISTS saved_game_inputs (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  target_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);
