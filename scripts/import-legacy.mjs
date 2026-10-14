import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import { createDecipheriv, createHash, scryptSync } from 'node:crypto';
import { env, assertProductionConfig } from '../backend/config/env.mjs';
import { pool, withTransaction } from '../backend/db/pool.mjs';
import { encryptJson } from '../backend/utils/crypto.mjs';
import { payloadHash } from '../backend/utils/ids.mjs';

assertProductionConfig();
const file = process.env.LEGACY_DB || 'data/topup.sqlite';
const legacy = new DatabaseSync(file, { readOnly: true });
const all = (table) => legacy.prepare(`SELECT * FROM "${table}"`).all();
const parseJson = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const decryptLegacy = (value) => {
  try {
    const [ivText, tagText, bodyText] = String(value).split('.').map(item => Buffer.from(item, 'base64'));
    const key = scryptSync(process.env.LEGACY_SESSION_SECRET || 'dev-only-change-me', 'topup-key', 32);
    const decipher = createDecipheriv('aes-256-gcm', key, ivText);
    decipher.setAuthTag(tagText);
    return JSON.parse(Buffer.concat([decipher.update(bodyText), decipher.final()]).toString('utf8'));
  } catch { return null; }
};
const oldUsers = all('users');
const oldGames = all('games');
const oldPackages = all('packages');
const oldPrices = all('prices');
const oldOrders = all('orders');
const oldLedger = all('ledger');
const oldAudit = all('audit');

try {
  const result = await withTransaction(async client => {
    const existing = await client.query('SELECT (SELECT COUNT(*)::int FROM users) users,(SELECT COUNT(*)::int FROM games) games,(SELECT COUNT(*)::int FROM orders) orders');
    if (existing.rows[0].users || existing.rows[0].games || existing.rows[0].orders) {
      throw new Error('PostgreSQL đã có dữ liệu; dừng import để tránh ghi đè.');
    }
    for (const row of oldUsers) await client.query('INSERT INTO users(id,email,password_hash,role,tier,wallet_cents,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [row.id, row.email.toLowerCase(), row.password_hash, row.role, row.tier || 'standard', row.wallet_cents, row.created_at]);
    for (const row of oldGames) await client.query('INSERT INTO games(id,slug,name,mode,image,active,platform) VALUES($1,$2,$3,$4,$5,$6,$7)', [row.id, row.slug, row.name, row.mode, row.image, Boolean(row.active), row.platform || 'mobile']);
    for (const row of oldPackages) await client.query('INSERT INTO packages(id,game_id,name,nominal,active) VALUES($1,$2,$3,$4,$5)', [row.id, row.game_id, row.name, row.nominal, Boolean(row.active)]);
    for (const row of oldPrices) await client.query('INSERT INTO prices(package_id,tier,customer_cents,ctv_cents) VALUES($1,$2,$3,$4)', [row.package_id, row.tier, row.customer_cents, row.ctv_cents]);
    for (const row of oldOrders) {
      const target = decryptLegacy(row.target_json);
      if (!target) throw new Error(`Không giải mã được target của đơn ${row.code}`);
      const fingerprint = payloadHash({ package_id: row.package_id, target, payment_method: row.payment_method });
      await client.query(`INSERT INTO orders(id,code,customer_id,package_id,game_id,tier,price_cents,ctv_cents,target_encrypted,payment_method,status,assigned_ctv_id,dispatched_ctv_ids,idempotency_key,idempotency_payload_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, [row.id, row.code, row.customer_id, row.package_id, row.game_id, row.tier, row.price_cents, row.ctv_cents, encryptJson(target), row.payment_method, row.status, row.assigned_ctv_id || null, parseJson(row.dispatched_ctv_ids, []), row.idempotency_key, fingerprint, row.created_at, row.updated_at]);
    }
    for (const row of oldLedger) await client.query('INSERT INTO ledger(id,user_id,order_id,kind,amount_cents,reference,note,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [row.id, row.user_id, row.order_id || null, row.kind, row.amount_cents, row.reference, row.note || null, row.created_at]);
    for (const row of oldAudit) await client.query('INSERT INTO audit_events(id,actor_id,action,entity_id,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6)', [row.id, row.actor_id || null, row.action, row.entity_id || null, parseJson(row.metadata_json, {}), row.created_at]);
    return { users: oldUsers.length, games: oldGames.length, packages: oldPackages.length, prices: oldPrices.length, orders: oldOrders.length, ledger: oldLedger.length, audit: oldAudit.length };
  });
  console.log('Legacy import complete:', result);
} finally {
  legacy.close();
  await pool.end();
}
