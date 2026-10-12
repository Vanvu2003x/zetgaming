# Kế hoạch triển khai toàn bộ hệ thống nạp game

Ngày: 12/10/2026. Trạng thái: kế hoạch để người dùng xem; chưa triển khai code.
Nguồn yêu cầu: ../HIEU_HE_THONG_NAP_GAME.md. Yêu cầu đã xác nhận trong tài liệu đó ưu tiên hơn các phương án đề xuất ở đây.

## 1. Công nghệ đề xuất

- JavaScript ESM cho toàn bộ mã ứng dụng; Node.js 24 LTS cho API, worker và công cụ. Không dùng PHP/Python làm backend.
- React + Vite cho giao diện khách, admin và CTV; CSS với hệ token dùng chung, animation có chế độ giảm chuyển động.
- Fastify cho API, validation schema và kiểm tra quyền phía server.
- PostgreSQL cho đơn, thanh toán và sổ giao dịch ví; dùng pg và migration SQL có phiên bản để kiểm soát transaction/constraint trực tiếp.
- Worker Node.js đọc transactional outbox trong PostgreSQL để gửi Telegram và xử lý tác vụ nền. Chưa cần Redis ở giai đoạn đầu.
- npm workspaces: apps/web, apps/api, apps/worker, packages/contracts; migrations, tests, docs và infra ở thư mục gốc.
- node:test cho nghiệp vụ và integration test với PostgreSQL thật; Playwright cho kiểm thử luồng trình duyệt.
- Docker Compose cho môi trường chạy; reverse proxy HTTPS cho production. Chốt phiên bản dependency và lockfile khi khởi tạo.

Node.js chạy mã ứng dụng; PostgreSQL vẫn là dịch vụ dữ liệu riêng. Không hiểu “Node hết” là lưu ví/đơn trong file hoặc bộ nhớ Node.

Nguồn kỹ thuật đã tham khảo: https://nodejs.org/en/about/previous-releases ; https://fastify.dev/docs/latest/ ; https://www.postgresql.org/docs/current/transaction-iso.html .

## 2. Các quyết định nghiệp vụ cần chốt trước phần phụ thuộc

| Vấn đề | Phương án đề xuất, chưa được người dùng duyệt |
| --- | --- |
| Tiền trả CTV | Mức trả cố định cho mỗi gói; lưu mức trả tại lúc phân đơn. Chưa chốt giá riêng từng CTV |
| Ghi có ví CTV | Admin duyệt bằng chứng hoàn thành rồi ghi có một lần |
| Thanh toán trực tiếp/nạp ví | Bước đầu admin đối soát chuyển khoản; tích hợp tự động khi có nhà cung cấp và thông tin kết nối |
| Hạng khách | Admin tạo hạng và gán thủ công trước; chưa làm tự nâng hạng |
| Trùng đơn khách | Chặn gửi lặp cùng yêu cầu; quy tắc chặn đơn mới cùng tài khoản đang xử lý còn cần xác nhận |
| Rút CTV | Giữ số dư khi tạo yêu cầu; admin xác minh và chi trả; không tự động chuyển tiền ngân hàng khi chưa có tích hợp |
| Login/OTP | Trường nhập theo cấu hình game; cần chốt game đầu tiên và cách trao đổi OTP |
| Thu hồi đơn | Chỉ phân lại khi đã xác minh chưa nạp; kết quả không rõ phải vào trạng thái cần kiểm tra |
| Dữ liệu login | Chỉ người được phép xử lý xem; cần chốt thời hạn xóa và quyền xem của admin |

Có thể làm nền tảng tài khoản, danh mục và bố cục trước. Không mặc định các phương án trên là yêu cầu đã được duyệt.

## 3. Phạm vi hoàn chỉnh

Khách: đăng ký/đăng nhập, danh mục game, tìm kiếm, gói và giá theo hạng, form UID/login, thanh toán trực tiếp/ví, nạp ví, lịch sử giao dịch, trạng thái đơn và thông tin tài khoản.

CTV: đăng nhập, đơn được phân, nhận đơn độc quyền, xem thông tin login có kiểm soát, gửi kết quả/bằng chứng, báo lỗi, ví thu nhập và yêu cầu rút.

