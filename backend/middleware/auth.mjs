import { hash } from '../utils/ids.mjs';
import { sessionName } from '../config/cookies.mjs';

export async function currentUser(req, _res, next) {
  const raw = req.cookies?.[sessionName];
  req.user = null;
  if (raw) {
    const result = await req.db.query(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [hash(raw)]);
    req.user = result.rows[0] || null;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Bạn không có quyền' });
    next();
  };
}
