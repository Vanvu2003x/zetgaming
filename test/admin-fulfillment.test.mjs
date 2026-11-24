import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { env } from '../backend/config/env.mjs';
import { pool } from '../backend/db/pool.mjs';
import { createApp } from '../backend/app.mjs';
import { encryptJson } from '../backend/utils/crypto.mjs';
import { hash } from '../backend/utils/ids.mjs';

test('admins process paid orders directly without CTV, wallet side effects or public credential exposure', {timeout:30000}, async () => {
  const schema='fulfillment_'+randomUUID().replaceAll('-','');
  const management=new pg.Pool({connectionString:env.databaseUrl});
  await management.query(`CREATE SCHEMA ${schema}`);
  pool.options.options='-c search_path='+schema;
  let server;
  try {
    for(const file of (await readdir(new URL('../backend/db/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) await pool.query(await readFile(new URL('../backend/db/migrations/'+file,import.meta.url),'utf8'));
    await pool.query("INSERT INTO users(id,email,password_hash,role) VALUES('admin','admin@fixture.invalid','unused','admin'),('other','other@fixture.invalid','unused','admin'),('customer','customer@fixture.invalid','unused','customer'),('ctv','ctv@fixture.invalid','unused','ctv')");
    await pool.query("INSERT INTO games(id,slug,name,mode,image) VALUES('g','fixture','Fixture','login','/fixture.png')");
    await pool.query("INSERT INTO packages(id,game_id,name,nominal) VALUES('p','g','Fixture package','60')");
    const credentials={uid:'123456789',login:'player@example.invalid',password:'PRIVATE-GAME-PASSWORD',server:'Asia'};
    for(const [id,code,status,method] of [['o','GPADMINTEST123','awaiting_payment','direct'],['w','GPWALLETTEST123','pending_admin','wallet'],['c','GPCANCELTEST123','cancelled','direct']]) {
      await pool.query('INSERT INTO orders(id,code,customer_id,package_id,game_id,tier,price_cents,ctv_cents,target_encrypted,payment_method,status,idempotency_key,idempotency_payload_hash) VALUES($1,$2,\'customer\',\'p\',\'g\',\'standard\',2000000,1800000,$3,$4,$5,$1,\'fixture\')',[id,code,encryptJson(credentials),method,status]);
    }
    for(const user of ['admin','other','customer','ctv']) await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[hash(user+'-token'),user]);
    server=await new Promise(resolve=>{const s=createApp().listen(0,'127.0.0.1',()=>resolve(s));});
    const base='http://127.0.0.1:'+server.address().port;
    async function browser(user='') {
      const r=await fetch(base+'/api/csrf',{headers:user?{cookie:'session='+user+'-token'}:{}});const {csrf_token:csrf}=await r.json();
      const cookie=r.headers.getSetCookie().map(raw=>raw.split(';')[0]).concat(user?'session='+user+'-token':[]).join('; ');
      return (path,body,headers={})=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,'content-type':'application/json','x-csrf-token':csrf,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    }
    const admin=await browser('admin'),other=await browser('other'),customer=await browser('customer'),ctv=await browser('ctv'),guest=await browser();
    const detail='/api/admin/orders/GPADMINTEST123';
    assert.equal((await guest(detail)).status,401);
    assert.equal((await customer(detail)).status,403);
    assert.equal((await ctv(detail)).status,403);
    const privateResponse=await admin(detail);assert.equal(privateResponse.status,200);
    assert.match(privateResponse.headers.get('cache-control'),/no-store/);
    const privateOrder=await privateResponse.json();assert.deepEqual(privateOrder.target,credentials);
    assert.equal(privateOrder.target_encrypted,undefined);
    assert.doesNotMatch(await (await guest('/api/storefront?path=/lich-su/GPADMINTEST123')).text(),/PRIVATE-GAME-PASSWORD|player@example.invalid|123456789/);
    assert.doesNotMatch(await (await customer('/api/orders/GPADMINTEST123')).text(),/PRIVATE-GAME-PASSWORD|player@example.invalid|123456789/);
    assert.equal((await admin(detail+'/start',{})).status,409);
    assert.equal((await admin(detail+'/complete',{confirmed:true})).status,409);
    assert.equal((await guest(detail+'/start',{})).status,401);
    assert.equal((await customer(detail+'/start',{})).status,403);
    assert.equal((await ctv(detail+'/start',{})).status,403);
    assert.equal((await admin(detail+'/confirm-payment',{})).status,200);
    assert.equal((await admin(detail+'/start',{}, {'x-csrf-token':'invalid'})).status,403);
    const competing=await Promise.all([admin(detail+'/start',{}),other(detail+'/start',{})]);
    assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
    const owner=(await pool.query("SELECT processing_admin_id,status FROM orders WHERE id='o'")).rows[0];
    assert.equal(owner.status,'processing');
    const assigned=owner.processing_admin_id==='admin'?admin:other,unassigned=owner.processing_admin_id==='admin'?other:admin;
    assert.equal((await unassigned(detail+'/complete',{confirmed:true})).status,409);
    assert.equal((await assigned(detail+'/complete',{confirmed:false})).status,400);
    const completed=await Promise.all([assigned(detail+'/complete',{confirmed:true}),assigned(detail+'/complete',{confirmed:true})]);
    assert.deepEqual(completed.map(r=>r.status).sort(),[200,409]);
    const final=(await pool.query("SELECT * FROM orders WHERE id='o'")).rows[0];
    assert.equal(final.status,'completed');assert.ok(final.processing_started_at);assert.ok(final.completed_at);
    assert.equal(final.assigned_ctv_id,null);
    assert.equal((await admin('/api/admin/orders/GPWALLETTEST123/start',{})).status,200);
    assert.equal((await admin('/api/admin/orders/GPWALLETTEST123/complete',{confirmed:true})).status,200);
    assert.equal((await admin('/api/admin/orders/GPCANCELTEST123/start',{})).status,409);
    assert.equal((await admin('/api/admin/orders/GPUNKNOWN123/start',{})).status,404);
    assert.equal(Number((await pool.query('SELECT count(*) FROM ledger')).rows[0].count),0);
    assert.equal(Number((await pool.query('SELECT sum(wallet_cents) total FROM users')).rows[0].total),0);
    assert.equal(Number((await pool.query("SELECT count(*) FROM audit_events WHERE entity_id='o' AND action='order.admin_completed'")).rows[0].count),1);
    assert.doesNotMatch(JSON.stringify((await pool.query('SELECT metadata FROM audit_events')).rows),/PRIVATE-GAME-PASSWORD|player@example.invalid|123456789/);
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    await pool.end();await management.query(`DROP SCHEMA ${schema} CASCADE`);await management.end();
  }
});
