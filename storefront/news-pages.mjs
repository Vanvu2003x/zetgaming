import { escapeHtml as e } from './shared.mjs';
import { articles } from './content.mjs';
import { breadcrumb } from './catalog-pages.mjs';

export function newsPage() {
  return `<div class="wrap page-container">${breadcrumb('Tin tức & hướng dẫn')}<div class="page-heading"><div><span class="eyebrow-label">GÓC ZETGAMING</span><h1>Tin tức & hướng dẫn</h1><p>Hiểu rõ cách nạp, thanh toán và theo dõi đơn của bạn.</p></div><a class="quiet-link" href="/nap-game">Khám phá game ↗</a></div><div class="editorial-grid" data-reveal>${articles.map(article => `<a class="editorial-card" href="/tin-tuc/${article.slug}"><div class="editorial-art art-${article.mark}" aria-hidden="true"><span>${article.mark}</span><b>✦</b></div><div><span class="eyebrow-label">${article.category}</span><h2>${article.title}</h2><p>${article.excerpt}</p><span class="quiet-link">Đọc hướng dẫn ↗</span></div></a>`).join('')}</div></div>`;
}
export function articlePage(article) {
  return `<div class="wrap page-container">${breadcrumb(article.title, '<a href="/tin-tuc">Tin tức</a><span aria-hidden="true">/</span>')}<article class="article-layout" data-reveal><header class="article-heading"><span class="eyebrow-label">${article.category} · ZETGAMING</span><h1>${article.title}</h1><p>${article.excerpt}</p></header><div class="article-body surface-panel">${article.sections.map(([title, text], index) => `<section id="buoc-${index + 1}"><span class="article-step">0${index + 1}</span><h2>${e(title)}</h2><p>${e(text)}</p></section>`).join('')}<a class="action-button" href="/nap-game">Chọn game để nạp ↗</a></div><aside class="article-sidebar surface-panel"><h2>Trong hướng dẫn này</h2>${article.sections.map(([title], index) => `<a href="#buoc-${index + 1}">0${index + 1} · ${e(title)}</a>`).join('')}<hr><a href="/tin-tuc">← Tất cả hướng dẫn</a></aside></article></div>`;
}
export function notFoundPage() {
  return `<div class="wrap page-container"><section class="account-gate surface-panel"><span class="eyebrow-label">404 · LẠC MỘT CHÚT THÔI</span><h1>Trang này không còn ở đây.</h1><p>Đường dẫn có thể đã thay đổi hoặc nội dung không tồn tại.</p><a class="action-button" href="/">Về trang chủ ↗</a><a class="quiet-link" href="/nap-game">Khám phá game</a></section></div>`;
}
