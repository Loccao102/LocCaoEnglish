# ADR 015 — Thiết lập mục tiêu đúng tài khoản và phục hồi sau lỗi lưu

Status: Accepted for implementation, 2026-10-24. Scope: CORE-006, hỗ trợ CORE-005.
Tiếp nối [ADR 014](014-vocabulary-unlock-grants.md); không đổi luật grant.

## Vấn đề

Onboarding chỉ tải profile lúc mount nhưng PUT lấy token hiện tại: đổi A→B giữ
form A và có thể ghi vào B. GET/PUT trả muộn cũng cập nhật form của người mới.
Guest PUT hiện đổi shared demo; key `loccao_player_build` không có owner, không
kiểm tra shape và có thể làm UI crash. Storage lỗi trước try/finally khiến nút lưu
mắc kẹt. Thất bại mạng vẫn hiện các lựa chọn như đã lưu xong.

## API và dữ liệu

- Chỉ PUT `/v1/player/profile` bắt buộc `signedInUser`; guest/invalid/expired
  token nhận 401, không sửa demo. GET giữ anonymous-demo compatibility hiện có.
  Owner luôn từ token; body userId không cho quyền ghi tài khoản khác.
- Giữ normalization goal/CEFR, phút 5–120, target band 4–9 làm tròn nửa band,
  interests normalized/deduplicated tối đa 8. Không thêm XP/confidence/rank,
  không đổi daily plan đã snapshot, world/quest policy hoặc schema.
- `savePlayerProfile(input, token?)` thêm token rõ ràng; onboarding và placement
  ghim token cho cả GET/PUT. Helper cũ vẫn tương thích, anonymous PUT không mở lại.
- Profile vẫn là PUT last-write-wins. Không phải receipt hay khóa chỉnh sửa nhiều
  thiết bị; không hứa chống mọi concurrent same-owner overwrite. GET đọc lại chỉ
  xác nhận trạng thái lúc đọc, không chứng minh lịch sử request.

## Giao diện và luồng lưu

- Onboarding dùng identity listener hiện có; chưa biết token thì loading. Account
  load ghim token, lấy user thật bằng `/v1/me`; profile.userId phải khớp. Form và
  trạng thái chỉ render đúng owner/token hiện tại, kể cả trước effect cleanup.
  Không tự import guest/legacy vào tài khoản.
- Chờ account GET thành công trước khi sửa; disable controls khi PUT. Capture
  snapshot chính xác, chặn double click bằng ref đồng bộ, request sequence và
  captured token chặn late GET/PUT cả thành công lẫn lỗi sau đổi account/logout.
- Trước PUT giữ pending snapshot trong bộ nhớ và thử lưu draft versioned theo
  owner. Storage lỗi có thông báo, vẫn lưu online được, không mắc busy. Chỉ hiện
  đồng bộ khi response hợp lệ hoặc GET khớp attempted normalized fields.
- PUT chưa xác nhận: giữ draft, chặn PUT tiếp, có `Refresh saved settings`.
  Refresh lỗi giữ lock; không auto replay. Reload đọc pending đúng owner rồi GET.
- GET khớp attempted fields: xác nhận dữ liệu hiện lưu. GET khác: giữ cả saved
  settings và attempted draft, yêu cầu chọn `Use saved settings` hoặc
  `Review my changes` trước PUT mới. Không tự ghi đè; không nói mismatch chứng
  minh request trước chưa từng thành công. Auth error có đường đăng nhập lại.

## Draft và guest

- Key mới `loccao.profile-settings.v1.<owner>`; owner là user ID thật từ me hoặc
  `guest`, không lưu token/email trong key/payload.
- Envelope `{version:1,owner,status,fields}`; status `draft`, `uncertain` hoặc
  `confirmed`. Fields chỉ gồm goal,cefrLevel,dailyMinutes,targetBand,interests;
  validate/normalize trước dùng. Có thể thêm saved fields cho lựa chọn phục hồi.
- Dữ liệu sai shape/version/owner: giữ raw key, thông báo không đọc được; không
  spread JSON vào form, không auto PUT. Bộ nhớ vẫn cho thao tác an toàn.
- Guest chỉnh/lưu trên thiết bị, không gọi personal profile GET/PUT; copy rõ
  local-only. Guest placement đọc/ghi cùng module validated guest preference,
  giữ 12 câu và không cấp XP/confidence/rank.
- Key cũ `loccao_player_build` không rõ owner: giữ nguyên; chỉ guest có nút
  chủ động `Review earlier device settings` sau validation. Không tự gộp vào
  account, không xóa key corrupt/unowned; bản mới không ghi key cũ.
- Confirmed draft có thể cập nhật canonical state; không đọc/ghi/xóa draft owner
  khác. Không thêm telemetry/audio. Storage lỗi không tự báo saved/synced.

## Phạm vi và nghiệm thu

Sửa active PlayerOnboarding, profile HTTP/helper, placement caller, module draft,
docs và kiểm tra liên quan. District campaign pages/PlayerJourney là follow-up;
không coi CORE-006 đã done. Không deploy production; backend trước frontend mới.

HTTP: guest/demo/invalid/expired/body foreign owner. Browser: lưu thật/reload,
A→B/logout lúc GET/PUT pending, request đảo thứ tự/double click, lost response
trước/sau commit, refresh lỗi/mismatch/match, storage blocked/corrupt/version lạ,
legacy explicit guest import, không auto account import, guest/signed placement
không đổi rewards, ảnh 390×551/844. Go/vet/build/TS/integration và đủ sáu CI jobs
trên final head trước main. Chưa có PG local thì ghi giới hạn và chờ CI.
