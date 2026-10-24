# ADR 014 — Quyền Word Network và Wordsmith có nguồn gốc

Status: Accepted for implementation, 2026-10-24. Scope: CORE-005/006.
Tiếp nối [ADR 013](013-skill-practice-summary.md).

## Bối cảnh

Vocabulary khởi tạo 74% tự mở Word Network (55%) và Wordsmith/pin (70%) cho
mọi tài khoản mới. Quyền hiện được tính động, không có ledger; thay threshold
trực tiếp sẽ thu hồi quyền cũ. Trang bị còn cho phép fallback sang shared demo,
và UI progression có thể hiển thị response của tài khoản trước.

## Quyết định

- Policy `vocabulary-unlocks.v1` chỉ sở hữu hai grant `word-network`, `wordsmith`.
  Wordsmith mở achievement và pin cùng một nguồn. Không cấp XP/rank, không thay
  profile/XP gates của các world khác, campaign clear, IELTS hoặc Fair.
- Quyền mới: Word Network cần **3 bài Vocabulary khác nhau từng làm đúng**, hoặc
  **300 personal XP** như trước. Wordsmith cần **7 bài khác nhau từng làm đúng
  từ ít nhất 2 activity**. Đây là mốc luyện tập có hỗ trợ, không phải mastery/CEFR.
- Evidence chỉ từ completed shared attempts đúng owner, skill Vocabulary,
  activity/rules được hỗ trợ (`word-link`, `collocation-factory`, `word-graph`),
  item/content không rỗng và completion time thật. Identity là `(activity,itemKey)`;
  đổi content version hoặc replay không tăng số bài. Lấy lần đúng đầu tiên theo
  completion time rồi ID; giữ content/rules version trong proof. Capped replay
  đúng vẫn hợp lệ, sai/legacy/provider/guest/foreign/future rules không tính.
- Đây là milestone tích lũy, khác cửa sổ latest-20 của journal. Sai về sau không
  xóa bài từng đúng hay thu hồi grant. Receipt được ghi nguyên tử một lần theo
  `(owner,unlockID)`; retry/concurrent/restart không thay nguồn/proof/thời gian.
  Nếu đủ cả practice và XP, ưu tiên source `checked-practice` khi ghi lần đầu.
- Ledger lưu `unlockId`, `method`, `source` (`legacy-personal`, `checked-practice`,
  `personal-xp`), `recordedAt`, optional `evidence` (attemptId/activity/itemKey/
  contentVersion/rulesVersion/completedAt), optional `personalXp` ở lúc grant.
  `recordedAt` là lúc ghi nhận; không bịa thời điểm người cũ từng nhận quyền.
- API bổ sung optional `unlock` vào words WorldState và Wordsmith achievement/
  pin: `{method,correctItems,targetItems,activityCount,targetActivities,receipt?}`.
  Count tiến độ cap ở 7, activity cap ở 3; target lần lượt 3/1 và 7/2. Receipt là
  snapshot bất biến, counts hiện tại là tiến độ tích lũy. Không dùng confidence.
  Words `progress` biểu diễn phần trăm checklist luyện tập (0–100), không gọi
  `% explored`; `unlock` giữ số bài/hoạt động thực tế cho giao diện.
- GET progression xác nhận grant đã đủ điều kiện trong transaction có khóa owner
  rồi trả trạng thái. Việc này chỉ ghi entitlement, không XP. Trang bị là thao tác
  riêng, idempotent, yêu cầu tài khoản; GET/PUT phải cùng policy. Lỗi trang bị không
  xóa grant đã kiếm được, không báo thành công giả. Refresh đọc lại đồ đã lưu.
  GET giữ anonymous-demo compatibility khi được cấu hình; UI hồ sơ mới không
  dùng response demo làm tiến độ cá nhân. Chỉ PUT trang bị bắt buộc đăng nhập.
- Word Graph và bài luyện trực tiếp vẫn công khai như trước; grant điều khiển mốc
  trong progression/menu, không phải lớp phân quyền cho nội dung học.

## Giữ dữ liệu và cutover

Migration 022 và startup schema dùng cùng SQL: ledger + cutover marker bền vững.
Một transaction, advisory lock cho initializer và một MVCC statement chụp quyền
cũ cùng marker. Snapshot chỉ chạy một lần: Word Network theo confidence ≥55% hoặc
XP ≥300; Wordsmith theo confidence ≥70% hoặc pin đang trang bị. Pin đã trang bị
cũng giữ Word Network. Ghi `legacy-personal`, không backfill attempt evidence.
Marker ghi cả quyết định âm (không có grant); chạy lại không xét confidence cho
tài khoản mới. Giữ XP/confidence/save/loadout; chỉ biết quyền còn suy được từ
dữ liệu tại cutover, không thể tái tạo lịch sử quyền chưa từng được lưu.

`Store.New` phải khởi tạo cutover **trước EnsureDemo/registration**; memory cũng
đặt boundary khi còn rỗng. `EnsureProgression` sau đó idempotent. Base/learning
DDL cũng dùng cùng advisory lock trước cutover để hai constructor khởi động trên
schema rỗng không đua tạo bảng; mỗi pha khởi tạo có timeout một phút. Production
cần drain writer API cũ trước cutover, backend mới trước frontend; không chạy binary
cũ song song để nhận cùng semantics. Rollback không drop schema/grants; binary
cũ mở lại policy yếu nên ưu tiên sửa tiến. Không deploy trong task này.

## Giao diện và tài khoản

Hiển thị rõ “Previously unlocked · kept”, “Checked vocabulary practice” hoặc
“Personal XP milestone”, cùng checklist item/activity khi đang khóa. Không suy
mastery từ seed hoặc `% explored`. API cũ thiếu metadata hiển thị thiếu chi tiết,
không tự gắn nguồn verified. `/progress`, camp WorldSelect/CampaignSpotlight và account rewards
chỉ hiển thị dữ liệu cá nhân khi đăng nhập, có loading/error/retry. Chặn late GET
và equip của owner cũ; request mutation ghim token, response muộn không đổi owner
mới. Guest có liên kết học và lời mời đăng nhập, không hiển thị demo như hồ sơ.

## Các phương án và đánh đổi

Đổi confidence về 0 mất lịch sử nhưng không tạo bằng chứng. Freeze mọi tài khoản
khi GET lần đầu sẽ tiếp tục nhận nhầm seed mới là legacy. Marker tại startup cùng
snapshot nguyên tử tránh cả hai. Milestone tích lũy có receipt dễ giải thích và
không thu hồi đồ; không chống học đáp án/hỗ trợ hoặc chứng nhận năng lực. Personal
XP vẫn là một đường mở world riêng, được ghi đúng nguồn và không vào checked rank.

## Nghiệm thu

Memory/PG: old eligible/equipped/negative, marker repeat và restart, hai initializer,
rollback marker/grants, new .74 không tự grant, owner/version/time/identity,
3/7/2 activity, capped replay, immutable receipts, concurrent sync/equip, không
XP/confidence mutation. DB fixture schema riêng trong `loccao_system_test`, không
drop bảng người học. Browser: làm bài thật mở 3→7, equip/reload, guest401, account
switch/late GET/late equip/unconfirmed response, legacy copy và mobile 390×551/844.
Roadmap là nguồn trạng thái; SYSTEM-VALIDATION ghi revision và sáu CI jobs.
