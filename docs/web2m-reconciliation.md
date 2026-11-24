# Đối soát Web2M

Endpoint nhận callback: `POST /api/payment/web2m/webhook`.

Hiện hệ thống đã có:

- Token bảo vệ qua `X-Web2M-Token` hoặc `Authorization: Bearer …`.
- Đổi số tiền VND sang cents phía server.
- Khớp chính xác `amount` và mã đơn xuất hiện trong nội dung chuyển khoản.
- Lưu event gốc để audit và chống xử lý trùng theo `provider_event_id`.
- Chỉ tự chuyển đơn `direct + awaiting_payment` sang `pending_admin`.

Cấu hình khi có thông tin Web2M:

```env
RECONCILIATION_PROVIDER=web2m
WEB2M_WEBHOOK_TOKEN=...
WEB2M_API_BASE_URL=...
WEB2M_API_TOKEN=...
```

Payload hiện chấp nhận các tên phổ biến: `event_id`/`id`/`transaction_id`, `amount`/`transfer_amount`, `content`/`description`, `reference`/`transaction_ref`. Khi Web2M gửi cấu trúc khác, cần map đúng field theo payload thật trước khi bật production.
