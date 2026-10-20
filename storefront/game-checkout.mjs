import { escapeHtml as e, money, gameImage, loginHref } from './shared.mjs';

const icons = {
  player: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  wallet: '<path d="M20 8V4H4v16h17V8H4m17 4h-6v4h6"/>',
  bank: '<path d="m3 8 9-5 9 5H3ZM5 10v8m7-8v8m7-8v8M3 21h18"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const gem = '<svg class="crystal-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="m32 4 23 15-5 29-18 13L9 43 11 18Z" fill="#104858"/><path d="m32 4 13 21-13 14L11 18Z" fill="#72dcf3"/><path d="m32 4 23 15-10 6Z" fill="#c4f5ff"/><path d="m11 18 21 21L9 43Z" fill="#28a9cf"/><path d="m45 25 5 23-18-9Z" fill="#b7effc"/><path d="m45 25 10-6-5 29Z" fill="#4abdda"/><path d="m32 39 18 9-18 13Z" fill="#45bddd"/><path d="M9 43 32 39v22Z" fill="#2787b3"/><path d="m32 4 23 15-5 29-18 13L9 43 11 18Z" stroke="#c1f5ff" stroke-opacity=".6" stroke-width="1.2"/></svg>';
const heading = (step, title, end = '') => `<div class="detail-section-heading"><div class="checkout-step"><span class="checkout-step-number" aria-hidden="true">${step}</span><h2>${title}</h2></div>${end}</div>`;

function packageCard(row, index) {
  const visual = /^(https:\/\/|\/(?!\/))/.test(row.package_image || '') ? `<img src="${e(row.package_image)}" alt="" loading="lazy">` : gem;
  return `<label class="package-choice">
    <input type="radio" name="package_id" value="${e(row.package_id)}" data-price="${row.customer_cents}" data-name="${e(row.package_name)}" ${index === 0 ? 'checked' : ''} required>
    <span class="package-visual">${visual}</span>
    <span class="package-copy"><span class="package-name">${e(row.package_name)}</span><strong>${money(row.customer_cents)}</strong>${row.badge ? `<small class="package-bonus">${e(row.badge)}</small>` : ''}</span>
    <span class="package-check" aria-hidden="true">✓</span>
  </label>`;
}

export function gameCheckout(game, rows, user, key) {
  const login = game.mode === 'login';
  const targetLabel = login ? 'Tài khoản game' : 'UID người chơi';
  const first = rows[0];
  return `<form id="orderForm" action="/dat-don" method="post" class="game-checkout">
    <input type="hidden" name="idempotency_key" value="${e(key)}">
    <input type="hidden" name="return_to" value="/nap-game/${e(game.slug)}">
    <section class="account-panel">
      ${heading('01', 'Thông tin người chơi', `<span class="checkout-required">Bắt buộc</span>`)}
      <label class="checkout-target-label" for="target">${targetLabel}</label>
      <div class="target-field">${icon('player')}<input id="target" name="${login ? 'login' : 'uid'}" placeholder="${login ? 'Nhập tài khoản game của bạn' : 'Nhập UID của bạn'}" inputmode="${login ? 'text' : 'numeric'}" autocomplete="off" aria-describedby="uidHint" maxlength="120" required></div>
      <p class="field-hint" id="uidHint">${login ? 'Nhập đúng tên tài khoản cần nạp.' : 'Kiểm tra UID trong game trước khi đặt đơn.'}</p>
      <details class="checkout-guide"><summary>${login ? 'Cần nhập thông tin gì?' : 'Hướng dẫn tìm UID'}</summary><p>${login ? 'Nhập tên tài khoản đúng như trong game. Không nhập mật khẩu vào ô này.' : 'Mở game → Hồ sơ người chơi → Sao chép UID, sau đó dán vào ô phía trên. Đối chiếu lại để tránh nạp nhầm tài khoản.'}</p></details>
    </section>
    <section class="package-panel">
      ${heading('02', 'Chọn gói nạp', `<span class="package-count">${rows.length} gói</span>`)}
      <div class="package-grid" role="group" aria-label="Các gói nạp ${e(game.name)}">${rows.map(packageCard).join('')}</div>
    </section>
    <section class="payment-panel">
      ${heading('03', 'Thanh toán')}
      <div class="payment-choice-grid">
        <label class="payment-choice"><input type="radio" name="payment_method" value="wallet" data-payment-choice="wallet" ${user ? 'checked' : 'disabled'}><span class="payment-choice-icon">${icon('wallet')}</span><span><strong>Ví ZetGaming</strong><small>${user ? 'Dùng số dư tài khoản' : 'Cần đăng nhập'}</small></span><b aria-hidden="true">✓</b></label>
        <label class="payment-choice"><input type="radio" name="payment_method" value="direct" data-payment-choice="direct" ${user ? '' : 'checked'}><span class="payment-choice-icon">${icon('bank')}</span><span><strong>Chuyển khoản</strong><small>Ngân hàng / VietQR</small></span><b aria-hidden="true">✓</b></label>
      </div>
      <select id="payment" class="payment-value" aria-hidden="true" tabindex="-1"><option value="direct" ${user ? '' : 'selected'}>Chuyển khoản</option><option value="wallet" ${user ? 'selected' : ''}>Ví ZetGaming</option></select>
    </section>
    <section class="order-submit-panel" aria-labelledby="checkoutSummaryTitle">
      <div class="checkout-summary-heading"><span>${icon('lock')}</span><h2 id="checkoutSummaryTitle">Đơn nạp của bạn</h2></div>
      <div class="checkout-game"><img src="${e(gameImage(game, 'thumbnail'))}" alt=""><div><strong>${e(game.name)}</strong><small>${login ? 'Nạp qua tài khoản' : 'Nạp bằng UID'}</small></div></div>
      <div class="order-summary"><span>Gói đã chọn</span><strong id="selectedPackageName">${e(first.package_name)}</strong></div>
      <div class="order-detail-lines"><div><span>${login ? 'Tài khoản' : 'UID'}</span><strong id="orderTargetValue">Chưa nhập</strong></div></div>
      <div class="order-total"><span>Tổng thanh toán</span><output id="orderTotal" aria-live="polite">${money(first.customer_cents)}</output></div>
      <button id="createOrderBtn" class="action-button wide" type="submit"><span>Thanh toán <span id="orderSubmitAmount">${money(first.customer_cents)}</span></span>${icon('arrow')}</button>
      <p id="orderMsg" class="form-message" role="status"></p>
      ${!user ? `<p class="checkout-small"><a href="${loginHref('/nap-game/' + game.slug)}">Đăng nhập</a> để lưu lịch sử và sử dụng ví.</p>` : ''}
      <p class="checkout-security">${icon('lock')} Kiểm tra thông tin trước khi thanh toán</p>
    </section>
  </form>`;
}
