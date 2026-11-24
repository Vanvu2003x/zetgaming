import { Router } from 'express';
import { withTransaction } from '../../db/pool.mjs';
import { requireRole } from '../../middleware/auth.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';
import { decryptJson } from '../../utils/crypto.mjs';
import { audit } from '../../utils/audit.mjs';
import { env } from '../../config/env.mjs';
import { khoablack } from '../providers/khoablack.mjs';
import { randomUUID } from 'node:crypto';

export const adminFulfillmentRouter = Router();
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

adminFulfillmentRouter.use('/admin/orders/:code', requireRole('admin'), (_req,res,next) => {
  res.set('Cache-Control','private, no-store');
  next();
});
adminFulfillmentRouter.get('/admin/orders/:code', async (req,res,next) => {
  try {
    const result = await withTransaction(async client => {
      const row = (await client.query(`SELECT o.id,o.code,o.status,o.price_cents,o.payment_method,o.created_at,o.updated_at,o.paid_at,o.cancelled_at,o.target_encrypted,o.processing_admin_id,o.processing_started_at,o.completed_at,(o.provider_order_id IS NOT NULL OR (g.provider_game_code IS NOT NULL AND p.provider_package_id IS NOT NULL)) provider_managed,p.name package_name,g.name game_name,COALESCE(u.email,'Khách vãng lai') customer,a.email processing_admin FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id LEFT JOIN users u ON u.id=o.customer_id LEFT JOIN users a ON a.id=o.processing_admin_id WHERE o.code=$1`, [req.params.code])).rows[0];
      if (!row) throw fail(404,'Không tìm thấy đơn');
      let decoded;
      try { decoded = decryptJson(row.target_encrypted); }
      catch { throw fail(500,'Không đọc được thông tin nạp đã mã hóa'); }
      const target = {};
      for (const field of ['uid','login','password','additional_info','zalo','server','region','character','note']) {
        if (typeof decoded?.[field] === 'string' && decoded[field]) target[field] = decoded[field];
      }
      await audit(client,req.user.id,'order.credentials_viewed',row.id);
      const notes=(await client.query('SELECT n.id,n.body,n.created_at,u.email actor FROM order_notes n JOIN users u ON u.id=n.actor_id WHERE n.order_id=$1 ORDER BY n.created_at DESC,n.id DESC',[row.id])).rows;
      const events=(await client.query("SELECT e.id,e.action,e.metadata,e.created_at,COALESCE(u.email,'Khách / hệ thống') actor FROM audit_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.entity_id=$1 ORDER BY e.created_at DESC,e.id DESC LIMIT 100",[row.id])).rows;
      let refund=(await client.query('SELECT amount_cents,method,state,reason,reference,created_at,paid_at FROM order_refunds WHERE order_id=$1',[row.id])).rows[0] || null;
      if(refund)refund.amount_cents=Number(refund.amount_cents);
      const { id, target_encrypted, ...order } = row;
      return { ...order, price_cents: Number(order.price_cents), target, notes, events, refund, can_complete: order.status === 'processing' && order.processing_admin_id === req.user.id, can_cancel_processing: order.status === 'processing' && order.processing_admin_id === req.user.id && !order.provider_managed, can_resolve: order.status === 'needs_review' && order.processing_admin_id === req.user.id };
    });
    res.json(result);
  } catch(error) { next(error); }
});