Admin: danh mục game/gói, hạng và giá, khách, CTV, duyệt thanh toán, duyệt/phân đơn bằng checkbox chọn một số/tất cả, kiểm tra hoàn thành, hoàn tiền, rút CTV, phân quyền nhân viên, Telegram, nội dung web, nhật ký và báo cáo.

UID: xây contract nhà cung cấp và bộ giả lập để kiểm thử. Tích hợp live chỉ khi có game/API thật; không coi mock là nạp game thực tế.

## 4. Mô hình dữ liệu và trạng thái

Các nhóm bảng: users, roles/permissions, sessions, customer_tiers, games, packages, tier_prices, ctv_rates, orders, order_assignments, order_events, encrypted_credentials, payment_intents, payment_events, wallet_accounts, ledger_transactions/entries, wallet_holds, withdrawal_requests, fulfillment_attempts, evidence_files, idempotency_requests, outbox_events, audit_events và site_settings.

- Tiền VND dùng số nguyên, không tính bằng số thực; server tính lại giá, không tin giá từ trình duyệt.
- Giá, gói và mức trả lưu snapshot; thay đổi cấu hình không sửa lịch sử đơn.
- Số dư có thể dùng cache trong DB nhưng sổ giao dịch là căn cứ đối soát; ghi cache và ledger trong cùng transaction.
- Trạng thái thanh toán tách khỏi trạng thái thực hiện đơn.
- Luồng đề xuất: chờ thanh toán → chờ admin duyệt → sẵn sàng nhận → đã nhận → đang nạp → chờ duyệt kết quả → hoàn thành. Nhánh: bị từ chối, đã hủy, cần kiểm tra. Hoàn tiền theo nghiệp vụ thanh toán riêng.
- Chuyển trạng thái chỉ qua lệnh nghiệp vụ có điều kiện và audit; không có API tùy ý sửa status/số dư.

## 5. Chống trùng và ACID

1. Tạo đơn có khóa idempotency gắn người dùng và nội dung yêu cầu: gửi lại trả cùng kết quả; cùng khóa nhưng nội dung khác bị từ chối. Unique constraint là hàng rào cuối.
2. Nhận đơn dùng cập nhật có điều kiện trong transaction, kiểm tra CTV được phân và trạng thái hiện tại. Chỉ một claim thành công; các lượt khác nhận HTTP 409 với thông báo ngắn.
3. Thanh toán, hoàn tiền, ghi có CTV có mã nghiệp vụ duy nhất. Webhook lặp hoặc admin bấm lại không tạo bút toán lần hai.
4. Mua bằng ví phải tạo đơn, trừ tiền/ghi ledger và ghi outbox trong cùng transaction. Các luồng nhiều điều kiện dùng khóa hàng hoặc SERIALIZABLE phù hợp, retry có giới hạn khi transaction xung đột.
5. Rút tiền phải giữ số dư nguyên tử; duyệt/chi trả/từ chối không được tiêu cùng khoản giữ hai lần. Chi trả ngoài hệ thống chưa rõ kết quả phải đối soát, không gửi lại mù quáng.
6. Outbox commit cùng nghiệp vụ; worker có thể chạy lại. Thông báo Telegram có thể bị lặp trong trường hợp phản hồi không rõ, nhưng không được gây nạp hoặc ghi tiền lặp.
7. Nạp UID chỉ retry an toàn khi nhà cung cấp hỗ trợ khóa chống lặp hoặc tra cứu xác minh. Timeout đưa vào cần kiểm tra.
8. Nạp login thủ công không thể bảo đảm exactly-once bên ngoài web bằng ACID. Không tự giải phóng đơn đang nạp do hết giờ; yêu cầu xác minh trước khi phân lại.

## 6. Bảo mật cần triển khai và nghiệm thu

