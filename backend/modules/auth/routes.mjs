import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { hash, token, id } from '../../utils/ids.mjs';
import { hashPassword, verifyPassword } from '../../utils/password.mjs';
import { env } from '../../config/env.mjs';
import { sessionName, cookieOptions } from '../../config/cookies.mjs';
import { withTransaction } from '../../db/pool.mjs';
import { parse, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../../utils/validation.mjs';
import { availableProviders } from './oauth.mjs';
import { audit } from '../../utils/audit.mjs';
import { createSession } from './sessions.mjs';
import { requireAuth } from '../../middleware/auth.mjs';
import { createGoogleOAuthRouter } from './google-oauth.mjs';
import { postgresGoogleStore } from './google-postgres-store.mjs';
import { deliverEmail } from './email-delivery.mjs';
import { passwordResetEmailHtml } from '../notifications/email-templates.mjs';
import { verifyTotp } from './totp.mjs';
import { decryptJson } from '../../utils/crypto.mjs';

const scrypt = promisify(scryptCallback);
const dummyHash = await hashPassword(token());
const sessionCookie = { ...cookieOptions, maxAge: 86_400_000 };
const publicUser = user => ({ id:user.id,email:user.email,role:user.role,tier:user.tier,wallet_cents:Number(user.wallet_cents),email_verified: Boolean(user.email_verified_at),created_at:user.created_at });
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
authRouter.use('/oauth/google', createGoogleOAuthRouter({ config: env.oauth.google, store: postgresGoogleStore, sessionName, cookieOptions }));
authRouter.post('/register', limited(5), async (req,res,next)=>{
  try {
    const input=parse(registerSchema,req.body);
    if(input.password_confirm!==input.password || ![true,'on','1'].includes(req.body.terms)) return res.status(400).json({error:'Vui lòng xác nhận mật khẩu và đồng ý điều khoản.'});
    const passwordHash=await hashPassword(input.password);
    const result=await withTransaction(async client=>{
      const user=(await client.query(`INSERT INTO users(id,email,password_hash,role,tier,wallet_cents) VALUES($1,$2,$3,'customer','standard',0) RETURNING *`,[id(),input.email.toLowerCase(),passwordHash])).rows[0];
      const session=await createSession(client,user.id,req.cookies[sessionName]);
      const verificationRaw = env.emailVerificationRequired ? token() : null;
      if (verificationRaw) await client.query('INSERT INTO email_verification_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'24 hours\')', [hash(verificationRaw), user.id]);
      await audit(client,user.id,'auth.registered',user.id,{method:'password'});
      return {user,session,verificationRaw};
    });
    if (result.verificationRaw) {
      const verificationUrl = new URL('/api/auth/verify-email?token=' + encodeURIComponent(result.verificationRaw), env.frontendOrigin).href;
      try { await deliverEmail({ to: result.user.email, subject: 'Xác thực email ZetGaming', text: `Mở liên kết để xác thực email: ${verificationUrl}` }); } catch (error) { await audit(req.db, result.user.id, 'auth.email_verification_delivery_failed', result.user.id, { reason: error.message }); }
    }
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
    if (user.active === false) return res.status(403).json({ error: 'Tài khoản đang bị khóa. Vui lòng liên hệ hỗ trợ.' });
    if (user.role === 'admin' && user.totp_enabled) {
      let secret = null; try { secret = decryptJson(user.totp_secret_encrypted).secret; } catch { secret = null; }
      if (!secret || !verifyTotp(secret, req.body.otp)) return res.status(401).json({ error: 'Tài khoản admin yêu cầu mã xác thực 2FA.' });
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
    if(env.emailDelivery==='disabled' || (env.emailDelivery==='webhook' && !env.emailWebhookUrl)) return res.status(503).json({error:'Khôi phục mật khẩu qua email chưa được cấu hình.'});
    const user=(await req.db.query('SELECT id FROM users WHERE lower(email)=lower($1)',[email.toLowerCase()])).rows[0];
    if(user){
      const raw=token();
      await withTransaction(async client=>{
        await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1 OR expires_at<=now()',[user.id]);
        await client.query('INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'15 minutes\')',[hash(raw),user.id]);
        await audit(client,user.id,'auth.password_reset_requested',user.id);
      });
      const resetUrl = new URL('/dat-lai-mat-khau?token='+raw,env.frontendOrigin).href;
      await deliverEmail({ to: email.toLowerCase(), subject: 'ZetGaming · Đặt lại mật khẩu', text: `Mở liên kết để đặt lại mật khẩu: ${resetUrl}`, html: passwordResetEmailHtml(resetUrl) });
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
async function verifyEmailToken(raw, db) {
  return withTransaction(async client => {
    const row = (await client.query('SELECT token_hash,user_id FROM email_verification_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE', [hash(raw)])).rows[0];
    if (!row) return null;
    await client.query('UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$1', [row.user_id]);
    await client.query('UPDATE email_verification_tokens SET used_at=now() WHERE token_hash=$1', [row.token_hash]);
    await audit(client, row.user_id, 'auth.email_verified', row.user_id);
    return row.user_id;
  });
}
authRouter.get('/verify-email', limited(10), async (req, res, next) => {
  try {
    const raw = String(req.query?.token || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(raw)) return res.status(400).json({ error: 'Liên kết xác thực không hợp lệ.' });
    const changed = await verifyEmailToken(raw, req.db);
    if (!changed) return res.status(400).json({ error: 'Liên kết đã hết hạn hoặc không hợp lệ.' });
    res.json({ ok: true, message: 'Email đã được xác thực.' });
  } catch (error) { next(error); }
});
authRouter.post('/verify-email', limited(10), async (req, res, next) => {
  try {
    const raw = String(req.body?.token || '').trim();
    if (!/^[a-f0-9]{32,128}$/i.test(raw)) return res.status(400).json({ error: 'Liên kết xác thực không hợp lệ.' });
    const changed = await verifyEmailToken(raw, req.db);
    if (!changed) return res.status(400).json({ error: 'Liên kết đã hết hạn hoặc không hợp lệ.' });
    res.json({ ok: true });
  } catch (error) { next(error); }
});
authRouter.post('/resend-verification', requireAuth, limited(3), async (req, res, next) => {
  try {
    if (req.user.email_verified_at) return res.json({ ok: true, message: 'Email đã được xác thực.' });
    const raw = token();
    await req.db.query('DELETE FROM email_verification_tokens WHERE user_id=$1 OR expires_at<=now()', [req.user.id]);
    await req.db.query('INSERT INTO email_verification_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'24 hours\')', [hash(raw), req.user.id]);
    const url = new URL('/api/auth/verify-email?token=' + encodeURIComponent(raw), env.frontendOrigin).href;
    await deliverEmail({ to: req.user.email, subject: 'Xác thực email ZetGaming', text: `Mở liên kết để xác thực email: ${url}` });
    res.json({ ok: true, message: 'Đã tạo yêu cầu xác thực email.' });
  } catch (error) { next(error); }
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
authRouter.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const current = hash(req.cookies[sessionName]);
    const { rows } = await req.db.query('SELECT token_hash,created_at,expires_at FROM sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC', [req.user.id]);
    res.set('Cache-Control', 'no-store').json(rows.map(row => ({ current: row.token_hash === current, created_at: row.created_at, expires_at: row.expires_at })));
  } catch (error) { next(error); }
});
authRouter.post('/sessions/revoke-others', requireAuth, async (req, res, next) => {
  try {
    const result = await req.db.query('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2', [req.user.id, hash(req.cookies[sessionName])]);
    await audit(req.db, req.user.id, 'auth.sessions_revoked', req.user.id, { count: result.rowCount });
    res.json({ revoked: result.rowCount });
  } catch (error) { next(error); }
});
export { hashPassword };
