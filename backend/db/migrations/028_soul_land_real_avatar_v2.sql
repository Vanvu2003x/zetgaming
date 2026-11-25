-- Use a real artwork avatar instead of the low-quality App Store placeholder.
UPDATE games
SET thumbnail = 'https://img11.18183.com/ku18183/image/2025/07/11/115301c2e9f1475400c8a6fd7efbbbbd.png'
WHERE slug = 'dau-la-dai-luc';

UPDATE packages
SET image = 'https://img11.18183.com/ku18183/image/2025/07/11/115301c2e9f1475400c8a6fd7efbbbbd.png'
WHERE game_id = (SELECT id FROM games WHERE slug = 'dau-la-dai-luc');
