# Implementation Plan: Coupon hoàn tiền cho đơn khách ẩn danh

## Overview

Cho phép đơn chuyển khoản của khách không đăng nhập được xử lý như đơn vãng lai. Khi đơn vãng lai thất bại, hệ thống tự phát hành một coupon có giá trị hoàn tương ứng. Coupon được dùng một lần cho một đơn mới, được trừ server-side trong transaction và có màn quản lý riêng trong Admin.

## Architecture Decisions

- Coupon được lưu riêng, liên kết với đơn nguồn và đơn sử dụng; không lưu plaintext ở audit ngoài mã coupon cần hiển thị cho khách/admin.
- Mã coupon là một lần dùng, khóa row bằng `FOR UPDATE` khi áp dụng để chống double-spend.
- Đơn direct không đăng nhập dùng `guest_token_hash`; ví ZetGaming vẫn bắt buộc tài khoản.
- Coupon phát hành tự động khi admin xác nhận đơn vãng lai `failed`; khách xem coupon trên trang chi tiết/tra cứu đơn.
- Giá thanh toán cuối được lưu ở `orders.price_cents`; giá gốc và mức giảm được lưu riêng để admin/audit minh bạch.

## Task List

### Phase 1: Foundation
- [ ] Migration coupon, liên kết đơn nguồn/đơn sử dụng, giá gốc và giảm giá.
- [ ] API/service phát hành coupon idempotent cho đơn vãng lai thất bại.
- [ ] Mở direct checkout cho guest, giữ wallet checkout bắt buộc đăng nhập.

### Checkpoint: Foundation
- [ ] Migration chạy được.
- [ ] Build và test transaction coupon pass.

### Phase 2: Checkout
- [ ] Thêm ô nhập coupon vào form thanh toán.
- [ ] Áp dụng coupon atomically, chỉ dùng một lần, tính lại số tiền QR.
- [ ] Hiển thị mã coupon ở trang chi tiết đơn thất bại/tra cứu.

### Phase 3: Admin
- [ ] API danh sách coupon và thu hồi coupon chưa dùng.
- [ ] Khu vực Coupon trong Admin: mã, giá trị, đơn nguồn, đơn dùng, trạng thái, thời gian.
- [ ] Audit thao tác phát hành, dùng và thu hồi.

### Checkpoint: Complete
- [ ] Guest tạo đơn direct → admin đánh dấu thất bại → coupon xuất hiện.
- [ ] Guest dùng coupon cho đơn mới → discount đúng, coupon chuyển redeemed.
- [ ] Gửi lại request hoặc dùng lại mã không thể trừ lần hai.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Double-spend coupon | High | Row lock + trạng thái redeemed trong cùng transaction |
| Coupon bị đoán | High | Mã random đủ dài, rate limit và không liệt kê mã đầy đủ ở log |
| Đơn coupon = 0 | Medium | Đánh dấu đã thanh toán và chuyển pending_admin, không tạo QR 0đ |
| Khách mất cookie guest | Medium | Tra cứu bằng mã đơn; coupon được hiển thị lại trong trang đơn |

## Open Questions

- Coupon hiện chưa gửi email tự động; trước mắt hiển thị ngay trên trang đơn và Admin.

---

# Implementation Plan: Gmail Pub/Sub ACB Reconciliation

## Overview

Nhận thông báo email biến động số dư ACB qua Gmail API + Google Cloud Pub/Sub, bóc tách nội dung `ZET<MÃ ĐƠN>ZET`, rồi đối soát an toàn với đơn chuyển khoản và nạp ví.

## Architecture Decisions

- Pub/Sub chỉ đánh thức worker; worker dùng `historyId` để đọc message mới từ Gmail API.
- Parser chỉ nhận email từ sender/subject đã cấu hình, mã đơn phải đúng định dạng và số tiền phải khớp.
- Lưu `provider_event_id`/Message-ID để idempotent; giao dịch mơ hồ đi vào `needs_review`, không tự xác nhận.
- Gmail watch phải được gia hạn định kỳ; khi chưa đủ cấu hình thì integration tắt và không ảnh hưởng luồng thủ công.

