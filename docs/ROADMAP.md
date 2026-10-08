# Roadmap thực thi

Cập nhật nền: 2026-10-08, main `31d842e` (PR #10). Đây là nguồn duy nhất của danh sách việc
cần làm và trạng thái. Chẩn đoán chi tiết ở [GAMEPLAY-AUDIT](GAMEPLAY-AUDIT.md);
quy định ở [PROJECT-RULES](PROJECT-RULES.md). Không bắt đầu mở rộng số lượng game
trước khi các contract core liên quan đã vững.

## Trạng thái nền đang có

- 24 nhân vật chibi, 7 chapter/14 quest, 8 Fair games và 12 learning activities.
- Fair có 3 mức khó, session dùng chung, seed/version, checkpoint, assistance,
  ledger chống ghi lặp và records theo mức khó. Xem [contract](GAMEPLAY-FOUNDATION.md).
- Story, Fair, learning XP và IELTS estimates vẫn là các miền khác nhau.
- Word Link, Grammar Repair, Collocation Factory, Sentence Builder, bài luyện Word Graph, Reading Race, Story Choice và Listen & Pick dùng chung server attempts và lifecycle khôi phục;
  các hoạt động còn lại chưa được chuyển đồng bộ sang contract này.
- Bằng chứng của đợt core trước: 50 logic cases, 17 browser scenarios và kiểm tra
  build/Go local; xem [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md) để biết giới hạn.
  Đây không phải xác nhận CI/production cho mọi revision sau này.

## Thứ tự mặc định

CORE-001 → CORE-002 → CORE-003/CORE-004 → CORE-005 → CORE-006 → CORE-007 → CONTENT-001.
DEP-001 và GOV-002 có thể làm khi đủ điều kiện độc lập, không cần chờ thêm nội dung.
CORE-001 phải giao được một luồng Word Link hoàn chỉnh trước khi chuyển hàng loạt
hoạt động. Nếu chủ dự án chỉ định task khác, ghi lý do và giới hạn trong PR.

| ID | Ưu tiên | Công việc | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- |
| CORE-001 | P0 | Attempt do server cấp và chấm; Word Link làm luồng đầu tiên | — | done |
| CORE-002 | P0 | Vòng chơi dùng chung phía frontend | CORE-001 contract | done |
| CORE-003 | P0 | Di chuyển 9 hoạt động khách quan, sửa lộ đáp án/chấm sai | CORE-001, CORE-002 | in_progress |
| CORE-004 | P0 | Nguồn gốc bằng chứng cho conversation/speaking/IELTS | CORE-001, CORE-002 | planned |
| CORE-005 | P0 | Reward/rank chỉ dùng kết quả được xác thực | CORE-003, CORE-004 | planned |
| CORE-006 | P1 | Khôi phục và tương thích xuyên hệ thống | CORE-002, CORE-005 | planned |
| CORE-007 | P1 | Đo và cân bằng độ khó, kiểm tra chiều sâu | Các luồng core liên quan | planned |
| CONTENT-001 | P2 | Mở rộng nội dung có mục đích, không tăng số lượng hình thức | CORE-005, CORE-007 | planned |
| DEP-001 | P0 | Triển khai/xác minh API và migration độ khó Fair | Backend/schema mới, môi trường đích | planned |
| GOV-001 | P0 | Quy tắc, docs index, backlog, DoD và PR template | — | done |
| GOV-002 | P1 | Xác minh và cấu hình rào chắn merge trên GitHub | Quyền repo, CI ổn định | planned |

Các mục planned chưa có người nhận hoặc hạn giao được ấn định. Người nhận chuyển
`in_progress` kèm tên/task/PR và ngày; không tự gán người khác. Mục done cần ghi
commit/PR + bằng chứng ngay tại mục đó. Không giữ “pending CI” vô thời hạn trong
trạng thái done khi CI là điều kiện nghiệm thu của task.

## CORE-001 — Server-owned attempt

Owner/task: Codex, branch `codex/learning-recovery`, 2026-09-27. Tiếp nối A1–C2
Word Link/Grammar Repair trên main `8aa9e06`; không tạo engine pilot song song.
Đã bổ sung snapshot/resume, owner guest/account, version validation, daily claim,
actual response log và migration 016. Xem [ADR 003](decisions/003-learning-recovery.md).
Đã merge qua [PR #4](https://github.com/Loccao102/LocCaoEnglish/pull/4), commit
`238c931`. Runtime `cf13e2f` đạt đủ 6 jobs tại
[CI 94](https://github.com/Loccao102/LocCaoEnglish/actions/runs/36450327003):
PostgreSQL/race, HTTP/domain, build, assets, integration và 52 E2E browser.
Các luồng mới xác minh guest/account, lost-response/reload, version/owner, actual
response/review, concurrent daily claims và rollback giao dịch. Chi tiết ở
[SYSTEM-VALIDATION](SYSTEM-VALIDATION.md#learning-recovery--2026-09-28).
Done áp dụng code/contract đã merge; chưa deploy API local/production. Windows
chặn store executable/API launch, phần đó được kiểm tra trên Linux CI.

**Vấn đề:** client đang báo accuracy, một số nơi gửi đáp án chuẩn thay câu trả lời
thật. Kết quả đó chưa đủ tin cậy để cấp mastery/rank.

**Cần làm:** thiết kế và ghi contract trước; server cấp attempt ID gắn account,
activity/content ID, content version, rules version và trạng thái. Client gửi lựa
chọn/thứ tự/text thật, không gửi điểm có thẩm quyền. Server chấm câu hỏi khách quan,
trả verdict và cập nhật progression nguyên tử. Đưa Word Link qua toàn bộ luồng này.

Endpoint pilot đã có trong code; mức triển khai/xác minh không được suy từ đó.
TTL, offline và replay được chốt trong ADR/API spec; không tự dùng timer UI làm
bằng chứng chống gian lận. Không gửi đáp án chuẩn xuống trước chấm. Kết quả pilot
là practice, chưa đủ để xác nhận competitive/unassisted evidence.

**Hoàn tất khi:**

- Word Link chơi từ lúc tạo attempt đến nhận feedback/save qua API thật.
- Điểm do client sửa không thay verdict; attempt sai owner/content/version bị từ chối.
- Retry/mất response/request đồng thời chỉ ghi attempt/reward một lần; payload khác
  cùng ID bị từ chối. Có test PostgreSQL và HTTP, không chỉ memory.
- Có actual response và correct answer riêng, trạng thái hỗ trợ rõ, migration API
  cũ được mô tả; không làm mất lịch sử người học.

## CORE-002 — Shared learning round lifecycle

Owner/task: cùng PR #4/commit `238c931` của CORE-001. Word Link và Grammar Repair
dùng chung hook khôi phục, khóa submit/retry, loại response cũ và owner-scoped
reference; UI giữ A1–C2 và campaign packs. CI 94 đã xác minh browser/API thật cho
cả hai trò, gồm response bị mất sau commit, reload, đổi tài khoản; ba UI fault tests
kiểm tra retry identity, pending input, expired round và giữ level sau reload.
Hai adapter hiện không có hint hoặc đồng hồ tính điểm: pause/assistance chưa áp
dụng, không được tự coi adapter sau này đã đáp ứng. TTL 24 giờ là hạn lưu lượt,
không phải phép đo tốc độ. Mở rộng adapter/assistance tiếp tục trong CORE-003/004.

**Cần làm:** tách controller/reducer hoặc module tương đương cho vòng đời
ready → active → submitting → feedback → finished; mỗi hoạt động cung cấp adapter
input/render/chấm phù hợp. Tên trạng thái là đề xuất, phải chốt cùng contract.

**Hoàn tất khi:**

- Word Link và một hoạt động khác dùng cùng lifecycle; UI không tự cấp điểm.
- Trộn lựa chọn/chunks giữ ID ổn định, không đổi đáp án mỗi render hoặc khi resume.
- Double click/Enter, submit trong lúc chờ và response cũ không tạo lượt mới.
- Retry network dùng attempt ID cũ; “chơi lại” tạo attempt mới theo chính sách.
- Pause, assistance, đổi pack/route/tài khoản không làm lẫn session hoặc bằng chứng.
- Feedback có lỗi, retry và đường đi tiếp rõ ràng; không mất câu trả lời vì request lỗi.

## CORE-003 — Hoạt động khách quan và answer leakage

Owner/task: Codex, branch `codex/core003-collocation`, 2026-09-28. Lát cắt đầu tiên
chuyển Collocation Factory sang attempt server-owned: catalog/version, lựa chọn
được trộn bằng seed, chấm actual answer và retry/resume dùng chung. Đã merge qua
[PR #5](https://github.com/Loccao102/LocCaoEnglish/pull/5), commit `7beb176`,
[CI 97](https://github.com/Loccao102/LocCaoEnglish/actions/runs/36454145790) đạt 6 jobs.

Tiếp nối 2026-10-06: Codex, branch `codex/collocation-depth`, `done` cho lát cắt này.
Phạm vi: chặn accuracy Collocation ở API legacy; câu hỏi có ngữ cảnh, mỗi level
core và level mở đầu campaign có ít nhất 3 câu riêng; chữ/nút đủ lớn và feedback
đầy đủ. Giữ snapshot/retry cũ, không đổi schema/luật thưởng. Nghiệm thu bằng test
đúng/sai/retry/guest/account và browser ba câu không lặp, reload, màn 390px.
Đã merge qua [PR #6](https://github.com/Loccao102/LocCaoEnglish/pull/6), commit
`2efffc4`; xác nhận ngày 2026-10-07 (Asia/Bangkok).
[CI 99](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37468179572) đạt đủ
6 jobs trên runtime `56c5715`, gồm PostgreSQL/race và 59 E2E browser.
Các hoạt động còn lại vẫn là migration debt; toàn CORE-003 chưa done.

Di chuyển theo lát cắt nhỏ; mỗi hoạt động phải đáp ứng CORE-001/002, không chỉ đổi UI.

Tiếp nối 2026-10-07: Codex, branch `codex/core003-sentence-builder`, `done` cho lát cắt này.
Phạm vi: chuyển Sentence Builder sang snapshot server, mảnh câu có ID riêng và
trộn theo seed; chấm thứ tự người chơi gửi, giữ bản nháp/retry/reload, chặn API
accuracy cũ. Giữ ba campaign đang dùng, thêm bộ core A1–C2 và giải thích cấu trúc.
Nghiệm thu: từ lặp, câu đúng/sai, payload không hợp lệ, không chấm lại sau feedback,
guest/account, daily cap, PostgreSQL/concurrency và browser desktop/390px.
Đã merge qua [PR #7](https://github.com/Loccao102/LocCaoEnglish/pull/7), commit
`e84c1c1`. [CI 103](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37528956984)
đạt đủ 6 jobs trên runtime `e27f0f0`, gồm PostgreSQL/race và 64 E2E browser.
Không đổi schema, chưa deploy production; chi tiết ở [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md).
Các luồng học còn lại và toàn CORE-003 vẫn `in_progress`.

Tiếp nối 2026-10-07: Codex, branch `codex/core003-word-graph`, `done` cho lát cắt này.
Phạm vi: bản đồ chỉ để khám phá, không chấm/XP; bài luyện quan hệ ở route riêng
không hiển thị edges/Connections/định nghĩa đáp án. Dùng catalog graph chung phía
server, snapshot/retry/owner/daily cap hiện có và chặn accuracy Word Graph cũ.
Giữ 9 node/9 quan hệ travel; sửa nhãn quan hệ boarding cho đúng thứ tự thực tế.
Nghiệm thu: không lộ key/feedback trong đề, không có submit khi khám phá,
đúng/sai/retry/reload/account, ba câu riêng và chữ/nút đủ lớn ở 390px.
Đã merge qua [PR #8](https://github.com/Loccao102/LocCaoEnglish/pull/8), commit
`cac8c34`. [CI 106](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37559631886)
đạt đủ 6 jobs trên runtime `8bbc2f9`, gồm PostgreSQL/race và 69 E2E browser.
Không đổi schema, chưa deploy production. Toàn CORE-003 vẫn `in_progress`.

Tiếp nối 2026-10-07: Codex, branch `codex/core003-reading-race`, `done` cho lát cắt này.
Phạm vi: Reading Race tại `/reading`
(`components/learning/VerifiedReadingRace.tsx`; export cũ trong MiniGames trỏ về đây).
Chuyển passage/question/options vào snapshot có
version; server chấm lựa chọn thật, giải thích bằng câu dẫn chứng sau submit,
trộn lựa chọn và tránh lặp trong bộ bài. Chặn `reading-race` ở đường accuracy cũ;
giữ retry/reload/account boundary dùng chung. Chỉ mở level có nội dung
được biên soạn và kiểm tra; chưa thêm timer trước khi contract kết quả vững.
Contract: `reading-race.v1`, catalog `2026-10-07.1`, core A2/B1/B2,
ba đoạn riêng mỗi level. Prompt thêm title/passage; feedback dẫn chứng chỉ sau
submit. Snapshot JSON hiện có đủ lưu trữ, không đổi schema hoặc dữ liệu cũ.
Nghiệm thu: đúng/sai, payload/version/owner, daily cap, lost response/reload,
ba câu không lặp, đổi level, review giữ ngữ cảnh bài đọc và mobile 390px.
Go tests/vet, build và 12 browser/API scenarios đạt local. Đã merge qua
[PR #9](https://github.com/Loccao102/LocCaoEnglish/pull/9), commit `ad6a5cf`.
[CI 109](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37578203639) đạt
đủ 6 jobs trên runtime `32e1d68`, gồm PostgreSQL/race và 74 E2E browser.
Chưa deploy production; toàn CORE-003 vẫn `in_progress`. Tiếp nối bằng lát cắt
Story Choice bên dưới, sau đó tiếp tục hai luồng nghe/chép chính tả.

Tiếp nối 2026-10-08: Codex, branch `codex/core003-story-choice`, `done` cho lát cắt này.
Story Choice dùng chuỗi learning attempts liên kết do server cấp. Mỗi cảnh chấm
lựa chọn thực tế; chỉ mở cảnh tiếp từ kết quả đã lưu, cùng parent luôn trả cùng
child kể cả request đồng thời. Snapshot riêng giữ toàn bộ graph/version, deadline
và lịch sử quyết định; API chỉ công khai cảnh hiện tại, hậu quả sau submit.
Pack hotel-check-in B1, nhiều lựa chọn hợp lý ở cảnh mở đầu, nhánh sửa sai và kết
thúc khác nhau. Giữ daily cap theo cảnh, không thêm thưởng kết thúc. JSON snapshot
được mở rộng nhưng không đổi SQL; chặn story-choice ở API accuracy cũ.
Nghiệm thu: mọi nhánh kết thúc, owner/version/retry, không nhảy cảnh, concurrent
continue, snapshot qua đổi catalog/reconnect, reload/lost response và mobile.
Local Go tests/vet, build và 13 browser/API scenarios đạt. Đã merge qua
[PR #10](https://github.com/Loccao102/LocCaoEnglish/pull/10), commit `31d842e`.
[CI 112](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37667016258) đạt
đủ 6 jobs trên runtime `7d2482a`, gồm PostgreSQL/race và 79 E2E browser (16.3m).
Chưa deploy production; toàn CORE-003 vẫn `in_progress`. Lát cắt tiếp theo là
Listen & Pick và Dictation Rush: chấm ở server, lưu câu trả lời thật và giữ
retry/reload theo lifecycle chung; chưa mở rộng số lượng trò chơi.

Tiếp nối 2026-10-08: Codex, branch `codex/core003-listen-pick`, `in_review`.
Phạm vi: Listen & Pick ở `/listening` dùng catalog/snapshot và chấm lựa chọn thật
tại server; giữ các campaign nghe đang có. Ghi yêu cầu phát, tốc độ và kết quả
phát do browser báo trong snapshot; retry không đếm lặp, reload giữ hỗ trợ.
Chỉ mở chọn đáp án sau khi xác nhận phát xong; lỗi/fallback không giả làm đã nghe.
Nghiệm thu: owner/version/expiry, đúng/sai, daily cap, replay/slow, audio lỗi,
mất phản hồi, chuyển tài khoản, snapshot cũ và mobile. Đây là guided practice,
không chứng minh người chơi đã nghe thật hoặc làm bài không hỗ trợ. Dictation
Rush là lát cắt riêng sau khi luồng âm thanh này đã được nghiệm thu.
Go tests/vet, build và 16 browser/API scenarios đạt local; đã phát thử giọng đọc
thật của browser và kiểm tra màn 390px. Chờ full CI/PostgreSQL trước merge.

| Hoạt động | Việc cần xử lý | Nghiệm thu đặc thù |
| --- | --- | --- |
| Word Link | Hoàn thiện bank/adapter sau pilot | Trộn vị trí; score thuộc attempt; replay không tự khai điểm duel |
| Word Graph | Tách Explore và Link assessment | Không hiện edges/Connections là đáp án trong bài đang chấm; explore không được coi như recall độc lập |
| Collocation Factory | Trộn đáp án, sửa copy nói có áp lực khi chưa có | Distractor hợp lý; mode đúng hành vi; không luôn chọn vị trí đầu |
| Sentence Builder | Trộn chunks theo ID; tách correction khỏi attempt mới | Từ/chunk lặp vẫn chọn được đúng; sau lộ đáp án không ghi lại thành unassisted |
| Grammar Repair | Trộn đáp án và giải thích lỗi | Không luôn đúng ở cùng vị trí; chấm từ actual selection |
| Reading Race | Câu hỏi dựa vào evidence và ngân hàng đề | Tránh đáp án cố định; lưu câu trả lời theo passage/content version |
| Story Choice | Đánh giá lựa chọn và hậu quả từng bước | Không gửi điểm choice tùy ý; replay/branch xác định được, không thưởng lặp |
| Listen & Pick | Ghi replay/slow audio/assistance | Adapter thuộc `ListeningPractice` đang dùng; fallback không giả làm audio đã phát |
| Dictation Rush | Token alignment và lifecycle chấm | Thừa/thiếu/thay từ làm thay score đúng; edit sau feedback không ghi cùng attempt lần nữa |

Mỗi hàng cần test đúng/sai/assisted/retry và browser flow. Chỉ done CORE-003 khi
cả 9 hàng có liên kết bằng chứng; không gộp một pilot thành “đã migrate toàn bộ”.

## CORE-004 — Speaking, mission và IELTS evidence

**Cần làm:** thêm provenance cho verdict: objective grading, transcript match,
acoustic assessment hoặc heuristic estimate; provider/version và assistance theo
mức cần thiết. Áp dụng cho Shadow Me, TravelMission/Airport Boss và IELTS Lab.

**Hoàn tất khi:**

- Không còn fixed accuracy `.85` cho mọi câu chat; actual conversation evidence
  quyết định progression theo contract mới.
- Mission kiểm tra mục tiêu và mạch hội thoại, không chỉ thấy từ khóa hoặc đủ lượt.
  Có trường hợp thiếu mục tiêu, spam/repeated text, phủ định và hội thoại hợp lệ.
- Speaking không coi transcript match là pronunciation; provider lỗi/không cấu
  hình không được tạo acoustic score giả. Re-analyze không thưởng lặp.
- IELTS objective scores và coach estimates giữ khác biệt, lịch sử version rõ;
  không trình bày như kết quả thi chính thức.
- Xác nhận route thật trước bỏ/consolidate `AirportMission` cũ và `MiniGames.ListeningPick`.

## CORE-005 — Reward và competitive integrity

**Cần làm:** cho mastery/XP/rank tiêu thụ verdict tin cậy; loại bỏ đường mới/cũ có
thể gửi score tùy ý để nhận thưởng. Phân loại dữ liệu legacy, không tự nâng cấp
toàn bộ lịch sử cũ thành “đã xác thực”. Fair vẫn giữ contract keepsake riêng.

**Hoàn tất khi:** API không cấp trusted mastery/rank từ accuracy/score client tự
báo; completion/reward có ledger và transaction; replay/multi-tab/concurrency
không lặp thưởng; bảng xếp hạng nói rõ loại dữ liệu đủ điều kiện; có test migration
và audit endpoint submit điểm. Quy tắc practice repetition vẫn cho người học tập
lại bình thường, không nhầm lẫn chống thưởng lặp với cấm luyện tập.

## CORE-006 — Khôi phục và tương thích

**Cần làm:** mở rộng quy tắc khôi phục sang shared learning attempts; rà các ranh
giới guest/account/offline/tài khoản hết hạn. Đánh giá nhu cầu records Cloud Hop
theo difficulty trước khi thay atlas: hiện atlas vẫn tổng hợp các mức.

**Hoàn tất khi:** reload giữa submit và response, rời tab, đổi tài khoản, server
restart và upgrade rules đều có kết quả dự kiến/được kiểm tra; không replay một
attempt cũ thành phần thưởng mới; snapshot không hợp lệ có đường phục hồi không
phá dữ liệu. Nếu quyết định tách atlas theo mức, phải có ADR/migration trước code.

## CORE-007 — Độ khó và chiều sâu có bằng chứng

**Cần làm:** định nghĩa mục đích học, quyết định người chơi phải đưa ra và lỗi cần
feedback cho mỗi mode. Đo trong playtest thời gian giải, lỗi, trợ giúp, hoàn thành,
chơi lại; chốt dữ liệu/retention trước bổ sung telemetry lưu server.

**Hoàn tất khi:** có kế hoạch và ghi nhận playtest theo nhóm trình độ, điều chỉnh
thông số dựa trên kết quả; mức khó tăng yêu cầu kỹ năng/chiến lược, không chỉ giảm
timer. Các puzzle giải được, label đọc được, thao tác touch công bằng. Colour Studio
có cách dạy tỷ lệ màu và ví dụ tham chiếu phù hợp; bridge có hướng tăng topology,
không chỉ đổi rotation. Không tự đặt KPI đạt được khi chưa thu thập dữ liệu.

## CONTENT-001 — Mở rộng có chiều sâu

Sau core: mở rộng clue/recipe/mission/bridge topology, lựa chọn hợp lý và hậu quả
khác nhau; dùng hệ thống hiện có để tạo nội dung. Mỗi gói mới nêu mục tiêu, độ khó,
cách chơi lại, host/personality và nguồn assets. Nghiệm thu bằng nội dung chơi được,
không phải số file hoặc số card. Game/map/nhân vật mới chỉ thêm khi có vai trò riêng
và không nhân bản cùng một câu hỏi dưới tên khác.

## DEP-001 — Fair difficulty rollout

**Cần làm:** chọn môi trường đích và kiểm tra phiên bản đang chạy; triển khai API
với `013_fair_difficulty.sql`/`EnsureFair` trước frontend gửi difficulty. Không giả
định API local đã được restart chỉ vì frontend build thành công.

**Hoàn tất khi:** account thật trên môi trường kiểm tra lưu Practice/Adventure/
Challenge riêng; retry không lặp; queue cũ/new payload tồn tại qua reconnect;
PostgreSQL giữ kết quả sau restart; có commit/schema version, bằng chứng và kế
hoạch rollback giữ dữ liệu. Đây chưa phải ủy quyền tự deploy production.

## GOV-001 — Tài liệu và luật làm việc

**Phạm vi đợt này:** AGENTS, CONTRIBUTING, docs index, PROJECT-RULES, ROADMAP,
Definition of Done, ADR về ưu tiên core và PR template.

**Hoàn tất khi:** tất cả file có trong repo, link nội bộ hợp lệ, không mâu thuẫn với
contract Fair hiện tại, phân biệt planned/implemented và không hứa branch protection
chưa cấu hình. Việc chỉ sửa docs không cần chạy lại gameplay tests.

**Bằng chứng 2026-09-27:** đã kiểm tra 12 file tài liệu/template, 59 liên kết nội bộ
và đủ section nghiệm thu cho 11 ID; không có link thiếu. `git diff --check` đạt;
khối Next.js được quản lý trong AGENTS còn nguyên. Bàn giao trong
[PR #3](https://github.com/Loccao102/LocCaoEnglish/pull/3), thay đổi tài liệu quản trị.
Phạm vi done là các file/quy tắc trong repo, không bao gồm cấu hình GitHub của GOV-002.

## GOV-002 — Rào chắn merge thực tế

**Cần làm:** kiểm tra branch rules/permissions và CI jobs thật trên GitHub; cấu hình
required checks và review phù hợp với quyền/chế độ cộng tác của repository. Không
tự điền CODEOWNERS cho người chưa được phân công. Ghi những điều được kiểm tra tự
động và những điều reviewer vẫn phải đọc (kiến trúc, dữ liệu, gameplay, license).

**Hoàn tất khi:** xác minh một PR có required check thất bại không thể merge theo
quyền thông thường, branch đích và tên check đúng, review/bypass rules được ghi rõ.
Files docs/PR checklist không được coi là đã hoàn thành mục này.

## Mẫu cập nhật một mục

```text
ID:
Status: planned | in_progress | in_review | blocked | done
Owner/task:
Ngày cập nhật:
Commit/PR:
Tiêu chí đã đạt:
Lệnh kiểm tra + kết quả + revision:
Phần chưa xác minh / blocker / điều kiện gỡ:
Bước tiếp theo:
```
