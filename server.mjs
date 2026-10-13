import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const DB_PATH = join(ROOT, 'data', 'topup.sqlite');
await mkdir(join(ROOT, 'data'), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', tier TEXT NOT NULL DEFAULT 'standard', wallet_cents INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, mode TEXT NOT NULL, image TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS packages (id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id), name TEXT NOT NULL, nominal TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS prices (package_id TEXT NOT NULL REFERENCES packages(id), tier TEXT NOT NULL, customer_cents INTEGER NOT NULL, ctv_cents INTEGER NOT NULL, PRIMARY KEY(package_id,tier));
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, customer_id TEXT NOT NULL REFERENCES users(id), package_id TEXT NOT NULL REFERENCES packages(id), game_id TEXT NOT NULL REFERENCES games(id), tier TEXT NOT NULL, price_cents INTEGER NOT NULL, ctv_cents INTEGER NOT NULL, target_json TEXT NOT NULL, payment_method TEXT NOT NULL, status TEXT NOT NULL, assigned_ctv_id TEXT REFERENCES users(id), idempotency_key TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_idempotency ON orders(customer_id,idempotency_key);
CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), order_id TEXT, kind TEXT NOT NULL, amount_cents INTEGER NOT NULL, reference TEXT UNIQUE NOT NULL, note TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, entity_id TEXT, metadata_json TEXT, created_at TEXT NOT NULL);
`);
try { db.exec("ALTER TABLE orders ADD COLUMN dispatched_ctv_ids TEXT NOT NULL DEFAULT '[]'"); } catch (error) { if (!String(error.message).includes('duplicate column')) throw error; }

const now = () => new Date().toISOString();
const id = () => randomUUID();
const hashPassword = (password) => { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; };
const verifyPassword = (password, stored) => { const [salt, hash] = stored.split(':'); const actual = scryptSync(password, salt, 64); return timingSafeEqual(actual, Buffer.from(hash, 'hex')); };
const json = (res, status, body, headers = {}) => { const data = JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(data); };
const parseBody = async (req) => { let raw = ''; for await (const chunk of req) raw += chunk; if (!raw) return {}; try { return JSON.parse(raw); } catch { throw new Error('JSON không hợp lệ'); } };
const headers = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=').map(decodeURIComponent)).filter(x => x.length === 2));
const userFor = (req) => { const token = headers(req).session; if (!token) return null; const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?').get(token, now()); return row || null; };
const requireUser = (req, res, roles = []) => { const user = userFor(req); if (!user) { json(res, 401, { error: 'Vui lòng đăng nhập' }); return null; } if (roles.length && !roles.includes(user.role)) { json(res, 403, { error: 'Bạn không có quyền' }); return null; } return user; };
const audit = (actor, action, entityId, metadata = {}) => db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?)').run(id(), actor?.id || null, action, entityId || null, JSON.stringify(metadata), now());
const transaction = (fn) => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
const encrypt = (value) => { const key = scryptSync(process.env.SESSION_SECRET || 'dev-only-change-me', 'topup-key', 32); const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${body.toString('base64')}`; };

