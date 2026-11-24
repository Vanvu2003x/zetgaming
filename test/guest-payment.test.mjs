import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { env } from '../backend/config/env.mjs';
import { pool } from '../backend/db/pool.mjs';
import { createApp } from '../backend/app.mjs';
import { createFrontend } from '../server.mjs';
import { hash } from '../backend/utils/ids.mjs';
import { bankPayment } from '../backend/modules/orders/payment.mjs';

test('bank QR uses server-side cents converted to VND, fixed merchant account and order reference', () => {
  const bank = { bin:'970422', label:'MB Bank', account:'0966335561', name:'NGUYEN THANH DUNG' };
  const payment = bankPayment({code:'GPTEST123',price_cents:2000000,payment_method:'direct',status:'awaiting_payment'}, bank);
  const url = new URL(payment.qr_url);
  assert.equal(url.searchParams.get('amount'),'20000');
  assert.equal(url.searchParams.get('addInfo'),'zetGPTEST123zet');
  assert.equal(url.pathname,'/image/970422-0966335561-compact2.png');
  assert.equal(bankPayment({code:'GPTEST123',price_cents:2000000,payment_method:'direct',status:'completed'},bank),null);
  assert.equal(bankPayment({code:'GPTEST123',price_cents:1,payment_method:'direct',status:'awaiting_payment'},bank),null);
});

