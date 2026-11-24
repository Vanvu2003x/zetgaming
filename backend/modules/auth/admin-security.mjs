import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import QRCode from 'qrcode';
import { z } from 'zod';
import { requireCsrf } from '../../middleware/csrf.mjs';
import { requireRole } from '../../middleware/auth.mjs';
import { parse } from '../../utils/validation.mjs';
import { encryptJson, decryptJson } from '../../utils/crypto.mjs';
import { audit } from '../../utils/audit.mjs';
import { generateTotpSecret, verifyTotp, otpauthUrl } from './totp.mjs';
import { passwordMatches, hashPassword } from './routes.mjs';
import { withTransaction } from '../../db/pool.mjs';
import { hash } from '../../utils/ids.mjs';
import { sessionName } from '../../config/cookies.mjs';

const currentPassword = z.string().min(1).max(200);
const codeSchema = z.object({ secret: z.string().regex(/^[A-Z2-7]{32}$/), code: z.string().regex(/^\d{6}$/), current_password: currentPassword }).strict();
const verifySchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
export const adminSecurityRouter = Router();
const limit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: req => req.user.id,
  message: { error: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.' },
});
const passwordSchema = z.object({
  current_password: currentPassword,
  new_password: z.string().min(8).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Mật khẩu tối đa 72 byte.'),
  code: z.string().regex(/^\d{6}$/).optional(),
}).strict();

adminSecurityRouter.post('/admin/security/password', requireRole('admin'), requireCsrf, limit, async (req, res, next) => {
  try {
    const input = parse(passwordSchema, req.body);
    const changed = await withTransaction(async client => {
      const { rows: [user] } = await client.query("SELECT * FROM users WHERE id=$1 AND role='admin' FOR UPDATE", [req.user.id]);
      if (!user?.password_hash || !await passwordMatches(input.current_password, user.password_hash)) return false;
      if (user.totp_enabled && !verifyTotp(decryptJson(user.totp_secret_encrypted).secret, input.code)) return false;
      await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await hashPassword(input.new_password), user.id]);
      await client.query('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2', [user.id, hash(req.cookies[sessionName])]);
      await audit(client, user.id, 'admin.password_changed', user.id);
      return true;
    });
    if (!changed) return res.status(400).json({ error: 'Mật khẩu hiện tại hoặc mã 2FA không đúng.' });
    res.json({ ok: true });
  } catch (error) { next(error); }
});
adminSecurityRouter.get('/admin/security/2fa', requireRole('admin'), async (req, res, next) => { try { const row=(await req.db.query('SELECT totp_enabled FROM users WHERE id=$1',[req.user.id])).rows[0]; res.json({ enabled:Boolean(row?.totp_enabled) }); } catch(error){ next(error); } });
adminSecurityRouter.post('/admin/security/2fa/enroll', requireCsrf, requireRole('admin'), async (req, res, next) => {
  try {
    if (req.user.totp_enabled) return res.status(409).json({ error: 'Tài khoản đã bật 2FA.' });
    const secret = generateTotpSecret();
    const url = otpauthUrl(secret, req.user.email);
    const qr = await QRCode.toDataURL(url, { width: 240, margin: 4 });
    res.set('Cache-Control', 'private, no-store').json({ secret, otpauth_url: url, qr, period: 30 });
  } catch (error) { next(error); }
});
adminSecurityRouter.post('/admin/security/2fa/enable', requireRole('admin'), requireCsrf, limit, async (req, res, next) => {
  try {
    const input = parse(codeSchema, req.body);
    if (!req.user.password_hash || !await passwordMatches(input.current_password, req.user.password_hash) || !verifyTotp(input.secret, input.code)) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại hoặc mã 2FA không đúng.' });
    }
    const updated = await req.db.query("UPDATE users SET totp_secret_encrypted=$1,totp_enabled=true WHERE id=$2 AND NOT totp_enabled AND password_hash=$3 AND role='admin'", [encryptJson({ secret: input.secret }), req.user.id, req.user.password_hash]);
    if (!updated.rowCount) return res.status(409).json({ error: 'Trạng thái tài khoản đã thay đổi. Vui lòng tải lại trang.' });
    await audit(req.db, req.user.id, 'admin.2fa_enabled', req.user.id);
    res.json({ enabled: true });
  } catch (error) { next(error); }
});
adminSecurityRouter.post('/admin/security/2fa/disable', requireCsrf, requireRole('admin'), async (req, res, next) => { try { const input=parse(verifySchema,req.body); const row=(await req.db.query('SELECT totp_secret_encrypted FROM users WHERE id=$1',[req.user.id])).rows[0]; if(!row?.totp_secret_encrypted || !verifyTotp(decryptJson(row.totp_secret_encrypted).secret,input.code)) return res.status(400).json({error:'Mã xác thực không đúng.'}); await req.db.query('UPDATE users SET totp_secret_encrypted=NULL,totp_enabled=false WHERE id=$1',[req.user.id]); await audit(req.db,req.user.id,'admin.2fa_disabled',req.user.id); res.json({enabled:false}); } catch(error){ next(error); } });
