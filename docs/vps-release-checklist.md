# ZetGaming — yêu cầu và checklist release VPS

Tài liệu này gom các yêu cầu đã chốt trong quá trình làm giao diện, storefront, admin và vận hành. Đây là checklist nghiệm thu trước khi đưa bản hiện tại lên VPS; không xem các tài khoản demo/local là thông tin production.

## 1. Phạm vi sản phẩm cần có trên VPS

### Storefront khách hàng

- Website là nhiều trang SSR, không còn phụ thuộc vào một màn hình SPA duy nhất:
  - `/` — trang chủ, hero/banner và game bán chạy.
  - `/nap-game` — danh mục tất cả game, tìm kiếm/lọc/sắp xếp.
  - `/nap-game/:slug` — trang nạp riêng của từng game, chọn gói và nhập thông tin.
  - `/lich-su` và `/lich-su/:code` — lịch sử và chi tiết đơn của tài khoản hiện tại.
  - `/tin-tuc` — trang tin tức.
  - `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/tai-khoan` — luồng tài khoản.
- Bấm card game phải đi thẳng đến trang nạp game tương ứng.
- Khu vực game trên trang chủ có hai phần rõ ràng: game bán chạy và danh mục tất cả game.
- Card game bán chạy giữ bố cục hiện tại nhưng bỏ phần chữ “giá từ” nếu còn xuất hiện.
- Trang danh mục dùng icon game vuông, tên game, số lượng/loại nạp và CTA rõ ràng; responsive tốt trên mobile và desktop.
- Trang nạp game phải gọn, ít chữ thừa, có thông tin người chơi, chọn gói, thanh toán và trạng thái lỗi/thành công rõ ràng.
- Form game chỉ hiển thị đúng trường cần thiết theo kiểu nạp UID/login; không làm người dùng nhập lại UID khi hệ thống tự có sẵn.
- Không hiển thị các block hướng dẫn nhập thông tin hoặc thông tin bổ sung thừa nếu game không cần.
- Footer là footer chuẩn, có liên kết/trợ giúp/thông tin liên hệ và không tạo khoảng trống bất thường ở cuối trang.

### Giao diện và responsive

- Phong cách chữ tham khảo Naperis: dễ đọc, đậm vừa, phân cấp rõ; không dùng cỡ chữ/icon làm vỡ bố cục.
- Bộ icon dùng thư viện nhất quán, sắc nét và cùng một stroke; ưu tiên Phosphor hoặc bộ icon đã được duyệt trong repo.
- Desktop và mobile dùng cùng tinh thần visual nhưng bố cục riêng hợp lý; không thu nhỏ cứng desktop vào viewport nhỏ.
- Mobile khoảng 320–430px phải không tràn ngang, margin hai bên cân đối, banner/card không bám sát mép màn hình.
- Header mobile: logo, tìm kiếm, menu, ngôn ngữ và avatar/tài khoản; ẩn nút đăng nhập dạng desktop và nút ba chấm thừa.
- Header/banner desktop: bố cục gọn, có khoảng top hợp lý; nhân vật có thể tràn ở phía trên/phải theo thiết kế nhưng vẫn giữ margin với mép màn hình. Không để phần dưới nhân vật tràn khỏi khung banner.
- Banner phải dùng đúng art đã duyệt, nhân vật thu nhỏ/căn phải để phần chữ bên trái dễ đọc; không chèn thêm card/banner phụ không yêu cầu.
- Bottom navigation mobile giữ 5 mục: `Nạp game`, `Lịch sử`, `Trang chủ`, `Tin tức`, `Tài khoản`.
- Bottom navigation có notch lõm thật ở giữa, không phải nút tròn đè lên navbar; background và border phải đi theo silhouette lõm.
- Nút Trang chủ màu cam, đường kính khoảng 56–62px, nhô khoảng 18–24px, có khoảng hở đều 4–6px và glow nhẹ.
- Các nút còn lại có trạng thái active/hover/focus rõ ràng; chuyển trang SSR vẫn giữ chuyển động bottom nav mượt, không giật khi thay HTML.
- Animation thanh nav nhanh vừa phải; riêng vòng/glow của nút cam chậm khoảng 1.2s, nhẹ và không chói. Tôn trọng `prefers-reduced-motion`.
- Toàn bộ spacing, kích thước card, input và tiêu đề phải được kiểm tra ở viewport mobile 355px và desktop laptop.

