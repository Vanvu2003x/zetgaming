# GameFlow Topup

Nền tảng nạp game chạy bằng Node.js 24 và SQLite tích hợp trong Node. Bản hiện tại là vertical slice chạy được cho khách, admin và CTV; adapter thanh toán, Telegram và nhà cung cấp game thật chưa được nối.

## Chạy local

```powershell
npm test
npm run build
npm start
```

Mở `http://localhost:4173`.

## Storefront nhiều trang SSR

Các trang dùng URL riêng, HTML được Node render từ SQLite trước khi gửi về trình duyệt:

- `/`: trang chủ và danh sách game nổi bật.
- `/nap-game`: danh sách game, tìm kiếm bằng `?q=`.
- `/nap-game/:slug`: gói nạp, thông tin người chơi và tổng tiền.
- `/lich-su`, `/lich-su/:code`: lịch sử và chi tiết đơn thuộc tài khoản hiện tại.
- `/tin-tuc`: trang thông báo Tin tức sắp ra mắt.
- `/dang-nhap`, `/tai-khoan`: đăng nhập và thông tin/số dư tài khoản.

Template dùng chung ở `views/layout.html`; route và các view ở `storefront/`. `public/app.js` chỉ tăng cường tương tác: chọn gói, lọc game, hiện mật khẩu, notch mobile và reveal/chuyển trang. Khi bấm liên kết nội bộ, trình duyệt lấy HTML SSR mới và giữ bottom nav đang hiển thị để nút cam trượt liên tục; Back/Forward cũng tải lại HTML từ server. Nội dung, đường dẫn và form đăng nhập/đặt đơn/đăng xuất vẫn hoạt động khi JavaScript bị tắt. API JSON hiện có giữ nguyên contract. HTML cá nhân dùng `private, no-store`; chi tiết đơn luôn kiểm tra chủ sở hữu.

Typography tham khảo Naperis: Signika Negative, tự host ở `public/fonts/` cùng giấy phép OFL. Banner ZetGaming và icon Phosphor được giữ; mobile dùng avatar thay pill đăng nhập/menu, tên ngắn sau đăng nhập lấy từ phần trước `@` của email hiện có. Hiệu ứng tôn trọng `prefers-reduced-motion`.

`npm test` có kiểm thử HTTP trên database tạm cho SSR, native forms, giá server, chống gửi đơn trùng và quyền xem đơn. Có thể đặt `DB_PATH` và `PORT` để chạy môi trường cô lập.

Tài khoản demo được seed lần đầu:

- Admin: `admin@example.com` / `admin12345`
- CTV: `ctv@example.com` / `ctv12345`
- Khách: `customer@example.com` / `customer123`

Đổi mật khẩu và `SESSION_SECRET` trước khi dùng môi trường thật. File database local nằm ở `data/topup.sqlite` và đã bị loại khỏi Git.

## API lõi

- `GET /api/games`
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`
- `POST /api/orders` với header `Idempotency-Key`
- `GET /api/orders`, `GET /api/orders/:code`
- Admin: duyệt/phân `POST /api/admin/orders/:code/approve`, quyết toán `POST /api/admin/orders/:code/settle`
- CTV: nhận `POST /api/ctv/orders/:code/claim`, hoàn thành `POST /api/ctv/orders/:code/complete`

## Giới hạn bản hiện tại

Màn hình khách hàng đã có. Admin/CTV hiện được kiểm thử qua API; dashboard quản trị, nạp ví, yêu cầu rút, upload bằng chứng, Telegram và adapter UID/login là các lát tiếp theo trong `tasks/todo.md`. Không đưa bản này lên production vì còn thiếu PostgreSQL multi-instance, HTTPS/reverse proxy, MFA, backup/restore khóa mã hóa và kiểm thử bảo mật đầy đủ.
