import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash, createDecipheriv } from 'node:crypto';
import { pool } from '../backend/db/pool.mjs';
import { env } from '../backend/config/env.mjs';
import { convertLegacyMoney } from './legacy-money.mjs';
import { decryptLegacyTarget } from './legacy-target.mjs';

const legacy=new DatabaseSync(process.env.LEGACY_DB,{readOnly:true});
const amount=value=>convertLegacyMoney(value,process.env.LEGACY_MONEY_UNIT);
try{
  const counts={};
  for(const table of ['users','games','packages','prices','orders','ledger']){
    const before=legacy.prepare('SELECT COUNT(*) n FROM '+table).get().n;
    const after=Number((await pool.query('SELECT COUNT(*) n FROM '+table)).rows[0].n);assert.equal(after,before,table+' count');counts[table]=after;
  }
  for(const user of legacy.prepare('SELECT * FROM users').all()){
    const row=(await pool.query('SELECT * FROM users WHERE id=$1',[user.id])).rows[0];
    assert.equal(Number(row.wallet_cents),amount(user.wallet_cents));assert.equal(row.role,user.role);assert.equal(row.tier,user.tier||'standard');
  }
  for(const price of legacy.prepare('SELECT * FROM prices').all()){
    const row=(await pool.query('SELECT * FROM prices WHERE package_id=$1 AND tier=$2',[price.package_id,price.tier])).rows[0];
    assert.equal(Number(row.customer_cents),amount(price.customer_cents));assert.equal(Number(row.ctv_cents),amount(price.ctv_cents));
  }
  for(const order of legacy.prepare('SELECT * FROM orders').all()){
    const row=(await pool.query('SELECT * FROM orders WHERE id=$1',[order.id])).rows[0];
    assert.equal(Number(row.price_cents),amount(order.price_cents));assert.equal(Number(row.ctv_cents),amount(order.ctv_cents));assert.equal(row.status,order.status);
    const expected=decryptLegacyTarget(order.target_json,[process.env.LEGACY_SESSION_SECRET||'dev-only-change-me',process.env.LEGACY_FALLBACK_SESSION_SECRET]);
    const [iv,tag,body]=row.target_encrypted.split('.').map(text=>Buffer.from(text,'base64url'));
    const cipher=createDecipheriv('aes-256-gcm',createHash('sha256').update(env.sessionSecret).digest(),iv);cipher.setAuthTag(tag);
    assert.deepEqual(JSON.parse(Buffer.concat([cipher.update(body),cipher.final()]).toString()),expected,'Encrypted order target');
  }
  for(const entry of legacy.prepare('SELECT * FROM ledger').all()){
    const row=(await pool.query('SELECT * FROM ledger WHERE id=$1',[entry.id])).rows[0];assert.equal(Number(row.amount_cents),amount(entry.amount_cents));assert.equal(row.reference,entry.reference);
  }
  if(legacy.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='oauth_identities'").get()){
    const before=legacy.prepare('SELECT * FROM oauth_identities').all();assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM oauth_identities')).rows[0].n),before.length);
    for(const identity of before)assert.equal((await pool.query('SELECT user_id FROM oauth_identities WHERE provider=$1 AND subject=$2',[identity.provider,identity.subject])).rows[0].user_id,identity.user_id);
  }
  console.log(JSON.stringify({verified:counts,money_preserved:true,order_targets_preserved:true,google_links_preserved:true}));
}finally{legacy.close();await pool.end();}
