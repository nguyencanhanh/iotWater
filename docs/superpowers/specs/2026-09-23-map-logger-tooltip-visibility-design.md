# Thiết kế ẩn/hiện bảng logger trên bản đồ

## Mục tiêu

- Khi cài đặt mặc định tắt, Trang chủ không hiện sẵn bảng thông tin trên các marker logger.
- Bấm marker sẽ hiện bảng của logger đó; bảng có nút mở chi tiết dữ liệu.
- Trong bảng "Trạng thái cảm biến" có công tắc nhỏ để chọn có hiện toàn bộ bảng khi mới tải trang hay không.
- Lựa chọn được lưu theo tài khoản trong `GeneralSetting`, vì vậy vẫn giữ sau khi tải lại hoặc đăng nhập trên thiết bị khác.

## Thiết kế

Backend thêm trường boolean `showMapTooltipsOnLoad`, mặc định `false`, vào cài đặt chung. API GET luôn trả giá trị rõ ràng; API PUT chấp nhận và lưu cùng cài đặt zoom hiện có.

Frontend tải cờ này cùng `mapTooltipMinZoom`. Tooltip của logger được render khi cài đặt bật, hoặc khi logger đó vừa được bấm. Marker không mở modal trực tiếp nữa; nút "Xem chi tiết" trong tooltip mở modal để tránh một lần bấm vừa hiện tooltip vừa bật ngay cửa sổ chi tiết. Công tắc trong bảng trạng thái lưu ngay qua API và phản hồi trạng thái đang lưu/lỗi.

## Kiểm thử

- Kiểm thử hàm chuẩn hóa và quyết định hiển thị tooltip ở trạng thái mặc định bật/tắt và logger được chọn.
- Kiểm thử backend chuẩn hóa boolean và payload cài đặt.
- Chạy test, lint/build frontend, sau đó kiểm tra tương tác trên môi trường test trước khi deploy production.
