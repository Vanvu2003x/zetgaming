import { Router } from 'express';

export const couponPreviewRouter = Router();

couponPreviewRouter.get('/coupons/preview', async (req, res, next) => {
  try {
    const code = String(req.query.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{4,80}$/.test(code)) return res.status(404).json({ error: 'Mã coupon không hợp lệ hoặc đã được sử dụng' });
    const row = (await req.db.query('SELECT amount_cents,expires_at FROM coupons WHERE code=$1 AND status=$2', [code, 'active'])).rows[0];
    if (!row || (row.expires_at && new Date(row.expires_at) <= new Date())) return res.status(404).json({ error: 'Mã coupon không hợp lệ hoặc đã được sử dụng' });
    res.set('Cache-Control', 'no-store');
    res.json({ amount_cents: Number(row.amount_cents) });
  } catch (error) { next(error); }
});