### Admin

- Admin chạy độc lập tại subdomain, có các màn hình đã triển khai trong code: Tổng quan, Đơn hàng, Kho game, Gói nạp, Phân loại, Khách hàng, Hạng khách, CTV, Thanh toán, Báo cáo, Nội dung, Bảo mật.
- Có tìm kiếm, lọc, phân trang, dialog chỉnh sửa, toast, trạng thái loading/error/empty và phân quyền.
- Các thao tác nghiệp vụ cần bảo toàn: quản lý game/gói, xử lý đơn, khách hàng, ví/nạp tiền, coupon, thanh toán, đối soát, thông báo và audit log.
- Trong editor game: bỏ các block “Hướng dẫn nhập thông tin” và “Thông tin bổ sung cần nhập” khỏi form nếu không còn dùng; khi lưu phải giữ nguyên cấu hình cũ để không làm mất dữ liệu.
- Trong editor gói nạp: không hiển thị trường “Hạng khách” nếu yêu cầu đã chốt là bỏ khỏi form; dữ liệu tier cũ không được tự ý xoá khỏi database.
- Trang Khách hàng: đưa khu vực “Hạng khách & giảm giá” lên phía trên bảng khách hàng; vẫn giữ chỉnh sửa hạng và trạng thái.
- Các form admin phải có margin/padding cân đối, không có trường thừa, không để dialog hoặc bảng tràn khỏi viewport.
- Tài liệu hướng dẫn admin và PDF cần được phát hành cùng release nếu người vận hành cần dùng.

## 2. Kiến trúc production dự kiến

- VPS chạy Node.js 24, Docker và Docker Compose.
- PostgreSQL 16 chạy trong container `zetgaming-postgres`, chỉ bind `127.0.0.1:5432`.
- Các service production:
  - `zetgaming-backend-v2` — API/backend, port nội bộ 4180.
  - `zetgaming-storefront-v2` — storefront SSR, port nội bộ 4273.
  - `zetgaming-admin-v2` — admin, port nội bộ 4174.
  - `zetgaming-notifications-v2` — worker thông báo.
- Nginx là reverse proxy duy nhất nhận Internet:
  - `https://zetgaming.vanvucoder.id.vn` → `127.0.0.1:4273`.
  - `https://admin.zetgaming.vanvucoder.id.vn` → `127.0.0.1:4174`.
  - Không mở trực tiếp port backend/admin/storefront/PostgreSQL ra Internet.
- TLS dùng Let’s Encrypt; redirect HTTP → HTTPS; bật HSTS sau khi đã xác nhận certificate và proxy ổn định.
- Uploads phải nằm ngoài image layer và được mount persistent tại `uploads/`.

## 3. Biến môi trường production bắt buộc

Tạo `.env` trên VPS từ `.env.example`, không commit hoặc gửi `.env` qua chat/git. Các giá trị phải được thay bằng secret thật:

- `NODE_ENV=production`
- `DATABASE_URL` trỏ đến PostgreSQL production.
- `DB_ADMIN_PASSWORD` mạnh, khác local.
- `SESSION_SECRET` dài và ngẫu nhiên; không dùng secret mặc định.
- `ADMIN_ORIGIN=https://admin.zetgaming.vanvucoder.id.vn`
- `STOREFRONT_ORIGIN=https://zetgaming.vanvucoder.id.vn`
- `FRONTEND_ORIGIN=https://zetgaming.vanvucoder.id.vn`
- `BACKEND_URL=http://127.0.0.1:4180`
- OAuth/payment/email/Telegram/provider keys nếu tính năng tương ứng được bật.
- Redirect Google OAuth phải trỏ production callback và đúng domain HTTPS.
- Thông tin admin/CTV production phải đổi khỏi tài khoản demo; bật MFA/TOTP cho admin nếu đã dùng module bảo mật.

