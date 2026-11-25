-- Replace the generic hero crop with the real Soul Land: Awakening World app icon.
UPDATE games
SET thumbnail = 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/72/7d/e6/727de6e8-555b-fd84-6702-78c79cbaf65f/Placeholder.mill/512x512bb.jpg'
WHERE slug = 'dau-la-dai-luc';

UPDATE packages
SET image = 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/72/7d/e6/727de6e8-555b-fd84-6702-78c79cbaf65f/Placeholder.mill/512x512bb.jpg'
WHERE game_id = (SELECT id FROM games WHERE slug = 'dau-la-dai-luc');
