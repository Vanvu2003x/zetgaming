import { env } from '../config/env.mjs';
import { pool, withTransaction } from './pool.mjs';
import { hashPassword } from '../utils/password.mjs';
import { id } from '../utils/ids.mjs';

if (!env.seedDemo && env.nodeEnv === 'production') throw new Error('Không seed demo ở production');
await withTransaction(async client => {
  const exists = await client.query('SELECT 1 FROM users LIMIT 1');
  if (exists.rowCount) { console.log('Seed skipped: users already exist'); return; }
  const adminId = id(); const ctvId = id(); const customerId = id();
  await client.query('INSERT INTO users(id,email,password_hash,role,wallet_cents) VALUES($1,$2,$3,$4,$5),($6,$7,$8,$9,$10),($11,$12,$13,$14,$15)', [adminId, process.env.ADMIN_EMAIL || 'admin@example.com', await hashPassword(process.env.ADMIN_PASSWORD || 'admin12345'), 'admin', 0, ctvId, 'ctv@example.com', await hashPassword('ctv12345'), 'ctv', 0, customerId, 'customer@example.com', await hashPassword('customer123'), 'customer', 500000]);
  const gameId = id(); await client.query('INSERT INTO games(id,slug,name,mode,image,platform) VALUES($1,$2,$3,$4,$5,$6)', [gameId, 'mobile-legends', 'Mobile Legends', 'uid', 'https://static2.pisapapeles.net/uploads/2025/11/Mobile_Legends_Bang_Bang_ML.jpg', 'mobile']);
  for (const [name, nominal, price, ctvPrice] of [['86 Diamonds','86',20000,16000], ['172 Diamonds','172',40000,32000], ['429 Diamonds','429',95000,76000]]) { const packageId = id(); await client.query('INSERT INTO packages(id,game_id,name,nominal) VALUES($1,$2,$3,$4)', [packageId, gameId, name, nominal]); await client.query('INSERT INTO prices(package_id,tier,customer_cents,ctv_cents) VALUES($1,$2,$3,$4)', [packageId, 'standard', price, ctvPrice]); }
  console.log('Demo data seeded');
});
await pool.end();