function seed() {
  if (db.prepare('SELECT COUNT(*) AS n FROM games').get().n) return;
  const admin = { id: id(), email: process.env.ADMIN_EMAIL || 'admin@example.com', password_hash: hashPassword(process.env.ADMIN_PASSWORD || 'admin12345') };
  const ctv = { id: id(), email: 'ctv@example.com', password_hash: hashPassword('ctv12345') };
  const customer = { id: id(), email: 'customer@example.com', password_hash: hashPassword('customer123') };
  transaction(() => {
    const u = db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)');
    u.run(admin.id, admin.email, admin.password_hash, 'admin', 'standard', 0, now());
    u.run(ctv.id, ctv.email, ctv.password_hash, 'ctv', 'standard', 0, now());
    u.run(customer.id, customer.email, customer.password_hash, 'customer', 'standard', 500000, now());
    const game = { id: id(), slug: 'mobile-legends', name: 'Mobile Legends', mode: 'uid', image: '◆', active: 1 };
    db.prepare('INSERT INTO games VALUES (?,?,?,?,?,?)').run(game.id, game.slug, game.name, game.mode, game.image, 1);
    for (const [name, nominal, price, ctvPrice] of [['86 Diamonds','86',20000,16000],['172 Diamonds','172',40000,32000],['429 Diamonds','429',95000,76000]]) {
      const pkg = { id: id() }; db.prepare('INSERT INTO packages VALUES (?,?,?,?,?)').run(pkg.id, game.id, name, nominal, 1); db.prepare('INSERT INTO prices VALUES (?,?,?,?)').run(pkg.id, 'standard', price, ctvPrice);
    }
  });
}
seed();
const REAL_GAME_CATALOG = [
  ['genshin-impact', 'Genshin Impact', 'uid', 'https://cdn.erisvn.net/unsafe/640x/filters:quality(80):format(webp)/https://storage.erisvn.net/images/2026/07/b732ebe5b058231230fd6f187581b1f4.webp', [['60 Genesis Crystals','60',20000,16000],['300 Genesis Crystals','300',85000,68000]]],
  ['honkai-star-rail', 'Honkai: Star Rail', 'uid', 'https://cdn.erisvn.net/unsafe/640x/filters:quality(80):format(webp)/https://storage.erisvn.net/images/2026/07/34635ffebfa047e8a603b8cb246cd3ba.webp', [['60 Oneiric Shard','60',20000,16000],['300 Oneiric Shard','300',85000,68000]]],
  ['zenless-zone-zero', 'Zenless Zone Zero', 'uid', 'https://cdn.erisvn.net/unsafe/640x/filters:quality(80):format(webp)/https://storage.erisvn.net/images/2026/07/053734c5e078d2e6c7f1968c83ec991d.webp', [['60 Monochromes','60',20000,16000],['300 Monochromes','300',85000,68000]]],
  ['wuthering-waves', 'Wuthering Waves', 'uid', 'https://cdn.erisvn.net/unsafe/640x/filters:quality(80):format(webp)/https://storage.erisvn.net/images/2026/07/d8aff142f64e588bf5a7f3a230a9359f.webp', [['60 Lunites','60',20000,16000],['300 Lunites','300',85000,68000]]]
];
for (const [slug, name, mode, image, packages] of REAL_GAME_CATALOG) {
  if (db.prepare('SELECT id FROM games WHERE slug=?').get(slug)) continue;
  const gameId = id(); db.prepare('INSERT INTO games VALUES (?,?,?,?,?,?)').run(gameId, slug, name, mode, image, 1);
  for (const [packageName, nominal, customerCents, ctvCents] of packages) { const packageId = id(); db.prepare('INSERT INTO packages VALUES (?,?,?,?,?)').run(packageId, gameId, packageName, nominal, 1); db.prepare('INSERT INTO prices VALUES (?,?,?,?)').run(packageId, 'standard', customerCents, ctvCents); }
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`); const path = url.pathname; const method = req.method;
  try {
    if (method === 'GET' && path === '/api/health') return json(res, 200, { ok: true, service: 'topup-api', time: now() });
    if (method === 'GET' && path === '/api/games') return json(res, 200, db.prepare(`SELECT g.id,g.slug,g.name,g.mode,g.image,p.id package_id,p.name package_name,p.nominal,pr.tier,pr.customer_cents FROM games g JOIN packages p ON p.game_id=g.id JOIN prices pr ON pr.package_id=p.id WHERE g.active=1 AND p.active=1 ORDER BY g.name,pr.customer_cents`).all());
    if (method === 'POST' && path === '/api/auth/login') { const body = await parseBody(req); const u = db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(String(body.email || '')); if (!u || !verifyPassword(String(body.password || ''), u.password_hash)) return json(res, 401, { error: 'Email hoặc mật khẩu không đúng' }); const token = randomBytes(32).toString('hex'); db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, u.id, new Date(Date.now() + 86400000).toISOString()); return json(res, 200, { user: { id: u.id, email: u.email, role: u.role, tier: u.tier, wallet_cents: u.wallet_cents } }, { 'set-cookie': `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400` }); }
    if (method === 'POST' && path === '/api/auth/logout') { const c = headers(req).session; if (c) db.prepare('DELETE FROM sessions WHERE token=?').run(c); return json(res, 200, { ok: true }, { 'set-cookie': 'session=; Max-Age=0; Path=/' }); }
    if (method === 'GET' && path === '/api/me') { const u = requireUser(req, res); if (!u) return; return json(res, 200, { id: u.id, email: u.email, role: u.role, tier: u.tier, wallet_cents: u.wallet_cents }); }
    if (method === 'POST' && path === '/api/orders') { const u = requireUser(req, res); if (!u) return; const body = await parseBody(req); const key = String(req.headers['idempotency-key'] || body.idempotency_key || ''); if (!key || key.length > 120) return json(res, 400, { error: 'Thiếu khóa chống gửi trùng' }); const pkg = db.prepare('SELECT p.*,g.name game_name,g.id game_id,pr.customer_cents,pr.ctv_cents FROM packages p JOIN games g ON g.id=p.game_id JOIN prices pr ON pr.package_id=p.id AND pr.tier=? WHERE p.id=? AND p.active=1').get(u.tier, body.package_id); if (!pkg) return json(res, 400, { error: 'Gói nạp không tồn tại hoặc chưa bán' }); const target = body.target || {}; if (!String(target.uid || target.login || '').trim()) return json(res, 400, { error: 'Vui lòng nhập UID hoặc tài khoản game' }); try { const order = transaction(() => { const existing = db.prepare('SELECT code,status FROM orders WHERE customer_id=? AND idempotency_key=?').get(u.id, key); if (existing) return existing; if (body.payment_method === 'wallet' && u.wallet_cents < pkg.customer_cents) throw new Error('Số dư ví không đủ'); const oid = id(); const code = `GP${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`; db.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(oid, code, u.id, pkg.id, pkg.game_id, u.tier, pkg.customer_cents, pkg.ctv_cents, encrypt(JSON.stringify(target)), body.payment_method === 'wallet' ? 'wallet' : 'direct', body.payment_method === 'wallet' ? 'pending_admin' : 'awaiting_payment', null, key, now(), now(), '[]'); if (body.payment_method === 'wallet') { db.prepare('UPDATE users SET wallet_cents=wallet_cents-? WHERE id=?').run(pkg.customer_cents, u.id); db.prepare('INSERT INTO ledger VALUES (?,?,?,?,?,?,?,?)').run(id(), u.id, oid, 'purchase', -pkg.customer_cents, `purchase:${oid}`, 'Thanh toán đơn', now()); } audit(u, 'order.created', oid, { code }); return { code, status: body.payment_method === 'wallet' ? 'pending_admin' : 'awaiting_payment' }; }); return json(res, 201, order); } catch (e) { return json(res, e.message === 'Số dư ví không đủ' ? 400 : 409, { error: e.message.includes('UNIQUE') ? 'Yêu cầu này đã được gửi trước đó' : e.message }); } }
    if (method === 'GET' && path === '/api/orders') { const u = requireUser(req, res); if (!u) return; const q = u.role === 'admin' ? 'SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,u.email customer,p.name package_name FROM orders o JOIN users u ON u.id=o.customer_id JOIN packages p ON p.id=o.package_id ORDER BY o.created_at DESC' : u.role === 'ctv' ? 'SELECT o.code,o.status,o.price_cents,o.ctv_cents,o.payment_method,o.created_at,p.name package_name FROM orders o JOIN packages p ON p.id=o.package_id WHERE o.assigned_ctv_id=? OR o.status IN (\'ready\') ORDER BY o.created_at DESC' : 'SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,p.name package_name FROM orders o JOIN packages p ON p.id=o.package_id WHERE o.customer_id=? ORDER BY o.created_at DESC'; return json(res, 200, db.prepare(q).all(...(u.role === 'customer' ? [u.id] : u.role === 'ctv' ? [u.id] : []))); }
    if (method === 'POST' && path.match(/^\/api\/admin\/orders\/[^/]+\/approve$/)) { const u = requireUser(req, res, ['admin']); if (!u) return; const code = path.split('/')[4]; const body = await parseBody(req); const list = Array.isArray(body.ctv_ids) ? body.ctv_ids.filter(Boolean) : []; const o = db.prepare('SELECT * FROM orders WHERE code=?').get(code); if (!o) return json(res, 404, { error: 'Không tìm thấy đơn' }); if (!list.length) return json(res, 400, { error: 'Phải chọn ít nhất một CTV' }); transaction(() => { db.prepare('UPDATE orders SET status=?,dispatched_ctv_ids=?,updated_at=? WHERE code=? AND status IN (\'pending_admin\',\'awaiting_payment\')').run('ready', JSON.stringify(list), now(), code); audit(u, 'order.approved', o.id, { ctv_ids: list }); }); return json(res, 200, { ok: true, code, status: 'ready', ctv_ids: list }); }
    if (method === 'POST' && path.match(/^\/api\/ctv\/orders\/[^/]+\/claim$/)) { const u = requireUser(req, res, ['ctv']); const code = path.split('/')[4]; if (!u) return; try { const result = transaction(() => { const o = db.prepare('SELECT * FROM orders WHERE code=?').get(code); if (!o) throw new Error('Không tìm thấy đơn'); if (!JSON.parse(o.dispatched_ctv_ids || '[]').includes(u.id)) throw new Error('Đơn chưa được phân cho bạn'); if (o.status !== 'ready' || o.assigned_ctv_id) throw new Error('Đơn đã có người nhận hoặc chưa được phân'); db.prepare('UPDATE orders SET status=\'claimed\',assigned_ctv_id=?,updated_at=? WHERE code=? AND status=\'ready\' AND assigned_ctv_id IS NULL').run(u.id, now(), code); const owned = db.prepare('SELECT assigned_ctv_id,status FROM orders WHERE code=?').get(code); if (owned.assigned_ctv_id !== u.id) throw new Error('Đơn đã có người nhận'); audit(u, 'order.claimed', o.id); return { code, status: owned.status }; }); return json(res, 200, result); } catch (e) { return json(res, 409, { error: e.message }); } }
    if (method === 'POST' && path.match(/^\/api\/ctv\/orders\/[^/]+\/complete$/)) { const u = requireUser(req, res, ['ctv']); if (!u) return; const code = path.split('/')[4]; const body = await parseBody(req); const o = db.prepare('SELECT * FROM orders WHERE code=? AND assigned_ctv_id=?').get(code, u.id); if (!o) return json(res, 404, { error: 'Đơn không thuộc về bạn' }); if (o.status !== 'claimed') return json(res, 409, { error: 'Đơn không ở trạng thái xử lý' }); transaction(() => { db.prepare('UPDATE orders SET status=\'review\',updated_at=? WHERE code=? AND assigned_ctv_id=? AND status=\'claimed\'').run(now(), code, u.id); audit(u, 'order.completed', o.id, { note: String(body.note || '').slice(0, 500) }); }); return json(res, 200, { code, status: 'review' }); }
    if (method === 'POST' && path.match(/^\/api\/admin\/orders\/[^/]+\/settle$/)) { const u = requireUser(req, res, ['admin']); if (!u) return; const code = path.split('/')[4]; const o = db.prepare('SELECT * FROM orders WHERE code=?').get(code); if (!o || !o.assigned_ctv_id) return json(res, 404, { error: 'Đơn không hợp lệ' }); if (o.status !== 'review') return json(res, 409, { error: 'Đơn chưa chờ duyệt' }); transaction(() => { db.prepare('UPDATE orders SET status=\'completed\',updated_at=? WHERE code=? AND status=\'review\'').run(now(), code); db.prepare('UPDATE users SET wallet_cents=wallet_cents+? WHERE id=?').run(o.ctv_cents, o.assigned_ctv_id); db.prepare('INSERT INTO ledger VALUES (?,?,?,?,?,?,?,?)').run(id(), o.assigned_ctv_id, o.id, 'ctv_earning', o.ctv_cents, `ctv_earning:${o.id}`, 'Thu nhập đơn', now()); audit(u, 'order.settled', o.id, { ctv_cents: o.ctv_cents }); }); return json(res, 200, { code, status: 'completed' }); }
    if (method === 'GET' && path === '/api/admin/ctvs') { const u = requireUser(req, res, ['admin']); if (!u) return; return json(res, 200, db.prepare("SELECT id,email,wallet_cents FROM users WHERE role='ctv'").all()); }
    if (method === 'GET' && path.startsWith('/api/orders/')) { const u = requireUser(req, res); if (!u) return; const code = path.split('/')[3]; const o = db.prepare('SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,o.updated_at,p.name package_name,g.name game_name,u.email customer FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id JOIN users u ON u.id=o.customer_id WHERE o.code=? AND (o.customer_id=? OR o.assigned_ctv_id=? OR ?=\'admin\')').get(code,u.id,u.id,u.role); if (!o) return json(res, 404, { error: 'Không tìm thấy đơn' }); return json(res, 200, o); }
    if (method === 'GET' && path === '/') { const html = await readFile(join(ROOT, 'public', 'index.html')); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
    if (method === 'GET' && path === '/app.js') { const js = await readFile(join(ROOT, 'public', 'app.js')); res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); return res.end(js); }
    if (method === 'GET' && path === '/styles.css') { const css = await readFile(join(ROOT, 'public', 'storefront.css')); res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }); return res.end(css); }
    if (method === 'GET' && path === '/gameflow-fire-banner.png') { const image = await readFile(join(ROOT, 'public', 'gameflow-fire-banner.png')); res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' }); return res.end(image); }
    if (method === 'GET' && path === '/zetgaming-logo.png') { const image = await readFile(join(ROOT, 'public', 'zetgaming-logo.png')); res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' }); return res.end(image); }
    json(res, 404, { error: 'Không tìm thấy đường dẫn' });
  } catch (e) { console.error(e); json(res, 500, { error: 'Lỗi máy chủ' }); }
}

createServer(route).listen(PORT, () => console.log(`Topup app listening at http://localhost:${PORT}`));
