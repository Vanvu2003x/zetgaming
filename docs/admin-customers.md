# Quản lý khách hàng trong Admin

Trang `/customers` dành cho admin, hiển thị email, vai trò, tier, số đơn, tổng tiền nạp và số phiên còn hiệu lực.

- `PATCH /api/admin/customers/:id` đổi `active`, `tier` hoặc `role`.
- Khóa tài khoản sẽ xóa toàn bộ phiên đăng nhập hiện tại.
- `POST /api/admin/customers/:id/revoke-sessions` chỉ thu hồi phiên, không khóa tài khoản.
- Hệ thống không cho khóa hoặc hạ quyền admin cuối cùng đang hoạt động.
- Tài khoản bị khóa không thể đăng nhập bằng mật khẩu hoặc Google OAuth.

Các thao tác đều yêu cầu phiên admin, CSRF và được ghi vào `audit_events`.