- Session server-side với cookie HttpOnly/Secure/SameSite, bảo vệ CSRF, thu hồi phiên; mật khẩu web hash Argon2id. MFA cho admin/CTV, recovery có kiểm soát.
- Phân quyền server-side theo vai trò, chủ sở hữu và CTV được phân/đã nhận; chống đọc đơn, ví, tệp của người khác bằng đổi ID.
- Thông tin login game mã hóa xác thực, ví dụ AES-256-GCM, khóa ngoài DB, quản lý phiên bản/rotation. Mật khẩu web phải hash, không mã hóa để giải ngược.
- Không đưa login/OTP vào Telegram, URL, log, analytics hoặc API danh sách. Màn hình xem bí mật có audit và không cache; hạn chế dữ liệu trả về.
- Validation, SQL tham số, chống XSS, CSP, giới hạn request/login, quản lý secrets, kiểm tra upload và tệp bằng chứng có quyền truy cập.
- Sự kiện tiền/đơn/quyền được audit; chỉnh sửa tài chính bằng bút toán điều chỉnh có lý do. Không cho người vận hành sửa lịch sử tùy ý.
- Backup DB mã hóa, bảo vệ và lưu dự phòng khóa mã hóa, kiểm thử phục hồi. Nếu thiếu khóa thì dữ liệu login không phục hồi được.
- Kiểm thử bảo mật và cập nhật dependency trước production. Không đưa ra cam kết không thể bị hack.

## 7. Giao diện

Khách phối hợp ShopThinhSang (luồng nạp), Eris (shop ngắn gọn) và Easyup (tham khảo chuyển động). Cần khảo sát runtime ShopThinhSang và animation Easyup kỹ hơn trước khi chốt thiết kế.

Trang chủ: header gọn, banner ngắn, tìm game, lưới game. Trang game: ảnh, gói/giá, form phù hợp và tổng tiền rõ. Các màn ví/lịch sử ưu tiên số tiền và trạng thái. Admin/CTV ưu tiên bảng, lọc và thao tác rõ ràng; không áp dụng ít chữ bằng cách bỏ dữ liệu cần thiết.

Animation tập trung ở thẻ game, chọn gói, chuyển bước và phản hồi thao tác; responsive/mobile, keyboard, reduced-motion. Chưa chốt thương hiệu, bảng màu và tài sản hình/video.

## 8. Thứ tự triển khai

Chi tiết từng việc và điều kiện nghiệm thu nằm trong todo.md.

1. Chốt contract/quy tắc tiền → khởi tạo workspace và database → tài khoản/quyền.
2. Danh mục và giá theo hạng → ledger/ví → tạo đơn bằng ví chống lặp. Kiểm thử cạnh tranh sớm.
3. Thanh toán trực tiếp/nạp ví → duyệt và phân checkbox → CTV nhận độc quyền.
4. Bí mật login → kết quả nạp/duyệt → thu nhập CTV → rút tiền/hoàn tiền.
5. Telegram → giao diện hoàn thiện → báo cáo/quản lý nội dung → contract UID.
6. Kiểm thử toàn luồng, lỗi/khôi phục và bảo mật → môi trường staging → kiểm thử backup/restore → chuẩn bị release.

Sau mỗi 2–3 việc chạy kiểm thử liên quan và build. Làm từng lát tính năng từ DB đến API/UI; không đợi viết xong toàn bộ API mới nối giao diện. Schema/tiền/claim làm tuần tự; màn hình độc lập có thể làm song song sau khi contract ổn định.

## 9. Điều kiện hoàn tất

- Khách thanh toán cả hai cách; giá đúng hạng; admin duyệt/phân; một CTV xử lý; tiền ghi đúng; rút/hoàn có đối soát.
- Kiểm thử đồng thời chứng minh một lượt nhận thành công, không âm ví, không bút toán trùng; injection lỗi chứng minh transaction rollback.
- Restart/retry/webhook lặp không làm mất hoặc lặp nghiệp vụ; trạng thái không rõ không bị nạp lại tự động.
- Kiểm thử quyền không lộ đơn, ví, login hay bằng chứng; kiểm tra log và Telegram không chứa bí mật.
- Giao diện mobile/desktop và reduced-motion đạt kiểm tra; hướng dẫn chạy, quản trị, khôi phục và triển khai đầy đủ.
- Tích hợp chưa có thông tin thật được ghi là chưa kết nối; không công bố sẵn sàng bán game UID trước khi xác minh live.
- Production cần thông tin hạ tầng, domain, thanh toán và Telegram thật; việc triển khai production là bước riêng sau nghiệm thu.
