# Coupon hoàn tiền

- [x] Migration/schema
- [x] Guest direct checkout
- [x] Auto issue coupon on failed guest order
- [x] Coupon input and atomic redemption
- [x] Show coupon on failed order
- [x] Admin coupon list/revoke
- [ ] Tests/build/manual flow

## Gmail Pub/Sub ACB

- [x] Thêm env/config placeholder, integration mặc định tắt.
- [x] Viết parser email ACB và test fixture.
- [x] Tạo Pub/Sub push endpoint có xác thực.
- [x] Thêm Gmail history cursor và chống xử lý trùng.
- [x] Nối reconciliation vào orders/wallet top-ups.
- [x] Gia hạn Gmail watch định kỳ và tài liệu cấu hình VPS.

## Admin UI/UX redesign — Lucian

- [x] Audit baseline screenshot và task flows cho các route admin.
- [x] Design tokens + AdminShell + grouped navigation + responsive drawer.
- [x] Dashboard priority queue, KPI, chart và activity timeline.
- [ ] Orders/payment/reconciliation table, mobile card và detail drawer.
- [ ] Catalog game/package/category editors với image preview.
- [ ] Customers/CTV/coupon/reports/security visual refresh.
- [ ] Accessibility, reduced-motion, responsive và visual regression.
- [ ] Staging deploy, smoke test và production promote.