for (const action of ['start','complete']) {
  adminFulfillmentRouter.post('/admin/orders/:code/'+action, requireCsrf, async (req,res,next) => {
    try {
      if (action === 'complete' && req.body.confirmed !== true) return res.status(400).json({error:'Vui lòng xác nhận đã nạp thành công cho khách.'});
      const result = await withTransaction(async client => {
        const order = (await client.query(`SELECT o.id,o.code,o.status,o.assigned_ctv_id,o.processing_admin_id,o.target_encrypted,
          g.provider_game_code,p.provider_package_id FROM orders o JOIN games g ON g.id=o.game_id JOIN packages p ON p.id=o.package_id WHERE o.code=$1 FOR UPDATE`,[req.params.code])).rows[0];
        if (!order) throw fail(404,'Không tìm thấy đơn');
        if (action === 'start') {
          if (order.status !== 'pending_admin' || order.assigned_ctv_id) throw fail(409,'Đơn chưa thanh toán, đã có người xử lý hoặc không còn chờ tiếp nhận.');
          await client.query("UPDATE orders SET status='processing',processing_admin_id=$1,processing_started_at=now(),updated_at=now() WHERE id=$2",[req.user.id,order.id]);
        } else {
          if (order.status !== 'processing' || order.processing_admin_id !== req.user.id) throw fail(409,'Chỉ admin đã nhận xử lý được hoàn thành đơn đang nạp.');
          await client.query("UPDATE orders SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1",[order.id]);
        }
        await audit(client,req.user.id,action === 'start' ? 'order.admin_started' : 'order.admin_completed',order.id);
        return {code:order.code,status:action === 'start' ? 'processing' : 'completed', provider: order.provider_game_code && order.provider_package_id ? { gameCode: order.provider_game_code, packageId: order.provider_package_id, targetEncrypted: order.target_encrypted } : null};
      });
      if (action === 'start' && result.provider && env.khoablack.enabled && env.khoablack.autoFulfill) {
        let target;
        try { target = decryptJson(result.provider.targetEncrypted); } catch { throw Object.assign(new Error('Không đọc được thông tin nạp đã mã hóa.'), { statusCode: 500 }); }
        const accountInfo = { ...target };
        if (target.login) { accountInfo.username = target.login; delete accountInfo.login; }
        try {
          const upstream = await khoablack.createOrder({ packageId: result.provider.packageId, accountInfo });
          await req.db.query(`UPDATE orders SET provider_order_id=$1,provider_status=$2,provider_payload=$3::jsonb,provider_created_at=now(),provider_updated_at=now(),updated_at=now() WHERE code=$4`, [String(upstream.id), String(upstream.status || 'pending'), JSON.stringify(upstream), result.code]);
        } catch (providerError) {
          if (![400,401,403,404,422].includes(providerError.statusCode)) {
            await req.db.query("UPDATE orders SET status='needs_review',provider_status='create_unconfirmed',updated_at=now() WHERE code=$1 AND status='processing'", [result.code]);
            return res.json({code:result.code,status:'needs_review'});
          }
          await withTransaction(async client => {
            const failed = (await client.query('SELECT id,code,customer_id,price_cents,gross_price_cents,payment_method,paid_at FROM orders WHERE code=$1 FOR UPDATE', [result.code])).rows[0];
            if (!failed) return;
            if (failed.customer_id && BigInt(failed.price_cents) > 0n) {
              const refund = await client.query(`INSERT INTO ledger(id,user_id,order_id,kind,amount_cents,reference,note) VALUES($1,$2,$3,'provider_refund',$4,$5,$6) ON CONFLICT(reference) DO NOTHING`, [id(), failed.customer_id, failed.id, failed.price_cents, `provider_refund:${failed.id}`, 'Hoàn tiền tự động do KhoaBlack không nhận đơn']);
              if (refund.rowCount) await client.query('UPDATE users SET wallet_cents=wallet_cents+$1 WHERE id=$2', [failed.price_cents, failed.customer_id]);
            }
            await client.query(`UPDATE orders SET status='failed',provider_status='create_failed',provider_payload=$1::jsonb,updated_at=now() WHERE id=$2`, [JSON.stringify({ message: providerError.message }), failed.id]);
            await audit(client, req.user.id, 'order.issue_resolved', failed.id, {
              reason: 'Nhà cung cấp không nhận đơn',
              outcome: 'not_delivered',
              from_status: 'processing',
              to_status: 'failed',
            });
            if (!failed.customer_id && failed.payment_method === 'direct' && failed.paid_at) {
              const amount = failed.gross_price_cents ?? failed.price_cents;
              const code = `ZET${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
              const coupon = await client.query(`INSERT INTO coupons(id,code,amount_cents,source_order_id,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_order_id) DO NOTHING RETURNING code,amount_cents,status`, [randomUUID(), code, amount, failed.id, req.user.id]);
              if (coupon.rowCount) await audit(client, req.user.id, 'coupon.issued', failed.id, { code: coupon.rows[0].code, amount_cents: Number(coupon.rows[0].amount_cents), reason: 'provider_create_failed' });
            }
          });
          throw providerError;
        }
        delete result.provider;
        return res.json(result);
      }
      delete result.provider;
      res.json(result);
    } catch(error) { next(error); }
  });
}
