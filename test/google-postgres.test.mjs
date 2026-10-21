import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { env } from '../backend/config/env.mjs';
import { createPostgresGoogleStore } from '../backend/modules/auth/google-postgres-store.mjs';

test('PostgreSQL OAuth creates customers, preserves existing balances and never auto-links privileged accounts',async()=>{
  const schema='oauth_test_'+randomUUID().replaceAll('-','');
  const management=new pg.Pool({connectionString:env.databaseUrl});
  await management.query(`CREATE SCHEMA ${schema}`);
  const db=new pg.Pool({connectionString:env.databaseUrl,options:'-c search_path='+schema});
  const transaction=async work=>{const client=await db.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}};
  const store=createPostgresGoogleStore(transaction);
  try{
    for(const file of ['001_init.sql','007_google_oauth.sql'])await db.query(await readFile(new URL('../backend/db/migrations/'+file,import.meta.url),'utf8'));
    await db.query("INSERT INTO users(id,email,password_hash,role,tier,wallet_cents) VALUES('existing','existing@gmail.com','unchanged','customer','vip',12345),('admin','admin@gmail.com','unchanged','admin','standard',0)");
    await store.saveAttempt(db,{state_hash:'state',browser_hash:'browser',nonce:'nonce',code_verifier:'verifier',next_path:'/tai-khoan'});
    assert.equal(await store.consumeAttempt(db,'state','wrong'),null);
    assert.equal((await store.consumeAttempt(db,'state','browser')).nonce,'nonce');
    assert.equal(await store.consumeAttempt(db,'state','browser'),null);
    const identity={subject:'sub-existing',email:'existing@gmail.com',authoritativeEmail:true};
    const first=await store.signIn(db,identity);
    const second=await store.signIn(db,{...identity,email:'renamed@gmail.com'},first.raw);
    const existing=(await db.query("SELECT * FROM users WHERE id='existing'")).rows[0];
    assert.equal(existing.password_hash,'unchanged');assert.equal(existing.tier,'vip');assert.equal(Number(existing.wallet_cents),12345);
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM sessions')).rows[0].n,1);assert.notEqual(first.raw,second.raw);
    await assert.rejects(store.signIn(db,{subject:'sub-admin',email:'admin@gmail.com',authoritativeEmail:true}),{code:'OAUTH_LINK_REQUIRED'});
    await assert.rejects(store.signIn(db,{subject:'sub-unsafe',email:'existing@gmail.com',authoritativeEmail:false}),{code:'OAUTH_LINK_REQUIRED'});
    await store.signIn(db,{subject:'sub-new',email:'new@gmail.com',authoritativeEmail:true});
    const created=(await db.query("SELECT * FROM users WHERE email='new@gmail.com'")).rows[0];
    assert.equal(created.role,'customer');assert.equal(Number(created.wallet_cents),0);assert.match(created.password_hash,/^\$2/);
    await store.saveAttempt(db,{state_hash:'expired',browser_hash:'browser',nonce:'nonce',code_verifier:'verifier',next_path:'/'});
    await db.query("UPDATE oauth_login_attempts SET expires_at=now()-interval '1 second' WHERE state_hash='expired'");
    assert.equal(await store.consumeAttempt(db,'expired','browser'),null);
  }finally{
    await db.end();
    assert.match(schema,/^oauth_test_[a-f0-9]{32}$/);
    await management.query(`DROP SCHEMA ${schema} CASCADE`);await management.end();
  }
});
