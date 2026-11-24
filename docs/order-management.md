# Quản lý đơn: ghi chú, đối soát, hủy và hoàn tiền

## Quy tắc

- Ghi chú chỉ admin được đọc, dạng bổ sung, không sửa/xóa. Không đưa mật khẩu/OTP vào ghi chú hoặc lý do. Lịch sử hiển thị 100 sự kiện gần nhất, gồm người thực hiện và thời điểm; toàn bộ sự kiện vẫn ở database.
- `processing → needs_review` khi chưa rõ kết quả. Chỉ admin đang giữ đơn được xác nhận đối soát: `delivered → completed`, `not_delivered → failed`. Không thử lại/hủy/hoàn khi chưa rõ kết quả.
- Đơn chờ xử lý hoặc đang nạp có thể chuyển `failed` sau khi xác nhận chưa giao vật phẩm. Đơn đang nạp chỉ người đã nhận được báo lỗi.
- `failed → pending_admin` để thử lại sau khi đã xác nhận chưa giao vật phẩm; không trừ ví lần nữa.
- Hủy chỉ từ `awaiting_payment`, `pending_admin`, `failed`. Hủy không tự hoàn tiền. Đơn hoàn thành hoặc luồng CTV cũ không dùng các thao tác này.
- Hoàn **toàn bộ** số tiền đã chốt, chỉ từ đơn đã hủy và có `paid_at`. Không hỗ trợ hoàn một phần hoặc đơn đã giao vật phẩm trong phiên bản này.
- Hoàn ví đối chiếu khoản trừ ví gốc, tạo sổ giao dịch và cộng ví trong cùng transaction; unique refund/order và reference chống hoàn hai lần.
- Hoàn chuyển khoản: lập yêu cầu `refund_pending`, admin tự chuyển tiền ngoài web, nhập mã giao dịch và xác nhận để ghi `refunded`. Web không tự chuyển tiền. Mã giao dịch hoàn tiền không được dùng cho hai yêu cầu khác nhau.
- Đơn hủy trước khi trả tiền không được hoàn. Nếu tiền vào sau hủy, admin đối soát và ghi nhận khoản tiền vào trước, sau đó lập hoàn chuyển khoản.

## API chỉ dành cho admin

`POST /api/admin/orders/:code/notes` nhận `{body}`; các action `cancel`, `retry`, `refund` nhận `{reason,confirmed:true}`. `report-issue` nhận `{reason,outcome:'unknown'|'not_delivered',confirmed}`; `resolve-issue` nhận `{reason,outcome:'delivered'|'not_delivered',confirmed:true}`. `confirm-refund` nhận `{reference,confirmed:true}`; `record-late-payment` nhận `{reason,reference,confirmed:true}`. Tất cả kiểm tra CSRF, role, trạng thái và khóa dòng order; mọi thay đổi nghiệp vụ được audit cùng transaction.

Chi tiết admin có `notes`, `events`, `refund`, `paid_at`, `cancelled_at`. API tra cứu công khai không trả các trường nội bộ, lý do, ghi chú hoặc mã giao dịch hoàn tiền.

## Release và rollback

Backup database và env, thử restore vào database tạm. Áp dụng migration 010 trước khi restart backend/frontend/admin mới. Migration backfill thời điểm đã thanh toán từ đơn và audit hiện có, không tạo giao dịch ví hay hoàn tiền.

Giữ schema mở rộng khi rollback code. Không dùng phiên bản cũ để thao tác các đơn `failed`, `needs_review`, `refund_pending`, `refunded`; ưu tiên triển khai bản sửa tiếp. Không restore dump cũ lên production sau khi có giao dịch mới để rollback giao diện.
