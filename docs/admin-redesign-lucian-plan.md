# Kế hoạch redesign ZetGaming Admin với Lucian UX/UI Prompt

Ngày: 2026-11-07

## Mục tiêu

Làm lại toàn bộ giao diện admin theo hướng operations console: nhìn nhanh, thao tác ít bước, ưu tiên đơn cần xử lý và dữ liệu tài chính. Giữ nguyên API/nghiệp vụ hiện tại, thay lớp UI theo từng lát dọc để mỗi giai đoạn vẫn chạy được.

Lucian UX/UI Prompt cung cấp 400 element HTML/CSS/JS không phụ thuộc thư viện, gồm interface parts 001–200 và website/motion 201–400. Admin sẽ ưu tiên các nhóm `Menus & Tabs`, `Cards & Content`, `Alerts & Feedback`, `Widgets & Charts`, `Document & Data Editing`, `Analytics & Data`, `Workflow & Systems`; không bê nguyên gallery vào app. Element được port phải giữ comment credit MIT và scoped CSS.

## Hướng visual

- **Style:** dark operations console, tương phản cao, nền midnight/navy, surface nâng nhẹ; màu cam ZetGaming chỉ dùng cho primary action và focus.
- **Status:** xanh = hoàn tất/đã đối soát, amber = chờ xử lý, đỏ = lỗi/hoàn tiền, tím = thông tin hệ thống.
- **Density:** dense dashboard, khoảng cách 8/12/16/24px; bảng nhiều dữ liệu nhưng không chật chữ.
- **Typography:** sans dễ đọc cho nội dung, mono chỉ cho mã đơn, transaction ref, số tiền kỹ thuật; không dùng toàn bộ chữ hoa.
- **Icons:** outline SVG/Phosphor style, icon đi kèm nhãn ở hành động quan trọng; không dùng emoji.
- **Motion:** 150–250ms cho hover/focus/drawer; stagger nhẹ ở metric/card; không animate từng hàng bảng; tắt hoặc giảm bằng `prefers-reduced-motion`.

## Kiến trúc thông tin mới

1. **Tổng quan**: KPI, đơn cần xử lý, trạng thái đối soát, hoạt động gần đây.
2. **Vận hành**: Đơn hàng, Thanh toán/đối soát, Coupon hoàn tiền.
3. **Cửa hàng**: Kho game, Gói nạp, Phân loại, Nội dung cửa hàng.
4. **Khách hàng**: Khách hàng, Cộng tác viên.
5. **Phân tích & bảo mật**: Báo cáo, Bảo mật.

Sidebar có nhóm thu gọn, badge số lượng ở Đơn hàng/Đối soát, trạng thái phiên ở topbar và quick action toàn cục. Mobile dùng drawer; desktop có thể thu sidebar thành rail chỉ icon nhưng vẫn có tooltip/aria-label.

## Các vertical slice

### Slice 1 — Admin shell và design tokens

- Tách token màu, spacing, radius, typography, shadow và focus thành `admin/public/admin-tokens.css`.
- Làm lại sidebar nhóm, topbar, breadcrumb, command/search shortcut, toast, dialog/drawer.
- Chuẩn hóa loading, empty, error, confirmation và unsaved state.
- Port 2–3 Lucian elements đầu tiên: grouped navigation, status/feedback, command/filter surface.

**Nghiệm thu:** mọi URL admin vẫn mở; nav desktop/mobile không tràn; focus keyboard rõ; không thay đổi API.

### Slice 2 — Dashboard điều hành

- KPI: doanh thu hoàn tất, đơn chờ, cần kiểm tra, hoàn tiền; mỗi KPI có period/filter rõ.
- “Cần xử lý ngay” đặt trước chart, click thẳng tới bộ lọc tương ứng.
- Chart doanh thu và payment reconciliation có empty state trung thực.
- Activity timeline hiển thị thao tác admin gần đây, không phô dữ liệu nhạy cảm.

**Lucian ưu tiên:** analytics/data, widgets/charts, workflow/systems, alerts/feedback.

### Slice 3 — Đơn hàng và đối soát

- Toolbar thống nhất: tìm kiếm, trạng thái, phương thức thanh toán, ngày, bulk select.
- Bảng desktop; mobile chuyển thành card list có cùng thứ tự thông tin.
- Drawer chi tiết đơn: payment state, fulfillment state, customer/game/package, notes, audit timeline.
- Quick actions có guard: xác nhận, nhận xử lý, hoàn tiền, retry; hành động nguy hiểm cần lý do.
- Khu vực đối soát hiển thị event provider, amount, reference, matched code, needs review.