## 4. Database, upload và backup

- Chụp backup PostgreSQL trước migration và trước lần cutover đầu tiên.
- Chạy migration theo thứ tự, kiểm tra version đã áp dụng; không chạy seed demo trên production.
- Nếu chuyển dữ liệu cũ, chạy import một lần có kiểm kê số lượng và tổng tiền trước/sau.
- Backup gồm PostgreSQL custom dump, `.env` được bảo vệ, compose/release metadata và `uploads/`; không đặt backup trong thư mục public.
- Systemd timer chạy backup hằng ngày, giữ tối thiểu 14 ngày; đồng thời sao chép ra nơi lưu trữ khác.
- Phải chạy `scripts/verify-backup.mjs` và có lần restore thử trên môi trường không phải production.
- Ghi rõ RPO/RTO trước go-live; mức mặc định đề xuất: RPO tối đa 6–24 giờ, RTO tối đa 1–2 giờ.

## 5. Quy trình release bắt buộc

1. Chốt commit/branch release; không deploy trực tiếp toàn bộ worktree đang dirty.
2. Kiểm tra không có `.env`, private key, token hoặc archive tạm trong artifact.
3. Chạy `npm ci`, `npm test`, `npm run build`; kiểm tra migration và Docker image.
4. Build image có tag bất biến theo commit, không dùng tag `latest` làm rollback.
5. Backup database và uploads trên VPS.
6. Upload release/image và `.env` production qua kênh SSH an toàn.
7. Chạy migration tương thích dữ liệu, sau đó restart đúng service.
8. Kiểm tra `docker compose ps`, log backend/storefront/admin/worker và Nginx.
9. Smoke test HTTPS: trang chủ, `/nap-game`, trang nạp, đăng nhập, admin login, API health, upload ảnh, tạo/đọc đơn và logout.
10. Theo dõi lỗi 5xx/log sau cutover; chỉ mở HSTS/cache mạnh sau khi xác nhận ổn định.

## 6. Rollback

- Giữ release/image trước đó và tag commit đang chạy.
- Nếu chỉ lỗi frontend/backend tương thích schema: quay về image/commit trước, không tự rollback migration.
- Nếu migration làm thay đổi dữ liệu hoặc không tương thích: dừng service, restore bản backup đã xác nhận, chạy smoke test rồi mới mở lại traffic.
- Ghi lại thời điểm deploy, commit, migration đã chạy, service restart và kết quả smoke test.

## 7. Những điều đang chặn việc deploy thật

- Chưa có thông tin SSH chính thức cho VPS trong workspace: host/IP, user, port, SSH key hoặc cách xác thực.
- Chưa có xác nhận DNS của hai domain đã trỏ về đúng VPS và certificate hiện còn hợp lệ.
- File Nginx hiện cần rà lại trước cutover: certificate chính đang tham chiếu thư mục `/etc/letsencrypt/live/103.72.56.192/`, và chưa có virtual host port 80 cho domain storefront; phải xác nhận/correct theo certificate/domain thật.
- Worktree hiện có nhiều thay đổi chưa commit ở frontend, backend, migration, test, upload và tài liệu; cần chốt phạm vi release hoặc tạo release commit riêng.
- README hiện vẫn ghi bản PostgreSQL/admin là giai đoạn chưa production-ready; cần chạy đủ test, backup/restore và smoke test trước khi tuyên bố go-live.
- Cần xác nhận có deploy toàn bộ các module payment/wallet/reconciliation/notification hiện có hay chỉ storefront + admin cơ bản.

## 8. Thông tin cần cung cấp để thực hiện bước deploy

Gửi một lần các thông tin sau qua kênh an toàn:

- VPS host/IP, SSH port, SSH user và SSH key đã cài (hoặc tên profile SSH).
- Thư mục deploy mong muốn nếu khác `/opt/zetgaming-v2`.
- Xác nhận domain production và subdomain admin.
- Registry Docker nếu dùng image registry, hoặc cho phép build trực tiếp trên VPS.
- Nơi lưu backup ngoài VPS.
- Quyết định release: toàn bộ thay đổi hiện tại hay một commit/tag đã chốt.

