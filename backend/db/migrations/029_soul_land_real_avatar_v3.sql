-- Use a higher-quality square Soul Land artwork for the catalog avatar.
UPDATE games
SET thumbnail = 'https://storage.googleapis.com/npay/cp37icon1024-1651118213.png'
WHERE slug = 'dau-la-dai-luc';

UPDATE packages
SET image = 'https://storage.googleapis.com/npay/cp37icon1024-1651118213.png'
WHERE game_id = (SELECT id FROM games WHERE slug = 'dau-la-dai-luc');
