# Quy tắc làm việc cho agent — LocCaoEnglish

Áp dụng cho toàn bộ repository và mọi agent sửa code, nội dung, assets hoặc docs.
Đây là điểm vào bắt buộc; không cần người dùng nhắc lại các quy tắc trong mỗi task.

## Đọc trước khi làm

1. [Quy tắc dự án](docs/PROJECT-RULES.md): nguồn quy định chính.
2. [Roadmap](docs/ROADMAP.md): việc còn thiếu, ưu tiên, phụ thuộc và tiêu chí nghiệm thu.
3. [Hướng dẫn đóng góp](CONTRIBUTING.md) và [điều kiện hoàn tất](docs/DEFINITION-OF-DONE.md).
4. [Mục lục docs](docs/README.md): chọn tài liệu đúng miền đang sửa.

## Chỉ dẫn thực thi

- Kiểm tra branch, `git status` và diff hiện có. Giữ nguyên công việc không thuộc task.
- Gắn task với một ID trong roadmap; nếu chưa có, thêm mục với phạm vi và tiêu chí
  hoàn tất trước khi mở rộng tính năng. Bug khẩn cấp được sửa ngay và ghi lại cùng PR.
- Mặc định làm core P0 trước P1/P2. Không thêm game/map/nhân vật chỉ để tăng số lượng
  khi luồng chấm điểm, lưu kết quả hoặc khôi phục còn lỗi. Chỉ đổi ưu tiên khi yêu cầu
  hiện tại của người dùng nêu rõ phạm vi khác; ghi lại lý do, không cần hỏi lại.
- Xác minh route/component đang được dùng trước khi sửa; không lấy code cũ không
  được import làm bằng chứng cho hành vi hiện tại.
- Luật Fair thuộc `FestivalSession`; UI/Three.js không tự tính thưởng hoặc có bản
  sao độc lập của luật. Không dùng kết quả Fair tự báo để cấp learning XP/rank.
- Không tạo thêm đường cấp XP/độ thành thạo dựa vào `accuracy`/`score` tùy ý từ client.
  API học hiện tại còn nợ kỹ thuật; xem CORE-001, không coi đó là mẫu để mở rộng.
- Thay đổi định dạng save, seed generator, API hay luật kết quả phải có kế hoạch
  version/migration, tương thích retry và kiểm tra tài khoản sở hữu dữ liệu.
- Chạy kiểm tra phù hợp theo CONTRIBUTING. Không xóa test, giảm assertion hay bật
  Practice để che lỗi Adventure/Challenge. Ghi rõ kiểm tra bị chặn/chưa chạy.
- Không sửa/xóa save, queue hoặc database của người dùng để làm kiểm tra pass.
- Cập nhật roadmap, docs miền và bằng chứng xác minh khi thay đổi hành vi/contract.
  Chỉ đánh dấu `done` sau khi đáp ứng tiêu chí và Definition of Done.
- Bàn giao: thay đổi gì, đã kiểm tra gì, commit/PR, điều gì chưa xác minh, việc tiếp
  theo. Không tuyên bố toàn hệ thống đã hoàn tất từ một build hoặc một màn hình.

Quy tắc chi tiết chỉ được duy trì ở PROJECT-RULES; không sao chép thành nhiều bộ
luật khác nhau. Hướng dẫn cấp cao hơn của môi trường và yêu cầu rõ ràng của người
dùng vẫn có ưu tiên. Ngoại lệ về phạm vi/kiểm tra phải được ghi trong PR.

Giữ nguyên khối Next.js được công cụ quản lý bên dưới.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
