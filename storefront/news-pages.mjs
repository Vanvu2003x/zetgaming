import { escapeHtml as e } from './shared.mjs';
import { breadcrumb } from './catalog-pages.mjs';

export function newsPage() {
  return `<div class="wrap page-container">${breadcrumb('Tin tức')}<section class="coming-soon-page surface-panel" data-reveal aria-labelledby="comingSoonTitle"><div class="notification-character" aria-hidden="true"><svg viewBox="0 0 160 160" role="presentation"><path class="notification-shadow" d="M31 126c21-8 77-8 98 0"/><path class="notification-bell" d="M48 102h64l-7-11V66a25 25 0 0 0-50 0v25z"/><path class="notification-clapper" d="M66 103a14 14 0 0 0 28 0"/><circle class="notification-eye" cx="68" cy="76" r="3"/><circle class="notification-eye" cx="92" cy="76" r="3"/><path class="notification-smile" d="M72 86c5 5 11 5 16 0"/><path class="notification-ray" d="M80 29V18M43 40l-8-8M117 40l8-8"/></svg><span class="notification-dot">!</span></div><span class="eyebrow-label">GÓC ZETGAMING</span><h1 id="comingSoonTitle">Tin tức sắp ra mắt</h1><p>Bọn mình đang chuẩn bị những hướng dẫn và thông tin hữu ích cho bạn.</p><a class="action-button" href="/nap-game">Khám phá game ↗</a></section></div>`;
}
export function notFoundPage() {
  return `<div class="wrap page-container"><section class="account-gate surface-panel"><span class="eyebrow-label">404 · LẠC MỘT CHÚT THÔI</span><h1>Trang này không còn ở đây.</h1><p>Đường dẫn có thể đã thay đổi hoặc nội dung không tồn tại.</p><a class="action-button" href="/">Về trang chủ ↗</a><a class="quiet-link" href="/nap-game">Khám phá game</a></section></div>`;
}
