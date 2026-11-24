INSERT INTO packages(id,game_id,name,nominal,badge)
SELECT seed.id,g.id,seed.name,seed.nominal,seed.badge
FROM games g
CROSS JOIN (VALUES
  ('d1af2ee1-3b99-4ab9-a18b-010000000001','980 Genesis Crystals','980','Tặng 110'),
  ('d1af2ee1-3b99-4ab9-a18b-010000000002','1.980 Genesis Crystals','1.980','Tặng 260'),
  ('d1af2ee1-3b99-4ab9-a18b-010000000003','3.280 Genesis Crystals','3.280','Tặng 600'),
  ('d1af2ee1-3b99-4ab9-a18b-010000000004','6.480 Genesis Crystals','6.480','Tặng 1.600')
) AS seed(id,name,nominal,badge)
WHERE g.slug='genshin-impact'
  AND NOT EXISTS (SELECT 1 FROM packages p WHERE p.id=seed.id);

INSERT INTO prices(package_id,tier,customer_cents,ctv_cents)
SELECT seed.package_id,seed.tier,seed.customer_cents,seed.ctv_cents
FROM (VALUES
  ('d1af2ee1-3b99-4ab9-a18b-010000000001','standard',32900000,29500000),
  ('d1af2ee1-3b99-4ab9-a18b-010000000002','standard',65900000,59000000),
  ('d1af2ee1-3b99-4ab9-a18b-010000000003','standard',109900000,98000000),
  ('d1af2ee1-3b99-4ab9-a18b-010000000004','standard',219900000,198000000)
) AS seed(package_id,tier,customer_cents,ctv_cents)
JOIN packages p ON p.id=seed.package_id
ON CONFLICT (package_id,tier) DO NOTHING;
