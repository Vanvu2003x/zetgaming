import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteGoogleStore } from '../backend/modules/auth/google-sqlite-store.mjs';

test('production adapter preserves wallet/role, maps stable subject, and refuses unsafe email linking',async()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,role TEXT,tier TEXT,wallet_cents INTEGER,created_at TEXT);
    CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);
    CREATE TABLE audit(id TEXT,actor_id TEXT,action TEXT,entity_id TEXT,metadata_json TEXT,created_at TEXT);
    INSERT INTO users VALUES('customer','existing@gmail.com','unchanged','customer','vip',12345,'2026-01-01');
    INSERT INTO users VALUES('admin','admin@gmail.com','unchanged','admin','standard',0,'2026-01-01');`);
  const store=createSqliteGoogleStore(db);
  try{
    await store.saveAttempt(null,{state_hash:'state',browser_hash:'browser',nonce:'nonce',code_verifier:'verifier',next_path:'/tai-khoan'});
    assert.equal(await store.consumeAttempt(null,'state','wrong'),null);
    assert.equal((await store.consumeAttempt(null,'state','browser')).nonce,'nonce');
    assert.equal(await store.consumeAttempt(null,'state','browser'),null);
    const identity={subject:'stable-sub',email:'existing@gmail.com',authoritativeEmail:true};
    const first=await store.signIn(null,identity);
    assert.equal(db.prepare('SELECT wallet_cents FROM users WHERE id=?').get('customer').wallet_cents,12345);
    assert.equal(db.prepare('SELECT tier FROM users WHERE id=?').get('customer').tier,'vip');
    const repeat=await store.signIn(null,{...identity,email:'changed@gmail.com'},first.raw);
    assert.equal(db.prepare('SELECT user_id FROM sessions WHERE token=?').get(repeat.raw).user_id,'customer');
    assert.equal(db.prepare('SELECT 1 FROM sessions WHERE token=?').get(first.raw),undefined);
    await assert.rejects(store.signIn(null,{subject:'admin-sub',email:'admin@gmail.com',authoritativeEmail:true}),{code:'OAUTH_LINK_REQUIRED'});
    await assert.rejects(store.signIn(null,{subject:'unsafe-sub',email:'existing@gmail.com',authoritativeEmail:false}),{code:'OAUTH_LINK_REQUIRED'});
    await store.signIn(null,{subject:'new-sub',email:'new@gmail.com',authoritativeEmail:true});
    const created=db.prepare('SELECT * FROM users WHERE email=?').get('new@gmail.com');
    assert.equal(created.role,'customer');assert.equal(created.wallet_cents,0);
    assert.ok(created.password_hash.length>100);
  }finally{db.close();}
});
