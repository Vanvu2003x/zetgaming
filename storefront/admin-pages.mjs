import { escapeHtml as e } from './shared.mjs';

const gameEditor = game => `<article class="admin-game-card" data-game-id="${e(game.id)}">
  <div class="admin-game-preview"><img src="${e(game.image)}" alt=""><span data-game-preview-status>${game.active ? 'ĐANG HIỂN THỊ' : 'ĐANG ẨN'}</span></div>
  <div class="admin-game-fields">
    <div class="admin-game-title"><div><span class="admin-field-kicker">GAME</span><strong>${e(game.name)}</strong></div><small>${e(game.slug)}</small></div>
    <label>Tên game<input data-game-field="name" value="${e(game.name)}" maxlength="120"></label>
    <label>Ảnh banner / card<input data-game-field="image" value="${e(game.image)}" placeholder="https://..." maxlength="1000"></label>
    <div class="admin-inline-fields">
      <label>Kiểu nạp<select data-game-field="mode"><option value="uid" ${game.mode === 'uid' ? 'selected' : ''}>Nạp UID</option><option value="login" ${game.mode === 'login' ? 'selected' : ''}>Nạp login</option></select></label>
      <label>Nền tảng<select data-game-field="platform"><option value="mobile" ${game.platform === 'mobile' ? 'selected' : ''}>Mobile</option><option value="pc" ${game.platform === 'pc' ? 'selected' : ''}>PC</option><option value="other" ${game.platform === 'other' ? 'selected' : ''}>Khác</option></select></label>
      <label class="admin-check"><input data-game-field="active" type="checkbox" ${game.active ? 'checked' : ''}> Hiển thị trên trang khách</label>
    </div>
    <div class="admin-game-footer"><span class="admin-save-status" data-game-save-status aria-live="polite"></span><button type="button" class="action-button admin-save-game" data-save-game>Lưu game ↗</button></div>
  </div>
</article>`;

const packageEditor = (game, pkg) => `<article class="admin-package-card" data-package-id="${e(pkg.id)}">
  <div class="admin-package-preview"><img src="${e(pkg.image || game.image)}" alt=""><span>${e(pkg.badge || pkg.nominal || 'GÓI')}</span></div>
  <div class="admin-package-fields"><div class="admin-package-title"><strong>${e(game.name)}</strong><small>${e(pkg.name)}</small></div>
    <label>Tên gói<input data-field="name" value="${e(pkg.name)}" maxlength="120"></label><label>Nominal<input data-field="nominal" value="${e(pkg.nominal || '')}" maxlength="80"></label><label>Ảnh gói<input data-field="image" value="${e(pkg.image || '')}" placeholder="https://..." maxlength="1000"></label>
    <div class="admin-inline-fields"><label>Giá khách<input data-field="customer_cents" type="number" min="0" step="1" value="${Number(pkg.customer_cents || 0)}"></label><label>Giá CTV<input data-field="ctv_cents" type="number" min="0" step="1" value="${Number(pkg.ctv_cents || 0)}"></label><label>Nhãn<input data-field="badge" value="${e(pkg.badge || '')}" maxlength="40"></label></div>
    <label class="admin-check"><input data-field="active" type="checkbox" ${pkg.active ? 'checked' : ''}> Đang bán</label><div class="admin-package-footer"><span class="admin-save-status" data-save-status aria-live="polite"></span><button type="button" class="action-button admin-save-package" data-save-package>Lưu gói ↗</button></div>
  </div>
</article>`;

export function adminCatalogPage(games, csrfToken = '') {
  const packages = games.flatMap(game => (game.packages || []).map(pkg => packageEditor(game, pkg)));
  const activeGames = games.filter(game => game.active).length;
  return `<div class="wrap admin-page"><div class="admin-heading"><div><span class="section-kicker">KHU VỰC QUẢN TRỊ</span><h1>Quản lý ZetGaming</h1><p>Chỉnh kho game, gói nạp và theo dõi đơn hàng trong một chỗ.</p></div><a class="quiet-link" href="/">Về trang chủ ↗</a></div><meta name="admin-csrf" content="${e(csrfToken)}"><nav class="admin-tabs" aria-label="Khu vực quản trị"><a class="is-active" href="#games">Kho game</a><a href="#packages">Gói nạp</a><a href="#orders">Đơn hàng</a></nav><section class="admin-summary" aria-label="Tổng quan"><div><strong>${games.length}</strong><span>tổng game</span></div><div><strong>${activeGames}</strong><span>game đang hiển thị</span></div><div><strong>${packages.length}</strong><span>gói nạp</span></div><div><strong id="adminOrderCount">—</strong><span>đơn cần xử lý</span></div></section><section id="games" class="admin-section"><div class="admin-section-heading"><div><span class="section-kicker">DANH MỤC</span><h2>Kho game</h2></div><p>Ảnh và thông tin dưới đây sẽ hiển thị trực tiếp ở trang nạp game.</p></div><div class="admin-games">${games.map(gameEditor).join('') || '<div class="empty-panel">Chưa có game nào.</div>'}</div></section><section id="packages" class="admin-section"><div class="admin-section-heading"><div><span class="section-kicker">SẢN PHẨM</span><h2>Gói nạp</h2></div><p>Cập nhật giá khách, giá CTV, nhãn và trạng thái bán.</p></div><div class="admin-packages">${packages.join('') || '<div class="empty-panel">Chưa có gói nạp nào.</div>'}</div></section><section id="orders" class="admin-section"><div class="admin-section-heading"><div><span class="section-kicker">VẬN HÀNH</span><h2>Đơn hàng</h2></div><p>Đơn mới và trạng thái xử lý sẽ được tải từ hệ thống.</p></div><div class="admin-orders" data-admin-orders aria-live="polite"><div class="admin-loading">Đang tải danh sách đơn...</div></div></section></div>`;
}
