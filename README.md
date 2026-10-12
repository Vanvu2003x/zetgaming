# GameFlow Topup

Nền tảng nạp game chạy bằng Node.js 24 và SQLite tích hợp trong Node. Bản hiện tại là vertical slice chạy được cho khách, admin và CTV; adapter thanh toán, Telegram và nhà cung cấp game thật chưa được nối.

## Chạy local

```powershell
npm test
npm run build
npm start
```

Mở `http://localhost:4173`.

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
