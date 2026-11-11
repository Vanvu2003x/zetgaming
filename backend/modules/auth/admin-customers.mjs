import { Router } from 'express';
import { z } from 'zod';
import { id } from '../../utils/ids.mjs';
import { audit } from '../../utils/audit.mjs';
import { parse } from '../../utils/validation.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';
import { requireRole } from '../../middleware/auth.mjs';

const updateSchema = z.object({ active: z.boolean().optional(), tier: z.string().trim().min(1).max(40).optional(), role: z.enum(['customer', 'ctv', 'admin']).optional() }).strict();
export const adminCustomersRouter = Router();
adminCustomersRouter.get('/admin/customers', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await req.db.query(`SELECT u.id,u.email,u.role,u.tier,u.active,u.created_at,u.locked_at,
      COALESCE(o.order_count,0)::int order_count,COALESCE(o.topup_cents,0)::bigint topup_cents,COALESCE(s.session_count,0)::int session_count
      FROM users u
      LEFT JOIN (SELECT customer_id,COUNT(*) order_count,SUM(price_cents) FILTER (WHERE status IN ('pending_admin','processing','completed')) topup_cents FROM orders GROUP BY customer_id) o ON o.customer_id=u.id
      LEFT JOIN (SELECT user_id,COUNT(*) session_count FROM sessions WHERE expires_at>now() GROUP BY user_id) s ON s.user_id=u.id
      ORDER BY u.created_at DESC`);
    res.set('Cache-Control', 'no-store').json(rows.map(row => ({ ...row, wallet_cents: Number(row.wallet_cents || 0), topup_cents: Number(row.topup_cents || 0) })));
  } catch (error) { next(error); }
});

adminCustomersRouter.get('/admin/customers/:id/history', requireRole('admin'), async (req, res, next) => {
  try {
    const customer = (await req.db.query('SELECT id,email,tier,wallet_cents FROM users WHERE id=$1', [req.params.id])).rows[0];
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    const [orders, ledger] = await Promise.all([
      req.db.query(`SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,o.updated_at,p.name package_name,g.name game_name FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id WHERE o.customer_id=$1 ORDER BY o.created_at DESC LIMIT 50`, [req.params.id]),
      req.db.query(`SELECT l.kind,l.amount_cents,l.reference,l.note,l.created_at,o.code order_code FROM ledger l LEFT JOIN orders o ON o.id=l.order_id WHERE l.user_id=$1 ORDER BY l.created_at DESC LIMIT 50`, [req.params.id]),
    ]);
    res.set('Cache-Control', 'private, no-store').json({ customer: { ...customer, wallet_cents: Number(customer.wallet_cents || 0) }, orders: orders.rows.map(row => ({ ...row, price_cents: Number(row.price_cents || 0) })), ledger: ledger.rows.map(row => ({ ...row, amount_cents: Number(row.amount_cents || 0) })) });
  } catch (error) { next(error); }
});

adminCustomersRouter.patch('/admin/customers/:id', requireCsrf, requireRole('admin'), async (req, res, next) => {
  try {
    const input = parse(updateSchema, req.body);
    const pooled = typeof req.db.release !== 'function';
    const client = pooled ? await req.db.connect() : req.db;
    const release = pooled ? () => client.release() : () => {};
    try {
      await client.query('BEGIN');
      const current = (await client.query('SELECT id,email,role,active,tier FROM users WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
      if (!current) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy tài khoản.' }); }
      const nextRole = input.role || current.role;
      const nextActive = input.active === undefined ? current.active : input.active;
      if (current.role === 'admin' && (nextRole !== 'admin' || !nextActive)) {
        const count = Number((await client.query("SELECT COUNT(*) FROM users WHERE role='admin' AND active=true")).rows[0].count);
        if (count <= 1) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Không thể khóa hoặc hạ quyền admin cuối cùng.' }); }
      }
      const row = (await client.query(`UPDATE users SET active=$1,tier=$2,role=$3,locked_at=CASE WHEN $1=false THEN COALESCE(locked_at,now()) ELSE NULL END,locked_by=CASE WHEN $1=false THEN $4 ELSE NULL END WHERE id=$5 RETURNING id,email,role,tier,active,created_at,locked_at`, [nextActive, input.tier || current.tier, nextRole, req.user.id, req.params.id])).rows[0];
      if (!nextActive) await client.query('DELETE FROM sessions WHERE user_id=$1', [req.params.id]);
      await audit(client, req.user.id, 'customer.updated', req.params.id, { active: nextActive, tier: row.tier, role: row.role });
      await client.query('COMMIT');
      res.json(row);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { release(); }
  } catch (error) { next(error); }
});

adminCustomersRouter.post('/admin/customers/:id/revoke-sessions', requireCsrf, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await req.db.query('DELETE FROM sessions WHERE user_id=$1', [req.params.id]);
    await audit(req.db, req.user.id, 'customer.sessions_revoked', req.params.id, { count: result.rowCount });
    res.json({ revoked: result.rowCount });
  } catch (error) { next(error); }
});
