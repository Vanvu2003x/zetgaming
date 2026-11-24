# Danh sách triển khai

Chưa có mục triển khai nào hoàn tất. Mỗi việc gồm DB/API/UI tối thiểu cần thiết, rồi kiểm tra trước khi chuyển việc. Kích thước dự kiến S–M (1–5 file nghiệp vụ mỗi việc); nếu vượt thì tách tiếp. Các lệnh kiểm thử dự kiến: npm test, npm run test:integration, npm run test:e2e, npm run build; sẽ định nghĩa khi khởi tạo.

| ID | Việc | Phụ thuộc | Điều kiện nghiệm thu | Kiểm tra | Vùng file dự kiến |
| --- | --- | --- | --- | --- | --- |
| 01 | Chốt quy tắc và contract | Không | Tiền CTV, duyệt, trùng khách, thanh toán, OTP và rút có quyết định rõ | Rà lại với tài liệu yêu cầu | docs/contracts, tasks |
| 02 | Workspace và môi trường | Không | Web/API/worker chạy; cấu hình validate; không có secrets trong git | Build, health check | package.json, apps, infra |
| 03 | Migration nền | 02 | Migration chạy mới/upgrade; DB test riêng; constraint có tên | Integration với PostgreSQL | migrations, tests/db |
| 04 | Tài khoản khách | 03 | Đăng ký/login/logout; hash; phiên thu hồi được | Auth integration/E2E | api/auth, web/auth |
| 05 | Quyền admin/CTV và MFA | 04 | Kiểm tra quyền server; khóa user mất quyền; MFA và recovery | Kiểm thử truy cập trái phép | api/access, web/security |
| 06 | Game và gói | 05 | Admin CRUD/bật tắt; khách chỉ thấy gói được bán | API/UI và validation | api/catalog, web/catalog |
| 07 | Hạng và giá | 01,06 | Giá theo hạng; khách không tự đổi hạng/giá; thiếu giá không bán nhầm | Test giá server | api/pricing, web/admin/pricing |
| 08 | Sổ giao dịch và số dư | 03,05 | Ledger đối soát; mã nghiệp vụ unique; rollback đồng bộ | Test tiền/concurrency | api/wallet, migrations/wallet |
| 09 | Đơn thanh toán bằng ví | 07,08 | Đơn và trừ ví nguyên tử; retry cùng kết quả; không âm ví | Gửi lặp/đồng thời/injection lỗi | api/orders, web/checkout |
| 10 | Thanh toán trực tiếp | 01,09 | Intent đúng tiền; xác nhận unique; đơn chưa trả không phân | Integration đối soát/replay | api/payments, web/payment |
| 11 | Khách nạp ví | 08,10 | Yêu cầu nạp có trạng thái; xác nhận chỉ cộng một lần | Replay/đồng thời | api/deposits, web/wallet |
| 12 | Duyệt/phân đơn checkbox | 05,10 | Chọn một số/tất cả; kiểm tra đủ điều kiện; audit danh sách | Permission/integration/UI | api/dispatch, web/admin/orders |
| 13 | CTV nhận độc quyền | 12 | N CTV nhận đồng thời chỉ một thành công; còn lại 409 | Test concurrency PostgreSQL thật | api/claims, web/ctv/orders |
| 14 | Thông tin login bảo vệ | 01,13 | Mã hóa; xem theo quyền; audit; không lộ danh sách/log | Quyền/decryption/tamper test | api/credentials, web/ctv/detail |
| 15 | Báo kết quả và bằng chứng | 14 | Upload riêng tư; kết quả rõ/chưa rõ; không tự phân lại đơn đang nạp | Upload/status/permission | api/fulfillment, web/ctv/result |
| 16 | Duyệt hoàn thành/thu nhập | 01,08,15 | Duyệt hợp lệ; ghi có một lần; lưu mức trả đã chốt | Replay/transaction test | api/settlement, web/admin/review |
| 17 | CTV yêu cầu rút | 01,16 | Giữ số dư; nhiều yêu cầu không tiêu quá tiền; CTV chỉ xem của mình | Concurrency/E2E | api/withdrawals, web/ctv/wallet |
| 18 | Admin xử lý rút | 17 | Duyệt/chi/từ chối đúng giữ tiền; lưu đối soát; không trả lặp | Replay/trạng thái không rõ | api/payouts, web/admin/payouts |
| 19 | Hủy/hoàn/thu hồi | 01,16 | Chuyển trạng thái hợp lệ; hoàn một lần; phân lại cần xác minh | Race cancel/claim/refund | api/order-actions, web/admin/actions |
| 20 | Telegram qua outbox | 12,16 | Chỉ thông báo; lỗi bot không rollback đơn; không chứa bí mật | Worker retry/redaction | worker/telegram, api/outbox |
| 21 | Khảo sát và token giao diện | 06 | Chốt bố cục từ 3 nguồn; không tự chọn thương hiệu; mobile/reduced-motion | Xem runtime/reference | docs/design, web/styles |
| 22 | Trang chủ shop | 21 | Tìm/chọn game; hình và chữ gọn; responsive | Browser/keyboard | web/home |
| 23 | Trang nạp hoàn thiện | 09,10,14,21 | UID/login đúng form; giá/tổng rõ; chống gửi lặp có phản hồi | Checkout E2E/mobile | web/checkout |
| 24 | Tài khoản và lịch sử khách | 11,19,21 | Ví/đơn đúng người; lọc/phân trang; trạng thái rõ | Ownership/E2E | web/account, api/history |
| 25 | Quản lý người dùng/CTV | 05,07 | Gán hạng/quyền có audit; khóa phiên; không tự nâng quyền | Authorization/E2E | web/admin/users, api/users |
| 26 | Báo cáo và nội dung | 16,18,19 | Doanh thu/chi phí đối soát ledger; cấu hình/banner validate | Fixture báo cáo/XSS | api/reports, web/admin/settings |
| 27 | Contract UID và simulator | 09,19 | Idempotency/status/reconcile; timeout cần kiểm tra; không gọi live giả | Provider contract test | api/providers, tests/providers |
| 28 | Security và phục hồi lỗi | 04–27 | CSRF/XSS/IDOR/upload/rate limit; restart/replay; không lộ secrets | Integration/security/E2E | tests/security, docs/security |
| 29 | Staging và backup/restore | 28 | HTTPS; secrets đúng; restore cả DB/khóa; health/log rotation | Smoke/restore drill | infra, docs/operations |
| 30 | Nghiệm thu/release | 29 | Toàn luồng đạt; giới hạn live ghi rõ; rollback và hướng dẫn đủ | Full test/build/smoke | docs/release |

## Checkpoint

- [ ] Sau 02–05: chạy được, phiên/quyền/MFA kiểm tra xong.
- [ ] Sau 06–09: giá theo hạng và mua bằng ví đúng; chống trùng/âm ví được chứng minh.
- [ ] Sau 10–13: thanh toán/duyệt/phân/claim hoàn chỉnh; nhiều CTV chỉ một người nhận.
- [ ] Sau 14–16: bảo vệ login và quyết toán đơn đúng.
- [ ] Sau 17–20: rút/hoàn/Telegram hoạt động khi gửi lặp và restart.
- [ ] Sau 21–27: cả ba vai trò có giao diện đầy đủ; UID chưa live được ghi rõ.
- [ ] Sau 28–30: bảo mật, phục hồi, staging và hồ sơ release đạt.

Trước khi bắt đầu code: chủ hệ thống xem kế hoạch. Các quyết định chưa chốt chỉ chặn phần nghiệp vụ phụ thuộc, không chặn công việc nền tảng đã được cho phép.
