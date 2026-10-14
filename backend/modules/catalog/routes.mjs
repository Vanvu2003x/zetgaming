import { Router } from 'express';
import { id } from '../../utils/ids.mjs';
import { audit } from '../../utils/audit.mjs';
import { requireRole } from '../../middleware/auth.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';

export const catalogRouter = Router();
catalogRouter.get('/games', async (req, res, next) => {
  try {
    const { rows } = await req.db.query(`SELECT g.id,g.slug,g.name,g.mode,g.image,g.platform,p.id package_id,p.name package_name,p.nominal,p.image package_image,p.badge,pr.tier,pr.customer_cents
      FROM games g JOIN packages p ON p.game_id=g.id JOIN prices pr ON pr.package_id=p.id
      WHERE g.active=true AND p.active=true ORDER BY g.name,pr.customer_cents`);
    res.json(rows);
  } catch (error) { next(error); }
});

catalogRouter.get('/admin/games', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await req.db.query(`SELECT g.id,g.slug,g.name,g.mode,g.image,g.platform,g.active,
      COALESCE(json_agg(json_build_object('id',p.id,'name',p.name,'nominal',p.nominal,'image',p.image,'badge',p.badge,'active',p.active,'tier',pr.tier,'customer_cents',pr.customer_cents,'ctv_cents',pr.ctv_cents) ORDER BY pr.customer_cents) FILTER (WHERE p.id IS NOT NULL),'[]') packages
      FROM games g LEFT JOIN packages p ON p.game_id=g.id LEFT JOIN prices pr ON pr.package_id=p.id AND pr.tier='standard'
      GROUP BY g.id ORDER BY g.name`);
    res.json(rows);
  }
  catch (error) { next(error); }
});

catalogRouter.patch('/admin/games/:id', requireCsrf, requireRole('admin'), async (req, res, next) => {
  try {
    const current = (await req.db.query('SELECT * FROM games WHERE id=$1', [req.params.id])).rows[0];
    if (!current) return res.status(404).json({ error: 'Không tìm thấy game' });
    const name = String(req.body.name ?? current.name).trim().slice(0, 120);
    const mode = String(req.body.mode ?? current.mode).trim().toLowerCase().slice(0, 40);
    const platform = String(req.body.platform ?? current.platform).trim().toLowerCase().slice(0, 20);
    const image = String(req.body.image ?? current.image).trim().slice(0, 1000);
    const active = req.body.active === undefined ? current.active : Boolean(req.body.active);
    if (!name || !['uid', 'login'].includes(mode) || !platform || !image || /[<>]/.test(image)) return res.status(400).json({ error: 'Thông tin game không hợp lệ' });
    const result = await req.db.query('UPDATE games SET name=$1,mode=$2,image=$3,platform=$4,active=$5 WHERE id=$6 RETURNING id,slug,name,mode,image,platform,active', [name, mode, image, platform, active, req.params.id]);
    await audit(req.db, req.user.id, 'game.updated', req.params.id, { fields: ['name', 'mode', 'image', 'platform', 'active'] });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

catalogRouter.patch('/admin/packages/:id', requireCsrf, requireRole('admin'), async (req, res, next) => {
  try {
    const current = (await req.db.query(`SELECT p.*,pr.customer_cents,pr.ctv_cents FROM packages p LEFT JOIN prices pr ON pr.package_id=p.id AND pr.tier='standard' WHERE p.id=$1`, [req.params.id])).rows[0];
    if (!current) return res.status(404).json({ error: 'Không tìm thấy gói nạp' });
    const name = String(req.body.name ?? current.name).trim().slice(0, 120);
    const nominal = String(req.body.nominal ?? current.nominal).trim().slice(0, 80);
    const image = String(req.body.image ?? current.image ?? '').trim().slice(0, 1000);
    const badge = String(req.body.badge ?? current.badge ?? '').trim().slice(0, 40) || null;
    const customer = Number(req.body.customer_cents ?? current.customer_cents);
    const ctv = Number(req.body.ctv_cents ?? current.ctv_cents);
    const active = req.body.active === undefined ? current.active : Boolean(req.body.active);
    if (!name || !nominal || !Number.isSafeInteger(customer) || customer < 0 || !Number.isSafeInteger(ctv) || ctv < 0 || (image && /[<>]/.test(image))) return res.status(400).json({ error: 'Thông tin gói nạp không hợp lệ' });
    const result = await req.db.query(`WITH updated AS (UPDATE packages SET name=$1,nominal=$2,image=NULLIF($3,''),badge=$4,active=$5 WHERE id=$6 RETURNING *)
      SELECT u.*,pr.customer_cents,pr.ctv_cents FROM updated u JOIN prices pr ON pr.package_id=u.id AND pr.tier='standard'`, [name, nominal, image, badge, active, req.params.id]);
    await req.db.query(`UPDATE prices SET customer_cents=$1,ctv_cents=$2 WHERE package_id=$3 AND tier='standard'`, [customer, ctv, req.params.id]);
    await audit(req.db, req.user.id, 'package.updated', req.params.id, { fields: ['name','nominal','image','badge','active','customer_cents','ctv_cents'] });
    res.json({ ...result.rows[0], customer_cents: customer, ctv_cents: ctv });
  } catch (error) { next(error); }
});
