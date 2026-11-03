# Roadmap thực thi

Cập nhật nền: 2026-10-23, main `f80c43e` (PR #23). Đây là nguồn duy nhất của danh sách việc
cần làm và trạng thái. Chẩn đoán chi tiết ở [GAMEPLAY-AUDIT](GAMEPLAY-AUDIT.md);
quy định ở [PROJECT-RULES](PROJECT-RULES.md). Không bắt đầu mở rộng số lượng game
trước khi các contract core liên quan đã vững.

## Trạng thái nền đang có

- 24 nhân vật chibi, 7 chapter/14 quest, 8 Fair games và 12 learning activities.
- Fair có 3 mức khó, session dùng chung, seed/version, checkpoint, assistance,
  ledger chống ghi lặp và records theo mức khó. Xem [contract](GAMEPLAY-FOUNDATION.md).
- Story, Fair, learning XP và IELTS estimates vẫn là các miền khác nhau.
- Chín hoạt động khách quan (Word Link, Grammar Repair, Collocation Factory,
  Sentence Builder, bài luyện Word Graph, Reading Race, Story Choice, Listen & Pick,
  Dictation Rush) dùng chung server attempts và lifecycle khôi phục; CORE-003 đã
  nghiệm thu. Shadow Me đã lưu guided transcript qua shared attempts, tách coach
  khỏi XP. Chín mission đã lưu hội thoại và kết quả rubric theo thứ tự cùng thưởng
  first-clear. IELTS Reading/Listening đã lưu lựa chọn gốc, chấm server và history
  nguyên tử; Listening có journal playback theo từng phần, không cấp learning XP.
  Writing đã lưu nháp tài khoản, từng lần nộp và phản hồi provider có dẫn chứng,
  giữ lịch sử sửa bài. Speaking đã lưu acoustic feedback theo mẫu, không giữ raw
  audio; ngữ nghĩa sâu và calibrated overall tiếp tục theo CORE-004.
- Nền PR #23 đã qua 50 logic cases, 173 browser/API cases và đủ sáu CI jobs,
  gồm PostgreSQL/race/vet; xem [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md) để biết
  revision và giới hạn. Chưa deploy production; không suy rộng sang revision sau.

## Thứ tự mặc định

CORE-001 → CORE-002 → CORE-003/CORE-004 → CORE-005 → CORE-006 → CORE-007 → CONTENT-001.
DEP-001 và GOV-002 có thể làm khi đủ điều kiện độc lập, không cần chờ thêm nội dung.
CORE-001 phải giao được một luồng Word Link hoàn chỉnh trước khi chuyển hàng loạt
hoạt động. Nếu chủ dự án chỉ định task khác, ghi lý do và giới hạn trong PR.

| ID | Ưu tiên | Công việc | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- |
| CORE-001 | P0 | Attempt do server cấp và chấm; Word Link làm luồng đầu tiên | — | done |
| CORE-002 | P0 | Vòng chơi dùng chung phía frontend | CORE-001 contract | done |
| CORE-003 | P0 | Di chuyển 9 hoạt động khách quan, sửa lộ đáp án/chấm sai | CORE-001, CORE-002 | done |
| CORE-004 | P0 | Nguồn gốc bằng chứng cho conversation/speaking/IELTS | CORE-001, CORE-002 | in_progress |
| CORE-005 | P0 | Reward/rank chỉ dùng kết quả được xác thực | CORE-003, CORE-004 | in_progress |
| CORE-006 | P1 | Khôi phục và tương thích xuyên hệ thống | CORE-002, CORE-005 | in_progress |
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

Đã nghiệm thu ngày 2026-10-11 qua [PR #13](https://github.com/Loccao102/LocCaoEnglish/pull/13),
main `3beef1f`. [CI 122](https://github.com/Loccao102/LocCaoEnglish/actions/runs/38074216860)
đạt đủ 6 jobs trên runtime `c604aca`, gồm PostgreSQL/race và 102 E2E (16.4m).
Phạm vi hoàn tất và giới hạn nằm trong ma trận bên dưới; chưa deploy production.

### Lịch sử các lát cắt

Các trạng thái trong từng đợt bên dưới phản ánh thời điểm đợt đó hoàn tất;
trạng thái hiện tại là `done` cho phạm vi CORE-003 đã nghiệm thu ở trên.

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
Chưa deploy production; toàn CORE-003 vẫn `in_progress`. Tiếp nối bằng Listen &
Pick bên dưới, rồi Dictation Rush; chưa mở rộng số lượng trò chơi.

Tiếp nối 2026-10-08: Codex, branch `codex/core003-listen-pick`, `done` cho lát cắt này.
Phạm vi: Listen & Pick ở `/listening` dùng catalog/snapshot và chấm lựa chọn thật
tại server; giữ các campaign nghe đang có. Ghi yêu cầu phát, tốc độ và kết quả
phát do browser báo trong snapshot; retry không đếm lặp, reload giữ hỗ trợ.
Chỉ mở chọn đáp án sau khi xác nhận phát xong; lỗi/fallback không giả làm đã nghe.
Nghiệm thu: owner/version/expiry, đúng/sai, daily cap, replay/slow, audio lỗi,
mất phản hồi, chuyển tài khoản, snapshot cũ và mobile. Đây là guided practice,
không chứng minh người chơi đã nghe thật hoặc làm bài không hỗ trợ. Dictation
Rush là lát cắt riêng sau khi luồng âm thanh này đã được nghiệm thu.
Go tests/vet, build và 16 browser/API scenarios đạt local; đã phát thử giọng đọc
thật của browser và kiểm tra màn 390px. Đã merge qua
[PR #11](https://github.com/Loccao102/LocCaoEnglish/pull/11), commit `8f69fe0`.
[CI 116](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37776731516) đạt
đủ 6 jobs trên runtime `956a11f`, gồm PostgreSQL/race và 86 E2E browser (10.1m).
Lỗi nhãn campaign từ CI 115 đã được sửa, giữ nguyên assertion và kiểm tra lại.
Chưa deploy production. Tiếp theo là Dictation Rush: alignment thừa/thiếu/thay từ,
server grading, actual response và khóa feedback; toàn CORE-003 vẫn `in_progress`.

Tiếp nối 2026-10-09: Codex, branch `codex/core003-dictation`, `done` cho lát cắt này.
Phạm vi: Dictation Rush dùng attempt/audio journal chung, catalog 9 câu giữ 5 câu cũ
trên server, đối chiếu từ bằng edit distance phiên bản `dictation.v1`. Bỏ qua
hoa/thường và dấu câu; giữ contractions, không coi “don't” là “do not”. Accuracy
là `max(0, 1 - (thừa + thiếu + thay)/số từ chuẩn)`; chỉ không có lỗi từ mới đúng
và đủ điều kiện 20 XP theo daily cap. Confidence dùng accuracy thực từ server.
Giữ bản nháp theo owner, khóa bài sau submit, hiện từng lỗi và actual response.
Nghiệm thu: alignment, retry/owner/expiry, audio failure, snapshot cũ/reconnect,
PostgreSQL/concurrency, browser reload/lost response và hai màn mobile. Đây là
guided practice; không đặt giới hạn thời gian hay coi browser playback là bằng
chứng đã nghe thật. Không đổi schema SQL; phải triển khai API trước UI.
Go tests/vet, production build và 12 browser/API scenarios đạt local (37.1s),
bao gồm hồi quy Listen & Pick. Đã phát thử bằng giọng browser thật và xem ảnh
desktop, 390 × 551, 390 × 844. Đã merge qua
[PR #12](https://github.com/Loccao102/LocCaoEnglish/pull/12), commit `49eddbd`.
[CI 119](https://github.com/Loccao102/LocCaoEnglish/actions/runs/37818092697)
đạt đủ 6 jobs trên runtime `abd2d7a`, gồm PostgreSQL/race và 91 E2E (16.1m).
Chưa deploy production. Toàn CORE-003 vẫn `in_progress`: tiếp theo rà nghiệm thu
chéo đủ chín hoạt động và liên kết bằng chứng trước chuyển CORE-004.

Nghiệm thu chéo 2026-10-09: Codex, branch `codex/core003-recovery-audit`,
`done` (nghiệm thu 2026-10-11 qua PR #13). Rà route → adapter → snapshot/grader → recovery và bằng chứng cho
chín hoạt động. Phát hiện Word Link/Grammar vẫn cho đổi CEFR khi submit bị mất
phản hồi, làm ghi đè reference chứa câu trả lời đang chờ. Sửa quyền đổi level tại
hook chung và đồng bộ mọi selector; không bỏ pending payload để mở câu khác.
Nghiệm thu: tái hiện lỗi trước sửa, pending create/submit qua reload và retry,
không tạo attempt mới khi chưa xác nhận, đổi level sau feedback vẫn hoạt động;
giữ đường phục hồi cho attempt hết hạn. Không đổi API/save v1 hoặc luật thưởng.
Rà thêm compatibility export `MiniGames.GrammarRepair`: thay bản chấm client cũ
bằng adapter đang dùng; bỏ các bank Word Link/Grammar trùng trong contentPacks.
Giữ nguyên mọi nhãn và câu mẫu Speaking, kiểm tra cấu trúc trước/sau chuyển đổi.
Build đạt; 26 browser/recovery/core scenarios đạt (32.8s), thêm ma trận API 9
hoạt động đúng/sai/actual answer/retry/owner/legacy rejection đạt (1.2s).
CI 122 đạt đủ 6 jobs và 102 E2E (16.4m), đã merge `3beef1f`; toàn CORE-003
được chốt `done` trong phạm vi migration/chấm bài/recovery. Chưa deploy production.

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

### Ma trận nghiệm thu CORE-003

Mọi hàng dùng [ma trận API đúng/sai](../tests/e2e/learning-contracts.spec.ts)
và [recovery chung](../tests/e2e/learning-recovery.spec.ts). Các ca audio báo cáo
phát ở ma trận chỉ kiểm tra contract; browser nghe thật/fallback có bằng chứng
riêng trong các đợt Listen/Dictation. Không có hint trước submit ở các bài chọn
đáp án; correction là feedback đóng attempt, không phải lượt chấm mới.

| Hoạt động / route | Adapter, luật và bằng chứng bổ sung | Trợ giúp / giới hạn |
| --- | --- | --- |
| Word Link · `/games/word-link` | [Adapter](../components/WordLinkGame.tsx), [catalog tests](../backend/internal/learning/wordlink_test.go), [store recovery](../backend/internal/store/learning_recovery_test.go), [PR #4](https://github.com/Loccao102/LocCaoEnglish/pull/4) | Options trộn; practice duel không gửi điểm bảng xếp hạng; bank nhỏ cần mở rộng sau core |
| Grammar Repair · `/games/grammar-repair` | [Adapter](../components/learning/VerifiedGrammarRepair.tsx), [catalog tests](../backend/internal/learning/grammar_test.go), [browser](../tests/e2e/core.spec.ts), [PR #4](https://github.com/Loccao102/LocCaoEnglish/pull/4) | Giải thích sau submit; level không bỏ pending answer; compatibility export dùng cùng adapter |
| Collocation · `/games/collocation-factory` | [Adapter](../components/learning/VerifiedCollocationFactory.tsx), [HTTP](../backend/internal/httpapi/collocation_attempt_test.go), [browser](../tests/e2e/collocation.spec.ts), [PR #6](https://github.com/Loccao102/LocCaoEnglish/pull/6) | Câu hỏi ngữ cảnh, untimed, ba câu không lặp; CEFR chưa hiệu chỉnh qua playtest |
| Sentence Builder · `/games/sentence-builder` | [Adapter](../components/learning/VerifiedSentenceBuilder.tsx), [store](../backend/internal/store/sentence_attempt_test.go), [browser](../tests/e2e/sentence-builder.spec.ts), [PR #7](https://github.com/Loccao102/LocCaoEnglish/pull/7) | Chunk IDs xử lý từ lặp; reset chỉ sửa draft chưa gửi; feedback đóng bài |
| Word Graph · `/word-graph/practice` | [Adapter](../components/learning/VerifiedWordGraph.tsx), [HTTP](../backend/internal/httpapi/word_graph_attempt_test.go), [browser](../tests/e2e/word-graph.spec.ts), [PR #8](https://github.com/Loccao102/LocCaoEnglish/pull/8) | Explore tách assessment, không có XP; bản đồ học công khai không bảo đảm recall độc lập |
| Reading Race · `/reading` | [Adapter](../components/learning/VerifiedReadingRace.tsx), [store](../backend/internal/store/reading_attempt_test.go), [browser](../tests/e2e/reading-race.spec.ts), [PR #9](https://github.com/Loccao102/LocCaoEnglish/pull/9) | Câu hỏi theo passage và evidence; không giả định tính giờ/speed bonus |
| Story Choice · `/games/story-choice` | [Adapter](../components/learning/VerifiedStoryChoice.tsx), [store](../backend/internal/store/story_attempt_test.go), [browser](../tests/e2e/story-choice.spec.ts), [PR #10](https://github.com/Loccao102/LocCaoEnglish/pull/10) | Có nhiều lựa chọn hiệu quả; hậu quả, recovery branch và bốn ending; snapshot giữ graph/history |
| Listen & Pick · `/listening` | [Adapter](../components/ListeningPractice.tsx), [store](../backend/internal/store/listening_attempt_test.go), [browser](../tests/e2e/listening.spec.ts), [PR #11](https://github.com/Loccao102/LocCaoEnglish/pull/11) | Guided listening: replay/slow/failure journal; giọng browser cần source text |
| Dictation Rush · `/dictation` | [Adapter](../components/DictationTrainer.tsx), [alignment](../backend/internal/learning/dictation_test.go), [browser](../tests/e2e/dictation.spec.ts), [PR #12](https://github.com/Loccao102/LocCaoEnglish/pull/12) | Guided dictation; tính thừa/thiếu/thay từ; actual response/draft và feedback bất biến |

Phạm vi đóng CORE-003 là migration, tính đúng của chấm bài và recovery đã nêu.
Speaking/mission/IELTS thuộc CORE-004, trust/rank toàn hệ thống thuộc CORE-005;
khôi phục xuyên miền thuộc CORE-006, đo độ khó/thú vị và nội dung thuộc CORE-007/
CONTENT-001. Không suy ra game đã cân bằng hoặc toàn hệ thống an toàn từ ma trận này.

## CORE-004 — Speaking, mission và IELTS evidence

Lát cắt mission: Codex, `codex/core004-mission-evidence`, 2026-10-11,
`done` trong phạm vi guided rubric, nghiệm thu 2026-10-12. Bỏ fixed accuracy theo lượt và chặn API legacy NPC. Thay bộ tìm
từ khóa toàn transcript bằng rubric theo thứ tự, có ngữ cảnh, bỏ qua spam/lặp
và các mẫu phủ định trái mục tiêu. Lưu first-clear receipt gồm actual messages, verdict,
rules version và provenance cùng transaction thưởng; retry cùng nội dung không
thưởng lặp, nội dung khác không ghi đè. UI giữ draft/pending theo tài khoản,
khôi phục sau mất phản hồi và hiển thị giới hạn heuristic. Không biến hội thoại
tự khai thành acoustic/mastery evidence. Nghiệm thu: đủ chín mission, input lỗi,
thứ tự, phủ định, retry/concurrency, owner, receipt legacy, browser và mobile.
Xem [ADR 005](decisions/005-mission-evidence.md). Đây vẫn là guided rubric dùng
pattern; semantic understanding/paraphrase coverage chưa được nghiệm thu. Không
coi hội thoại tự khai là trusted mastery. Đã merge
[PR #15](https://github.com/Loccao102/LocCaoEnglish/pull/15), main `2abbc36`.
Head `047e7a5` đạt đủ 6 jobs tại
[CI 133](https://github.com/Loccao102/LocCaoEnglish/actions/runs/38184889862),
gồm PostgreSQL/race và **121 E2E (19.2m)**, không failed/flaky. Đã sửa CORS cho
429, giữ draft trong RAM khi storage bị chặn, và retry khi tải receipt thất bại.
Các lỗi CI trước và cách tách rate window cho fixture được giữ trong
[SYSTEM-VALIDATION](SYSTEM-VALIDATION.md). Chưa deploy production.

Lát cắt Shadow Me: Codex, `codex/core004-shadowing-evidence`, 2026-10-11,
`done` trong phạm vi guided transcript và coach tách riêng. Chuyển 30 câu mẫu hiện có thành catalog server; dùng shared attempts
để lưu/chấm actual transcript theo `shadowing.v1`, giữ draft/retry/owner và daily
claim. Reference hiện trước khi nói nên đây là guided transcript practice, không
phải chứng minh phát âm hoặc recall độc lập. Coach/acoustic feedback tách riêng,
không cấp XP; API legacy từ chối shadowing/pronunciation client accuracy.
Không đổi SQL; snapshot và result bổ sung transcript alignment. Backend trước
frontend, giữ grader/snapshot và legacy rejection khi rollback. Nghiệm thu gồm
đúng/sai/thừa/thiếu/từ lặp, concurrent retry, owner, reload, microphone lỗi/cleanup,
provider lỗi/không cấu hình, phản hồi cũ và mobile. Mission/IELTS còn ngoài lát cắt.
Local Go tests/vet, build 58 routes và typecheck đạt. 19 browser/API scenarios
đạt (29.3s); xem bằng chứng và giới hạn tại [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md).
Đã merge [PR #14](https://github.com/Loccao102/LocCaoEnglish/pull/14), `d8ccd86`.
Runtime `5666bc2` đạt đủ 6 jobs tại
[CI 126](https://github.com/Loccao102/LocCaoEnglish/actions/runs/38109616712),
gồm PostgreSQL/race và **111 E2E (16.8m)**. Bản sửa lời nhắc âm thanh cũng đạt
build và 9 Speaking cases local (12.2s). Chưa deploy production; chưa thử micro
vật lý hoặc provider acoustic production. Toàn CORE-004 vẫn `in_progress`.

Điểm vào đã rà ngày 2026-10-11: `/speaking` và
`/ielts/speaking` cùng dùng [SpeakingPractice](../components/SpeakingPractice.tsx).
Lỗi trước lát cắt này: gửi câu mẫu trong `answer` và ghi lại mỗi lần Analyze.
Contract thay thế ở [ADR 004](decisions/004-speaking-evidence.md).
Các route `/missions/*` dùng [TravelMission](../components/TravelMission.tsx).
Lỗi fixed accuracy `.85` được thay bằng rubric và completion receipt trong lát
cắt mission; component `AirportMission` không còn được import đã được bỏ cùng
helper score-only. Toàn CORE-004 vẫn `in_progress`; persistent acoustic receipts,
đánh giá ngữ nghĩa hội thoại sâu hơn và IELTS provenance/history còn tiếp tục.

### Lát cắt đã nghiệm thu — IELTS Academic Reading (`done`, 2026-10-16)

Owner/task: Codex, branch `codex/core004-ielts-reading`, nền main `973b6fc`.

Rà route đang dùng cho thấy `IeltsObjectiveMock` gửi số câu đúng do client tính;
history chưa có đáp án gốc, phiên bản hoặc khóa chống ghi lặp. Làm Reading trước
để tách việc chấm/lưu khỏi lifecycle âm thanh của Listening. Đã triển khai:

- Server cấp bộ câu hỏi có phiên bản, không gửi đáp án chuẩn trước chấm; nhận
  lựa chọn theo ID, lưu cả câu bỏ trống và kết quả chấm bất biến.
- Dùng lifecycle owner/draft/pending/retry chung nhưng có chính sách chỉ lưu
  bằng chứng do server quyết định. Không tự cấp XP, confidence hoặc review khi
  tái sử dụng store learning attempts; xác minh không có các tác động đó.
- Lưu receipt và history nguyên tử theo attempt ID; retry cùng dữ liệu trả kết
  quả cũ, payload khác bị từ chối; kiểm tra PostgreSQL/concurrency và memory.
- Ghi nguồn/phương pháp/phiên bản; phân biệt kết quả server chấm với legacy
  client report. Giữ lịch sử cũ, không backfill bằng chứng chưa tồn tại; bỏ nhận
  tally Reading cũ sau khi luồng thay thế sẵn sàng.
- Sửa nhãn dashboard: Writing/Speaking hiện chưa có luồng UI lưu band tương ứng,
  không hứa đã đủ bốn kỹ năng; bỏ band cá nhân 6.0 cố định ở dashboard chung.
  IELTS yêu cầu đăng nhập; API band tự khai trả 409, không gộp lịch sử guest.

Đã nghiệm thu đúng/sai/bỏ trống/ID lỗi, owner/version, pending qua reload,
phản hồi cũ, storage lỗi, migration chạy lại, concurrency và hai kích thước mobile.
Build 58 routes, Go tests/vet và 9 browser/API cases local đạt (2.2m); lượt kết hợp
contract/recovery/Listening đạt 27/27 (2.4m). CI 137 bị từ chối do Listening chạm
giới hạn IP chung; sửa nhịp chạy suite, không giảm assertion hoặc tăng rate limit.

[CI 138](https://github.com/Loccao102/LocCaoEnglish/actions/runs/38789544231) trên
head `60ae09f` đạt đủ sáu jobs, gồm PostgreSQL/race/vet và **130 E2E passed (23.6m)**,
không failed/flaky/retry. [PR #17](https://github.com/Loccao102/LocCaoEnglish/pull/17)
đã merge thành main `6e1a7e5`. Xem [ADR 006](decisions/006-ielts-reading-evidence.md)
và [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md). Không deploy production. Toàn CORE-004
vẫn `in_progress`; Listening playback evidence, acoustic/Writing receipts và
overall bốn kỹ năng chưa được nghiệm thu trong lát cắt Reading.

### Lát cắt đã nghiệm thu — IELTS Listening (`done`, 2026-10-18)

Owner/task: Codex, branch `codex/core004-ielts-listening`, nền main `372bb9a`.

Ưu tiên sau Reading: thay tally do client tính tại `/ielts/listening` bằng lựa
chọn gốc do server chấm, dùng shared attempts/recovery. Không thêm bộ đề/game
mới trong lúc còn thiếu lưu bài và chống ghi lặp.

Phạm vi và điều kiện nghiệm thu:

- Server snapshot bốn phần/40 câu, giữ transcript và answer key ngoài public
  prompt; opaque option IDs, phiên bản nội dung/luật và feedback sau submit.
- Mở rộng audio journal hiện có theo từng phần; ghi provider, hoàn thành/thất bại,
  replay/slow khi hỗ trợ. Báo cáo playback từ browser không phải chứng minh người
  học đã nghe, không được nâng thành bằng chứng acoustic hoặc unaided mastery.
- Lưu actual selections, câu bỏ trống, verdict và history nguyên tử theo attempt;
  không cấp XP/confidence/review. Retry cùng payload không thêm lịch sử; payload
  khác bị từ chối, owner và version được kiểm tra.
- Draft và pending tồn tại qua reload; response cũ/đổi tài khoản, mất phản hồi sau
  commit, audio lỗi/ẩn tab và storage lỗi có đường phục hồi rõ ràng.
- Chặn tally Listening cũ sau khi adapter mới sẵn sàng; giữ các hàng client-reported/
  legacy cũ, không backfill đáp án. API/schema trước frontend; rollback giữ receipts.
- Kiểm tra PostgreSQL/concurrency/migration, completion của đoạn audio dài và
  mobile 390×551/844; CI sạch trên head cuối. Listening band vẫn là ước lượng
  luyện tập, không tự tạo overall bốn kỹ năng.

Đã triển khai adapter `VerifiedIeltsPaper` dùng chung Reading/Listening, catalog
Listening phía server, journal theo `partId`, chặn submit thiếu phần nghe và đóng
tally/legacy XP bypass. [CI 142](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39027387520)
trên head `411163b` đạt đủ sáu jobs, gồm PostgreSQL/race/vet và **136 E2E passed
(22.2m)**, không failed/flaky/retry. [PR #18](https://github.com/Loccao102/LocCaoEnglish/pull/18)
đã merge thành main `b7b0333`. Local regression Reading/Listening/Dictation/
Listen & Pick đạt 27/27 (6.7m); Tea Time đạt 20/20 lần lặp sau sửa click test
theo phần tử ổn định, giữ nguyên luật game và các assertion. Bằng chứng và lỗi
CI trước đó được lưu ở [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md); contract ở
[ADR 007](decisions/007-ielts-listening-evidence.md). Chưa deploy production;
toàn CORE-004 vẫn `in_progress`.

### Lát cắt đã nghiệm thu — IELTS Writing feedback receipt (`done`, 2026-10-21)

Owner/task: Codex, branch `codex/core004-writing-receipts`, 2026-10-18,
nền main `18509ac`. Contract: [ADR 008](decisions/008-writing-receipts.md).

Rà route ngày 2026-10-17: `app/ielts/writing/page.tsx` dùng `WritingLab`;
bài viết chỉ ở React state, gọi `/v1/ai/writing-score` qua proxy. Cả browser và
AI service còn tạo band từ số từ/connectors; chưa có receipt gắn với bài viết
và phiên bản đề. Đổi nội dung trong khi chờ phản hồi cũng cần chặn kết quả cũ.

Ưu tiên sau Listening, trước mở rộng đề/game:

- Đề Task 2 và phiên bản rubric do server cấp; bản nháp theo owner, giới hạn độ
  dài riêng cho essay (không ép vào answer budget 2048 byte của câu hỏi khách quan).
- Lưu nguyên văn bài nộp, prompt/rules/provider/model version và phản hồi tương ứng;
  retry sau commit trả receipt cũ, không gọi provider đồng thời hoặc ghi history
  trùng; sửa bài tạo revision mới. ADR phải xử lý crash sau provider response
  nhưng trước commit, không hứa exactly-once provider khi dịch vụ không hỗ trợ.
- Không dùng thống kê số từ để tạo band thay thế khi provider lỗi. Phân biệt gợi ý
  biên tập, phản hồi heuristic và estimate từ provider; response sai schema hoặc
  không có bằng chứng giữ trạng thái lỗi có thể retry, không tạo kết quả giả.
- Mất phản hồi sau commit, reload, đổi tài khoản và sửa draft trong lúc chờ không
  trộn bài/kết quả. Chưa cấp learning XP/confidence, chưa ghép overall bốn kỹ năng.
- ADR cho lifecycle evaluation, transaction/idempotency và rollout trước code;
  kiểm tra provider lỗi/timeout/malformed/zero, race, PostgreSQL và mobile.

Acoustic receipts và calibrated overall vẫn là phần tiếp theo của CORE-004;
nghiệm thu Writing được ghi riêng theo bằng chứng triển khai bên dưới.

Tiếp nối triển khai 2026-10-21: đã có server draft/version, immutable submission,
generation/lease chống gọi chấm trùng, revision history và adapter owner-scoped.
Chấm yêu cầu dẫn chứng từ bài viết, provider/model/rubric rõ và zero hợp lệ;
đã bỏ band fallback theo số từ ở browser/AI. API legacy trả 409; không cấp XP.
Local Go tests/vet, 18 AI tests và build 58 routes đã đạt. Lượt browser đầu đạt
10/10 (2.3m); lượt kết hợp Reading/Listening/Writing đạt 27/27 (6.7m). Bản cuối
`ceb477f` đạt 13/13 Writing (2.3m), gồm generation, lost-start, validation 400 và
giữ bản sửa khi tab khác nộp bài; đã xem ảnh draft/feedback ở 390×551/844.

Luồng chấm thành công đã chạy qua browser → Go → Python → provider HTTP fixture,
lưu receipt/history, reload và tạo revision; retry giữ kết quả với đúng một lần
gọi fixture. Chưa đánh giá model thật. Kiểm tra cuối bổ sung lỗi validation 400
để người học sửa draft thay vì mắc kẹt trong pending request.

[CI 145](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39488459649)
đạt đủ sáu jobs trên head `ceb477f`, gồm PostgreSQL/race/vet, integration và
**149 E2E passed (22.9m)**, không failed/flaky/retry.
[PR #19](https://github.com/Loccao102/LocCaoEnglish/pull/19) đã merge thành main
`40794e6`; tree khớp bản đã kiểm tra. Lưu/chấm Writing được nghiệm thu trong phạm vi
ADR 008; chấm thực tế cần cấu hình provider, không tự tạo band khi provider lỗi.
Chi tiết ở [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md). Chưa deploy production;
toàn CORE-004 vẫn `in_progress`.

### Lát cắt đã nghiệm thu — Speaking acoustic feedback receipt (`done` trong phạm vi)

Owner/task: Codex, branch `codex/core004-acoustic-receipts`, 2026-10-21,
nền main `8ce2260`. Contract: [ADR 009](decisions/009-acoustic-receipts.md).

Rà route 2026-10-21: `/speaking` và `/ielts/speaking` dùng `SpeakingPractice`;
`useSpeakingFeedback` còn giữ coach/acoustic feedback trong React state. Audio
không khôi phục sau reload; guided transcript result không phải bằng chứng phát âm.

- ADR chốt receipt gắn đúng owner, reference/attempt và sample identity; lưu rõ
  provider/model/method version và loại bằng chứng. Không suy band IELTS từ điểm
  transcript match hoặc thang acoustic 0–100.
- Chỉ gửi mẫu khi người học yêu cầu đánh giá. Chốt retention trước schema; mặc
  định không lưu raw audio dài hạn, không thêm thu âm nền hoặc telemetry âm thanh.
- Áp dụng lifecycle evaluation/generation phù hợp để giữ exact retry, owner,
  failure và stale-worker boundaries. Zero hợp lệ; thiếu cấu hình, provider lỗi
  hoặc schema sai không tạo acoustic score giả. Không hứa exactly-once provider.
- Giữ guided transcript practice và XP hiện có độc lập với acoustic feedback;
  receipt mới không cấp thưởng. Chưa ghép overall bốn kỹ năng.
- Kiểm tra PostgreSQL/concurrency, mất phản hồi/reload, đổi tài khoản, permission,
  audio không hợp lệ và mobile. Chốt rollout/rollback trước thay luồng đang dùng.

Đã merge [PR #20](https://github.com/Loccao102/LocCaoEnglish/pull/20), main
`99c8535`. Head `b38ecf9` đạt đủ sáu jobs tại
[CI 149](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39495797778),
gồm PostgreSQL/race/vet, container Go→Python, 22 AI, 50 logic, assets và **153/153
E2E (29.5m)**, không flaky/retry. Local Speaking cuối đạt 13/13; lượt Speaking +
Writing trước đó đạt 25/25. Adapter tài khoản/migration 020 lưu lịch sử theo mẫu,
không lưu raw audio; Writing/acoustic dùng chung lease/generation. Lỗi provider
không tạo điểm giả, XP hoặc band. Chưa deploy hay hiệu chuẩn provider thật; toàn
CORE-004 vẫn `in_progress`. Chi tiết tại
[SYSTEM-VALIDATION](SYSTEM-VALIDATION.md#acoustic-receipts--2026-10-21).

### Tiêu chí hoàn tất toàn CORE-004

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

### Đang nghiệm thu — Ledger Word Network/Wordsmith và giữ quyền cũ (`in_review`, 2026-10-24)

Owner/task: Codex, branch `codex/core005-vocabulary-grants`, nền main `e8d9371`.
[ADR 014](decisions/014-vocabulary-unlock-grants.md) chốt milestone 3 bài / 7 bài
và 2 activity, giữ đường 300 personal XP cho Word Network, cutover một lần và
receipt nguồn cấp quyền. Sửa anonymous equip và owner races trên progression UI.
Nghiệm thu memory/PG/migration/restart/rollback/concurrency, bài thật/retry/equip,
guest/account/mobile và đủ sáu CI jobs. Giữ các world/profile/XP gate khác và
không khóa trực tiếp Word Graph; chưa nghiệm thu toàn CORE-005/006 từ lát cắt này.

Code/migration/API/UI và regression đã có; review độc lập chưa có finding phải sửa.
Go tests/vet, build 58 routes, TypeScript, 50 game cases và script integration
milestone/retry/concurrent equip đạt local. Đã xem bốn ảnh 390×551/844, chữ và
nút đọc được. Browser final 6/6 mới và 17/17 liên quan đạt; ba selector mới đã
được sửa theo UI thật, không giảm assertions. Head đầu đã đạt PG/race/vet và
integration. CI 166 phát hiện nhãn Challenge chồng nhau, đã sửa intrinsic width;
CI 167 phát hiện regression đo projection cũ trước native ResizeObserver. Tái
hiện có kiểm soát và sửa đồng bộ test, giữ mọi assertion chặt và xác minh test
vẫn bắt lỗi width:auto cũ. Head cuối cần đủ sáu jobs sạch trước merge. PG/race
chưa chạy local do thiếu test database/toolchain CGO; không dùng lượt flaky nghiệm thu.

### Đã nghiệm thu — Hồ sơ luyện tập và questline từ receipt (`done`, 2026-10-24)

Owner/task: Codex, branch `codex/core005-skill-practice`, nền main `4cdc9e7`.
[ADR 013](decisions/013-skill-practice-summary.md) chốt projection cửa sổ 20 bài
khác nhau mới nhất, latest completion mỗi bài, loại seed/legacy khỏi bằng chứng,
camp không hiển thị mastery mẫu và gợi ý không hứa XP giả. Nghiệm thu bằng
memory/PG, owner/version/dedup/replay/window, engine, browser/account/offline và
ảnh mobile. Giữ confidence/XP/world/cosmetic và daily snapshots hiện tại; chưa
thay policy grants, teacher analytics hay mastery calibration.

Local Go/vet/build/TypeScript, 6/6 ca mới và 15/15 ca core/reward liên quan đã đạt;
ảnh 390×551/844 đọc được. Lượt CI đầu phát hiện test cũ giả định sai về top 20;
đã sửa và thêm regression 25 người, giữ nguyên luật/thưởng. Head cuối `24cb8c4`
đạt đủ sáu jobs tại [CI 162](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39987606107),
gồm PostgreSQL/race/vet, integration và **179/179 E2E (26.3m)**, không flaky.
[PR #24](https://github.com/Loccao102/LocCaoEnglish/pull/24) đã merge thành main
`9009a3e` sau đối chiếu base/head, reviews/threads và ghim expected head.
Chưa deploy production; toàn CORE-005 vẫn `in_progress`. Xem
[SYSTEM-VALIDATION](SYSTEM-VALIDATION.md#skill-practice-summary-and-recommendations--2026-10-23).

### Đã nghiệm thu — Prerequisite của chín chương có nguồn gốc (`done`, 2026-10-23)

Owner/task: Codex, branch `codex/core005-campaign-evidence`, nền main `302c05b`.
[ADR 012](decisions/012-campaign-practice-gates.md) chốt shared correct receipts,
freshness sau chương trước, cùng policy cho GET/claim, preparation receipt nguyên
tử với reward và giữ clear cũ. Nghiệm thu: memory/PG, chín mapping, legacy/wrong/
owner/version/time, retry/fresh replay, concurrency/rollback và browser/mobile.
Không mở rộng thành mastery/pack-specific difficulty hay đổi mọi world/cosmetic gate.
Local Go/vet, build, 13/13 mission browser/API cases (2.3m), hai ảnh mobile và
integration đi đủ chín chương đã đạt; thêm 18/18 browser cases liên quan và kiểm
tra khôi phục pending dialogue qua gate mới. Head `7e30c68` đạt đủ sáu jobs tại
[CI 158](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39815676237), gồm
PostgreSQL/race/vet, rollback/concurrency, chín chương qua container integration
và **173/173 E2E (30.4m)**, không flaky. [PR #23](https://github.com/Loccao102/LocCaoEnglish/pull/23)
đã merge thành main `f80c43e` sau xác minh reviews/threads và expected head.
Chưa deploy production; toàn CORE-005/006 vẫn `in_progress`. Xem
[SYSTEM-VALIDATION](SYSTEM-VALIDATION.md#campaign-prerequisite-receipts--2026-10-22).

### Đã nghiệm thu — Đóng điểm tự báo và bảng XP có receipt (`done`, 2026-10-22)

Owner/task: Codex, branch `codex/core005-reward-boundary`, 2026-10-21,
tiếp nối main `4cd2104`, acoustic đã nghiệm thu qua PR #20.
[ADR 010](decisions/010-checked-practice-ranking.md)
chốt việc nghỉ endpoint accuracy cũ, bỏ gửi điểm từ lesson/placement, tính bảng
XP từ shared receipts/daily claim và chặn duel score tự báo. Không reset XP/save,
không tự nâng legacy confidence/prerequisite thành bằng chứng mới. Nghiệm thu
bằng Go/PG/concurrency và browser thực tế; toàn CORE-005 còn gồm chính sách
legacy mastery/prerequisite, không đánh dấu done từ một lát cắt.

Code hiện đóng mọi activity trên `/v1/attempts` và điểm duel tự báo. Bảng cộng đồng
tính checked XP từ receipt/daily claim, không dùng lifetime XP. Lesson/placement
không gửi accuracy; câu mở không tự báo đúng, bookmark chỉ là tự khai có đăng nhập.
Đã sửa crash options rỗng, khóa câu đã kiểm tra, lỗi bookmark không bị báo thành
công giả và tăng chữ cho mobile. Local Go/vet, build và 15 browser/API cases đã
đạt. Head `9b9b528` đã đạt đủ sáu jobs tại
[CI 152](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39500642512), gồm
PostgreSQL/race/vet, container integration và **161/161 E2E (28.9m)**, không flaky.
[PR #21](https://github.com/Loccao102/LocCaoEnglish/pull/21) đã merge thành main
`6e130fc` sau kiểm tra reviews/threads và ghim expected head. Chưa deploy production;
toàn CORE-005 vẫn `in_progress`. Xem
[SYSTEM-VALIDATION](SYSTEM-VALIDATION.md#checked-practice-rewards--2026-10-21).

**Cần làm:** cho mastery/XP/rank tiêu thụ verdict tin cậy; loại bỏ đường mới/cũ có
thể gửi score tùy ý để nhận thưởng. Phân loại dữ liệu legacy, không tự nâng cấp
toàn bộ lịch sử cũ thành “đã xác thực”. Fair vẫn giữ contract keepsake riêng.

**Hoàn tất khi:** API không cấp trusted mastery/rank từ accuracy/score client tự
báo; completion/reward có ledger và transaction; replay/multi-tab/concurrency
không lặp thưởng; bảng xếp hạng nói rõ loại dữ liệu đủ điều kiện; có test migration
và audit endpoint submit điểm. Quy tắc practice repetition vẫn cho người học tập
lại bình thường, không nhầm lẫn chống thưởng lặp với cấm luyện tập.

## CORE-006 — Khôi phục và tương thích

### Đang nghiệm thu — Thiết lập mục tiêu đúng owner và phục hồi lưu (`in_review`, 2026-10-24)

Owner/task: Codex, branch `codex/core006-profile-owner`, phụ thuộc ADR 014 đang
nghiệm thu ở PR #25. [ADR 015](decisions/015-profile-owner-recovery.md) chốt
signed-in profile PUT, captured-token onboarding/placement, draft versioned theo
owner, guest local-only và read-back khi mất phản hồi. Giữ GET demo compatibility,
normalization và last-write-wins; không cấp XP/confidence/rank hay đổi daily plan.
Nghiệm thu HTTP/auth/owner, browser save/reload/lost response/mismatch/storage,
guest/legacy/placement, mobile và đủ sáu jobs. District pages/PlayerJourney tiếp
tục follow-up; lát cắt này không hoàn tất toàn CORE-006.

Go/vet, integration API thật ở memory mode, TypeScript/build 58 routes và 10/10
browser cases (2.6m, không retry) đã đạt. Review độc lập tìm và đóng hai lỗi mất
draft từ placement. Sửa chữ mục tiêu quá nhỏ, build lại đạt; [CI 168](https://github.com/Loccao102/LocCaoEnglish/actions/runs/40112559574)
trên `cdd0b51` đạt đủ sáu jobs, PG/race/vet, integration và 196/196 E2E (34.2m)
không flaky. Đã xem đủ mười hai ảnh cuối 390×551/844, gồm font/choice actions.
Sau khi đồng bộ test resize Fair, head mới vẫn cần đủ sáu jobs trước merge.
Xem [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md#account-owned-profile-recovery--2026-10-24).

### Đã nghiệm thu — Daily plan cố định và bằng chứng theo ngày (`done`, 2026-10-22)

Owner/task: Codex, branch `codex/core006-daily-recovery`, 2026-10-21, tiếp nối
reward-boundary PR #21 đã nghiệm thu, main `6e130fc`. [ADR 011](decisions/011-daily-practice-recovery.md)
chốt sửa confidence cũ bị tính thành luyện hôm nay trong memory, legacy rows bị
tính trong SQL và checklist thay đổi sau mỗi bài. Daily plan gắn owner/ngày/rules;
claim phải có completed attempts đúng ngày, ledger/receipt nguyên tử và reward
cố định. Giữ toàn bộ XP/claim cũ, không gộp guest vào tài khoản hoặc mở rộng trusted
rank. Đây là lát cắt CORE-006 hỗ trợ CORE-005, không nghiệm thu toàn recovery từ đó.

Migration 021/startup schema bổ sung plan/receipt; giữ claim/XP/streak cũ, đánh dấu
legacy thay vì backfill. Memory và SQL dùng actual completion time giống nhau;
retry kết quả cũ không đổi ngày, valid wrong/fresh replay được tính công luyện.
UI giữ owner/date/rules khi mất response, GET phục hồi và explicit retry; account
đổi/hết hạn, storage lỗi/corrupt có đường xử lý. Go/HTTP, browser thật và hai kích
thước mobile đã đạt. Head `b4410d3` đạt đủ sáu jobs tại
[CI 155](https://github.com/Loccao102/LocCaoEnglish/actions/runs/39797758885), lượt
cuối gồm PostgreSQL/race/vet, container integration và **170/170 E2E (29.9m)**.
[PR #22](https://github.com/Loccao102/LocCaoEnglish/pull/22) đã merge thành main
`a0ae3be` sau kiểm tra reviews/threads và expected head. Lỗi fixture assets cũ và
sự cố cập nhật kết quả GitHub được ghi tại
[SYSTEM-VALIDATION](SYSTEM-VALIDATION.md#stable-daily-practice-recovery--2026-10-22).
Chưa deploy production; toàn CORE-006 và CORE-005 vẫn `in_progress`.

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

## SEC-001 — Vá dependency frontend (`planned`, P0, 2026-10-24)

Audit thực tế trên lockfile Next 16.3.4 ghi 3 dependency bị cảnh báo: Next
critical, sharp và source-map-js high. Đây là dependency advisory, chưa là bằng
chứng ứng dụng bị khai thác. Đã đối chiếu nguồn gốc: [Next image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw),
[sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)
và [release 16.4.3](https://github.com/vercel/next.js/releases/tag/v16.4.3).
Ưu tiên patch nền ngay sau lát cắt owner đang làm, không thêm nội dung mới trước.
Nâng Next tới stable đã vá, cập nhật lockfile/transitive tương thích, đọc guide
đang cài rồi chạy audit/build/logic/browser và sáu CI jobs. Chưa nâng dependency,
chưa nghiệm thu và không tự deploy. Không dùng `audit fix --force` thiếu review.

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

Đã đọc trạng thái 2026-10-21 (main `8ce2260`): GitHub branch API trả
`protected:false`, required status checks ở chế độ off; danh sách repository
rulesets rỗng. Nguồn: [branch main](https://api.github.com/repos/Loccao102/LocCaoEnglish/branches/main),
[rulesets](https://api.github.com/repos/Loccao102/LocCaoEnglish/rulesets).
Đây là bằng chứng chưa có enforcement tại thời điểm đọc, không phải đã cấu hình.
Các merge trong đợt này vẫn chờ đủ sáu jobs và dùng expected head SHA thủ công.
Connector hiện có chỉ cung cấp đọc branch protection/rulesets; cần quyền/công cụ
quản trị để áp dụng policy rồi xác minh PR lỗi thực sự bị chặn. Mục vẫn planned.

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
