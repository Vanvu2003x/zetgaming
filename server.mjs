import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderStorefront } from './storefront/render.mjs';
import { safeNext } from './storefront/shared.mjs';
import { adminCatalogPage } from './storefront/admin-pages.mjs';

const ROOT=dirname(fileURLToPath(import.meta.url));
const production=process.env.NODE_ENV==='production';
const formRoutes={
  '/dang-nhap':'/api/auth/login','/dang-ky':'/api/auth/register',
  '/quen-mat-khau':'/api/auth/forgot-password','/dat-lai-mat-khau':'/api/auth/reset-password',
  '/dang-xuat':'/api/auth/logout','/dat-don':'/api/orders',
};
export function createFrontend({backendUrl=process.env.BACKEND_URL || 'http://127.0.0.1:4180'}={}) {
  const app=express();
  app.disable('x-powered-by');
  app.set('trust proxy',production ? 'loopback' : false);
  app.use(helmet({
    contentSecurityPolicy:{directives:{
      defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],
      imgSrc:["'self'",'https:','data:'],fontSrc:["'self'"],connectSrc:["'self'"],
      objectSrc:["'none'"],baseUri:["'self'"],formAction:["'self'"],frameAncestors:["'none'"],
      upgradeInsecureRequests:production ? [] : null,
    }},
    strictTransportSecurity:production ? {maxAge:31536000,includeSubDomains:true} : false,
    referrerPolicy:{policy:'no-referrer'},
  }));
  app.use(express.json({limit:'64kb'}));
  app.use(express.urlencoded({extended:false,limit:'64kb'}));
  const backend=async(req,res,path,body)=>{
    const headers={accept:'application/json'};
    if(req.headers.cookie)headers.cookie=req.headers.cookie;
    for(const name of ['origin','sec-fetch-site','x-csrf-token','idempotency-key'])if(req.headers[name])headers[name]=req.headers[name];
    headers['x-forwarded-for']=req.ip;
    if(body!==undefined)headers['content-type']='application/json';
    const response=await fetch(new URL(path,backendUrl),{
      method:body===undefined ? 'GET' : req.method,headers,
      body:body===undefined ? undefined : JSON.stringify(body),
      signal:AbortSignal.timeout(10000),redirect:'manual',
    });
    const cookies=response.headers.getSetCookie();
    if(cookies.length)res.append('Set-Cookie',cookies);
    for(const name of ['retry-after','ratelimit','ratelimit-policy'])if(response.headers.has(name))res.set(name,response.headers.get(name));
    return response;
  };
  app.use('/api',async(req,res,next)=>{
    try{
      const path=req.originalUrl==='/api/me' ? '/api/auth/me' : req.originalUrl;
      const response=await backend(req,res,path,['GET','HEAD'].includes(req.method) ? undefined : req.body);
      res.status(response.status).set('Cache-Control','no-store').type('json').send(await response.text());
    }catch(error){next(error);}
  });
  app.post(Object.keys(formRoutes),async(req,res,next)=>{
    try{
      const body={...req.body};
      if(req.path==='/dat-don')body.target={uid:body.uid||'',login:body.login||''};
      const response=await backend(req,res,formRoutes[req.path],body);
      const result=await response.json();
      res.set('Cache-Control','no-store');
      if(!response.ok){
        if(req.path==='/dat-don' && response.status===401)return res.redirect(303,'/dang-nhap?next='+encodeURIComponent(safeNext(body.return_to,'/nap-game')));
        const destination=new URL(req.path==='/dat-don' ? safeNext(body.return_to,'/nap-game') : req.path,'http://localhost');
        destination.searchParams.set('error',req.path==='/dang-nhap' ? '1' : (result.error || 'Có lỗi xảy ra. Vui lòng thử lại.'));
        if(req.path==='/dang-nhap')destination.searchParams.set('next',safeNext(body.next));
        if(req.path==='/dat-lai-mat-khau')destination.searchParams.set('token',String(body.token || '').slice(0,200));
        return res.redirect(303,destination.pathname+destination.search);
      }
      if(req.path==='/dang-nhap'||req.path==='/dang-ky')return res.redirect(303,safeNext(body.next));
      if(req.path==='/dang-xuat')return res.redirect(303,'/');
      if(req.path==='/quen-mat-khau')return res.redirect(303,'/quen-mat-khau?sent=1');
      if(req.path==='/dat-lai-mat-khau')return res.redirect(303,'/dat-lai-mat-khau?success=1');
      return res.redirect(303,'/lich-su/'+encodeURIComponent(result.code));
    }catch(error){next(error);}
  });
  app.get('/admin', async (req, res, next) => {
    try {
      const response = await backend(req, res, '/api/admin/games');
      if (response.status === 401) return res.redirect(303, '/dang-nhap?next=%2Fadmin');
      if (response.status === 403) return res.status(403).send('Bạn không có quyền truy cập khu vực quản trị.');
      const games = await response.json();
      const csrfResponse = await backend(req, res, '/api/storefront?path=%2F&status=all');
      const csrfData = await csrfResponse.json();
      const layout = await readFile(join(ROOT, 'views', 'layout.html'), 'utf8');
      const values = { content: adminCatalogPage(games, csrfData.csrf_token), title: 'Quản trị kho game', description: 'Cấu hình game và gói nạp ZetGaming.', page: 'admin', year: new Date().getFullYear(), csrfToken: csrfData.csrf_token, authenticated: 'true', accountHref: '/admin', accountLabel: 'Quản trị', mobileName: 'Quản trị', accountAccessible: 'Khu vực quản trị', authBackHref: '/', authBackLabel: 'Về trang chủ' };
      const html = layout.replace(/{{(\w+)}}/g, (_, key) => values[key] ?? '').replace('</body>', '<script type="module" src="/admin.js?v=admin-1"></script></body>');
      res.type('html').send(html);
    } catch (error) { next(error); }
  });
  app.get('/styles.css',(_req,res)=>res.sendFile(join(ROOT,'public','storefront.css')));
  app.use(express.static(join(ROOT,'public'),{index:false,dotfiles:'deny',maxAge:0}));
  app.use(async(req,res,next)=>{
    if(!['GET','HEAD'].includes(req.method))return res.status(404).json({error:'Không tìm thấy đường dẫn'});
    try{
      const url=new URL(req.originalUrl,'http://localhost');
      const query=new URLSearchParams({path:url.pathname,status:url.searchParams.get('status')||'all'});
      const response=await backend(req,res,'/api/storefront?'+query);
      if(!response.ok)throw new Error('Backend unavailable');
      const data=await response.json();
      const page=renderStorefront({url,user:data.user,data,csrfToken:data.csrf_token,layout:await readFile(join(ROOT,'views','layout.html'),'utf8')});
      if(page.redirect)return res.redirect(page.status,page.redirect);
      res.status(page.status).set('Cache-Control','private, no-store').type('html').send(page.html);
    }catch(error){next(error);}
  });
  app.use((error,_req,res,_next)=>{
    const status=error.type==='entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 503;
    console.error(JSON.stringify({event:'frontend.error',status}));
    if(!res.headersSent)res.status(status).set('Cache-Control','no-store').json({error:status===413 ? 'Request quá lớn' : status===400 ? 'Dữ liệu không hợp lệ' : 'Dịch vụ tạm thời chưa sẵn sàng. Vui lòng thử lại sau.'});
  });
  return app;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]){
  const server=createFrontend().listen(Number(process.env.PORT || 4173),'127.0.0.1',()=>console.log(`Topup app listening at http://localhost:${server.address().port}`));
}
