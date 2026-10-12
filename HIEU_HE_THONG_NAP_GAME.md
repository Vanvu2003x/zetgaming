# Cách hiểu hệ thống nạp game

Cập nhật: 12/10/2026.

Tài liệu này ghi lại yêu cầu và cách hiểu hiện tại từ cuộc trao đổi với chủ hệ thống. Đây chưa phải đặc tả triển khai cuối cùng. Không bắt đầu viết code hệ thống cho đến khi chủ hệ thống xác nhận đã hiểu đúng và cho phép triển khai.

## 1. Mục tiêu

Xây dựng website kinh doanh dịch vụ nạp nhiều game, gồm khách hàng, admin và cộng tác viên (CTV). Admin quản lý toàn bộ hệ thống, duyệt và phân phối đơn; CTV ứng tiền để thực hiện đơn nạp login rồi nhận tiền qua ví CTV và yêu cầu rút tiền.

Chủ hệ thống muốn sử dụng JavaScript, giao diện đẹp, chỉn chu và ưu tiên rất cao việc bảo vệ thông tin tài khoản khách hàng.

## 2. Những yêu cầu đã được người dùng xác nhận

### 2.1. Giao diện và khách hàng

- Giao diện khách hàng tham khảo dự án tại `D:\Web\topup\ShopThinhSang`.
- Đã đọc sơ bộ mã giao diện khách hàng của dự án tham khảo: có banner game, chọn gói, nhập thông tin, thanh toán, tra cứu đơn và khu vực tài khoản/ví. Chưa chạy dự án để khảo sát toàn bộ giao diện thực tế; chưa chốt mức độ giống cụ thể.
- Hỗ trợ nhiều game và nhiều gói nạp.
- Khách có hai cách thanh toán: thanh toán trực tiếp cho từng đơn hoặc thanh toán bằng ví trên hệ thống.
- Có nhiều loại/hạng khách, ví dụ user thường, VIP, Pro.
- Admin tự cấu hình các hạng khách và giá từng gói cho từng hạng. Không mặc định các hạng chỉ giới hạn ở những tên ví dụ trên.

### 2.2. Hai kiểu nạp game

- **Nạp UID:** gọi API để gửi đơn. Hiện chưa có game UID được đưa vào vận hành; cần hỗ trợ bổ sung về sau.
- **Nạp login:** khách nhập thông tin tài khoản game để gửi đơn cho admin xử lý và phân cho CTV.
- Các trường đăng nhập cụ thể, cách xử lý OTP và loại tài khoản được hỗ trợ chưa được chốt.

### 2.3. Admin và phân đơn

- Admin quản lý toàn bộ hệ thống, không chỉ quản lý đơn hàng.
- Đơn phải được admin duyệt trước khi phân cho CTV.
- Admin chọn các CTV nhận phân phối đơn bằng checkbox.
- Có thể chọn một số CTV hoặc chọn tất cả CTV.
- Các CTV được phân phối có thể bấm nhận đơn.
- Một đơn chỉ được một CTV nhận thành công. Sau khi một CTV nhận, những CTV khác không được nhận đơn đó nữa, kể cả khi bấm gần như đồng thời.
- Chưa chốt chức năng giao thẳng cho một CTV mà không cần bấm nhận, thu hồi hoặc phân lại đơn.

### 2.4. Tiền và ví của CTV

- CTV tự bỏ tiền ra trước để nạp game cho khách.
- CTV có ví riêng trên hệ thống và có thể tạo yêu cầu rút tiền.
- Admin cấu hình tiền/hoa hồng liên quan đến việc thực hiện đơn; công thức chi tiết chưa được xác nhận.
- Không hiểu ví CTV là ví phải nạp tiền vào trước để được nhận đơn.
- Chưa chốt tiền ghi có vào ví gồm khoản hoàn chi phí và hoa hồng riêng, hay một mức trả cố định theo gói.
- Chưa chốt thời điểm ghi có: ngay khi CTV báo hoàn thành hay sau khi admin duyệt kết quả.
- Chưa chốt quy trình duyệt, chi trả và xác nhận yêu cầu rút tiền.

### 2.5. Telegram

- Có bot gửi thông báo cho admin.
- Có nhóm Telegram với bot thông báo đơn cho CTV.
- Telegram chỉ dùng để thông báo. Không duyệt, nhận hoặc xử lý đơn trên Telegram.
- Nội dung thông báo, người nhận và thời điểm gửi chi tiết chưa được chốt.

### 2.6. Bảo mật

- Người dùng yêu cầu bảo mật rất cao, đặc biệt lo ngại việc lộ thông tin đơn và tài khoản game.
- Người dùng muốn mã hóa dữ liệu nhạy cảm; phạm vi và giải pháp kỹ thuật cần được thiết kế sau khi chốt quy trình.
- Không cam kết “bảo mật tuyệt đối”: đây là mong muốn về mức bảo vệ, không phải bảo đảm kỹ thuật có thể chứng minh.
- CTV cần đọc thông tin login để thực hiện đơn nên vẫn tồn tại nguy cơ người được cấp quyền sao chép thông tin. Mã hóa không loại bỏ được rủi ro này.

