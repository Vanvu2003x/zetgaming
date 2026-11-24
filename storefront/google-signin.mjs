import { escapeHtml as e, safeNext } from './shared.mjs';

export function googleSignin(next, providers = []) {
  const contents = '<img src="/google-g.png" width="20" height="20" alt=""><span>Tiếp tục với Google</span>';
  return providers.includes('google')
    ? `<a class="google-signin" href="/api/auth/oauth/google?next=${e(encodeURIComponent(safeNext(next)))}">${contents}</a>`
    : `<button class="google-signin" type="button" disabled title="Đăng nhập Google chưa được cấu hình">${contents}</button>`;
}

export const googleErrors = {
  cancelled: 'Bạn đã hủy đăng nhập Google. Bạn có thể thử lại.',
  invalid_state: 'Phiên đăng nhập Google đã hết hạn. Vui lòng bấm Google để thử lại.',
  failed: 'Chưa thể đăng nhập Google. Vui lòng thử lại.',
  unavailable: 'Đăng nhập Google chưa sẵn sàng. Vui lòng dùng email và mật khẩu.',
  link_required: 'Tài khoản này cần đăng nhập bằng mật khẩu để bảo vệ quyền truy cập.',
};

export function authConsent() {
  return `<label class="check-label auth-consent"><input type="checkbox" name="terms" required> <span>Tôi đồng ý với <a href="/dieu-khoan-dich-vu" target="_blank" rel="noopener">Điều khoản sử dụng</a> và <a href="/chinh-sach-bao-mat" target="_blank" rel="noopener">Chính sách bảo mật</a>.</span></label>`;
}
