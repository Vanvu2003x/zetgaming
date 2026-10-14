import { Router } from 'express';
import { withTransaction } from '../../db/pool.mjs';
import { audit } from '../../utils/audit.mjs';
import { encryptJson } from '../../utils/crypto.mjs';
import { hash, id, orderCode, payloadHash } from '../../utils/ids.mjs';
import { parse, orderSchema } from '../../utils/validation.mjs';

export const ordersRouter = Router();

ordersRouter.post('/orders', async (req, res, next) => {
  try {
    const input = parse(orderSchema, req.body);
    const key = String(req.get('Idempotency-Key') || input.idempotency_key || '').trim();
    if (!key || key.length > 120) return res.status(400).json({ error: 'Thiếu khóa chống gửi trùng' });
    const target = input.target || {};
    if (!String(target.uid || target.login || '').trim()) return res.status(400).json({ error: 'Vui lòng nhập UID hoặc tài khoản game' });
    const method = input.payment_method;
    const fingerprint = payloadHash({ package_id: input.package_id, target, payment_method: method });
    const result = await withTransaction(async client => {
      const existing = (await client.query('SELECT code,status,idempotency_payload_hash FROM orders WHERE customer_id=$1 AND idempotency_key=$2', [req.user.id, key])).rows[0];
      if (existing) {
        if (existing.idempotency_payload_hash !== fingerprint) { const error = new Error('Idempotency-Key đã được dùng cho yêu cầu khác'); error.statusCode = 409; throw error; }
        return { code: existing.code, status: existing.status };
      }
      const pkg = (await client.query(`SELECT p.*,g.id game_id,pr.customer_cents,pr.ctv_cents FROM packages p JOIN games g ON g.id=p.game_id JOIN prices pr ON pr.package_id=p.id AND pr.tier=$1 WHERE p.id=$2 AND p.active=true AND g.active=true`, [req.user.tier, input.package_id])).rows[0];
      if (!pkg) { const error = new Error('Gói nạp không tồn tại hoặc chưa bán'); error.statusCode = 400; throw error; }
      let customer;
      if (method === 'wallet') {
        customer = (await client.query('UPDATE users SET wallet_cents=wallet_cents-$1 WHERE id=$2 AND wallet_cents >= $1 RETURNING wallet_cents', [pkg.customer_cents, req.user.id])).rows[0];
        if (!customer) { const error = new Error('Số dư ví không đủ'); error.statusCode = 400; throw error; }
      }
      const oid = id(); const code = orderCode(); const status = method === 'wallet' ? 'pending_admin' : 'awaiting_payment';
      await client.query(`INSERT INTO orders(id,code,customer_id,package_id,game_id,tier,price_cents,ctv_cents,target_encrypted,payment_method,status,idempotency_key,idempotency_payload_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [oid, code, req.user.id, pkg.id, pkg.game_id, req.user.tier, pkg.customer_cents, pkg.ctv_cents, encryptJson(target), method, status, key, fingerprint]);
      if (method === 'wallet') await client.query('INSERT INTO ledger(id,user_id,order_id,kind,amount_cents,reference,note) VALUES($1,$2,$3,$4,$5,$6,$7)', [id(), req.user.id, oid, 'purchase', -pkg.customer_cents, `purchase:${oid}`, 'Thanh toán đơn']);
      await audit(client, req.user.id, 'order.created', oid, { code });
      return { code, status };
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

ordersRouter.get('/orders', async (req, res, next) => {
  try {
    let result;
    if (req.user.role === 'admin') result = await req.db.query(`SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,u.email customer,p.name package_name FROM orders o JOIN users u ON u.id=o.customer_id JOIN packages p ON p.id=o.package_id ORDER BY o.created_at DESC`);
    else if (req.user.role === 'ctv') result = await req.db.query(`SELECT o.code,o.status,o.price_cents,o.ctv_cents,o.payment_method,o.created_at,p.name package_name FROM orders o JOIN packages p ON p.id=o.package_id WHERE o.assigned_ctv_id=$1 OR $1=ANY(o.dispatched_ctv_ids) ORDER BY o.created_at DESC`, [req.user.id]);
    else result = await req.db.query(`SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,p.name package_name FROM orders o JOIN packages p ON p.id=o.package_id WHERE o.customer_id=$1 ORDER BY o.created_at DESC`, [req.user.id]);
    res.json(result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => ['price_cents', 'ctv_cents'].includes(key) ? [key, Number(value)] : [key, value]))));
  } catch (error) { next(error); }
});

ordersRouter.get('/orders/:code', async (req, res, next) => {
  try {
    const result = await req.db.query(`SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,o.updated_at,p.name package_name,g.name game_name,u.email customer FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id JOIN users u ON u.id=o.customer_id WHERE o.code=$1 AND (o.customer_id=$2 OR o.assigned_ctv_id=$2 OR $3='admin')`, [req.params.code, req.user.id, req.user.role]);
    if (!result.rowCount) return res.status(404).json({ error: 'Không tìm thấy đơn' });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

export { hash };