## Task List

### Phase 1: Contract and parser
- [x] Thêm cấu hình Gmail/PubSub vào env example.
- [x] Parser email ACB: sender, amount, reference, content, occurredAt, order code.
- [x] Test mã `ZET...ZET`, email lỗi, số tiền lỗi và nội dung nhiễu.

### Phase 2: Secure ingestion
- [x] Endpoint Pub/Sub push có xác thực OIDC/audience.
- [x] Gmail history/message client với scope readonly.
- [x] Migration lưu mailbox cursor, raw event hash và trạng thái xử lý.

### Phase 3: Reconciliation
- [ ] Match đơn nạp game và wallet top-up trong transaction.
- [ ] Chống duplicate, mismatch amount, duplicate order và replay.
- [ ] Ghi audit và đưa trường hợp bất thường vào `needs_review`.

### Checkpoint: Config-ready
- [x] Không bật auto-confirm khi thiếu config.
- [x] Parser/unit/integration tests pass.
- [x] Build pass và manual test bằng fixture email.

## Open Questions

- Gmail nhận thông báo nào và email sender/subject cụ thể của ACB là gì?
- Dùng Pub/Sub push URL hay pull subscription trên VPS?
- Có cần tự động xác nhận cả wallet top-up và đơn game trong cùng worker không?

---

# Implementation Plan: ZetGaming Admin UI/UX Redesign with Lucian

Chi tiết đầy đủ nằm ở [docs/admin-redesign-lucian-plan.md](../docs/admin-redesign-lucian-plan.md). Phạm vi lần này là redesign UI/UX, chưa thay đổi API/nghiệp vụ.

## Task List

### Phase 1: Foundation
- [ ] Tách admin design tokens và chuẩn hóa typography, spacing, color/status, focus.
- [ ] Làm lại admin shell: sidebar nhóm, topbar, breadcrumb, drawer mobile, toast/dialog.
- [ ] Port có scope các Lucian elements cho navigation, feedback và filter surface; giữ MIT credit.

### Checkpoint: Shell
- [ ] Tất cả route admin hiện tại vẫn mở.
- [ ] Responsive pass ở 375/768/1024/1440px.
- [ ] Keyboard/focus/reduced-motion pass.

### Phase 2: Operations first
- [ ] Redesign dashboard theo priority queue + KPI + chart + activity.
- [ ] Redesign đơn hàng thành data table/card responsive và detail drawer.
- [ ] Redesign payment/reconciliation và trạng thái needs-review.

### Checkpoint: Money flows
- [ ] Không nhầm payment state với fulfillment state.
- [ ] Confirm/retry/refund có lý do, loading, success/error feedback.
- [ ] Không lộ secret/login game trong UI hoặc log.

### Phase 3: Catalog and management
- [ ] Redesign kho game, upload/preview banner-thumbnail và editor.
- [ ] Redesign gói nạp compact, có ảnh, số đơn và doanh thu nếu API có dữ liệu.
- [ ] Redesign phân loại, nội dung cửa hàng, khách hàng, CTV và coupon.

### Phase 4: Analytics and hardening
- [ ] Redesign báo cáo, thanh toán cấu hình và bảo mật.
- [ ] Visual regression + browser smoke + accessibility checklist.
- [ ] Build image, deploy staging, kiểm tra rồi mới promote production.

## Open Questions

- Chốt ưu tiên màu tối OLED hoàn toàn hay dark navy có light surface cho bảng.
- Admin muốn ưu tiên desktop hay dùng mobile tablet thường xuyên.
- Có cần command search toàn hệ thống và phím tắt cho các thao tác đơn hàng không.
