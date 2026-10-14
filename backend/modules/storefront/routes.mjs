import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../../utils/validation.mjs';
export const storefrontRouter = Router();
storefrontRouter.get('/storefront', async (req, res, next) => {
  try {
    const { path, status } = parse(z.object({ path: z.string().max(300).default('/'), status: z.string().max(40).default('all') }), req.query);
    const user = req.user ? { id: req.user.id, email: req.user.email, role: req.user.role, tier: req.user.tier, wallet_cents: Number(req.user.wallet_cents), created_at: req.user.created_at } : null;
    let rows = [], orders = [], order = null, summary = null;
    if (path === '/' || path.startsWith('/nap-game')) {
      rows = (await req.db.query(`SELECT g.id,g.slug,g.name,g.mode,g.image,g.platform,p.id package_id,p.name package_name,p.nominal,p.image package_image,p.badge,pr.customer_cents FROM games g JOIN packages p ON p.game_id=g.id JOIN prices pr ON pr.package_id=p.id WHERE g.active=true AND p.active=true AND pr.tier=$1 ORDER BY g.name,pr.customer_cents`, [user?.tier || 'standard'])).rows.map(row => ({ ...row, customer_cents: Number(row.customer_cents) }));
    }
    if (user && path === '/tai-khoan') {
      const row = (await req.db.query(`SELECT COUNT(*) total,COUNT(*) FILTER(WHERE status NOT IN ('completed','cancelled')) pending,COUNT(*) FILTER(WHERE status='completed') completed FROM orders WHERE customer_id=$1`, [user.id])).rows[0];
      summary = Object.fromEntries(Object.entries(row).map(([key,value]) => [key, Number(value)]));
    }
    if (user && path === '/lich-su') {
      orders = (await req.db.query(`SELECT o.code,o.status,o.price_cents,o.created_at,p.name package_name,g.name game_name FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id WHERE o.customer_id=$1 AND ($2='all' OR o.status=$2) ORDER BY o.created_at DESC`, [user.id, status])).rows.map(row => ({ ...row, price_cents: Number(row.price_cents) }));
    }
    if (user && /^\/lich-su\/[a-zA-Z0-9-]+$/.test(path)) {
      order = (await req.db.query(`SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,o.updated_at,p.name package_name,g.name game_name FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id WHERE o.code=$1 AND o.customer_id=$2`, [path.split('/')[2], user.id])).rows[0] || null;
      if (order) order.price_cents = Number(order.price_cents);
    }
    res.set('Cache-Control', 'no-store').json({ user, rows, orders, order, summary, csrf_token: req.csrfToken });
  } catch (error) { next(error); }
});
