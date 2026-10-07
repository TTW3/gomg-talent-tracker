# GOMG Talent Tracker v2

## Có gì mới?
- `game-data.json` tách riêng khỏi code.
- 144 base characters có tên English từ database cộng đồng.
- Talent dùng ID cố định, tránh lỗi do đổi tên.
- Talent selector/search thay vì gõ tay.
- Kiểm tra tier khi SWAP.
- Local data vẫn riêng cho từng người bằng localStorage.
- Export/Import backup.

## Quan trọng về talent names
Nguồn công khai hiện có danh sách 431 talent nhưng chủ yếu cung cấp tên Nhật/Trung, không có một catalog English hoàn chỉnh mà mình có thể xác minh. Vì vậy:
- Các English talent đã được xác minh từ dữ liệu người dùng hoặc English patch notes được ghi là verified/official-update.
- Các mục khác giữ tên nguồn/nhãn dịch, không giả mạo là tên English chính thức.
- `game-data.json` được thiết kế để thay thế/cập nhật sau này mà không sửa code.

