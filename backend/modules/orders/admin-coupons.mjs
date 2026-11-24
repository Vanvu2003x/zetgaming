import { Router } from 'express';
import { requireRole } from '../../middleware/auth.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';
import { withTransaction } from '../../db/pool.mjs';
import { audit } from '../../utils/audit.mjs';

export const adminCouponsRouter = Router();
adminCouponsRouter.use('/admin/coupons', requireRole('admin'));

adminCouponsRouter.get('/admin/coupons', async (req, res, next) => {
  try {
    const status = String(req.query.status || '').trim().toLowerCase();
    const params = status && ['active', 'redeemed', 'revoked', 'expired'].includes(status) ? [status] : [];
    const where = params.length ? 'WHERE c.status=$1' : '';
    const rows = (await req.db.query(`SELECT c.code,c.amount_cents,c.status,c.created_at,c.redeemed_at,c.expires_at,so.code source_order_code,so.status source_order_status,ro.code redeemed_order_code,creator.email created_by_email,redeemer.email redeemed_by_email FROM coupons c JOIN orders so ON so.id=c.source_order_id LEFT JOIN orders ro ON ro.id=c.redeemed_order_id LEFT JOIN users creator ON creator.id=c.created_by LEFT JOIN users redeemer ON redeemer.id=c.redeemed_by ${where} ORDER BY c.created_at DESC LIMIT 500`, params)).rows;
    res.json(rows.map(row => ({ ...row, amount_cents: Number(row.amount_cents) })));
  } catch (error) { next(error); }
});

adminCouponsRouter.post('/admin/coupons/:code/revoke', requireCsrf, async (req, res, next) => {
  try {
    const result = await withTransaction(async client => {
      const row = (await client.query(`UPDATE coupons SET status='revoked' WHERE code=$1 AND status='active' RETURNING code,amount_cents,source_order_id`, [String(req.params.code).toUpperCase()])).rows[0];
      if (!row) { const error = new Error('Coupon không tồn tại hoặc đã được dùng.'); error.statusCode = 409; throw error; }
      await audit(client, req.user.id, 'coupon.revoked', row.source_order_id, { coupon_code: row.code, amount_cents: String(row.amount_cents) });
      return { code: row.code, status: 'revoked' };
    });
    res.json(result);
  } catch (error) { next(error); }
});
