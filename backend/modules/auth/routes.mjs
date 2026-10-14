import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hash, token, id } from '../../utils/ids.mjs';
import { hashPassword, verifyPassword } from '../../utils/password.mjs';
import { env } from '../../config/env.mjs';
import { sessionName, cookieOptions } from '../../config/cookies.mjs';
import { withTransaction } from '../../db/pool.mjs';
import { parse, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../../utils/validation.mjs';
import { availableProviders } from './oauth.mjs';
import { audit } from '../../utils/audit.mjs';

const scrypt = promisify(scryptCallback);
const dummyHash = await hashPassword(token());
const sessionCookie = { ...cookieOptions, maxAge: 86_400_000 };
const publicUser = user => ({ id:user.id,email:user.email,role:user.role,tier:user.tier,wallet_cents:Number(user.wallet_cents),created_at:user.created_at });
export const authRouter = Router();
const limited = limit => rateLimit({ windowMs:15*60_000,limit,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.'} });
const accountLimit = rateLimit({
  windowMs:15*60_000,limit:10,standardHeaders:'draft-7',legacyHeaders:false,
  keyGenerator:req=>hash(String(req.body?.email || '').trim().toLowerCase()),
  message:{error:'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.'},
});
async function passwordMatches(password, stored) {
  if (/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored || '')) {
    const [salt,digest] = stored.split(':');
    return timingSafeEqual(await scrypt(password,salt,64),Buffer.from(digest,'hex'));
  }
  return verifyPassword(password, stored || dummyHash);
}
async function createSession(client, userId, previous, remember=false) {
  if (previous) await client.query('DELETE FROM sessions WHERE token_hash=$1',[hash(previous)]);
  const raw=token();
  const maxAge=remember ? 7*86_400_000 : 86_400_000;
  await client.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+($3::int * interval \'1 second\'))',[hash(raw),userId,maxAge/1000]);
  return {raw,maxAge};
}
authRouter.post('/register', limited(5), async (req,res,next)=>{
  try {
    const input=parse(registerSchema,req.body);
    if(input.password_confirm!==input.password || ![true,'on','1'].includes(req.body.terms)) return res.status(400).json({error:'Vui lòng xác nhận mật khẩu và đồng ý điều khoản.'});
    const passwordHash=await hashPassword(input.password);
    const result=await withTransaction(async client=>{
      const user=(await client.query(`INSERT INTO users(id,email,password_hash,role,tier,wallet_cents) VALUES($1,$2,$3,'customer','standard',0) RETURNING *`,[id(),input.email.toLowerCase(),passwordHash])).rows[0];
      const session=await createSession(client,user.id,req.cookies[sessionName]);
      await audit(client,user.id,'auth.registered',user.id,{method:'password'});
      return {user,session};
    });
    res.status(201).cookie(sessionName,result.session.raw,sessionCookie).json({user:publicUser(result.user)});
  } catch(error) {
    if(error.code==='23505')return res.status(409).json({error:'Không thể tạo tài khoản với email này. Bạn có thể thử đăng nhập hoặc khôi phục mật khẩu.'});
    next(error);
  }
});
authRouter.post('/login',limited(10),accountLimit,async(req,res,next)=>{
  try{
    const input=parse(loginSchema,req.body);
    const user=(await req.db.query('SELECT * FROM users WHERE lower(email)=lower($1)',[input.email.toLowerCase()])).rows[0];
    const valid=await passwordMatches(input.password,user?.password_hash);
    if(!user || !valid){
      await audit(req.db,null,'auth.login.failed',null,{request_id:req.requestId});
      return res.status(401).json({error:'Email hoặc mật khẩu không đúng'});
    }
    const upgradedHash=user.password_hash.startsWith('$2') ? null : await hashPassword(input.password);
    const remember=[true,'1','on'].includes(req.body.remember);
    const session=await withTransaction(async client=>{
      if(upgradedHash)await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[upgradedHash,user.id]);
      const session=await createSession(client,user.id,req.cookies[sessionName],remember);
      await audit(client,user.id,'auth.login',user.id,{method:'password'});
      return session;
    });
    res.cookie(sessionName,session.raw,{...sessionCookie,maxAge:session.maxAge}).json({user:publicUser(user)});
  }catch(error){next(error);}
});
authRouter.post('/forgot-password',limited(5),async(req,res,next)=>{
  try {
    const {email}=parse(forgotPasswordSchema,req.body);
    if(env.nodeEnv==='production' || env.resetDelivery!=='local-outbox') return res.status(503).json({error:'Khôi phục mật khẩu qua email chưa được cấu hình.'});
    const user=(await req.db.query('SELECT id FROM users WHERE lower(email)=lower($1)',[email.toLowerCase()])).rows[0];
    if(user){
      const raw=token();
      await withTransaction(async client=>{
        await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1 OR expires_at<=now()',[user.id]);
        await client.query('INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'15 minutes\')',[hash(raw),user.id]);
        await audit(client,user.id,'auth.password_reset_requested',user.id);
      });
      const outbox=join(process.cwd(),'data','mail-outbox');
      await mkdir(outbox,{recursive:true});
      await writeFile(join(outbox,id()+'.json'),JSON.stringify({to:email.toLowerCase(),reset_url:new URL('/dat-lai-mat-khau?token='+raw,env.allowedOrigins[0]).href}),{mode:0o600,flag:'wx'});
    } else { await hashPassword(token()); }
    res.json({message:'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được tạo.'});
  } catch(error){next(error);}
});
authRouter.post('/reset-password',limited(5),async(req,res,next)=>{
  try{
    const input=parse(resetPasswordSchema,req.body);
    const passwordHash=await hashPassword(input.password);
    const changed=await withTransaction(async client=>{
      const reset=(await client.query('SELECT token_hash,user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[hash(input.token)])).rows[0];
      if(!reset)return false;
      await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[passwordHash,reset.user_id]);
      await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1',[reset.user_id]);
      await client.query('DELETE FROM sessions WHERE user_id=$1',[reset.user_id]);
      await audit(client,reset.user_id,'auth.password_reset',reset.user_id);
      return true;
    });
    if(!changed)return res.status(400).json({error:'Liên kết đã hết hạn hoặc không hợp lệ'});
    res.clearCookie(sessionName,cookieOptions).json({ok:true});
  }catch(error){next(error);}
});
authRouter.get('/providers',(_req,res)=>res.json({password:true,oauth:availableProviders()}));
authRouter.post('/logout',async(req,res,next)=>{
  try{
    if(req.cookies[sessionName])await req.db.query('DELETE FROM sessions WHERE token_hash=$1',[hash(req.cookies[sessionName])]);
    res.clearCookie(sessionName,cookieOptions).json({ok:true});
  }catch(error){next(error);}
});
authRouter.get('/me',(req,res)=>{
  if(!req.user)return res.status(401).json({error:'Vui lòng đăng nhập'});
  res.json(publicUser(req.user));
});
export { hashPassword };
