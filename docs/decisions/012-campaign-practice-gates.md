# ADR 012 — Bằng chứng chuẩn bị cho chín nhiệm vụ hội thoại

Status: Accepted, 2026-10-22. Scope: CORE-005/CORE-006;
tiếp nối [ADR 005](005-mission-evidence.md) và [ADR 011](011-daily-practice-recovery.md).

## Bối cảnh

SQL đang mở checkpoint từ bảng accuracy cũ; memory suy từ confidence thay đổi,
kể cả bài sai, bỏ qua activity và thời điểm chương trước. Hai chế độ vì thế có
thể mở chương khác nhau. Shared attempts đã có thời điểm hoàn tất thật.

## Quyết định

- Chính sách `campaign-practice.v1` dùng completed, correct shared attempts đúng
  owner, có content version, cặp activity/rules được hỗ trợ và completed_at thật.
  Không dùng legacy attempts/confidence, provider pronunciation hay điểm tự báo.
- Một bảng điều kiện cho cả hiển thị và ghi completion của cả chín chương.
  Chương sau cần chương trước đã clear và practice hoàn tất **sau** mốc clear đó.
  Retry attempt đã hoàn tất không đổi mốc; một round mới đúng vẫn đủ điều kiện
  dù không được thêm learning XP. Không yêu cầu pack/CEFR cụ thể ở phiên bản này.
- Đây là chuẩn bị có hỗ trợ: Shadow Me là transcript match có mẫu, không phải
  đánh giá phát âm, unassisted mastery hay chứng chỉ năng lực.
- Khi clear lần đầu, kiểm tra lại gate, lưu preparation receipt (policy, mốc chương
  trước, ID/activity/content/rules/completedAt của ba bài) cùng dialogue, ledger và
  reward trong một transaction/critical section. Dùng wall-clock completion,
  không dùng thời điểm bắt đầu transaction để quyết định freshness.
- Giữ tất cả clear, XP, cosmetics và dialogue receipt cũ; retry không thưởng lại.
  Receipt thiếu preparation vẫn đọc được, không backfill bằng chứng giả. Clear cũ
  vẫn mở chuỗi chương nhưng chương kế cần practice mới sau mốc clear đã lưu.
- Goal/lifetime XP vẫn là điều kiện vào world mang tính cá nhân. Chính sách
  confidence/Word Network/cosmetics rộng hơn tiếp tục nằm trong CORE-005.

## Các phương án và đánh đổi

Giữ fallback confidence dễ triển khai nhưng không biết bài nào, đúng/sai hay thời
gian. Chuyển shared receipts cho kết quả đồng nhất và truy vết được, đổi lại người
chưa clear chỉ có lịch sử legacy cần làm lại checkpoint. Bắt buộc đúng pack hoặc
mastery nhiều lần sẽ tăng chiều sâu nhưng cần catalog/assistance/difficulty policy
riêng; không âm thầm gắn nhãn năng lực cho guided practice trong bản sửa này.

## Triển khai và phục hồi

Không cần schema mới: preparation là trường JSON bổ sung trong player_bosses.evidence;
completed_at đã được bổ sung bởi migration 021/startup schema. Backend trước frontend.
Không backfill completed_at NULL từ created_at; bài không rõ thời điểm cần round mới.
Rollback binary không xóa dữ liệu; UI cũ bỏ qua trường mới, receipt cũ vẫn đọc được.
Rollback về binary cũ cũng mở lại gate yếu, nên ưu tiên sửa tiến thay vì quay lại.

## Nghiệm thu và hệ quả

Phải kiểm tra memory/PostgreSQL, legacy/wrong/foreign/unsupported/NULL time, chín
mapping, freshness theo completion chứ không creation, retry so với fresh replay,
hai store đồng thời, rollback reward/receipt và giữ clear/receipt cũ. Browser phải
đi qua chapter gate và refresh sau luyện đúng, kể cả mất response và mobile.
Roadmap là nguồn trạng thái, [SYSTEM-VALIDATION](../SYSTEM-VALIDATION.md) ghi bằng chứng.
