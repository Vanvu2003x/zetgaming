import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.mjs';
import { sessionName, csrfSeedName, cookieOptions } from '../config/cookies.mjs';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const signature = (scope, nonce) => createHmac('sha256', env.sessionSecret).update(`${scope}:${nonce}`).digest('hex');
export function csrfToken(req, res, next) {
  let seed = req.cookies[csrfSeedName];
  if (!/^[a-f0-9]{64}$/.test(seed || '')) {
    seed = randomBytes(32).toString('hex');
    res.cookie(csrfSeedName, seed, { ...cookieOptions, maxAge: 86_400_000 });
  }
  req.csrfScope = req.cookies[sessionName] || seed;
  const nonce = randomBytes(32).toString('hex');
  req.csrfToken = `${nonce}.${signature(req.csrfScope, nonce)}`;
  next();
}

export function requireCsrf(req, res, next) {
  if (safeMethods.has(req.method)) return next();
  const origin = req.get('Origin');
  if ((origin && !env.allowedOrigins.includes(origin)) || req.get('Sec-Fetch-Site') === 'cross-site') {
    return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ' });
  }
  const provided = req.get('X-CSRF-Token') || req.body?._csrf;
  if (typeof provided !== 'string' || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(provided)) {
    return res.status(403).json({ error: 'Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.' });
  }
  const [nonce, mac] = provided.split('.');
  if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(req.csrfScope, nonce), 'hex'))) {
    return res.status(403).json({ error: 'Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.' });
  }
  next();
}
