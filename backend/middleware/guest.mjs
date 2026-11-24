import { cookieOptions } from '../config/cookies.mjs';
import { env } from '../config/env.mjs';
import { hash, token } from '../utils/ids.mjs';

export const guestCookieName = env.nodeEnv === 'production' ? '__Host-guest-orders' : 'guest_orders';
export function guestSession(req, res, next) {
  let raw = req.cookies?.[guestCookieName];
  if (!/^[a-f0-9]{64}$/.test(raw || '')) {
    raw = token();
    res.cookie(guestCookieName, raw, { ...cookieOptions, maxAge: 30 * 86_400_000 });
  }
  req.guestHash = hash(raw);
  next();
}
