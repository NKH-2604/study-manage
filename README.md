# Hệ thống quản lý thời gian học tập cho sinh viên

Ứng dụng web giúp sinh viên quản lý lịch học, nhiệm vụ, điểm số, thống kê giờ học và tài liệu.

**Dùng thử:** https://nkh-2604.github.io/study-manage/

## Chức năng
- Lịch học theo tuần, ngày, tháng; kéo thả sự kiện, lặp lại hàng tuần, gợi ý giờ trống
- Nhiệm vụ, kỳ thi, tính điểm GPA và số tín chỉ
- Dụng cụ học tập: ghi nhớ, máy tính, đồng hồ đặt giờ
- Thống kê giờ học, mục tiêu tuần, chuỗi ngày học
- Quản lý tài liệu, sao lưu và khôi phục dữ liệu
- Giao diện sáng/tối, đổi màu tùy ý

## Lưu ý về dữ liệu
Bản này chạy hoàn toàn trên trình duyệt, không có máy chủ:
- Dữ liệu và tài khoản lưu trong trình duyệt của bạn (localStorage), không gửi đi đâu.
- Dữ liệu chỉ có trên máy và trình duyệt đang dùng. Xóa dữ liệu trình duyệt thì mất dữ liệu.
- Nên dùng nút **Sao lưu** trong Cài đặt để lưu ra file `.json`, và **Khôi phục** để nạp lại.

## Phiên bản có đăng nhập MySQL
Bản đầy đủ (Node.js + Express + MySQL, tài khoản thật, mật khẩu băm bcrypt) nằm ở repo: https://github.com/NKH-2604/Do-An-HTTT

## Công nghệ
HTML, CSS, JavaScript thuần. Không cần cài đặt.

## Chạy trên máy
Tải 3 file `index.html`, `styles.css`, `app.js` về cùng một thư mục rồi mở `index.html`.
