import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from '../backend/db/pool.mjs';

if (process.env.NODE_ENV === 'production') throw new Error('Không seed coupon test ở production');

const couponCode = 'ZETLOCAL100K';
const result = await withTransaction(async client => {
  const existing = (await client.query('SELECT code,amount_cents,source_order_id FROM coupons WHERE code=$1', [couponCode])).rows[0];
  if (existing) return { ...existing, reused: true };

  const admin = (await client.query("SELECT id FROM users WHERE role='admin' ORDER BY created_at LIMIT 1")).rows[0];
  const pkg = (await client.query(`SELECT p.id,p.game_id,p.name,pr.customer_cents,pr.ctv_cents
    FROM packages p JOIN games g ON g.id=p.game_id JOIN prices pr ON pr.package_id=p.id AND pr.tier='standard'
    WHERE p.active=true AND g.active=true ORDER BY pr.customer_cents LIMIT 1`)).rows[0];
  if (!admin || !pkg) throw new Error('Local DB chưa có admin hoặc gói game đang bán');

  const orderId = randomUUID();
  const orderCode = `GPMTEST${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
  await client.query(`INSERT INTO orders(
    id,code,customer_id,package_id,game_id,tier,price_cents,gross_price_cents,coupon_discount_cents,ctv_cents,
    target_encrypted,payment_method,status,idempotency_key,idempotency_payload_hash,guest_token_hash
  ) VALUES($1,$2,NULL,$3,$4,'standard',$5,$5,0,$6,$7,'direct','failed',$8,$9,$10)`, [
    orderId, orderCode, pkg.id, pkg.game_id, pkg.customer_cents, pkg.ctv_cents, 'test-coupon-target', `seed-${orderId}`, `seed-${orderId}`, `guest-seed-${orderId}`,
  ]);
  const coupon = (await client.query(`INSERT INTO coupons(id,code,amount_cents,source_order_id,created_by)
    VALUES($1,$2,$3,$4,$5) RETURNING code,amount_cents,source_order_id`, [randomUUID(), couponCode, 100000, orderId, admin.id])).rows[0];
  return { ...coupon, order_code: orderCode, package_name: pkg.name, package_price_cents: Number(pkg.customer_cents), reused: false };
});

console.log(JSON.stringify(result, null, 2));
await pool.end();
