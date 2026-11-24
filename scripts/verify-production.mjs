import assert from 'node:assert/strict';
import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const base=process.env.VERIFY_BASE_URL||'http://127.0.0.1:4273';
const admin=process.env.VERIFY_ADMIN_URL||'http://127.0.0.1:4174';
const credentials=JSON.parse(await readFile(process.env.ROTATED_CREDENTIALS_FILE,'utf8'));
const cookies=new Map();
const request=async(origin,path,options={})=>{
  const response=await fetch(origin+path,{...options,redirect:'manual',headers:{...(cookies.size?{cookie:[...cookies].map(([key,value])=>key+'='+value).join('; ')}:{}),...options.headers},signal:AbortSignal.timeout(15000)});
  for(const item of response.headers.getSetCookie()){
    const pair=item.split(';')[0],position=pair.indexOf('=');cookies.set(pair.slice(0,position),pair.slice(position+1));
  }
  return response;
};
for(const path of ['/','/nap-game','/nap-game/genshin-impact','/dang-nhap','/dang-ky','/quen-mat-khau','/chinh-sach-bao-mat','/dieu-khoan-dich-vu']){
  const response=await request(base,path);assert.equal(response.status,200,'Page '+path);
  const html=await response.text();assert.equal((html.match(/<h1\b/g)||[]).length,1,'Heading '+path);
}
const home=await(await request(base,'/')).text();assert.match(home,/zetgaming-hero-soul-land-v4.png/);
const login=await(await request(admin,'/login')).text();
const csrf=login.match(/name="_csrf" value="([^"]+)"/)?.[1];assert.ok(csrf);
const signedIn=await request(admin,'/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:process.env.ADMIN_ORIGIN},body:new URLSearchParams({_csrf:csrf,email:'admin@example.com',password:credentials['admin@example.com']})});
assert.equal(signedIn.status,303);assert.equal(signedIn.headers.get('location'),'/');
let adminToken;
for(const path of ['/','/games','/packages','/categories','/orders','/ctvs']){
  const response=await request(admin,path);assert.equal(response.status,200,'Admin '+path);
  const html=await response.text();assert.match(html,/admin-shell/);adminToken=html.match(/name="csrf-token" content="([^"]+)"/)?.[1]||adminToken;
}
assert.ok(adminToken);
const games=await(await request(admin,'/api/admin/games')).json();assert.ok(games.length>0);
const png=await readFile('public/zetgaming-oauth-logo-120.png');
const uploaded=await request(admin,'/api/admin/uploads',{method:'POST',headers:{'content-type':'image/png','x-csrf-token':adminToken,origin:process.env.ADMIN_ORIGIN},body:png});
assert.equal(uploaded.status,201);const {url}=await uploaded.json();assert.match(url,/^\/uploads\/games\/[a-f0-9-]+\.png$/);
try{
  for(const origin of [base,admin]){
    const response=await request(origin,url);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
  }
}finally{const path=resolve('public',url.slice(1));assert.ok(path.startsWith(resolve('public/uploads/games')+'/'));await unlink(path);}
const start=await request(base,'/api/auth/oauth/google');assert.equal(start.status,302);
assert.equal(new URL(start.headers.get('location')).searchParams.get('redirect_uri'),'https://zetgaming.vanvucoder.id.vn/api/auth/oauth/google/callback');
const logout=await request(admin,'/logout',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:process.env.ADMIN_ORIGIN},body:new URLSearchParams({_csrf:adminToken})});
assert.equal(logout.status,303);assert.equal((await request(base,'/api/me')).status,401);
console.log(JSON.stringify({storefront_pages:8,admin_pages:6,game_count:games.length,admin_login:true,shared_upload_read:true,oauth_redirect:true,logout:true}));