**Nghiệm thu:** admin phân biệt được “đã nhận tiền” và “đã nạp game” trong một màn; không thao tác tài chính bằng nút mơ hồ.

### Slice 4 — Kho game, gói nạp và phân loại

- Kho game dùng table/card hybrid: thumbnail, banner, category, kiểu nạp, số gói, số đơn, trạng thái.
- Editor game dùng 2 cột trên desktop, step sections trên mobile; preview ảnh nền/avatar thật và lỗi upload rõ.
- Gói nạp có compact cards/table: game, tên gói, giá, ảnh, số đơn, doanh thu, active; tạo/sửa bằng drawer.
- Phân loại là inline edit có confirm; không để submenu làm mất context.

**Lucian ưu tiên:** document/data editing, cards/content, forms/input, alerts.

### Slice 5 — Khách hàng, CTV, coupon

- Customer detail có overview, đơn, ví, lịch sử thao tác, quyền; dữ liệu nhạy cảm không nằm ở bảng tổng.
- Coupon table có trạng thái active/redeemed/expired/revoked, đơn nguồn, đơn sử dụng, giá trị, thời gian.
- Bulk filters và export/read-only summary chỉ thêm nếu API hỗ trợ; không giả doanh thu.

### Slice 6 — Báo cáo, thanh toán, bảo mật

- Báo cáo có preset period, metric cards, bảng chi tiết và export trạng thái rõ.
- Thanh toán gom cấu hình VietQR, provider reconciliation, Gmail/Pub/Sub health và lần sync cuối.
- Bảo mật hiển thị 2FA, phiên, audit và cảnh báo cấu hình; các secret chỉ hiển thị masked.

## Component contract

- `AdminShell`, `SidebarGroup`, `Topbar`, `CommandSearch`
- `MetricCard`, `StatusBadge`, `PriorityQueue`
- `DataToolbar`, `DataTable`, `MobileDataCard`, `Pagination`
- `DetailDrawer`, `ConfirmDialog`, `FormSection`, `ImageUploaderPreview`
- `ActivityTimeline`, `PaymentEvent`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`

Mỗi component có state: default, hover, focus, loading, disabled, error, empty và reduced-motion. Không copy các selector `.uNNN` trực tiếp vào global CSS; đổi tên theo component sau khi port.

## Thứ tự kỹ thuật

1. Tokens + shell + responsive primitives.
2. Dashboard và order queue.
3. Order detail/payment reconciliation.
4. Catalog editors và image previews.
5. Customers/coupons/CTV.
6. Reports/security/payment settings.
7. Accessibility, visual regression, performance và deploy.

## Verification

- `npm run build` và test hiện có pass sau mỗi slice.
- Browser smoke test ở 375px, 768px, 1024px, 1440px.
- Keyboard-only: mở drawer, đổi filter, submit, đóng dialog bằng Escape.
- Kiểm tra contrast, focus ring, reduced motion, table overflow/card fallback.
- Không đổi API response hoặc quyền admin; kiểm tra không lộ login game, token, secret trong DOM/log.
- Chụp baseline các route `/`, `/orders`, `/games`, `/packages`, `/coupons`, `/customers`, `/reports`, `/payment`, `/security` trước/sau.

## Rủi ro

| Rủi ro | Ảnh hưởng | Cách giảm |
|---|---|---|
| Port element Lucian làm rò CSS | Cao | Scope theo component, build check, giữ token riêng |
| Redesign che mất thao tác tài chính | Cao | Giữ quick actions + audit, test task-based với admin |
| Bảng quá rộng trên mobile | Trung bình | Mobile card layout/horizontal scroll có chủ đích |
| Animation gây chậm dashboard | Trung bình | Không animate table rows, reduced-motion, đo load |
| Thay UI làm lỗi route cũ | Cao | Vertical slice, smoke test từng URL, rollback theo image |

## Nguồn và license

- Lucian UX/UI Prompt: https://github.com/Seokwoooo/lucian-uxui-prompt
- Gallery/API: https://lucianlabs.dev/uxui-prompt/
- Repo cho phép dùng personal/commercial theo MIT; giữ comment credit trên code đã port.
