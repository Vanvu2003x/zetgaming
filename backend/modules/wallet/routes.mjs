import { Router } from 'express';
import { z } from 'zod';
import { withTransaction } from '../../db/pool.mjs';
import { audit } from '../../utils/audit.mjs';
import { id, orderCode, payloadHash } from '../../utils/ids.mjs';
import { parse } from '../../utils/validation.mjs';
import { requireAuth, requireRole } from '../../middleware/auth.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';
import { bankPayment } from '../orders/payment.mjs';

const createSchema = z.object({ amount_vnd: z.coerce.number().int().min(10000).max(50000000), idempotency_key: z.string().trim().min(8).max(120).optional(), _csrf: z.string().optional() }).strict();
const publicTopup = row => ({ ...row, amount_cents: Number(row.amount_cents), payment: bankPayment({ code: row.code, price_cents: row.amount_cents, payment_method: 'direct', status: row.status }) });

export const walletRouter = Router();

walletRouter.post('/wallet-topups', requireCsrf, requireAuth, async (req, res, next) => {
  try {
    const input = parse(createSchema, req.body);
    const key = String(req.get('Idempotency-Key') || input.idempotency_key || '').trim();
    if (!key) return res.status(400).json({ error: 'Thiếu khóa chống gửi trùng' });
    const amountCents = input.amount_vnd * 100;
    const fingerprint = payloadHash({ amount_cents: amountCents });
    const result = await withTransaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`wallet:${req.user.id}:${key}`]);
      const existing = (await client.query('SELECT id,code,amount_cents,status FROM wallet_topups WHERE user_id=$1 AND idempotency_key=$2', [req.user.id, key])).rows[0];
      if (existing) return publicTopup(existing);
      const row = (await client.query(`INSERT INTO wallet_topups(id,code,user_id,amount_cents,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING id,code,amount_cents,status,created_at`, [id(), orderCode(), req.user.id, amountCents, key])).rows[0];
      await audit(client, req.user.id, 'wallet.topup_created', row.id, { code: row.code, amount_cents: String(amountCents), payload_hash: fingerprint });
      return publicTopup(row);
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

walletRouter.get('/wallet-topups/:code', requireAuth, async (req, res, next) => {
  try {
    const row = (await req.db.query(`SELECT id,code,amount_cents,status,transaction_ref,created_at,updated_at,paid_at FROM wallet_topups WHERE code=$1 AND (user_id=$2 OR $3='admin')`, [req.params.code.toUpperCase(), req.user.id, req.user.role])).rows[0];
    if (!row) return res.status(404).json({ error: 'Không tìm thấy giao dịch nạp số dư' });
    res.json(publicTopup(row));
  } catch (error) { next(error); }
});

walletRouter.get('/admin/wallet-topups', requireRole('admin'), async (req, res, next) => {
  try {
    const rows = (await req.db.query(`SELECT t.id,t.code,t.amount_cents,t.status,t.transaction_ref,t.created_at,t.updated_at,t.paid_at,u.email FROM wallet_topups t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC`)).rows;
    res.json(rows.map(row => ({ ...row, amount_cents: Number(row.amount_cents) })));
  } catch (error) { next(error); }
});

walletRouter.post('/admin/wallet-topups/:code/complete', requireCsrf, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await withTransaction(async client => completeTopup(client, req.params.code, req.user.id, req.body?.transaction_ref));
    res.json(result);
  } catch (error) { next(error); }
});

walletRouter.post('/admin/wallet-topups/:code/cancel', requireCsrf, requireRole('admin'), async (req, res, next) => {
  try {
    const row = (await req.db.query(`UPDATE wallet_topups SET status='cancelled',updated_at=now() WHERE code=$1 AND status='awaiting_payment' RETURNING code,status`, [req.params.code.toUpperCase()])).rows[0];
    if (!row) return res.status(409).json({ error: 'Giao dịch không còn ở trạng thái chờ thanh toán.' });
    res.json(row);
  } catch (error) { next(error); }
});

export async function completeTopup(client, code, actorId = null, transactionRef = null) {
  const row = (await client.query(`SELECT id,code,user_id,amount_cents,status FROM wallet_topups WHERE code=$1 FOR UPDATE`, [String(code).toUpperCase()])).rows[0];
  if (!row) { const error = new Error('Không tìm thấy giao dịch nạp số dư'); error.statusCode = 404; throw error; }
  if (row.status === 'completed') return { code: row.code, status: row.status, duplicate: true };
  if (row.status !== 'awaiting_payment') { const error = new Error('Giao dịch không còn chờ thanh toán'); error.statusCode = 409; throw error; }
  await client.query(`UPDATE wallet_topups SET status='completed',transaction_ref=$1,paid_at=now(),updated_at=now() WHERE id=$2`, [transactionRef || null, row.id]);
  await client.query('UPDATE users SET wallet_cents=wallet_cents+$1 WHERE id=$2', [row.amount_cents, row.user_id]);
  await client.query(`INSERT INTO ledger(id,user_id,kind,amount_cents,reference,note) VALUES($1,$2,$3,$4,$5,$6)`, [id(), row.user_id, 'deposit', row.amount_cents, `wallet-topup:${row.id}`, `Nạp số dư ${row.code}`]);
  await audit(client, actorId, 'wallet.topup_completed', row.id, { code: row.code, amount_cents: String(row.amount_cents), transaction_ref: transactionRef || null });
  return { code: row.code, status: 'completed', amount_cents: Number(row.amount_cents) };
}
