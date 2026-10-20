CREATE TABLE IF NOT EXISTS game_categories (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX IF NOT EXISTS game_categories_name_idx ON game_categories (lower(name));
ALTER TABLE games ADD COLUMN IF NOT EXISTS category_id text REFERENCES game_categories(id);
CREATE INDEX IF NOT EXISTS games_category_idx ON games(category_id);
INSERT INTO game_categories(id,name) VALUES ('category-uid','Nạp UID'),('category-login','Nạp login') ON CONFLICT DO NOTHING;
UPDATE games SET category_id=CASE WHEN mode='login' THEN 'category-login' ELSE 'category-uid' END WHERE category_id IS NULL;
