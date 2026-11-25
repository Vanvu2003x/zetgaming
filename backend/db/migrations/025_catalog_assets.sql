-- Catalog artwork fallbacks for games/packages that were created without media.
-- URLs are kept in the catalog so the existing image upload/editor flow remains unchanged.
UPDATE games
SET image = CASE slug
  WHEN 'play-together-vng' THEN 'https://img.zing.vn/upload/vnggames2/source/Game/2022/Play%20Together/1000x490.jpg'
  ELSE image
END,
thumbnail = CASE
  WHEN slug = 'play-together-vng' THEN 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/4a/d4/35/4ad43556-4fe9-7358-154c-b45f30873343/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg'
  WHEN COALESCE(thumbnail, '') = '' THEN image
  ELSE thumbnail
END
WHERE slug IN ('genshin-impact', 'honkai-star-rail', 'mobile-legends', 'play-together-vng', 'wuthering-waves', 'zenless-zone-zero');

UPDATE packages p
SET image = CASE g.slug
  WHEN 'genshin-impact' THEN 'https://staticg.sportskeeda.com/editor/2021/08/a95bb-16301832964719-800.jpg'
  WHEN 'honkai-star-rail' THEN 'https://techgarage.tn/4432-home_default/oneiric-shard-330.jpg'
  WHEN 'mobile-legends' THEN 'https://www.pngall.com/wp-content/uploads/18/Mobile-Legends-Diamond-Icon-PNG-thumb.png'
  WHEN 'play-together-vng' THEN 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/4a/d4/35/4ad43556-4fe9-7358-154c-b45f30873343/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg'
  WHEN 'wuthering-waves' THEN 'https://i0.wp.com/gamingonphone.com/wp-content/uploads/2024/06/Wuthering-waves-Lunite.jpg'
  WHEN 'zenless-zone-zero' THEN 'https://image.api.playstation.com/vulcan/ap/rnd/202403/2910/a97d0d9052c895398afd6771df9c5cdedf8490855f4e71c5.png?w=440'
  ELSE p.image
END
FROM games g
WHERE p.game_id = g.id AND COALESCE(p.image, '') = '';
