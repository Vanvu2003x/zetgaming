import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { parse } from '../../utils/validation.mjs';
import { bankPayment } from '../orders/payment.mjs';
import { availableProviders } from '../auth/oauth.mjs';
export const storefrontRouter = Router();
const lookupLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Bạn tra cứu quá nhanh. Vui lòng thử lại sau một phút.' }, skip: req => !(req.query.path === '/lich-su' && req.query.code) && !/^\/lich-su\/GP[A-Z0-9]{8,30}$/i.test(String(req.query.path || '')) });
storefrontRouter.use('/storefront', lookupLimit);
storefrontRouter.get('/storefront', async (req, res, next) => {
  try {
    const { path, status } = parse(z.object({ path: z.string().max(300).default('/'), status: z.string().max(40).default('all') }), req.query);
    const user = req.user ? { id: req.user.id, email: req.user.email, role: req.user.role, tier: req.user.tier, wallet_cents: Number(req.user.wallet_cents), created_at: req.user.created_at } : null;
    let rows = [], orders = [], walletLedger = [], order = null, summary = null, settings = null, walletTopup = null;
    if (path === '/') settings = (await req.db.query('SELECT value FROM site_settings WHERE key=$1', ['home_hero'])).rows[0]?.value || null;
    const lookupCode = path === '/lich-su' ? String(req.query.code || '').trim().toUpperCase().slice(0, 40) : '';
    let lookup = null;
    if (/^GP[A-Z0-9]{8,30}$/.test(lookupCode)) {
      lookup = (await req.db.query(`SELECT o.code,o.status,o.price_cents,o.created_at,o.updated_at,p.name package_name,g.name game_name,c.code coupon_code,c.status coupon_status,c.amount_cents coupon_amount_cents FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id LEFT JOIN coupons c ON c.source_order_id=o.id AND o.customer_id IS NULL AND o.status IN ('failed','cancelled') WHERE o.code=$1`, [lookupCode])).rows[0] || null;
      if (lookup) { lookup.price_cents = Number(lookup.price_cents); if (lookup.coupon_amount_cents != null) lookup.coupon_amount_cents = Number(lookup.coupon_amount_cents); else { delete lookup.coupon_code; delete lookup.coupon_status; delete lookup.coupon_amount_cents; } }
    }
    if (path === '/' || path.startsWith('/nap-game')) {
      rows = (await req.db.query(`SELECT g.id,g.slug,g.name,g.mode,g.image,g.thumbnail,g.platform,g.category_id,g.input_config,c.name category_name,p.id package_id,p.name package_name,p.nominal,p.image package_image,p.badge,ROUND(pr.customer_cents * (100 - COALESCE(ct.discount_percent,0)) / 100)::bigint customer_cents FROM games g LEFT JOIN game_categories c ON c.id=g.category_id JOIN packages p ON p.game_id=g.id JOIN prices pr ON pr.package_id=p.id AND pr.tier='standard' LEFT JOIN customer_tiers ct ON ct.code=$1 WHERE g.active=true AND p.active=true ORDER BY g.name,customer_cents`, [user?.tier || 'standard'])).rows.map(row => ({ ...row, customer_cents: Number(row.customer_cents) }));
    }
    if (user && path === '/tai-khoan') {
      const row = (await req.db.query(`SELECT COUNT(*) total,COUNT(*) FILTER(WHERE status NOT IN ('completed','cancelled','refunded')) pending,COUNT(*) FILTER(WHERE status='completed') completed FROM orders WHERE customer_id=$1`, [user.id])).rows[0];
      summary = Object.fromEntries(Object.entries(row).map(([key,value]) => [key, Number(value)]));
    }
    if (user && (path === '/nap-so-du' || /^\/nap-so-du\/[A-Z0-9]+$/i.test(path))) {
      const code = path === '/nap-so-du' ? String(req.query.code || '').trim().toUpperCase() : path.split('/')[2].toUpperCase();
      if (code) walletTopup = (await req.db.query(`SELECT id,code,amount_cents,status,transaction_ref,created_at,updated_at,paid_at FROM wallet_topups WHERE code=$1 AND user_id=$2`, [code, user.id])).rows[0] || null;
    }
    if (user && path === '/lich-su') {
      orders = (await req.db.query(`SELECT o.code,o.status,o.price_cents,o.created_at,p.name package_name,g.name game_name FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id WHERE o.customer_id=$1 AND ($2='all' OR o.status=$2) ORDER BY o.created_at DESC`, [user.id, status])).rows.map(row => ({ ...row, price_cents: Number(row.price_cents) }));
      walletLedger = (await req.db.query(`SELECT l.id,l.kind,l.amount_cents,l.note,l.reference,l.created_at,o.code order_code,p.name package_name,g.name game_name FROM ledger l LEFT JOIN orders o ON o.id=l.order_id LEFT JOIN packages p ON p.id=o.package_id LEFT JOIN games g ON g.id=o.game_id WHERE l.user_id=$1 ORDER BY l.created_at DESC LIMIT 100`, [user.id])).rows.map(row => ({ ...row, amount_cents: Number(row.amount_cents) }));
    }
    if (/^\/lich-su\/[a-zA-Z0-9-]+$/.test(path)) {
      // The saved order code grants read-only payment access; never include customer or game credentials here.
      order = (await req.db.query(`SELECT o.code,o.status,o.price_cents,o.payment_method,(SELECT method FROM order_refunds WHERE order_id=o.id AND state='paid') refund_method,o.created_at,o.updated_at,p.name package_name,g.name game_name,c.code coupon_code,c.status coupon_status,c.amount_cents coupon_amount_cents FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id LEFT JOIN coupons c ON c.source_order_id=o.id AND o.customer_id IS NULL AND o.status IN ('failed','cancelled') WHERE o.code=$1`, [path.split('/')[2].toUpperCase()])).rows[0] || null;
      if (order) { order.price_cents = Number(order.price_cents); if (order.coupon_amount_cents != null) order.coupon_amount_cents = Number(order.coupon_amount_cents); else { delete order.coupon_code; delete order.coupon_status; delete order.coupon_amount_cents; } order.payment = bankPayment(order); }
    }
    if (walletTopup) { walletTopup.amount_cents = Number(walletTopup.amount_cents); walletTopup.payment = bankPayment({ code: walletTopup.code, price_cents: walletTopup.amount_cents, payment_method: 'direct', status: walletTopup.status }); }
    res.set('Cache-Control', 'no-store').json({ user, rows, orders, walletLedger, order, summary, walletTopup, lookup, settings, oauth: availableProviders(), csrf_token: req.csrfToken });
  } catch (error) { next(error); }
});
