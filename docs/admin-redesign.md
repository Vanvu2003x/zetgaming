# ZetGaming Admin — thiết kế lại

## Khảo sát và quyết định

Admin cũ dùng layout cửa hàng, font tiêu đề quá đậm, toàn bộ game/gói là form mở sẵn và đơn hàng chỉ đọc. Không có tìm kiếm, phân trang hoặc luồng xử lý đơn. Ưu tiên công việc hàng ngày: nhận biết đơn cần xử lý → lọc → xem chi tiết → phân CTV hoặc quyết toán.

Tham khảo: [Carbon data tables](https://v10.carbondesignsystem.com/components/data-table/usage/), [Carbon dashboards](https://v10.carbondesignsystem.com/data-visualization/dashboards/), [Shopify Polaris index tables](https://polaris-react.shopify.com/components/tables/index-table). Áp dụng thanh công cụ rõ ràng, bảng gọn, progressive disclosure và số liệu dẫn tới hành động. Không thêm framework UI vào ứng dụng Express SSR hiện có.

## Cấu trúc

- Cửa hàng: localhost:4173; admin: localhost:4174; API: localhost:4180.
- `admin/server.mjs`: tiến trình riêng; `admin/routes.mjs`: đăng nhập và chặn quyền; `admin/views.mjs`: khung độc lập; `admin/public/`: CSS và hành vi giao diện.
- Dùng chung proxy HTTP và API xác thực/RBAC/CSRF phía backend; cookie host-only ở production, không đặt Domain chia sẻ với cửa hàng.
- `ADMIN_ORIGIN` dùng cho CORS/CSRF và link chuyển từ cửa hàng; `STOREFRONT_ORIGIN` dùng cho link xem cửa hàng. Khi triển khai, đặt lần lượt https://admin.zetgaming.vanvucoder.id.vn và https://zetgaming.vanvucoder.id.vn, reverse proxy admin về 127.0.0.1:4174. Lần này chỉ chạy local.

## Màn hình và tiêu chí

1. Tổng quan: doanh thu hoàn thành, đơn cần duyệt/quyết toán, số game và gói; biểu đồ từ đơn thực tế trong 7 ngày, đơn gần nhất, liên kết thao tác nhanh.
2. Đơn hàng: tìm mã/email/gói, lọc trạng thái, phân trang; dialog chi tiết và phân CTV/quyết toán đúng trạng thái. Không thêm nút xác nhận chuyển khoản khi chưa có API đối soát.
3. Kho game: bảng có ảnh/tên/kiểu nạp/nền tảng/trạng thái; tìm/lọc, dialog chỉnh sửa và xem trước ảnh, giữ dữ liệu khi lưu lỗi.
4. Gói nạp: tìm/lọc theo game, dialog chỉnh sửa. UI nhập đồng Việt Nam, đổi cents tại ranh giới API để tránh nhầm tiền.
5. CTV: danh sách email/số dư thật và thao tác chuyển sang xử lý đơn. Không dựng số liệu giả cho các API chưa có.
6. Đăng nhập quản trị riêng, từ chối tài khoản khách, logout; session/CSRF hết hạn có thông báo.

## Thứ tự triển khai và kiểm chứng

- [x] Tách origin, trang login, kiểm thử HTTP quyền/redirect/layout/cache.
- [x] Khung giao diện, tổng quan và bảng tìm kiếm/lọc/phân trang.
- [x] Editor game/gói, xử lý đơn và lỗi tải/lưu.
- [x] API ghi thực tế: login, CSRF, lưu game/gói với giá trị không đổi, đơn/CTV, logout.
- [ ] Xác minh trực quan desktop/mobile và keyboard/dialog trong trình duyệt: automation bị tắt trong Work settings ở phiên này.
- [x] Build và test admin; cấu hình mẫu và hướng dẫn chạy local/subdomain.

## Chạy local

Mỗi tiến trình chạy trong một terminal ở thư mục repo:

```powershell
npm run db:local
npm run backend
npm run dev
npm run admin:dev
```

Các lệnh này chạy ở terminal riêng, không chạy tuần tự trong cùng terminal. Nếu PostgreSQL đã chạy thì dùng tiến trình đó. Admin ở http://localhost:4174, cửa hàng ở http://localhost:4173. Tài khoản admin dùng cùng dữ liệu backend; production trên hai subdomain có phiên host-only riêng. Ở local cookie cùng hostname được trình duyệt dùng chung giữa các port.

Kiểm tra:

```powershell
node --test test/admin-data.test.mjs test/admin-http.test.mjs
node scripts/smoke-admin.mjs
npm run build
```

Smoke chỉ gọi localhost và lưu lại thông tin game/gói nguyên trạng để xác minh ghi dữ liệu. Bộ `npm test` có test SSR cũ gọi database local thật, kỳ vọng ví demo còn 480000 cents; trong phiên này test đó thất bại vì số dư dữ liệu local đã thay đổi (380000). Không reset ví để ép test đạt.

## Chuẩn bị subdomain (chưa triển khai VPS)

```dotenv
NODE_ENV=production
ADMIN_PORT=4174
ADMIN_ORIGIN=https://admin.zetgaming.vanvucoder.id.vn
STOREFRONT_ORIGIN=https://zetgaming.vanvucoder.id.vn
FRONTEND_ORIGIN=https://zetgaming.vanvucoder.id.vn
BACKEND_URL=http://127.0.0.1:4180
```

Chạy admin bằng `npm run admin` dưới process manager, khởi động lại backend để nhận allowlist origin mới. Sau khi bản ghi DNS `admin` trỏ về VPS và TLS được cấp, Nginx chuyển tiếp virtual host admin đến `http://127.0.0.1:4174`, với `Host $host`, `X-Forwarded-Proto $scheme`, `X-Forwarded-For $proxy_add_x_forwarded_for`. API tiếp tục chỉ ở loopback. Không mở trực tiếp port 4180 ra Internet. Lệnh build kiểm tra cú pháp cả backend, storefront và admin.

## Phạm vi tiếp theo

### Ảnh game trong repo

Kho game có hai trường riêng: `image` là ảnh nền/banner và `thumbnail` là icon vuông. Chọn ảnh từ máy trong dialog rồi bấm Lưu thay đổi; API admin tải từng file PNG/JPG/WebP (tối đa 5 MB) vào `public/uploads/games/`, đặt tên UUID và lưu đường dẫn `/uploads/games/...` trong PostgreSQL. Thư mục này được Git theo dõi; file mới có thể commit/push cùng source, HTTP không tự chạy Git. File chỉ được tải khi bấm Lưu. Nếu cập nhật metadata lỗi sau upload, đường dẫn đã tải được giữ lại trong form để thử lưu lại. Game cũ chưa có thumbnail dùng ảnh nền làm dự phòng. Chạy migration `005_game_thumbnail.sql` trước khi khởi động backend mới.

Tạo/xóa game, danh mục do admin tự tạo, khách hàng, nạp ví, phân quyền chi tiết và log hoạt động cần API/schema riêng. Không hiển thị menu giả cho những chức năng chưa có. Bản thiết kế này giữ nguyên dữ liệu và các quy tắc nghiệp vụ hiện tại.
