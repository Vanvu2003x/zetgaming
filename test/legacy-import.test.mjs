import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, scryptSync, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { env } from '../backend/config/env.mjs';

test('fresh migrations and legacy import preserve all money, game mappings, Google identities and encrypted order targets',async()=>{
  const schema='import_test_'+randomUUID().replaceAll('-','');
  const management=new pg.Pool({connectionString:env.databaseUrl});await management.query(`CREATE SCHEMA ${schema}`);
  const url=new URL(env.databaseUrl);url.searchParams.set('options','-c search_path='+schema);
  const db=new pg.Pool({connectionString:url.href});
  const temp=await mkdtemp(join(tmpdir(),'zet-migration-'));const file=join(temp,'old.sqlite');
  const legacy=new DatabaseSync(file);
  const legacySecret='legacy-fixture-secret';const secret='new-production-fixture-secret-at-least-32';
  const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',scryptSync(legacySecret,'topup-key',32),iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify({uid:'fixture-uid'}),'utf8'),cipher.final()]);
  const target=[iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64')).join('.');
  legacy.exec(`CREATE TABLE users(id,email,password_hash,role,tier,wallet_cents,created_at);
    CREATE TABLE games(id,slug,name,mode,image,active,platform);
    CREATE TABLE packages(id,game_id,name,nominal,active);
    CREATE TABLE prices(package_id,tier,customer_cents,ctv_cents);
    CREATE TABLE orders(id,code,customer_id,package_id,game_id,tier,price_cents,ctv_cents,target_json,payment_method,status,assigned_ctv_id,dispatched_ctv_ids,idempotency_key,created_at,updated_at);
    CREATE TABLE ledger(id,user_id,order_id,kind,amount_cents,reference,note,created_at);
    CREATE TABLE audit(id,actor_id,action,entity_id,metadata_json,created_at);
    CREATE TABLE oauth_identities(provider,subject,user_id,created_at);
    INSERT INTO users VALUES('user','fixture@gmail.com','unchanged','customer','standard',500000,'2026-01-01');
    INSERT INTO games VALUES('game','genshin-impact','Genshin Impact','uid','/game-images/genshin.webp',1,'mobile');
    INSERT INTO packages VALUES('package','game','60 Crystals','60',1);
    INSERT INTO prices VALUES('package','standard',20000,16000);
    INSERT INTO ledger VALUES('ledger','user','order','payment',-20000,'fixture-ledger',NULL,'2026-01-01');
    INSERT INTO audit VALUES('audit','user','fixture','order','{}','2026-01-01');
    INSERT INTO oauth_identities VALUES('google','stable-google-subject','user','2026-01-01');`);
  legacy.prepare("INSERT INTO orders VALUES('order','GPFIXTURE','user','package','game','standard',20000,16000,?,'direct','awaiting_payment',NULL,'[]',NULL,'2026-01-01','2026-01-01')").run(target);
  legacy.close();
  try{
    for(const name of (await readdir('backend/db/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.query(await readFile('backend/db/migrations/'+name,'utf8'));
    const childEnv={...process.env,DATABASE_URL:url.href,SESSION_SECRET:secret,LEGACY_DB:file,LEGACY_SESSION_SECRET:'rotated-key-after-old-orders',LEGACY_FALLBACK_SESSION_SECRET:legacySecret,LEGACY_MONEY_UNIT:'vnd'};
    const run=()=>spawnSync(process.execPath,['scripts/import-legacy.mjs'],{env:childEnv,encoding:'utf8'});
    const imported=run();assert.equal(imported.status,0,imported.stderr);
    assert.equal(Number((await db.query('SELECT wallet_cents FROM users')).rows[0].wallet_cents),50000000);
    assert.equal(Number((await db.query('SELECT customer_cents FROM prices')).rows[0].customer_cents),2000000);
    assert.equal(Number((await db.query('SELECT amount_cents FROM ledger')).rows[0].amount_cents),-2000000);
    assert.equal((await db.query('SELECT category_id FROM games')).rows[0].category_id,'category-uid');
    assert.equal((await db.query('SELECT subject FROM oauth_identities')).rows[0].subject,'stable-google-subject');
    const order=(await db.query('SELECT * FROM orders')).rows[0];assert.equal(Number(order.price_cents),2000000);assert.equal(order.idempotency_key,'legacy:order');
    const [newIv,tag,body]=order.target_encrypted.split('.').map(s=>Buffer.from(s,'base64url'));
    const decipher=createDecipheriv('aes-256-gcm',createHash('sha256').update(secret).digest(),newIv);decipher.setAuthTag(tag);
    assert.deepEqual(JSON.parse(Buffer.concat([decipher.update(body),decipher.final()]).toString()),{uid:'fixture-uid'});
    assert.notEqual(run().status,0);
  }finally{
    await db.end();assert.match(schema,/^import_test_[a-f0-9]{32}$/);await management.query(`DROP SCHEMA ${schema} CASCADE`);await management.end();
    assert.equal(dirname(resolve(temp)),resolve(tmpdir()));assert.ok(basename(temp).startsWith('zet-migration-'));await rm(temp,{recursive:true,force:true});
  }
});
