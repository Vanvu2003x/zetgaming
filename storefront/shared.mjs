export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const money = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
export const dateTime = (value) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
export const dateOnly = (value) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
export const statusText = { awaiting_payment: 'Chờ thanh toán', pending_admin: 'Chờ duyệt', ready: 'Chờ tiếp nhận', claimed: 'Đang xử lý', review: 'Chờ xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
export function safeNext(value, fallback = '/tai-khoan') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  const url = new URL(value, 'http://localhost');
  if (!/^\/(?:nap-game(?:\/[a-z0-9-]+)?|lich-su(?:\/[a-zA-Z0-9-]+)?|tai-khoan|tin-tuc(?:\/[a-z0-9-]+)?)?$/.test(url.pathname)) return fallback;
  return url.pathname + url.search;
}
export const loginHref = (next) => `/dang-nhap?next=${encodeURIComponent(safeNext(next))}`;
export function gameImage(game) {
  const image = game.slug === 'mobile-legends' ? 'https://static2.pisapapeles.net/uploads/2025/11/Mobile_Legends_Bang_Bang_ML.jpg' : game.image;
  return /^(https:\/\/|\/(?!\/))/.test(image || '') ? image : '/zetgaming-fire-bg.png';
}