### 2.7. Chống trùng và tính toàn vẹn giao dịch

- Người dùng yêu cầu cấm nạp trùng và sử dụng giao dịch ACID đúng nghĩa cho dữ liệu nghiệp vụ liên quan.
- Khi hai CTV cùng nhận một đơn, chỉ một người thành công; người còn lại phải được báo đơn đã có người nhận/trùng lượt nhận, không được cấp quyền xử lý đơn.
- Phía khách cũng phải chống trùng đơn. Cần xác nhận “trùng” là gửi lại cùng một yêu cầu do bấm nhiều lần/mạng lỗi, hay cả việc tạo đơn mới cho cùng tài khoản game đang có đơn chưa hoàn tất.
- Yêu cầu chống trùng phải được bảo vệ ở phía máy chủ và cơ sở dữ liệu, không chỉ bằng việc vô hiệu hóa nút trên giao diện.
- Không được trừ tiền khách, cộng tiền CTV, ghi nhận thanh toán, hoàn tiền hoặc chi trả rút tiền nhiều lần cho cùng một nghiệp vụ. Đây là cách hiểu mở rộng của yêu cầu chống trùng, cần đưa vào đặc tả nghiệm thu.
- ACID bảo vệ giao dịch trong cơ sở dữ liệu; không tự bảo đảm thao tác nạp ngoài hệ thống hoặc thao tác thủ công của CTV chỉ diễn ra một lần.
- Nếu kết quả nạp chưa rõ, phải giữ đơn để xác minh trước khi thử lại hoặc phân cho CTV khác. Không suy ra “chưa nạp” chỉ vì timeout hoặc thiếu phản hồi.
- Với API UID tương lai, cần xác minh khả năng chống gửi lặp và tra cứu trạng thái của nhà cung cấp trước khi thiết kế quy tắc thử lại.
- Với nạp login thủ công, phần mềm có thể kiểm soát quyền nhận và luồng xử lý, nhưng không thể tự ngăn một CTV thao tác nạp hai lần bên ngoài web. Cần quy trình và bằng chứng đối soát để đáp ứng mục tiêu chống nạp trùng.

### 2.8. Định hướng giao diện khách hàng đã xác nhận

- Phối hợp ba nguồn tham khảo: `D:\Web\topup\ShopThinhSang`, https://easyup-edu.com/ và https://taphoaeris.com/.
- ShopThinhSang là nguồn tham khảo giao diện nạp game.
- Easyup là nguồn tham khảo animation/chuyển động. Đã mở trang và xem phần đầu; chưa xác minh đầy đủ từng hiệu ứng để chốt danh sách animation cụ thể.
- Shop Eris là nguồn tham khảo cách trình bày shop đẹp, ít chữ, thông tin ngắn gọn và dễ sử dụng. Đã xem cấu trúc trang chủ: danh mục trò chơi, danh mục nạp game, tên game và lời gọi hành động ngắn.
- Yêu cầu ít chữ áp dụng cho giao diện khách hàng. Không tự suy rộng thành việc bỏ dữ liệu nghiệp vụ cần thiết trên màn hình admin/CTV.
- Chưa chốt tên thương hiệu, logo, bảng màu, font chữ hoặc yêu cầu dùng hình/video nào.

#### Cách phối hợp đang đề xuất

- Trang chủ ưu tiên hình game, tên game, tìm kiếm và nút đi vào nạp; banner có nội dung ngắn.
- Trang nạp có luồng rõ: chọn gói → nhập thông tin → chọn cách thanh toán → kiểm tra và gửi đơn.
- Giá theo hạng khách, gói đã chọn và tổng tiền phải dễ thấy; không để hiệu ứng che hoặc trì hoãn thao tác thanh toán.
- Hướng dẫn dài đặt trong mục mở rộng; vẫn hiển thị trực tiếp thông tin ảnh hưởng đến giá, tài khoản nhận nạp và quyết định thanh toán.
- Chuyển động nhẹ khi xuất hiện nội dung, tương tác thẻ game, chọn gói và chuyển bước là phương án đề xuất, chưa phải các hiệu ứng đã được xác minh trên Easyup.
- Giao diện điện thoại cần thao tác thuận tiện; hiệu ứng phải có chế độ giảm chuyển động và không làm chậm luồng mua hàng.
- Các trạng thái chờ xử lý, lỗi, đã nhận đơn và chống gửi lặp phải có phản hồi ngắn, dễ hiểu.

## 3. Luồng nghiệp vụ đang được hiểu

1. Khách chọn game và gói nạp; hệ thống lấy giá theo hạng khách.
2. Khách cung cấp thông tin cần thiết và chọn thanh toán trực tiếp hoặc bằng ví khách hàng.
3. Đơn được gửi tới admin để kiểm tra và duyệt. Cách xác nhận thanh toán chưa chốt.
4. Admin chọn một số hoặc tất cả CTV bằng checkbox và phân phối đơn.
5. Những CTV được chọn thấy đơn có thể nhận.
6. Một CTV nhận thành công; đơn được giữ cho CTV đó.
7. CTV ứng tiền cá nhân để thực hiện việc nạp game và báo kết quả.
8. Tiền được ghi nhận vào ví CTV theo quy tắc sẽ chốt với chủ hệ thống.
9. CTV tạo yêu cầu rút tiền; hệ thống ghi nhận và xử lý theo quy trình sẽ chốt.

