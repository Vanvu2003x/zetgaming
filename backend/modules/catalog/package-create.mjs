import { Router } from 'express';
import { z } from 'zod';
import { id } from '../../utils/ids.mjs';
import { parse } from '../../utils/validation.mjs';
import { requireRole } from '../../middleware/auth.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';

const image = z.string().trim().max(1000).refine(value => !value || (/^(https:\/\/|\/(?!\/))/.test(value) && !/[<>]/.test(value)), 'Đường dẫn ảnh không hợp lệ');
const schema = z.object({
  game_id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  nominal: z.string().trim().max(80).default(''),
  image: image.default(''),
  badge: z.string().trim().max(40).default(''),
  customer_cents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ctv_cents: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
  active: z.boolean().default(true),
});

export const packageCreateRouter = Router();
packageCreateRouter.post('/admin/packages', requireCsrf, requireRole('admin'), async (req, res, next) => {
  try {
    const input = parse(schema, req.body);
    const packageId = id();
    // A single statement commits the product, price and audit together, or none of them.
    const result = await req.db.query(`WITH created AS (
      INSERT INTO packages(id,game_id,name,nominal,image,badge,active)
      SELECT $1,g.id,$3,$4,NULLIF($5,''),NULLIF($6,''),$7 FROM games g WHERE g.id=$2
      RETURNING *
    ), priced AS (
      INSERT INTO prices(package_id,tier,customer_cents,ctv_cents)
      SELECT id,'standard',$8,$9 FROM created RETURNING *
    ), logged AS (
      INSERT INTO audit_events(id,actor_id,action,entity_id)
      SELECT $10,$11,'package.created',id FROM created
    ) SELECT c.*,p.customer_cents,p.ctv_cents FROM created c JOIN priced p ON p.package_id=c.id`,
    [packageId, input.game_id, input.name, input.nominal || input.name.slice(0, 80), input.image, input.badge, input.active, input.customer_cents, input.ctv_cents, id(), req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Không tìm thấy game. Vui lòng chọn lại.' });
    res.status(201).json({ ...result.rows[0], customer_cents: Number(result.rows[0].customer_cents), ctv_cents: Number(result.rows[0].ctv_cents) });
  } catch (error) { next(error); }
});
