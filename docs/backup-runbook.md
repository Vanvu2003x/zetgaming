# Backup vận hành

Chạy trên VPS từ thư mục `/opt/zetgaming-v2/release`:

```sh
node scripts/backup-production.mjs
```

Script tạo backup trong `/opt/zetgaming-v2/backups/` gồm database PostgreSQL dạng custom dump, `.env`, compose, source release và uploads. Mặc định giữ 14 ngày; đổi bằng `BACKUP_RETENTION_DAYS`.

Khuyến nghị chạy bằng systemd timer hoặc cron hằng ngày, đồng thời sao chép thư mục backup sang nơi lưu trữ khác. Restore cần dừng backend/storefront/admin, giải nén source/uploads, khôi phục dump bằng `pg_restore`, sau đó chạy migration và smoke test.

## Cài timer trên VPS

```sh
cp deploy/zetgaming-backup.service deploy/zetgaming-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now zetgaming-backup.timer
systemctl list-timers zetgaming-backup.timer
```

Kiểm tra archive mới nhất mà không đụng dữ liệu đang chạy:

```sh
node scripts/verify-backup.mjs
```