Đây là luồng làm việc hiện tại để thảo luận, chưa phải danh sách trạng thái đơn hoặc điều kiện chuyển trạng thái đã được phê duyệt.

## 4. Phạm vi admin được đề xuất, chưa chốt toàn bộ

| Nhóm quản lý | Phạm vi đề xuất |
| --- | --- |
| Game và gói | Game, hình ảnh, hướng dẫn, kiểu UID/login, gói nạp, bật/tắt bán |
| Khách hàng | Tài khoản, hạng khách, lịch sử mua, khóa tài khoản |
| Giá | Giá từng gói theo từng hạng khách |
| Đơn | Kiểm tra, duyệt, phân CTV, theo dõi kết quả, hủy và hoàn tiền |
| CTV | Tài khoản, quyền nhận đơn, mức trả/hoa hồng, lịch sử xử lý |
| Ví và thanh toán | Ví khách, ví CTV, giao dịch, nạp tiền, hoàn tiền, rút tiền, đối soát |
| Telegram | Bot, nhóm và sự kiện gửi thông báo |
| Nội dung web | Banner, thông báo, hướng dẫn, hỗ trợ |
| Quyền và bảo mật | Quyền nhân viên, quyền xem login, lịch sử thao tác |
| Báo cáo | Doanh thu, chi phí, lợi nhuận, hoa hồng, hiệu quả CTV |

Các mục trên là phạm vi do trợ lý đề xuất để cụ thể hóa ý “admin quản lý cả hệ thống”. Không coi các chi tiết chưa được người dùng xác nhận là yêu cầu bắt buộc.

## 5. Quy tắc đề xuất cần xác nhận

- Chốt và lưu giá tại thời điểm tạo đơn; thay đổi bảng giá sau đó không sửa giá đơn cũ.
- Mọi thay đổi số dư đều có bản ghi giao dịch để đối soát.
- Tách ví khách hàng và ví CTV theo mục đích nghiệp vụ.
- Chỉ CTV nhận đơn thành công mới được xem thông tin login cần thiết của đơn đó.
- Telegram chỉ chứa thông tin tối thiểu như mã đơn, game, gói, trạng thái và liên kết vào web; không gửi tài khoản, mật khẩu hoặc OTP.
- Admin duyệt hoàn thành trước khi ghi tiền vào ví CTV là một phương án đang đề xuất, chưa được người dùng chọn.
- Cần quy định thời gian giữ thông tin login và thời điểm xóa dữ liệu nhạy cảm.

## 6. Các câu hỏi còn mở

1. Thanh toán trực tiếp dùng chuyển khoản/QR hay phương thức khác? Xác nhận tự động hay admin duyệt?
2. Khách nạp tiền vào ví bằng cách nào? Khi nào tiền được ghi có?
3. Tiền trả CTV là mức cố định theo gói, hay hoàn chi phí thực tế cộng hoa hồng?
4. Nếu khách trả 100.000đ và CTV ứng 80.000đ, cụ thể ví CTV nhận bao nhiêu? Ai cấu hình và ai kiểm tra chi phí?
5. Ai xác nhận đơn hoàn thành và khi nào tiền vào ví CTV?
6. Rút tiền có mức tối thiểu, phí, phương thức nhận, điều kiện và người duyệt nào?
7. Hạng khách do admin gán thủ công, tự nâng theo doanh số/nạp tiền, hay cả hai?
8. Game login cần những trường nào và xử lý OTP, đăng nhập thất bại hoặc khách đổi mật khẩu ra sao?
9. Khi CTV đã nhận nhưng không làm được, xử lý thu hồi, phân lại và tiền thế nào?
10. Đơn lỗi, nạp một phần, hủy hoặc tranh chấp được xác minh và hoàn tiền thế nào?
11. Có nhân viên admin với quyền hạn khác nhau không?
12. Thông tin tài khoản khách được lưu trong bao lâu và ai được xem ngoài CTV nhận đơn?
13. Ngoài gửi lặp cùng yêu cầu, có cấm tạo đơn mới cho cùng game/tài khoản khi đơn trước đang xử lý không? Có cho khách chủ động mua thêm cùng gói không?

## 7. Nguyên tắc cập nhật tài liệu

- Tiếp tục phân tích và cập nhật tài liệu khi người dùng bổ sung yêu cầu.
- Phân biệt rõ yêu cầu đã xác nhận, cách hiểu tạm thời, đề xuất và câu hỏi chưa chốt.
- Không tự biến ví dụ về giá, hoa hồng, hạng khách hoặc quy trình thành quy tắc đã được duyệt.
- Chưa viết code hệ thống theo yêu cầu hiện tại của người dùng.
