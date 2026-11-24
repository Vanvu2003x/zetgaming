import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { withTransaction } from '../../db/pool.mjs';
import { audit } from '../../utils/audit.mjs';
import { id } from '../../utils/ids.mjs';
import { env } from '../../config/env.mjs';
import { completeTopup } from '../wallet/routes.mjs';

export const reconciliationRouter = Router();
const sameSecret = (received, expected) => { if (!received || !expected) return false; const a = Buffer.from(received); const b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a, b); };
const text = value => String(value ?? '').trim().slice(0, 1000);
const extractZetCode = content => text(content).match(/zet\s*([a-z0-9]+)\s*zet/i)?.[1]?.toUpperCase() || '';
const normalize = body => ({ eventId: text(body.event_id || body.id || body.transaction_id || body.reference), amount: Number(body.amount ?? body.transfer_amount ?? body.amount_vnd ?? 0), content: text(body.content || body.description || body.transfer_content), reference: text(body.reference || body.transaction_ref || body.transaction_code), occurredAt: body.transaction_date || body.occurred_at || null });

reconciliationRouter.post('/payment/web2m/webhook', async (req, res, next) => {
  try {
    if (env.reconciliationProvider !== 'web2m' || !env.web2mWebhookToken) return res.status(503).json({ error: 'Đối soát Web2M chưa được bật.' });
    const token = req.get('x-web2m-token') || req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!sameSecret(token, env.web2mWebhookToken)) return res.status(401).json({ error: 'Webhook token không hợp lệ.' });
    const input = normalize(req.body);
    const transferCode = extractZetCode(input.content);
    if (!input.eventId || !Number.isFinite(input.amount) || input.amount <= 0) return res.status(400).json({ error: 'Payload giao dịch thiếu mã hoặc số tiền.' });
    const result = await withTransaction(async client => {
      const existing = (await client.query('SELECT status,matched_order_id FROM payment_events WHERE provider=$1 AND provider_event_id=$2', ['web2m', input.eventId])).rows[0];
      if (existing) return { duplicate: true, matched: existing.status === 'matched', order_id: existing.matched_order_id, wallet_topup_id: existing.matched_wallet_topup_id };
      const amountCents = Math.round(input.amount * 100);
      const eventId = id();
      const order = (await client.query(`SELECT id,code,price_cents,status,payment_method FROM orders WHERE payment_method='direct' AND status='awaiting_payment' AND price_cents=$1 AND code=$2 ORDER BY created_at LIMIT 1 FOR UPDATE`, [amountCents, transferCode])).rows[0];
      const topup = order ? null : (await client.query(`SELECT id,code,amount_cents,status FROM wallet_topups WHERE status='awaiting_payment' AND amount_cents=$1 AND code=$2 ORDER BY created_at LIMIT 1 FOR UPDATE`, [amountCents, transferCode])).rows[0];
      await client.query(`INSERT INTO payment_events(id,provider,provider_event_id,amount_cents,transaction_ref,content,raw_payload,matched_order_id,matched_wallet_topup_id,status,occurred_at) VALUES($1,'web2m',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`, [eventId, input.eventId, amountCents, input.reference || null, input.content, JSON.stringify(req.body), order?.id || null, topup?.id || null, order || topup ? 'matched' : 'ignored', input.occurredAt || null]);
      if (!order && !topup) return { duplicate: false, matched: false };
      if (topup) return { ...(await completeTopup(client, topup.code, null, input.reference)), duplicate: false, matched: true, wallet_topup_id: topup.id };
      await client.query("UPDATE orders SET status='pending_admin',paid_at=now(),updated_at=now() WHERE id=$1", [order.id]);
      await audit(client, null, 'order.payment_confirmed', order.id, { amount_cents: String(amountCents), method: 'web2m', transaction_ref: input.reference });
      return { duplicate: false, matched: true, order_id: order.id, code: order.code };
    });
    res.status(result.duplicate ? 200 : 201).json({ ok: true, ...result });
  } catch (error) { next(error); }
});
