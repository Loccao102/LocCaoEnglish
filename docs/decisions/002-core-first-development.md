# ADR 002 — Core trước mở rộng nội dung

Status: accepted, 2026-09-27. Áp dụng hướng phát triển theo yêu cầu chủ dự án;
không có nghĩa các hạng mục core bên dưới đã được triển khai.

## Bối cảnh

Người chơi muốn game có kỹ năng và chiều sâu, không chỉ hình ảnh di chuyển hoặc
câu hỏi quá dễ. Fair đã có session/difficulty/checkpoint; các learning activities
còn dùng lifecycle riêng và client-reported accuracy. Thêm nội dung vào lúc này
có thể nhân rộng các lỗi chấm điểm và lưu tiến độ.

## Quyết định

1. Ưu tiên server-owned learning attempts, shared round lifecycle và reward
   integrity trước game/map/nhân vật mới. Giao từng lát cắt dọc, bắt đầu Word Link.
2. Giữ các miền story, Fair, learning và IELTS riêng theo ADR 001. Không ép tất cả
   vào một engine khổng lồ, không gộp Fair stars thành learning mastery.
3. Quy tắc bắt buộc ở [PROJECT-RULES](../PROJECT-RULES.md); backlog/status chỉ ở
   [ROADMAP](../ROADMAP.md). AGENTS/CONTRIBUTING/PR template dẫn về cùng nguồn.
4. Dùng [Definition of Done](../DEFINITION-OF-DONE.md) để phân biệt code đã viết,
   kết quả đã kiểm tra, thay đổi đã merge và hệ thống đã deploy.
5. Việc chưa đạt contract được ghi là nợ kỹ thuật; không mô tả kiến trúc mong muốn
   như hành vi sẵn có. Mọi thay đổi save/generator phải có version và rollout rõ.

## Làm rõ ADR 001

Fair server hiện tính điểm từ số vòng và **result stars** client báo. Ở Practice,
số sao tương ứng số tim còn lại; advanced modes trừ ảnh hưởng assistance theo
[GAMEPLAY-FOUNDATION](../GAMEPLAY-FOUNDATION.md). Cụm “reported remaining hearts”
trong ADR 001 là mô tả trước khi có difficulty, không phải quyền bỏ qua assistance.
Ranh giới Fair không cấp learning XP/rank của ADR 001 giữ nguyên.

## Đánh đổi

Tiến độ thêm nội dung mới sẽ chậm hơn trong ngắn hạn. Đổi lại, các game mới có
thể dùng contract lưu/chấm/khôi phục đã được kiểm tra. Không cần tách microservice
hay viết lại runtime 3D để thực hiện bước này; Go modular backend vẫn là ranh giới
persistence. Cân bằng độ khó vẫn cần playtest ngoài test tự động.

## Xác minh và áp dụng

Mỗi PR liên kết mục roadmap và nêu bằng chứng. CI giữ kiểm tra kỹ thuật; reviewer
chịu trách nhiệm nội dung/kiến trúc/nguồn assets. Required checks/review trên GitHub
cần xác minh riêng trong GOV-002; ADR này không tự bật branch protection.
