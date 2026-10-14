import { Router } from 'express';
import { withTransaction } from '../../db/pool.mjs';
import { audit } from '../../utils/audit.mjs';
import { id } from '../../utils/ids.mjs';
import { requireRole } from '../../middleware/auth.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';

export const dispatchRouter = Router();

dispatchRouter.get('/admin/ctvs', requireRole('admin'), async (req, res, next) => {
  try { res.json((await req.db.query("SELECT id,email,wallet_cents FROM users WHERE role='ctv' ORDER BY email")).rows.map(row => ({ ...row, wallet_cents: Number(row.wallet_cents) }))); }
  catch (error) { next(error); }
});

dispatchRouter.post('/admin/orders/:code/approve', requireCsrf, requireRole('admin'), async (req, res, next) => {
  try {
    const list = [...new Set(Array.isArray(req.body.ctv_ids) ? req.body.ctv_ids.filter(Boolean).map(String) : [])];
    if (!list.length) return res.status(400).json({ error: 'Phải chọn ít nhất một CTV' });
    const result = await withTransaction(async client => {
      const order = (await client.query('SELECT * FROM orders WHERE code=$1 FOR UPDATE', [req.params.code])).rows[0];
      if (!order) { const error = new Error('Không tìm thấy đơn'); error.statusCode = 404; throw error; }
      if (!['pending_admin', 'awaiting_payment'].includes(order.status)) { const error = new Error('Đơn không ở trạng thái chờ duyệt'); error.statusCode = 409; throw error; }
      if (order.payment_method === 'direct' && order.status === 'awaiting_payment') { const error = new Error('Đơn chưa được xác nhận thanh toán'); error.statusCode = 409; throw error; }
      const valid = (await client.query("SELECT id FROM users WHERE role='ctv' AND id=ANY($1::text[])", [list])).rows.map(row => row.id);
      if (valid.length !== list.length) { const error = new Error('Danh sách CTV không hợp lệ'); error.statusCode = 400; throw error; }
      await client.query("UPDATE orders SET status='ready',dispatched_ctv_ids=$1,updated_at=now() WHERE id=$2", [valid, order.id]);
      await audit(client, req.user.id, 'order.approved', order.id, { ctv_ids: valid });
      return { code: order.code, status: 'ready', ctv_ids: valid };
    });
    res.json(result);
  } catch (error) { next(error); }
});

dispatchRouter.post('/ctv/orders/:code/claim', requireCsrf, requireRole('ctv'), async (req, res, next) => {
  try {
    const result = await withTransaction(async client => {
      const order = (await client.query('SELECT * FROM orders WHERE code=$1 FOR UPDATE', [req.params.code])).rows[0];
      if (!order) { const error = new Error('Không tìm thấy đơn'); error.statusCode = 404; throw error; }
      if (!order.dispatched_ctv_ids.includes(req.user.id)) { const error = new Error('Đơn chưa được phân cho bạn'); error.statusCode = 403; throw error; }
      if (order.status !== 'ready' || order.assigned_ctv_id) { const error = new Error('Đơn đã có người nhận hoặc chưa được phân'); error.statusCode = 409; throw error; }
      await client.query("UPDATE orders SET status='claimed',assigned_ctv_id=$1,updated_at=now() WHERE id=$2", [req.user.id, order.id]);
      await audit(client, req.user.id, 'order.claimed', order.id);
      return { code: order.code, status: 'claimed' };
    });
    res.json(result);
  } catch (error) { next(error); }
});

dispatchRouter.post('/ctv/orders/:code/complete', requireCsrf, requireRole('ctv'), async (req, res, next) => {
  try {
    const result = await withTransaction(async client => {
      const order = (await client.query("SELECT * FROM orders WHERE code=$1 AND assigned_ctv_id=$2 AND status='claimed' FOR UPDATE", [req.params.code, req.user.id])).rows[0];
      if (!order) { const error = new Error('Đơn không thuộc về bạn hoặc không ở trạng thái xử lý'); error.statusCode = 409; throw error; }
      await client.query("UPDATE orders SET status='review',updated_at=now() WHERE id=$1", [order.id]);
      await audit(client, req.user.id, 'order.completed', order.id, { note: String(req.body.note || '').slice(0, 500) });
      return { code: order.code, status: 'review' };
    });
    res.json(result);
  } catch (error) { next(error); }
});

dispatchRouter.post('/admin/orders/:code/settle', requireCsrf, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await withTransaction(async client => {
      const order = (await client.query("SELECT * FROM orders WHERE code=$1 AND status='review' FOR UPDATE", [req.params.code])).rows[0];
      if (!order || !order.assigned_ctv_id) { const error = new Error('Đơn chưa chờ duyệt hoặc không hợp lệ'); error.statusCode = 409; throw error; }
      await client.query("UPDATE orders SET status='completed',updated_at=now() WHERE id=$1", [order.id]);
      await client.query('UPDATE users SET wallet_cents=wallet_cents+$1 WHERE id=$2', [order.ctv_cents, order.assigned_ctv_id]);
      await client.query('INSERT INTO ledger(id,user_id,order_id,kind,amount_cents,reference,note) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(reference) DO NOTHING', [id(), order.assigned_ctv_id, order.id, 'ctv_earning', order.ctv_cents, `ctv_earning:${order.id}`, 'Thu nhập đơn']);
      await audit(client, req.user.id, 'order.settled', order.id, { ctv_cents: Number(order.ctv_cents) });
      return { code: order.code, status: 'completed' };
    });
    res.json(result);
  } catch (error) { next(error); }
});
