# ADR 017 — Teacher practice analytics từ shared attempts

Status: Accepted, 2026-11-05. Scope: CORE-005.

## Bối cảnh

`AnalyticsSnapshot` đã có các trường lịch sử như `averageAccuracy` và
`averageConfidence`. Những trường này tồn tại để tương thích, nhưng trộn legacy
attempts, seed confidence và các nguồn không phải practice nên không đủ làm bằng
chứng hiện tại cho giáo viên. Teacher dashboard cần một projection có nguồn gốc
rõ ràng, dùng được như nhau ở memory và PostgreSQL.

## Quyết định

- Bổ sung `method: teacher-practice.v1` ở response analytics và object `practice`
  với `windowDays: 7`, `attempts7d`, `correct7d`, `active7d` (số learner khác
  nhau trong toàn cửa sổ) và `skills`.
- Mỗi skill có `attempts`, `correct`, `learners` (distinct learner của skill) và
  `evidenceKind`. Các skill practice có hướng dẫn dùng `guided-practice`; riêng
  Speaking dùng `transcript-match` để không ngụ ý đánh giá phát âm âm học.
- Chỉ tính completed shared attempts có owner, item key, content version,
  completion time trong cửa sổ UTC đóng `[now-7d, now]`, activity/rules/skill
  đúng catalog dùng bởi `skill_practice` và `checked_practice`. Sai vẫn là một
  lần luyện tập. Retry cùng server attempt là một receipt, không nhân đôi.
- Loại demo, active, legacy, Adventure quest/IELTS/unknown và mọi receipt thiếu hoặc sai
  provenance. Projection chỉ đọc; không ghi reward, XP, confidence, level hay
  world state.
- Story Choice (`story-choice`) thuộc shared guided Reading practice, vẫn được
  tính khi đúng policy. Đây không phải quest clear của Adventure/Sunlit Village.
- Giữ nguyên các trường analytics cũ như giá trị compatibility đã deprecated.
  UI mới không trình bày chúng như evidence hiện tại; policy mới sau này phải
  dùng method version mới.

## Tương thích và phục hồi

Đây là thay đổi additive, không cần migration SQL. Client cũ bỏ qua `practice`;
client mới gặp server cũ vẫn giữ được các trường cũ và có thể báo thiếu method.
Rollback binary không xóa hay sửa attempt/skill state. Quyền route hiện có giữ
nguyên: chỉ teacher/admin đọc analytics; learner và guest không được suy ra dữ
liệu lớp.

## Nghiệm thu

Store memory và PostgreSQL phải cùng kết quả cho eligibility, cửa sổ và biên thời
gian, đúng/sai, distinct learners, duplicate/retry, activity/rules/skill sai,
demo, zero-data và không thay đổi account state. HTTP kiểm tra quyền teacher,
admin, learner và guest; CI browser/API kiểm tra response method và rendering
teacher từ một round practice thật.
