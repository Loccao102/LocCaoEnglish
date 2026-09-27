# Bắt đầu từ đây

Repository này có một thế giới 3D, game hội chợ và hệ thống học tiếng Anh. Đọc đúng
miền trước khi code; các loại tiến độ/phần thưởng không có cùng ý nghĩa.

## Tài liệu bắt buộc cho người và agent

| Tài liệu | Dùng để làm gì |
| --- | --- |
| [PROJECT-RULES](PROJECT-RULES.md) | Quy tắc bắt buộc khi thiết kế, code, lưu dữ liệu và bàn giao |
| [ROADMAP](ROADMAP.md) | Nguồn duy nhất về việc phải làm, thứ tự và tiêu chí hoàn tất |
| [CONTRIBUTING](../CONTRIBUTING.md) | Quy trình nhận việc, phát triển, kiểm tra và PR |
| [DEFINITION-OF-DONE](DEFINITION-OF-DONE.md) | Điều kiện được gọi một thay đổi là hoàn tất |
| [AGENTS](../AGENTS.md) | Chỉ dẫn tự đọc cho coding agent ở root repository |

## Đọc theo miền

| Miền | Tài liệu |
| --- | --- |
| Tổng quan và khởi chạy | [README dự án](../README.md) |
| Kiến trúc dịch vụ | [ARCHITECTURE](ARCHITECTURE.md), [API hiện tại](API.md) |
| Thế giới, quest và story rewards | [ADVENTURE](ADVENTURE.md) |
| Hội chợ, độ khó, checkpoint | [FRIENDSHIP-FAIR](FRIENDSHIP-FAIR.md), [GAMEPLAY-FOUNDATION](GAMEPLAY-FOUNDATION.md) |
| Vấn đề gameplay đã rà soát | [GAMEPLAY-AUDIT](GAMEPLAY-AUDIT.md) |
| Nhân vật và assets | [CHIBI-CAST](CHIBI-CAST.md), [SUNLIT-VILLAGE](SUNLIT-VILLAGE.md) |
| Quyết định kiến trúc | [ADR 001: nguồn tiến độ riêng](decisions/001-unified-player-journey.md), [ADR 002: core trước nội dung](decisions/002-core-first-development.md) |
| Bằng chứng kiểm tra theo đợt | [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md) |

## Cách giữ tài liệu nhất quán

- PROJECT-RULES chứa quy định; ROADMAP chứa trạng thái công việc; docs miền chứa
  contract; SYSTEM-VALIDATION chứa bằng chứng. Liên kết thay vì sao chép nội dung.
- Một bản ghi test cũ chỉ xác nhận commit/phạm vi được ghi, không xác nhận HEAD mới.
- Khi thay đổi quyết định kiến trúc, thêm ADR và ghi rõ quyết định cũ bị thay thế ở
  điểm nào. Không âm thầm sửa lịch sử để làm như hệ thống luôn hoạt động như vậy.
- Nội dung đề xuất phải ghi `planned`, không được mô tả như endpoint/tính năng đang có.
- Nếu code khác docs: kiểm tra hành vi thật, ghi discrepancy và xử lý trong task;
  lỗi tồn tại không tự trở thành quy tắc được phép tiếp tục sao chép.
