# Admin trực tiếp xử lý đơn nạp

Luồng mới: `awaiting_payment → pending_admin → processing → completed`.
Đơn bằng ví đã trừ tiền bắt đầu ở `pending_admin`. Không phân CTV, không cộng thu nhập CTV và không trừ ví lần nữa.

- `GET /api/admin/orders/:code`: chỉ admin; giải mã UID/thông tin game theo danh sách trường cho phép. Phản hồi private/no-store, ghi audit lượt xem nhưng không ghi nội dung nhạy cảm.
- `POST /api/admin/orders/:code/confirm-payment`: đối soát tiền vào thực tế rồi xác nhận, dùng endpoint hiện có.
- `POST /api/admin/orders/:code/start`: chỉ nhận đơn `pending_admin`, lưu admin và thời điểm nhận; khóa dòng để chỉ một admin nhận thành công.
- `POST /api/admin/orders/:code/complete`: chỉ admin đã nhận, đơn đang `processing`, body `{confirmed:true}` sau khi nạp thành công. Ghi thời điểm hoàn thành và audit một lần.
- Các thao tác ghi yêu cầu CSRF. Tra cứu công khai/khách không được trả thông tin đăng nhập game.

Màn hình Admin → Đơn hàng → Chi tiết có sao chép UID/tài khoản, mật khẩu thu gọn khi tồn tại, checkbox đối soát và xác nhận kết quả. Đóng hộp thoại sẽ xóa nội dung riêng tư khỏi DOM. Các trạng thái CTV cũ được giữ, không tự chuyển sang luồng mới.

## Release

Backup PostgreSQL và private env; kiểm tra bản dump khôi phục được. Áp dụng migration `009_admin_fulfillment.sql` trước khi restart ứng dụng mới. Migration thêm cột và trạng thái, không sửa đơn đang có. Chạy kiểm thử `test/admin-fulfillment.test.mjs`, guest checkout, auth/admin HTTP và build.

Rollback code không xóa migration/cột. Khi đã có đơn `processing`, không dùng giao diện cũ để xử lý chúng; giữ backend/giao diện hiểu trạng thái này hoặc triển khai bản sửa tiếp. Không khôi phục dump cũ lên production sau khi có giao dịch mới chỉ để rollback giao diện.
