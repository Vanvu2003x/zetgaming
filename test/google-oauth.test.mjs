import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createGoogleOAuthRouter, validateGoogleClaims } from '../backend/modules/auth/google-oauth.mjs';
import { createFrontend } from '../server.mjs';

test('Google claims require verified email, subject and the original nonce', () => {
  const claims={sub:'google-subject',email:'User@gmail.com',email_verified:true,nonce:'expected'};
  assert.equal(validateGoogleClaims(claims,'expected').email,'user@gmail.com');
  for(const bad of [{...claims,email_verified:false},{...claims,nonce:'other'},{...claims,sub:''}])assert.throws(()=>validateGoogleClaims(bad,'expected'));
  assert.equal(validateGoogleClaims({...claims,email:'person@other.example'},'expected').authoritativeEmail,false);
});

test('storefront proxy preserves OAuth redirects and session cookies instead of returning JSON',async()=>{
  const backend=express();
  backend.get('/api/auth/oauth/google',(_req,res)=>res.cookie('google_flow','fixture',{httpOnly:true,sameSite:'lax'}).redirect(302,'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture'));
  backend.get('/api/auth/oauth/google/callback',(_req,res)=>res.cookie('session','signed-in',{httpOnly:true}).redirect(303,'/tai-khoan'));
  const api=backend.listen(0,'127.0.0.1');await new Promise(resolve=>api.once('listening',resolve));
  const front=createFrontend({backendUrl:'http://127.0.0.1:'+api.address().port}).listen(0,'127.0.0.1');await new Promise(resolve=>front.once('listening',resolve));
  const base='http://127.0.0.1:'+front.address().port;
  try{
    const start=await fetch(base+'/api/auth/oauth/google?next=%2Ftai-khoan',{redirect:'manual'});
    assert.equal(start.status,302);assert.match(start.headers.get('location'),/^https:\/\/accounts.google.com\//);
    assert.ok(start.headers.getSetCookie().some(c=>c.startsWith('google_flow=')));
    const callback=await fetch(base+'/api/auth/oauth/google/callback?state=fixture&code=fixture',{redirect:'manual'});
    assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),'/tai-khoan');
    assert.ok(callback.headers.getSetCookie().some(c=>c.startsWith('session=signed-in;')));
  }finally{await Promise.all([new Promise(resolve=>front.close(resolve)),new Promise(resolve=>api.close(resolve))]);}
});

test('OAuth round trip binds the browser, consumes state once and issues a session only after validation', async () => {
  const attempts=new Map();let signIns=0,exchanges=0;
  const store={
    saveAttempt:async(_db,row)=>attempts.set(row.state_hash,row),
    consumeAttempt:async(_db,state,browser)=>{const row=attempts.get(state);if(!row||row.browser_hash!==browser)return null;attempts.delete(state);return row;},
    signIn:async(_db,identity)=>{assert.equal(identity.subject,'sub-123');signIns++;return {raw:'session-fixture'};},
  };
  const app=express();app.use(cookieParser());
  app.use('/api/auth/oauth/google',createGoogleOAuthRouter({config:{clientId:'fixture',clientSecret:'private',callbackUrl:'http://localhost:4173/api/auth/oauth/google/callback'},store,sessionName:'session',cookieOptions:{httpOnly:true,secure:false,sameSite:'lax',path:'/'},exchange:async(_config,code,attempt)=>{exchanges++;assert.equal(code,'valid-code');return {sub:'sub-123',email:'member@gmail.com',email_verified:true,nonce:attempt.nonce};}}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const start=await fetch(base+'/api/auth/oauth/google?next=%2Fnap-game%2Fgenshin-impact',{redirect:'manual'});
    const auth=new URL(start.headers.get('location'));
    assert.equal(auth.origin,'https://accounts.google.com');
    assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
    assert.ok(auth.searchParams.get('nonce'));
    assert.equal(auth.searchParams.get('redirect_uri'),'http://localhost:4173/api/auth/oauth/google/callback');
    assert.ok(!auth.href.includes('private'));
    const cookie=start.headers.getSetCookie().find(x=>x.startsWith('google_flow=')).split(';')[0];
    const callback=base+'/api/auth/oauth/google/callback?code=valid-code&state='+auth.searchParams.get('state');
    const wrong=await fetch(callback,{redirect:'manual'});
    assert.match(wrong.headers.get('location'),/oauth_error=invalid_state/);assert.equal(exchanges,0);
    const complete=await fetch(callback,{headers:{cookie},redirect:'manual'});
    assert.equal(complete.headers.get('location'),'/nap-game/genshin-impact');
    assert.ok(complete.headers.getSetCookie().some(x=>x.startsWith('session=session-fixture;')&&x.includes('HttpOnly')));
    assert.equal(signIns,1);
    const replay=await fetch(callback,{headers:{cookie},redirect:'manual'});
    assert.match(replay.headers.get('location'),/oauth_error=invalid_state/);assert.equal(signIns,1);
    const deniedStart=await fetch(base+'/api/auth/oauth/google?next=https://evil.example',{redirect:'manual'});
    const deniedState=new URL(deniedStart.headers.get('location')).searchParams.get('state');
    const deniedCookie=deniedStart.headers.getSetCookie().find(x=>x.startsWith('google_flow=')).split(';')[0];
    const denied=await fetch(base+'/api/auth/oauth/google/callback?error=access_denied&state='+deniedState,{headers:{cookie:deniedCookie},redirect:'manual'});
    assert.match(denied.headers.get('location'),/oauth_error=cancelled/);assert.equal(signIns,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