test('guest checkout creates a private pending order and QR without login; only admin can confirm payment', {timeout:30000}, async () => {
  const schema='guest_test_'+randomUUID().replaceAll('-','');
  const management=new pg.Pool({connectionString:env.databaseUrl});
  await management.query(`CREATE SCHEMA ${schema}`);
  pool.options.options='-c search_path='+schema;
  Object.assign(env.bank,{bin:'970422',label:'MB Bank',account:'0966335561',name:'NGUYEN THANH DUNG'});
  let apiServer,frontServer;
  try {
    for(const file of (await readdir(new URL('../backend/db/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) await pool.query(await readFile(new URL('../backend/db/migrations/'+file,import.meta.url),'utf8'));
    await pool.query("INSERT INTO games(id,slug,name,mode,image) VALUES('g','guest-fixture','Fixture Game','uid','/fixture.png')");
    await pool.query("INSERT INTO packages(id,game_id,name,nominal) VALUES('p','g','Fixture Package','60')");
    await pool.query("INSERT INTO prices(package_id,tier,customer_cents,ctv_cents) VALUES('p','standard',2000000,1800000)");
    await pool.query("INSERT INTO users(id,email,password_hash,role) VALUES('a','admin@fixture.invalid','unused','admin'),('u','user@fixture.invalid','unused','customer')");
    const adminToken=randomBytes(32).toString('hex');
    await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,'a',now()+interval '1 hour')",[hash(adminToken)]);
    apiServer=await new Promise(resolve=>{const s=createApp().listen(0,'127.0.0.1',()=>resolve(s));});
    frontServer=await new Promise(resolve=>{const s=createFrontend({backendUrl:'http://127.0.0.1:'+apiServer.address().port}).listen(0,'127.0.0.1',()=>resolve(s));});
    const base='http://127.0.0.1:'+frontServer.address().port;
    env.allowedOrigins.push(base);
    function browser(initial={}) {
      const jar=new Map(Object.entries(initial)); let csrf='';
      return {async request(path,options={}) {
        const response=await fetch(base+path,{...options,redirect:'manual',headers:{cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(options.body?{'content-type':'application/json','x-csrf-token':csrf}:{}),...options.headers}});
        for(const raw of response.headers.getSetCookie()){const pair=raw.split(';')[0];const cut=pair.indexOf('=');jar.set(pair.slice(0,cut),pair.slice(cut+1));}
        return response;
      },async start(){const response=await this.request('/nap-game/guest-fixture');const html=await response.text();assert.equal(response.status,200);assert.equal(response.headers.get('referrer-policy'),'same-origin');csrf=html.match(/name="csrf-token" content="([^"]+)"/)[1];return html;}};
    }
    const guest=browser();const guestHtml=await guest.start();
    const body={package_id:'p',target:{uid:'test-uid'},payment_method:'direct',price_cents:1};
    const create=()=>guest.request('/api/orders',{method:'POST',headers:{'idempotency-key':'same-key'},body:JSON.stringify(body)});
    const created=await create();assert.equal(created.status,201);const order=await created.json();assert.equal(order.status,'awaiting_payment');
    for (const duplicate of await Promise.all([create(),create()])) assert.equal((await duplicate.json()).code,order.code);
    const stored=(await pool.query('SELECT * FROM orders')).rows;assert.equal(stored.length,1);assert.equal(stored[0].customer_id,null);assert.equal(Number(stored[0].price_cents),2000000);assert.ok(stored[0].guest_token_hash);
    const details=await guest.request('/api/orders/'+order.code);assert.equal(details.status,200);assert.equal((await details.json()).payment.account,'0966335561');
    const page=await guest.request('/lich-su/'+order.code);const html=await page.text();assert.equal(page.status,200);assert.match(html,/Quét mã để thanh toán/);assert.match(html,/amount=20000/);assert.doesNotMatch(html,/Đăng nhập để xem/);
    const outsider=browser();await outsider.start();assert.equal((await outsider.request('/api/orders/'+order.code)).status,404);
    const publicDetails=(await (await outsider.request('/api/storefront?path=/lich-su/'+order.code)).json()).order;
    assert.deepEqual(Object.keys(publicDetails).sort(),['code','status','price_cents','payment_method','created_at','updated_at','package_name','game_name','payment'].sort());
    assert.equal(publicDetails.payment.account,'0966335561');
    const publicPage=await (await outsider.request('/lich-su/'+order.code)).text();
    assert.match(publicPage,/Quét mã để thanh toán/);assert.match(publicPage,/amount=20000/);
    assert.doesNotMatch(publicPage,/test-uid|admin@fixture.invalid|user@fixture.invalid/);
    const lookup=await (await outsider.request('/api/storefront?path=/lich-su&code='+order.code.toLowerCase())).json();
    assert.deepEqual(Object.keys(lookup.lookup).sort(),['code','status','price_cents','created_at','updated_at','package_name','game_name'].sort());
    assert.equal(lookup.lookup.code,order.code);assert.equal(lookup.lookup.status,'awaiting_payment');
    assert.equal(lookup.lookup.game_name,'Fixture Game');assert.equal(lookup.lookup.price_cents,2000000);
    const lookupPage=await (await outsider.request('/lich-su?code='+order.code)).text();
    assert.match(lookupPage,/Tra cứu đơn hàng/);assert.match(lookupPage,/Fixture Package/);assert.match(lookupPage,/name="code"/);
    assert.ok(lookupPage.includes('href="/lich-su/'+order.code+'"'));
    assert.match(lookupPage,/Xem chi tiết &amp; thanh toán/);
    assert.doesNotMatch(lookupPage,/Quét mã để thanh toán/);
    assert.equal((await outsider.request('/api/orders/'+order.code)).status,404);
    for(const code of ['GPDOESNOTEXIST123',"' OR 1=1 --",'<script>alert(1)</script>']) {
      const missing=await (await outsider.request('/api/storefront?path=/lich-su&code='+encodeURIComponent(code))).json();
      assert.equal(missing.lookup,null);
    }
    assert.match(await (await outsider.request('/lich-su?code=GPDOESNOTEXIST123')).text(),/Không tìm thấy đơn hàng/);
    assert.equal((await guest.request('/api/orders')).status,401);
    const wallet=await guest.request('/api/orders',{method:'POST',headers:{'idempotency-key':'wallet-key'},body:JSON.stringify({...body,payment_method:'wallet'})});assert.equal(wallet.status,401);
    const badCsrf=await guest.request('/api/orders',{method:'POST',headers:{'x-csrf-token':'invalid','idempotency-key':'csrf-key'},body:JSON.stringify(body)});assert.equal(badCsrf.status,403);
    assert.equal((await guest.request('/api/admin/orders/'+order.code+'/confirm-payment',{method:'POST',body:'{}'})).status,401);
    const formCsrf=guestHtml.match(/name="_csrf" value="([^"]+)"/)[1];
    const native=await guest.request('/dat-don',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-csrf-token':'',origin:base},body:new URLSearchParams({_csrf:formCsrf,package_id:'p',uid:'native-uid',payment_method:'direct',idempotency_key:'native-key',return_to:'/nap-game/guest-fixture'}).toString()});
    assert.equal(native.status,303);assert.match(native.headers.get('location'),/^\/lich-su\/GP/);
    assert.match(await (await guest.request(native.headers.get('location'))).text(),/Quét mã để thanh toán/);
    for(const origin of ['null','https://untrusted.invalid']) {
      const blocked=await guest.request('/api/orders',{method:'POST',headers:{origin},body:JSON.stringify(body)});
      assert.equal(blocked.status,403);
    }
    const admin=browser({session:adminToken});await admin.start();
    const list=await (await admin.request('/api/orders')).json();assert.equal(list[0].customer,'Khách vãng lai');
    const confirm=()=>admin.request('/api/admin/orders/'+order.code+'/confirm-payment',{method:'POST',body:'{}'});
    assert.equal((await confirm()).status,200);assert.equal((await confirm()).status,409);
    const paid=await (await guest.request('/api/orders/'+order.code)).json();assert.equal(paid.status,'pending_admin');assert.equal(paid.payment,null);
    const paidPublic=(await (await outsider.request('/api/storefront?path=/lich-su/'+order.code)).json()).order;
    assert.equal(paidPublic.status,'pending_admin');assert.equal(paidPublic.payment,null);
    assert.doesNotMatch(await (await outsider.request('/lich-su/'+order.code)).text(),/Quét mã để thanh toán/);
    assert.match(await (await outsider.request('/lich-su?code='+order.code)).text(),/>Xem chi tiết<\/a>/);
    assert.equal(Number((await pool.query("SELECT count(*) FROM audit_events WHERE action='order.payment_confirmed'")).rows[0].count),1);
    assert.equal(Number((await pool.query('SELECT count(*) FROM ledger')).rows[0].count),0);
  } finally {
    if(frontServer) await new Promise(resolve=>frontServer.close(resolve));
    if(apiServer) await new Promise(resolve=>apiServer.close(resolve));
    await pool.end();
    await management.query(`DROP SCHEMA ${schema} CASCADE`);await management.end();
  }
});
