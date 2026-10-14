import { randomUUID } from 'node:crypto';
import { escapeHtml as e, safeNext, statusText } from './shared.mjs';
import { homePage, catalogPage, gamePage } from './catalog-pages.mjs';
import { loginPage, registerPage, forgotPasswordPage, resetPasswordPage, gatePage, accountPage, historyPage, orderPage } from './account-pages.mjs';
import { newsPage, notFoundPage } from './news-pages.mjs';
import { navPath } from '../public/navigation.js';

export function renderStorefront({ url, user, db, data, csrfToken = '', layout }) {
  const path = url.pathname;
  if (path.length > 1 && path.endsWith('/')) return { redirect: path.replace(/\/+$/, '') + url.search, status: 308 };
  const needsCatalog = path === '/' || path === '/nap-game' || path.startsWith('/nap-game/');
  const rows = needsCatalog ? data?.rows ?? db.prepare(`SELECT g.id,g.slug,g.name,g.mode,g.image,g.platform,p.id package_id,p.name package_name,pr.customer_cents
    FROM games g JOIN packages p ON p.game_id=g.id JOIN prices pr ON pr.package_id=p.id
    WHERE g.active=1 AND p.active=1 AND pr.tier=? ORDER BY g.name,pr.customer_cents`).all(user?.tier || 'standard') : [];
  const games = new Map();
  for (const row of rows) {
    const existing = games.get(row.id);
    if (!existing) games.set(row.id, { ...row, price: row.customer_cents });
    else existing.price = Math.min(existing.price, row.customer_cents);
  }
  const catalog = [...games.values()];
  let title = 'Không tìm thấy trang', description = 'Nạp game tại ZetGaming.', page = 'not-found', active = '/', content = notFoundPage(), status = 404;
  const set = (name, tab, heading, html, desc = heading) => { page = name; active = tab; title = heading; content = html; description = desc; status = 200; };
  if (path === '/') set('home', '/', 'Nạp game dễ dàng', homePage(catalog), 'Chọn game yêu thích, xem giá gói nạp và theo dõi đơn tại ZetGaming.');
  else if (path === '/nap-game') set('catalog', '/nap-game', 'Nạp game', catalogPage(catalog, (url.searchParams.get('q') || '').trim().slice(0, 100)));
  else if (/^\/nap-game\/[a-z0-9-]+$/.test(path)) {
    const game = catalog.find(item => item.slug === path.split('/')[2]);
    if (game) set('game', '/nap-game', `Nạp ${game.name}`, gamePage(game, rows.filter(row => row.id === game.id), user, randomUUID(), url.searchParams.get('error') || '', catalog), `Chọn gói nạp ${game.name}, kiểm tra UID và xem giá trước khi tạo đơn.`);
  } else if (path === '/dang-nhap') {
    if (user) return { redirect: safeNext(url.searchParams.get('next')), status: 303 };
    set('login', '/tai-khoan', 'Đăng nhập', loginPage(url.searchParams.get('next'), url.searchParams.get('error')));
  } else if (path === '/dang-ky') {
    if (user) return { redirect: safeNext(url.searchParams.get('next'), '/tai-khoan'), status: 303 };
    set('register', '/tai-khoan', 'Đăng ký', registerPage(url.searchParams.get('next'), url.searchParams.get('error')));
  } else if (path === '/quen-mat-khau') {
    set('forgot-password', '/tai-khoan', 'Quên mật khẩu', forgotPasswordPage(url.searchParams.get('sent') === '1', url.searchParams.get('token')));
  } else if (path === '/dat-lai-mat-khau') {
    set('reset-password', '/tai-khoan', 'Đặt lại mật khẩu', resetPasswordPage(url.searchParams.get('token'), url.searchParams.get('error'), url.searchParams.get('success') === '1'));
  } else if (path === '/tai-khoan') {
    const summary = user ? data?.summary ?? db.prepare(`SELECT COUNT(*) total, COALESCE(SUM(status NOT IN ('completed','cancelled')),0) pending, COALESCE(SUM(status='completed'),0) completed FROM orders WHERE customer_id=?`).get(user.id) : null;
    set('account', '/tai-khoan', 'Tài khoản', user ? accountPage(user, summary) : gatePage('Tài khoản', path));
  } else if (path === '/lich-su') {
    let orders = [];
    const requestedStatus = url.searchParams.get('status');
    const filter = Object.hasOwn(statusText, requestedStatus) ? requestedStatus : 'all';
    if (user) orders = data?.orders ?? db.prepare(`SELECT o.code,o.status,o.price_cents,o.created_at,p.name package_name,g.name game_name FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id WHERE o.customer_id=? AND (?='all' OR o.status=?) ORDER BY o.created_at DESC`).all(user.id, filter, filter);
    set('history', '/lich-su', 'Lịch sử đơn hàng', user ? historyPage(orders, filter) : gatePage('Lịch sử đơn hàng', path));
  } else if (/^\/lich-su\/[a-zA-Z0-9-]+$/.test(path)) {
    if (!user) set('history', '/lich-su', 'Lịch sử đơn hàng', gatePage('Lịch sử đơn hàng', path));
    else {
      const order = data ? data.order : db.prepare(`SELECT o.code,o.status,o.price_cents,o.payment_method,o.created_at,o.updated_at,p.name package_name,g.name game_name FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id WHERE o.code=? AND o.customer_id=?`).get(path.split('/')[2], user.id);
      if (order) set('order', '/lich-su', `Đơn ${order.code}`, orderPage(order));
    }
  } else if (path === '/tin-tuc' || /^\/tin-tuc\/[a-z0-9-]+$/.test(path)) set('news', '/tin-tuc', 'Tin tức sắp ra mắt', newsPage(), 'Tin tức và hướng dẫn của ZetGaming sắp ra mắt.');
  let shell = layout.replace(/<a\b([^>]*href="([^"]+)"[^>]*)>/g, (tag, attrs, href) => {
    if (href !== active) return tag;
    const className = attrs.includes('mobile-bottom-link') ? 'is-active' : 'is-current';
    attrs = /class="/.test(attrs) ? attrs.replace(/class="([^"]*)"/, (_, cls) => `class="${cls} ${className}"`) : attrs + ` class="${className}"`;
    return `<a${attrs} aria-current="page">`;
  });
  const center = { '/nap-game': 49.5, '/lich-su': 106.5, '/': 177.5, '/tin-tuc': 248.5, '/tai-khoan': 305.5 }[active];
  shell = shell.replace(/(<path id="mobileBottomShapePath" d=")[^"]+/, (_, prefix) => prefix + navPath(center));
  const name = user ? user.email.split('@')[0] : '';
  const recoveryPage = ['forgot-password', 'reset-password'].includes(page);
  content = content.replace(/(<form\b[^>]*method="post"[^>]*>)/gi, `$1<input type="hidden" name="_csrf" value="${e(csrfToken)}">`);
  const values = { authBackHref: recoveryPage ? '/dang-nhap' : '/', authBackLabel: recoveryPage ? 'Quay lại đăng nhập' : 'Trở về trang chủ', title: e(title), description: e(description), content, page, year: new Date().getFullYear(), accountHref: user ? '/tai-khoan' : '/dang-nhap', accountLabel: user ? e(name) : 'Đăng nhập', mobileName: e(name), accountAccessible: user ? e('Tài khoản của ' + name) : 'Đăng nhập', authenticated: Boolean(user) };
  values.content = content;
  values.csrfToken = e(csrfToken);
  return { status, html: shell.replace(/{{(\w+)}}/g, (_, key) => values[key] ?? '') };
}
