import { Router } from 'express';
import { withTransaction } from '../../db/pool.mjs';
import { audit } from '../../utils/audit.mjs';
import { encryptJson } from '../../utils/crypto.mjs';
import { hash, id, orderCode, payloadHash } from '../../utils/ids.mjs';
import { parse, orderSchema } from '../../utils/validation.mjs';

import { requireAuth } from '../../middleware/auth.mjs';
import { bankPayment } from './payment.mjs';
import { validateGameTarget } from '../../../shared/game-inputs.mjs';
import { applyCoupon } from '../../../shared/coupon-policy.mjs';

export const ordersRouter = Router();

ordersRouter.post('/orders', async (req, res, next) => {
  try {
    const input = parse(orderSchema, req.body);
    const key = String(req.get('Idempotency-Key') || input.idempotency_key || '').trim();
    if (!key || key.length > 120) return res.status(400).json({ error: 'Thiếu khóa chống gửi trùng' });
    const target = input.target || {};
    if (!String(target.uid || target.login || '').trim()) return res.status(400).json({ error: 'Vui lòng nhập UID hoặc tài khoản game' });
    const method = input.payment_method;
    if (method === 'wallet' && !req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập để dùng ví ZetGaming' });
    if (method === 'direct' && !bankPayment({ payment_method: 'direct', status: 'awaiting_payment', code: 'CHECK', price_cents: 100 })) return res.status(503).json({ error: 'Chuyển khoản chưa được cấu hình. Vui lòng quay lại sau.' });
    const owner = req.user?.id || null;
    const guest = owner ? null : req.guestHash;
    const tier = req.user?.tier || 'standard';
    const couponCode = String(input.coupon_code || '').trim().toUpperCase();
    const fingerprint = payloadHash({ package_id: input.package_id, target, payment_method: method, coupon_code: couponCode });
    const result = await withTransaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${owner || guest}:${key}`]);
      const existing = (await client.query('SELECT code,status,idempotency_payload_hash FROM orders WHERE ((customer_id=$1 AND $1 IS NOT NULL) OR (guest_token_hash=$2 AND customer_id IS NULL)) AND idempotency_key=$3', [owner, guest, key])).rows[0];
      if (existing) {
        if (existing.idempotency_payload_hash !== fingerprint) { const error = new Error('Idempotency-Key đã được dùng cho yêu cầu khác'); error.statusCode = 409; throw error; }
        return { code: existing.code, status: existing.status };
      }
      const pkg = (await client.query(`SELECT p.*,g.id game_id,g.mode,g.input_config,ROUND(pr.customer_cents * (100 - COALESCE(ct.discount_percent,0)) / 100)::bigint customer_cents,pr.ctv_cents FROM packages p JOIN games g ON g.id=p.game_id JOIN prices pr ON pr.package_id=p.id AND pr.tier='standard' LEFT JOIN customer_tiers ct ON ct.code=$1 WHERE p.id=$2 AND p.active=true AND g.active=true`, [tier, input.package_id])).rows[0];
      if (!pkg) { const error = new Error('Gói nạp không tồn tại hoặc chưa bán'); error.statusCode = 400; throw error; }
      const cleanTarget=validateGameTarget(pkg.mode,pkg.input_config,target);
      if (method === 'direct' && !bankPayment({ payment_method: method, status: 'awaiting_payment', code: 'CHECK', price_cents: pkg.customer_cents })) { const error = new Error('Giá gói nạp chưa hỗ trợ chuyển khoản'); error.statusCode = 400; throw error; }
      const grossPriceCents = Number(pkg.customer_cents);
      let coupon = null;
      let couponDiscountCents = 0;
      if (couponCode) {
        coupon = (await client.query(`SELECT id,code,amount_cents,status,expires_at FROM coupons WHERE code=$1 FOR UPDATE`, [couponCode])).rows[0];
        if (!coupon || coupon.status !== 'active' || (coupon.expires_at && new Date(coupon.expires_at) <= new Date())) { const error = new Error('Mã coupon không hợp lệ hoặc đã được sử dụng'); error.statusCode = 400; throw error; }
        couponDiscountCents = applyCoupon(grossPriceCents, coupon.amount_cents).discount_cents;
      }
      const priceCents = grossPriceCents - couponDiscountCents;
      let customer;
      if (method === 'wallet') {
        customer = (await client.query('UPDATE users SET wallet_cents=wallet_cents-$1 WHERE id=$2 AND wallet_cents >= $1 RETURNING wallet_cents', [priceCents, req.user.id])).rows[0];
        if (!customer) { const error = new Error('Số dư ví không đủ'); error.statusCode = 400; throw error; }
      }
      const oid = id(); const code = orderCode(); const status = method === 'wallet' || priceCents === 0 ? 'pending_admin' : 'awaiting_payment';
      await client.query(`INSERT INTO orders(id,code,customer_id,package_id,game_id,tier,price_cents,gross_price_cents,coupon_discount_cents,coupon_id,ctv_cents,target_encrypted,payment_method,status,idempotency_key,idempotency_payload_hash,guest_token_hash,paid_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, [oid, code, owner, pkg.id, pkg.game_id, tier, priceCents, grossPriceCents, couponDiscountCents, coupon?.id || null, pkg.ctv_cents, encryptJson(cleanTarget), method, status, key, fingerprint, guest, method === 'wallet' || priceCents === 0 ? new Date() : null]);
      if (coupon) await client.query(`UPDATE coupons SET status='redeemed',redeemed_order_id=$1,redeemed_by=$2,redeemed_at=now() WHERE id=$3 AND status='active'`, [oid, owner, coupon.id]);
      if (method === 'wallet' && priceCents > 0) await client.query('INSERT INTO ledger(id,user_id,order_id,kind,amount_cents,reference,note) VALUES($1,$2,$3,$4,$5,$6,$7)', [id(), req.user.id, oid, 'purchase', -priceCents, `purchase:${oid}`, 'Thanh toán đơn']);
      await audit(client, owner, 'order.created', oid, { code });
      return { code, status, price_cents: priceCents, coupon_discount_cents: couponDiscountCents };
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

ordersRouter.get('/orders', requireAuth, async (req, res, next) => {
  try {
    let result;
    if (req.user.role === 'admin') result = await req.db.query(`SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,COALESCE(u.email,'Khách vãng lai') customer,p.name package_name FROM orders o LEFT JOIN users u ON u.id=o.customer_id JOIN packages p ON p.id=o.package_id ORDER BY o.created_at DESC`);
    else if (req.user.role === 'ctv') result = await req.db.query(`SELECT o.code,o.status,o.price_cents,o.ctv_cents,o.payment_method,o.created_at,p.name package_name FROM orders o JOIN packages p ON p.id=o.package_id WHERE o.assigned_ctv_id=$1 OR $1=ANY(o.dispatched_ctv_ids) ORDER BY o.created_at DESC`, [req.user.id]);
    else result = await req.db.query(`SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,p.name package_name FROM orders o JOIN packages p ON p.id=o.package_id WHERE o.customer_id=$1 ORDER BY o.created_at DESC`, [req.user.id]);
    res.json(result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => ['price_cents', 'ctv_cents'].includes(key) ? [key, Number(value)] : [key, value]))));
  } catch (error) { next(error); }
});

ordersRouter.get('/orders/:code', async (req, res, next) => {
  try {
    const result = await req.db.query(`SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,o.updated_at,p.name package_name,g.name game_name,COALESCE(u.email,'Khách vãng lai') customer FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id LEFT JOIN users u ON u.id=o.customer_id WHERE o.code=$1 AND (o.customer_id=$2 OR o.assigned_ctv_id=$2 OR $3='admin' OR (o.customer_id IS NULL AND o.guest_token_hash=$4))`, [req.params.code, req.user?.id || null, req.user?.role || '', req.guestHash]);
    if (!result.rowCount) return res.status(404).json({ error: 'Không tìm thấy đơn' });
    res.json({ ...result.rows[0], payment: bankPayment(result.rows[0]) });
  } catch (error) { next(error); }
});

export { hash };
