# Thông báo trạng thái đơn

Hệ thống ghi thông báo vào bảng `order_notifications` khi đơn thay đổi các trạng thái quan trọng. Worker `scripts/notification-worker.mjs` đọc outbox và gửi các bản ghi đang chờ qua email và Telegram, có chống gửi trùng, tối đa 5 lần thử.

Mặc định thông báo bị tắt an toàn. Khi có dịch vụ thật, cấu hình trong `.env`:

```env
EMAIL_DELIVERY=webhook
EMAIL_FROM=no-reply@zetgaming.vanvucoder.id.vn
EMAIL_WEBHOOK_URL=https://your-mail-provider.example/send
EMAIL_WEBHOOK_TOKEN=...
NOTIFICATION_EMAIL_EVENTS=order.created,order.payment_confirmed,order.admin_completed,order.cancelled,order.refund_paid
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
NOTIFICATION_WORKER_INTERVAL_MS=10000
```

Production chạy worker cùng Docker Compose. Chạy thử thủ công bằng `node scripts/dispatch-notifications.mjs`. Chưa có credential thì không có thông báo Telegram được xếp hàng; các đơn vẫn hoạt động bình thường.
