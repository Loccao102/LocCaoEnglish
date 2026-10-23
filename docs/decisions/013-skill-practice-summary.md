# ADR 013 — Hồ sơ luyện tập và gợi ý từ bài đã kiểm tra

Status: Accepted, 2026-10-23. Scope: CORE-005.

Đã triển khai qua [PR #24](https://github.com/Loccao102/LocCaoEnglish/pull/24),
main `9009a3e`; nghiệm thu 2026-10-24 (UTC+7), chưa deploy production.

## Bối cảnh

Confidence hiện trộn số khởi tạo, lịch sử cũ và kết quả luyện tập. Tài khoản mới
đã có 42–78%; dashboard gọi đó là điểm yếu, bản đồ camp dùng trạng thái mastery
cố định và questline hứa XP không khớp các hoạt động thực tế.

## Quyết định

- Bổ sung `practice` vào mỗi skill: `method: skill-practice.v1`, `sampleCount`,
  `correctCount`, `windowSize: 20`, `lastCompletedAt` (nullable), `evidenceKind`
  (`guided-practice`, `transcript-match`, hoặc `not-supported`).
- Chỉ đọc shared attempts completed, đúng owner, có item/content/completion time,
  cặp activity/rules được hỗ trợ và skill khớp activity. Bài đúng và sai đều là
  luyện tập. Không dùng seed, legacy attempts, story rewards, IELTS/provider
  feedback hoặc confidence làm bằng chứng trong projection này.
- Với từng skill, chọn lần hoàn tất mới nhất cho mỗi `(activity, itemKey,
  contentVersion)`, rồi lấy 20 bài khác nhau gần nhất. Thứ tự completion time và
  ID quyết định tie. Retry không thêm bài; round mới cùng bài thay kết quả cũ,
  kể cả XP bị cap. Đây là cửa sổ luyện tập, không phải mastery hoặc CEFR.
- Dashboard/camp hiển thị số bài và số đúng, trạng thái chưa có dữ liệu và giới
  hạn Speaking transcript. Bỏ bản đồ mastery mẫu. Questline ưu tiên bài có lỗi,
  tiếp đến kỹ năng chưa có dữ liệu, rồi ôn tập; tie ổn định theo tên. Không suy
  điểm yếu từ confidence và không hứa XP từ số ước lượng. Các route trỏ thẳng
  hoạt động tương ứng. Questline trả `method: skill-practice.v1`; frontend từ chối
  plan thiếu/khác method để không hiển thị chẩn đoán cũ khi API chưa cập nhật.
  Các trường XP cũ của questline giữ tương thích bằng 0.
  Với profile đã chọn goal, bài theo mục tiêu nằm sau review đến hạn/bài có lỗi
  và trước phần khám phá/ôn tập; ngân sách ngắn vẫn thấy hành động sửa lỗi.
- Dữ liệu lấy theo tài khoản hiện tại; guest không hiển thị demo như dữ liệu cá
  nhân. Đổi account, response muộn và lỗi mạng phải có trạng thái rõ và retry.
- Giữ nguyên confidence/level/XP, world/cosmetic gates và daily snapshot đã lưu.
  Những giá trị cũ là tiến độ cá nhân tương thích, không được dùng như bằng chứng
  của projection mới. Chính sách chuyển world/cosmetic grants cần ledger/migration
  riêng; không thu hồi huy hiệu cũ trong lát cắt này. Daily plan vẫn dùng policy
  v1 đã lưu; chưa thay thuật toán chọn daily, teacher analytics hoặc calibration.

## Phương án và đánh đổi

Đặt confidence về 0 sẽ mất lịch sử và vẫn tạo một chỉ số năng lực không có cơ sở.
Tính phần trăm mastery mới từ mọi lần replay dễ tạo cảm giác thành thạo giả.
Projection đọc riêng giữ save, giải thích được từng nhóm bài; cửa sổ 20 và latest
per item giảm việc một bài lặp lấn át gợi ý nhưng không chống cheat/assistance.

## Triển khai và phục hồi

Không migration hoặc ghi lại lịch sử. Backend thêm trường trước frontend. Client
cũ bỏ qua trường mới; client mới gặp backend cũ báo chưa có summary, không quay
về confidence. Rollback binary không xóa receipt. Policy thay đổi sau này cần
method mới; version của từng receipt vẫn được giữ.

## Nghiệm thu

Memory/PostgreSQL: seed/legacy/foreign/rules/skill/time exclusions, đúng/sai,
dedup/retry/capped replay, giới hạn 20, tie, restart và không đổi XP/confidence.
Engine: thứ tự gợi ý và route chính xác, không thưởng tưởng tượng. Browser thật:
người mới, luyện rồi reload, account switch/late response, offline retry, không
mastery mẫu và ảnh mobile 390×551/390×844. Roadmap giữ trạng thái duy nhất;
SYSTEM-VALIDATION lưu bằng chứng gắn revision.
