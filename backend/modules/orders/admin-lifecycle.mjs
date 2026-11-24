import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { withTransaction } from '../../db/pool.mjs';
import { requireRole } from '../../middleware/auth.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';
import { parse } from '../../utils/validation.mjs';
import { audit } from '../../utils/audit.mjs';
import { id } from '../../utils/ids.mjs';

export const adminLifecycleRouter=Router();
const fail=(code,message)=>Object.assign(new Error(message),{statusCode:code});
const reason=z.string().trim().min(1).max(1000);
const confirmation=z.literal(true);
const schemas={
  notes:z.object({body:z.string().trim().min(1).max(2000)}).strict(),
  'report-issue':z.object({reason,outcome:z.enum(['unknown','not_delivered']),confirmed:z.boolean().optional()}).strict(),
  'resolve-issue':z.object({reason,outcome:z.enum(['delivered','not_delivered']),confirmed:confirmation}).strict(),
  retry:z.object({reason,confirmed:confirmation}).strict(),
  cancel:z.object({reason,confirmed:confirmation}).strict(),
  refund:z.object({reason,confirmed:confirmation}).strict(),
  'confirm-refund':z.object({reference:z.string().trim().min(3).max(120),confirmed:confirmation}).strict(),
  'record-late-payment':z.object({reason,reference:z.string().trim().min(3).max(120),confirmed:confirmation}).strict(),
};
adminLifecycleRouter.use('/admin/orders/:code',requireRole('admin'),(_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
for(const [action,schema] of Object.entries(schemas)){
  adminLifecycleRouter.post('/admin/orders/:code/'+action,requireCsrf,async(req,res,next)=>{
    try{
      const input=parse(schema,req.body);
      const result=await withTransaction(async client=>{
        const order=(await client.query('SELECT * FROM orders WHERE code=$1 FOR UPDATE',[req.params.code])).rows[0];
        if(!order)throw fail(404,'Không tìm thấy đơn');
        let status=order.status,event,metadata={};
        if(action==='notes'){
          const noteId=id();await client.query('INSERT INTO order_notes(id,order_id,actor_id,body) VALUES($1,$2,$3,$4)',[noteId,order.id,req.user.id,input.body]);
          await audit(client,req.user.id,'order.note_added',order.id,{note_id:noteId});return {code:order.code,status};
        }
        // Legacy CTV orders keep their original fulfillment/settlement rules.
        if(order.assigned_ctv_id || ['ready','claimed','review'].includes(status))throw fail(409,'Đơn thuộc luồng CTV cũ, cần đối soát riêng trước khi xử lý.');
        if(action==='report-issue'){
          if(!['pending_admin','processing'].includes(status))throw fail(409,'Chỉ báo lỗi cho đơn đang chờ xử lý hoặc đang nạp.');
          if(status==='processing' && order.processing_admin_id!==req.user.id)throw fail(409,'Chỉ admin nhận xử lý được báo kết quả đơn này.');
          if(input.outcome==='unknown' && status!=='processing')throw fail(409,'Chỉ đơn đang nạp mới cần đối soát kết quả chưa rõ.');
          if(input.outcome==='not_delivered' && input.confirmed!==true)throw fail(400,'Cần xác nhận chưa giao vật phẩm trước khi đánh dấu nạp lỗi.');
          status=input.outcome==='unknown'?'needs_review':'failed';event='order.issue_reported';metadata={reason:input.reason,outcome:input.outcome};
        }else if(action==='resolve-issue'){
          if(status!=='needs_review' || order.processing_admin_id!==req.user.id)throw fail(409,'Chỉ admin đang giữ đơn cần kiểm tra được xác nhận kết quả.');
          status=input.outcome==='delivered'?'completed':'failed';event='order.issue_resolved';metadata={reason:input.reason,outcome:input.outcome};
          if(status==='completed')await client.query('UPDATE orders SET completed_at=now() WHERE id=$1',[order.id]);
        }else if(action==='retry'){
          if(status!=='failed')throw fail(409,'Chỉ thử lại đơn đã xác nhận chưa nạp được.');
          if ((await client.query("SELECT 1 FROM ledger WHERE order_id=$1 AND kind IN ('refund','failure_refund','provider_refund') UNION ALL SELECT 1 FROM coupons WHERE source_order_id=$1 LIMIT 1", [order.id])).rowCount) throw fail(409,'Đơn đã được hoàn tiền hoặc cấp coupon. Khách cần tạo đơn mới.');
          status='pending_admin';event='order.retry_requested';metadata={reason:input.reason};
          await client.query('UPDATE orders SET processing_admin_id=NULL,processing_started_at=NULL WHERE id=$1',[order.id]);
        }else if(action==='cancel'){
          if (status === 'processing') {
            if (order.processing_admin_id !== req.user.id) throw fail(409, 'Chỉ admin đang xử lý được hủy đơn này.');
            const { rows: [mapping] } = await client.query(`SELECT g.provider_game_code,p.provider_package_id
              FROM games g JOIN packages p ON p.game_id=g.id WHERE g.id=$1 AND p.id=$2`, [order.game_id, order.package_id]);
            if (order.provider_order_id || (mapping?.provider_game_code && mapping?.provider_package_id)) {
              throw fail(409, 'Cần đối soát với nhà cung cấp trước khi hủy đơn.');
            }
          } else if (!['awaiting_payment','pending_admin','failed'].includes(status)) {
            throw fail(409, 'Không thể hủy đơn chưa rõ kết quả hoặc đã kết thúc.');
          }
          status='cancelled';event='order.cancelled';metadata={reason:input.reason};
          await client.query('UPDATE orders SET cancelled_at=now() WHERE id=$1',[order.id]);
        }else if(action==='record-late-payment'){
          if(status!=='cancelled' || order.payment_method!=='direct' || order.paid_at)throw fail(409,'Chỉ ghi nhận tiền vào cho đơn chuyển khoản đã hủy và chưa ghi nhận thanh toán.');
          await client.query('UPDATE orders SET paid_at=now() WHERE id=$1',[order.id]);event='order.late_payment_recorded';metadata={reason:input.reason,reference:input.reference};
        }else if(action==='refund'){
          if(status!=='cancelled' || !order.paid_at || BigInt(order.price_cents)<=0n)throw fail(409,'Chỉ hoàn toàn bộ cho đơn đã hủy và có thanh toán được ghi nhận.');
          if ((await client.query('SELECT 1 FROM coupons WHERE source_order_id=$1',[order.id])).rowCount) throw fail(409,'Đơn đã được hoàn bằng coupon.');
          if((await client.query('SELECT 1 FROM order_refunds WHERE order_id=$1',[order.id])).rowCount)throw fail(409,'Đơn đã có yêu cầu hoàn tiền.');
          const wallet=order.payment_method==='wallet';
          if(wallet){
            const purchase=(await client.query("SELECT COALESCE(sum(amount_cents),0) amount FROM ledger WHERE order_id=$1 AND user_id=$2 AND kind='purchase'",[order.id,order.customer_id])).rows[0];
            if(!order.customer_id || BigInt(purchase.amount)!==-BigInt(order.price_cents))throw fail(409,'Chưa đối soát được giao dịch trừ ví ban đầu.');
          }
          await client.query(`INSERT INTO order_refunds(id,order_id,amount_cents,method,state,reason,requested_by,confirmed_by,paid_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $5='paid' THEN now() END)`,[id(),order.id,order.price_cents,order.payment_method,wallet?'paid':'pending',input.reason,req.user.id,wallet?req.user.id:null]);
          if(wallet){
            await client.query("INSERT INTO ledger(id,user_id,order_id,kind,amount_cents,reference,note) VALUES($1,$2,$3,'refund',$4,$5,'Hoàn đơn đã hủy')",[id(),order.customer_id,order.id,order.price_cents,'refund:'+order.id]);
            await client.query('UPDATE users SET wallet_cents=wallet_cents+$1 WHERE id=$2',[order.price_cents,order.customer_id]);
          }
          status=wallet?'refunded':'refund_pending';event=wallet?'order.refund_paid':'order.refund_requested';metadata={amount_cents:String(order.price_cents),method:order.payment_method,reason:input.reason};
        }else if(action==='confirm-refund'){
          if(status!=='refund_pending' || order.payment_method!=='direct')throw fail(409,'Đơn không còn chờ hoàn chuyển khoản.');
          const updated=await client.query("UPDATE order_refunds SET state='paid',reference=$1,confirmed_by=$2,paid_at=now() WHERE order_id=$3 AND method='direct' AND state='pending' RETURNING id",[input.reference,req.user.id,order.id]);
          if(!updated.rowCount)throw fail(409,'Yêu cầu hoàn tiền không còn hợp lệ.');
          status='refunded';event='order.refund_paid';metadata={amount_cents:String(order.price_cents),method:'direct',reference:input.reference};
        }
        let walletRefund = null;
        const paid = order.paid_at || action === 'record-late-payment';
        if (status === 'cancelled' && order.customer_id && paid && BigInt(order.price_cents) > 0n) {
          const existing = await client.query("SELECT 1 FROM ledger WHERE order_id=$1 AND user_id=$2 AND kind IN ('refund','failure_refund','provider_refund')",[order.id,order.customer_id]);
          if (!existing.rowCount) {
            if (order.payment_method === 'wallet') {
              const {rows:[purchase]} = await client.query("SELECT COALESCE(SUM(amount_cents),0) amount FROM ledger WHERE order_id=$1 AND user_id=$2 AND kind='purchase'",[order.id,order.customer_id]);
              if (BigInt(purchase.amount) !== -BigInt(order.price_cents)) throw fail(409,'Chưa đối soát được giao dịch trừ ví ban đầu.');
            }
            await client.query("INSERT INTO ledger(id,user_id,order_id,kind,amount_cents,reference,note) VALUES($1,$2,$3,'refund',$4,$5,'Hoàn tiền về ví do đơn bị hủy')",[id(),order.customer_id,order.id,order.price_cents,'refund:'+order.id]);
            await client.query('UPDATE users SET wallet_cents=wallet_cents+$1 WHERE id=$2',[order.price_cents,order.customer_id]);
          }
          await client.query("INSERT INTO order_refunds(id,order_id,amount_cents,method,state,reason,requested_by,confirmed_by,paid_at) VALUES($1,$2,$3,'wallet','paid',$4,$5,$5,now())",[id(),order.id,order.price_cents,input.reason,req.user.id]);
          status='refunded';
          walletRefund={amount_cents:Number(order.price_cents),method:'wallet'};
          await audit(client,req.user.id,'order.refund_paid',order.id,walletRefund);
        }
        await client.query('UPDATE orders SET status=$1,updated_at=now() WHERE id=$2',[status,order.id]);
        if (status === 'failed' && order.customer_id && order.paid_at && BigInt(order.price_cents) > 0n) {
          const refunded = (await client.query(`INSERT INTO ledger(id,user_id,order_id,kind,amount_cents,reference,note) VALUES($1,$2,$3,'failure_refund',$4,$5,$6) ON CONFLICT(reference) DO NOTHING RETURNING amount_cents`, [id(), order.customer_id, order.id, order.price_cents, `failure_refund:${order.id}`, 'Hoàn tiền vào ví do đơn nạp thất bại'])).rows[0];
          if (refunded) {
            await client.query('UPDATE users SET wallet_cents=wallet_cents+$1 WHERE id=$2',[order.price_cents,order.customer_id]);
            walletRefund = { amount_cents: Number(refunded.amount_cents), method: 'wallet' };
            metadata = { ...metadata, refund: 'wallet', refund_amount_cents: String(order.price_cents) };
            await audit(client, req.user.id, 'order.failure_refunded_to_wallet', order.id, { amount_cents: String(order.price_cents), customer_id: order.customer_id });
          }
        }
        await audit(client,req.user.id,event,order.id,{...metadata,from_status:order.status,to_status:status});
        let coupon = null;
        if (['failed','cancelled'].includes(status) && !order.customer_id && order.payment_method === 'direct' && paid && BigInt(order.gross_price_cents ?? order.price_cents)>0n) {
          const couponCode = `ZET${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
          const amountCents = Number(order.gross_price_cents ?? order.price_cents);
          const issued = (await client.query(`INSERT INTO coupons(id,code,amount_cents,source_order_id,created_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_order_id) DO NOTHING RETURNING code,amount_cents`, [id(), couponCode, amountCents, order.id, req.user.id])).rows[0];
          if (issued) {
            coupon = { code: issued.code, amount_cents: Number(issued.amount_cents) };
            await audit(client,req.user.id,'coupon.issued',order.id,{coupon_code:issued.code,amount_cents:String(issued.amount_cents),source:'guest_failed_order'});
          }
        }
        return {code:order.code,status,coupon,refund:walletRefund};
      });
      res.status(action==='notes'?201:200).json(result);
    }catch(error){next(error.code==='23505'?fail(409,'Đơn hoặc mã giao dịch hoàn tiền đã được ghi nhận.'):error);}
  });
}
