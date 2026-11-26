import { escapeHtml as e } from '../storefront/shared.mjs';

const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  orders: '<path d="M7 3h10l3 4v14l-4-2-4 2-4-2-4 2V7z"/><path d="M8 8h8M8 12h8"/>',
  game: '<path d="M8 6h8a5 5 0 0 1 5 4l1 7a2 2 0 0 1-3 2l-4-3H9l-4 3a2 2 0 0 1-3-2l1-7a5 5 0 0 1 5-4Z"/><path d="M7 9v5M4.5 11.5h5M16 10h.01M19 13h.01"/>',
  box: '<path d="m12 3 9 5-9 5-9-5zM3 8v9l9 5 9-5V8M12 13v9M7 5.5l9 5"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  logout: '<path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4"/>',
  shield: '<path d="m12 3 9 4v6c0 5-9 9-9 9s-9-4-9-9V7zM8 12l3 3 5-6"/>',
  refresh: '<path d="M20 7a9 9 0 1 0 1 8M20 2v6h-6"/>',
  wallet: '<path d="M20 8V5H5a3 3 0 0 1 0-3h13M4 5v15h17V8H4M21 12h-6v5h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
};
export const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
const pages = [['/', 'Tổng quan', 'grid'], ['/orders', 'Đơn hàng', 'orders'], ['/coupons', 'Coupon hoàn tiền', 'wallet'], ['/customers', 'Khách hàng', 'users'], ['/games', 'Kho game', 'game'], ['/categories', 'Phân loại', 'grid'], ['/packages', 'Gói nạp', 'box'], ['/ctvs', 'Cộng tác viên', 'users'], ['/tiers', 'Hạng khách', 'users'], ['/reports', 'Báo cáo', 'grid'], ['/payment', 'Thanh toán', 'wallet'], ['/security', 'Bảo mật', 'shield']];
const navGroups = [
  { label: 'Tổng quan', items: ['/'] },
  { label: 'Vận hành', items: ['/orders', '/coupons', '/payment'] },
  { label: 'Cửa hàng', items: ['/games', '/packages', '/categories'] },
  { label: 'Hệ thống', items: ['/customers', '/ctvs', '/reports', '/security'] },
];
const storefront = () => e(process.env.STOREFRONT_ORIGIN || 'http://localhost:4173');
const head = (title, csrf, screen = '') => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="csrf-token" content="${e(csrf)}"><meta name="storefront-origin" content="${storefront()}"><link rel="icon" href="/zetgaming-oauth-logo-120.png"><title>${e(title)} · ZetGaming Admin</title><link rel="stylesheet" href="/assets/admin-tokens.css?v=lucian-admin-1"><link rel="stylesheet" href="/assets/admin.css?v=admin-security-2"><link rel="stylesheet" href="/assets/content.css?v=1"><link rel="stylesheet" href="/assets/admin-workspace.css">${screen ? `<link rel="stylesheet" href="/assets/screen-${screen}.css">` : ''}<script type="module" src="/assets/admin.js?v=admin-security-2"></script></head>`;
const brand = `<a class="brand" href="/" aria-label="ZetGaming Admin"><span class="brand-symbol">Z<span>·</span></span><span>ZETGAMING<small>ADMIN WORKSPACE</small></span></a>`;

export function adminDocument(path, user, csrf) {
  const title = pages.find(page => page[0] === path)?.[1] || 'Tổng quan';
  const screen = path === '/' ? 'overview' : pages.some(page => page[0] === path) ? path.slice(1) : '';
  return `${head(title, csrf, screen)}<body data-page="${e(path)}"><a class="skip-link" href="#main">Đến nội dung</a><div class="admin-shell">
    <aside class="sidebar" id="sidebar">${brand}<div class="workspace-label">KHÔNG GIAN QUẢN TRỊ</div><nav aria-label="Quản trị">${navGroups.map((group, index) => { const open = true; return `<section class="sidebar-nav-group ${open ? 'is-open' : ''}"><button class="sidebar-nav-toggle" type="button" data-nav-toggle aria-expanded="${open}" aria-controls="nav-group-${index}"><span>${group.label}</span>${icon('chevron')}</button><div class="sidebar-nav-items" id="nav-group-${index}">${group.items.map(href => { const [, label, symbol] = pages.find(page => page[0] === href); return `<a href="${href}" ${path === href ? 'class="active" aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span>${href === '/orders' ? '<span class="nav-count" data-pending-count hidden>—</span>' : ''}</a>`; }).join('')}</div></section>`; }).join('')}</nav>
    <div class="sidebar-bottom"><a class="store-link" href="${storefront()}" target="_blank" rel="noopener">${icon('arrow')} Xem cửa hàng</a><div class="admin-identity"><span class="avatar">A</span><div><strong>Quản trị viên</strong><small>${e(user.email)}</small></div><form action="/logout" method="post"><input type="hidden" name="_csrf" value="${e(csrf)}"><button class="logout" aria-label="Đăng xuất" title="Đăng xuất">${icon('logout')}</button></form></div></div></aside>
    <div class="workspace"><header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" aria-label="Mở menu" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button><span>Workspace</span>${icon('chevron')}<strong>${title}</strong></div><div class="topbar-right"><span class="connection" data-connection>Đang kết nối</span><span class="topbar-divider"></span><span class="avatar small">A</span></div></header>
    <main id="main" tabindex="-1"><div class="page-title"><div><span class="eyebrow">ZETGAMING / QUẢN TRỊ</span><h1>${title}</h1><p>${{ '/': 'Mọi hoạt động cửa hàng, trong một góc nhìn.', '/orders': 'Xác nhận thanh toán, nhận xử lý và hoàn tất đơn nạp.', '/coupons': 'Theo dõi coupon hoàn tiền phát hành từ các đơn vãng lai lỗi.', '/customers': 'Khóa mở tài khoản, thu hồi phiên và quản lý hạng khách.', '/games': 'Quản lý hình ảnh và thông tin game trên cửa hàng.', '/categories': 'Tạo và đổi tên phân loại để sắp xếp kho game.', '/packages': 'Quản lý sản phẩm, giá bán và trạng thái gói nạp.', '/content': 'Quản lý banner hiển thị trên trang chủ cửa hàng.', '/ctvs': 'Đội ngũ cộng tác viên và số dư hiện tại.', '/tiers': 'Thiết lập mức giảm giá theo hạng khách hàng.', '/security': 'Bảo vệ tài khoản quản trị và các phiên đăng nhập.', '/reports': 'Theo dõi đơn hàng, doanh thu và hoàn tiền theo thời gian.', '/payment': 'Kiểm tra cấu hình VietQR và trạng thái đối soát.' }[path]}</p></div><div class="page-title-actions"><span id="page-create-action"></span><button class="button" id="refresh">${icon('refresh')} Làm mới</button></div></div>
    <div id="page-content" aria-busy="true"><div class="loading-panel"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><p>Đang tải dữ liệu cửa hàng…</p></div></div><noscript><div class="empty">Bật JavaScript để sử dụng các công cụ quản trị.</div></noscript><div class="page-footnote"><span>ZetGaming Admin</span><span>Dữ liệu cửa hàng · <span id="updated-at">—</span></span></div></main></div></div>
    <dialog id="editor" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog><div id="toast" role="status" aria-live="polite" hidden></div></body></html>`;
}

export function loginDocument(csrf, error) {
  return `${head('Đăng nhập quản trị', csrf)}<body class="login-body"><main class="login-shell"><section class="login-story">${brand}<div><span class="eyebrow">CONTROL YOUR PLAY.</span><h1>Một không gian.<br>Mọi hoạt động.</h1><p>Quản lý cửa hàng và theo dõi đơn nạp<br>với ZetGaming Admin.</p><div class="login-art" aria-hidden="true"><div class="art-orbit"></div><div class="art-cube">Z</div><span class="art-tag">${icon('check')} Sẵn sàng vận hành</span></div></div><small>© ${new Date().getFullYear()} ZetGaming</small></section><section class="login-form-area"><div class="login-card"><span class="login-shield">${icon('shield')}</span><span class="eyebrow">CHÀO MỪNG TRỞ LẠI</span><h2>Đăng nhập quản trị</h2><p>Đăng nhập để tiếp tục quản lý cửa hàng.</p>${error ? `<div class="inline-error" role="alert">${e(String(error).slice(0, 300))}</div>` : ''}<form action="/login" method="post"><input type="hidden" name="_csrf" value="${e(csrf)}"><label>Email quản trị<input type="email" name="email" autocomplete="username" placeholder="admin@example.com" required maxlength="254"></label><label>Mật khẩu<input type="password" name="password" autocomplete="current-password" placeholder="Nhập mật khẩu" required minlength="8" maxlength="200"></label><label>Mã 2FA <small>(nếu đã bật)</small><input inputmode="numeric" name="otp" autocomplete="one-time-code" placeholder="6 chữ số" pattern="[0-9]{6}" maxlength="6"></label><button class="button primary login-submit" type="submit">Đăng nhập ${icon('arrow')}</button></form><div class="login-note">${icon('shield')} Chỉ dành cho tài khoản được cấp quyền quản trị.</div><a class="back-store" href="${storefront()}">← Về cửa hàng</a></div></section></main></body></html>`;
}
