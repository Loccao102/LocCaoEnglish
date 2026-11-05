# Roadmap thực thi

Cập nhật nền: 2026-11-05, main `59cf031` (các merge đã nghiệm thu tới PR #51).
PR #43 là probe thất bại có kiểm soát, đã đóng và không merge. Đây là nguồn duy nhất của danh sách việc
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
- Runtime PR #51 `82871ea` đã qua 263 E2E cases và đủ sáu CI jobs,
  gồm PostgreSQL/race/vet; xem [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md) để biết
  revision và giới hạn. Chưa deploy production; không suy rộng sang revision sau.

## Thứ tự mặc định

Đợt GitHub-only 2026-11-05: [PR #31](https://github.com/Loccao102/LocCaoEnglish/pull/31)
(hero nhiệm vụ), [#32](https://github.com/Loccao102/LocCaoEnglish/pull/32)
(teacher practice), [#33](https://github.com/Loccao102/LocCaoEnglish/pull/33)
(Adventure actual answers), [#34](https://github.com/Loccao102/LocCaoEnglish/pull/34)
(course ownership) đã được nghiệm thu và merge. [PR #35](https://github.com/Loccao102/LocCaoEnglish/pull/35)
giữ ancestry của #31/#33/#34/#36/#37, thêm mission refinement và sửa tương phản
nút khôi phục khóa học; source `651c946` đạt sáu jobs tại
[CI 201](https://github.com/Loccao102/LocCaoEnglish/actions/runs/41970949503),
242 E2E (44.3m), không retry/flaky. Ảnh mission/review/content/course đã xem;
merge thành `c601292` sau đối chiếu checks, review threads và expected head.
Các phần #38–#42 nằm trong PR #44 `2c2550a`, đã đạt CI 216 đủ sáu jobs/252 E2E
(45.1m), merge `68f4e3e`. SEC-002 PR #45 `dd0f05f` đạt CI 217 đủ sáu jobs/252
E2E (39.7m), merge `a372827`. PR #46 `9638dec` đạt CI 219 đủ sáu jobs/252 E2E
(44.4m), merge `30b6276`. Không retry/flaky; reviews/threads trống, kiểm tra
expected head và merged tree giữ đúng source đã kiểm tra. Không suy sang các
nhánh phát triển tiếp theo.
PR #49 `94998a8` đã đạt CI 225 đủ sáu jobs/256 E2E (40.7m), focused 31 (47.9s),
hai ảnh recovery đã xem; merge `ff7ef88` giữ ancestry #47/#48. Catalog bài học,
AI HTTP pool và Fair conflict recovery đã được nghiệm thu trong phạm vi. Bridge
v2/label layout và catalog course tiếp nối đạt CI 229 đủ sáu jobs/263 E2E
(46.1m), focused 38 (2.0m) trên `82871ea`; cả bốn ảnh Bridge đã xem. PR #51
merge `59cf031`, giữ ancestry #50. CORE-006 và ba lát cắt PERF đã nghiệm thu;
CORE-004/007 vẫn giữ phần provider/calibration/playtest chưa xác minh.
Không chạy local/deploy. [Audit reward](REWARD-BOUNDARY-AUDIT.md) chốt phạm vi
CORE-005 trên main đã merge; các mục core khác giữ tiêu chí độc lập.

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
| CORE-005 | P0 | Reward/rank chỉ dùng kết quả được xác thực | CORE-003, CORE-004 contract | done |
| CORE-006 | P1 | Khôi phục và tương thích xuyên hệ thống | CORE-002, CORE-005 | done |
| CORE-007 | P1 | Đo và cân bằng độ khó, kiểm tra chiều sâu | Các luồng core liên quan | in_progress |
| CONTENT-001 | P2 | Mở rộng nội dung có mục đích, không tăng số lượng hình thức | CORE-005, CORE-007 | planned |
| DEP-001 | P0 | Triển khai/xác minh API và migration độ khó Fair | Backend/schema mới, môi trường đích | planned |
| GOV-001 | P0 | Quy tắc, docs index, backlog, DoD và PR template | — | done |
| GOV-002 | P1 | Xác minh và cấu hình rào chắn merge trên GitHub | Quyền repo, CI ổn định | done |
| SEC-002 | P0 | Cấp quyền theo tài khoản được quản trị xác nhận, không tự khai email | Auth/role hiện có | done |
| PERF-001 | P1 | Đo và giảm truy vấn catalog lặp, giữ đúng dữ liệu công khai/owner | Contract core hiện có | done |
| PERF-002 | P1 | Tái sử dụng outbound HTTP connection cho LLM/TTS | AI lifespan/provider contract | done |
| PERF-003 | P1 | Tránh bố trí/ghi lại nhãn 3D khi input projection không đổi | Fair renderer/input hiện có | done |

Các mục planned chưa có người nhận hoặc hạn giao được ấn định. Người nhận chuyển
`in_progress` kèm tên/task/PR và ngày; không tự gán người khác. Mục done cần ghi
commit/PR + bằng chứng ngay tại mục đó. Không giữ “pending CI” vô thời hạn trong
trạng thái done khi CI là điều kiện nghiệm thu của task.

## SEC-002 — Quyền được cấp cho tài khoản cụ thể

Owner/task: Codex, branch `codex/sec002-explicit-roles`, 2026-11-05.
Bug P0: đăng ký chưa xác minh email nhưng `RoleForUser` tự nâng quyền theo
`ADMIN_EMAILS`/`TEACHER_EMAILS`. Email cấu hình chưa đăng ký có thể bị chiếm
để nhận quyền mới; unique email không chứng minh quyền sở hữu địa chỉ.

Phạm vi: bỏ cấp quyền từ email/env; tài khoản chưa có role luôn là learner.
Giữ role đã lưu, dùng công cụ operator gắn user ID để cấp/thu hồi role; không
thêm endpoint công khai. CI chuyển sang fixture được operator cấp quyền trên
database dùng một lần. Không tự thu hồi role cũ hoặc sửa dữ liệu người dùng.

Nghiệm thu: signup bằng email nằm trong hai biến cũ vẫn là learner và bị từ
chối admin/teacher routes; quyền được operator cấp tồn tại sau restart và hạ
quyền không bị tự nâng lại; first read đồng thời không ghi đè quyết định operator.
Kiểm tra memory, PostgreSQL/race, HTTP, CLI và teacher E2E trên GitHub. Schema/API
response không đổi; phải có hướng dẫn audit role cũ, rollout/retry theo user ID.
Đã nghiệm thu source `dd0f05f`: CI 217 đủ sáu jobs, PG/race/vet, operator fixture
thật và 252 E2E (39.7m); PR #45 merge thành `a372827`. Không chạy local/deploy.
Done áp dụng code/CI; audit role legacy trước production vẫn là việc operator,
không tự thu hồi role hoặc suy rằng production đã được vá.

## PERF-001 — Catalog không truy vấn lặp theo số bài

Owner/task: Codex, `codex/perf001-lesson-catalog`, 2026-11-05; người dùng yêu cầu
bổ sung tối ưu hiệu năng. Điểm vào thật `/learn` → LessonCatalog → GET /v1/lessons
→ ListLessons. SQL hiện lấy slug rồi gọi GetLesson cho từng bài, lặp schema,
metadata và exercises: `2 + 3N` database calls, trong đó một schema batch
có nhiều lệnh DDL. Phạm vi đầu: bulk read catalog trong số statement cố định,
giữ published/admin filter, metadata, thứ tự bài/exercises và shape/API hiện có.
Không cache dữ liệu cá nhân, không đổi save/XP, không thêm pagination contract.
Nghiệm thu query budget đo được trong PostgreSQL CI, tương đương kết quả với
luồng cũ, draft/empty/options/order/publication và concurrent reads; benchmark
CI báo số đo đúng điều kiện, không suy p95 production từ fixture nhỏ. Không chạy
app/build/test/benchmark trên máy người dùng. ListCourses là follow-up sau khi
lát cắt đầu đã được xác minh; không tự tuyên bố toàn app đã tối ưu.

### PERF-001 tiếp nối — Catalog course trong một snapshot (`done`)

Owner/task: Codex, `codex/perf001-course-projection`, 2026-11-05. Source bài học
đã đạt đủ sáu jobs/256 E2E trong CI 225 và merge PR #49 `ff7ef88`.
Catalog course trước đây lấy slug rồi GetCourse cho từng course:
`1 + 2N` calls, detail hai calls. Lát cắt tiếp nối đọc gộp published courses và
published lesson metadata trong một query/snapshot, giữ đúng course và authored
lesson order, empty Lessons `[]`, ErrNotFound/slug rỗng, memory path và owner/
enrollment/bookmark/progress hiện có. Không đổi API/schema/cache/reward.
Nghiệm thu query budget List/Get bằng test-only counter, so sánh baseline cũ,
draft/hidden/empty/option order, publication snapshot và benchmark cô lập trên
GitHub; không chạy local hoặc dùng timing fixture để suy production p95.

Source `82871ea` đạt đủ sáu jobs tại [CI 229](https://github.com/Loccao102/LocCaoEnglish/actions/runs/42002431910),
gồm PostgreSQL/race/vet, query-budget/baseline/snapshot regressions và 263 E2E
(46.1m); [PR #51](https://github.com/Loccao102/LocCaoEnglish/pull/51) merge
`59cf031`. Cùng fixture đo courses 49→1 calls/op, 23.791→0.858ms; lessons
80→2 calls/op, 27.459→1.127ms. Hai lát cắt catalog hoàn tất trong phạm vi đã
định; [PERFORMANCE](PERFORMANCE.md) giữ corpus/allocations và giới hạn đo.
Không suy thành toàn app đã tối ưu hoặc production p95; không chạy local/deploy.

## PERF-002 — HTTP pool cho AI

Owner/task: Codex, tích hợp [PR #47](https://github.com/Loccao102/LocCaoEnglish/pull/47)
`29a126b` vào nhánh nghiệm thu hiệu năng. LLM JSON coach và Azure neural TTS
trước tạo AsyncClient mỗi request. Dùng một client trong lifespan mỗi worker,
giới hạn pool 40/keepalive 12, đóng khi shutdown; giữ timeout 35s/25s, fallback,
API/schema và standalone synthesize usage. Không giữ prompt/result trong cache.
Nghiệm thu protocol/lifespan qua MockTransport, integration/build và CI tổ hợp
với các thay đổi main/Fair mới. Không coi test giả lập là provider thật hoặc số
đo throughput/latency mạng; không thêm secret, live provider call hay deploy.
Acoustic/Writing provider riêng chưa thuộc tối ưu này. Đọc source đang dùng
`app.server` trỏ cùng `app.main.app`, không chỉ sửa entry point không được import.
Đã tích hợp vào PR #49, source `94998a8` đạt CI 225 đủ sáu jobs/256 E2E,
merge `ff7ef88`. Đây là nghiệm thu pooling/protocol/lifecycle, không phải số
đo latency/throughput provider thật; không chạy local/deploy.

## PERF-003 — Không lặp label layout không đổi

Owner/task: Codex, cùng nhánh `codex/core007-bridge-topology`, 2026-11-05.
FestivalArena gọi updateView mỗi frame, tạo/sort nhiều vị trí nhãn và ghi DOM
attributes/styles dù camera, mục tiêu và lựa chọn không đổi; pause vẫn lặp việc
này. Phạm vi: bỏ qua đúng projection/label input không đổi, vẫn render/simulate
như trước. Invalidate theo resize/zoom/rebuild, vị trí mục tiêu/hero-follow,
visibility, round và lựa chọn/canChoose. Không throttle physics/timer/input, đổi
luật, bỏ animation hoặc tự tính thưởng trong renderer.
Nghiệm thu CI browser đo số lần ghi attributes vào labels khi pause/static và
sau resize/zoom/input, giữ labels đúng/kích thước nhỏ; so sánh đường cũ trên
cùng scene qua phép đo có kiểm soát nếu thực hiện được. Không tuyên bố FPS/GPU
hay battery được cải thiện khi chưa đo, không chạy local. Label metrics dirty
vẫn buộc tính lại; hỗ trợ font/DOM thay đổi theo cơ chế hiện có.

Đã nghiệm thu source `82871ea`: CI 229 đủ sáu jobs/263 E2E (46.1m), focused
run 14 đủ 38 cases (2.0m); cả hai mẫu Adventure/Challenge 250ms đo
pausedWrites=0/runningWrites=0. Resize, selection, countdown và moving-box
assertions độc lập đạt; cả bốn ảnh Bridge điện thoại đã xem. PR #51 merge
`59cf031`. Done áp dụng bỏ DOM layout/write dư thừa, không phải FPS/GPU/battery.

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

### Không suy overall từ dashboard cũ (`done`, 2026-11-05)

Owner/task: Codex, branch `codex/core004-overall-boundary`, nền `4fa1b77`.
`/camp` dùng LiveSnapshot, vẫn render `dashboard.ieltsBand` thành overall dù
backend hiện tại luôn trả null và API cũ có thể gửi estimate thiếu nguồn gốc.
Thẻ IELTS chỉ dẫn tới kết quả từng kỹ năng, giữ target do người dùng chọn và
không tính/hiện combined band từ trường legacy. Không đổi API/schema/history.
Nghiệm thu fixture API cũ có band khác null, target riêng và ảnh mobile qua CI.
Overall đã hiệu chuẩn và provider thật tiếp tục là phần chưa nghiệm thu.
Đã xem hai ảnh 390×551/844; assertion Reading dùng nhãn cũ được sửa tại
`2c2550a`, giữ kiểm tra null-band/không hiện điểm giả. CI 216 đủ sáu jobs/252
E2E; đã merge qua PR #44 `68f4e3e`, không suy thành overall đã hiệu chuẩn.

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

### CORE-004 — Paraphrase có phiên bản (`done` trong phạm vi, 2026-11-05)

Owner/task: Codex, branch `codex/core004-mission-paraphrases`; từ runtime PR #28
`84fe2b2` trong lúc đồng bộ các merge được nghiệm thu. Phạm vi: nhận đúng ba
cách diễn đạt tự nhiên cho city-transit/weekend-plans/repair-misunderstanding,
chốt `conversation.v3` và giữ grader `conversation.v2` cho draft/pending cũ.
Không đổi gate, first-clear reward hoặc schema; không chấm lại receipt đã lưu.
Contract/rollout ở [ADR 005](decisions/005-mission-evidence.md).
Nghiệm thu: đúng/sai/phủ định/spam/thứ tự, version/owner, retry/concurrency,
v2 draft recovery và browser v3/receipt/reload; PG/vet/build và CI cuối.
Head `a679850` đạt đủ sáu jobs tại [CI 181](https://github.com/Loccao102/LocCaoEnglish/actions/runs/41617269155),
gồm PostgreSQL/race/vet và 210 E2E (37.4m), không flaky/retry. Đã xem hai ảnh
receipt mobile từ CI; lỗi hero dài được tách xử lý bên dưới. [PR #30](https://github.com/Loccao102/LocCaoEnglish/pull/30)
đã merge thành `5170415`. Không chạy lại local theo yêu cầu người dùng, chưa
deploy production; toàn CORE-004 vẫn `in_progress`.

### CORE-004 — Tiêu đề nhiệm vụ trên điện thoại (`done`, 2026-11-05)

Owner/task: Codex, branch `codex/core004-mission-mobile`, nền main `54273c3`.
Ảnh receipt từ CI 181 cho thấy tiêu đề “Repair the misunderstanding.” bị cắt
trong hero ở chiều rộng 390px; kiểm tra scroll toàn trang chưa bắt được phần chữ
bị `overflow:hidden` che. Phạm vi: cho nội dung hero co/xuống dòng và giữ vòng
tiến độ trong khung; kiểm tra chín tiêu đề đang dùng ở 390×551/844, cả chiều rộng
chữ thực và vị trí badge, lưu ảnh để xem. Không thay rubric, API, save hay thưởng.
Chỉ chạy kiểm tra trên GitHub Actions theo yêu cầu người dùng. Head `e95c0ca`
đạt sáu jobs/212 E2E tại CI 192; bốn ảnh cuối đã xem, heading đủ chữ và badge
không cắt. Đã merge qua PR #35 `c601292`, kiểm tra lại tổ hợp tại CI 201.

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

### Nghiệm thu ranh giới phần mềm (`done`, 2026-11-05)

Owner/task: Codex, `codex/roadmap-core005-acceptance`. Đối chiếu routes đang dùng,
ledger/transaction, migration và regression tại main `c601292`, sau khi actual
answers/provenance của Adventure đã merge qua PR #35. Đủ tiêu chí CORE-005:
không nhận score/accuracy tùy ý để cấp trusted mastery/rank; retry/replay được
phân biệt; rank chỉ dùng receipt hợp lệ; legacy/personal/story/Fair tách nguồn.
Ma trận endpoint, test và giới hạn ở [REWARD-BOUNDARY-AUDIT](REWARD-BOUNDARY-AUDIT.md).
CI 201 trên source `651c946` đạt đủ sáu jobs, PG/race/vet và 242 E2E (44.3m).
Đây không phải hiệu chuẩn năng lực, competitive anti-cheat hay deploy production.
SEC-002 tiếp tục riêng; trước rollout vẫn phải audit role đã lưu. Các trạng thái
`in_progress` trong lịch sử lát cắt bên dưới phản ánh thời điểm ghi, không phủ
định nghiệm thu hiện tại hoặc đánh dấu toàn CORE-004/006/007 đã hoàn tất.

### Báo cáo giáo viên từ checked practice (`done`, 2026-11-05)

Owner/task: Codex, branch `codex/core005-teacher-practice` / `codex/core005-teacher-ui`,
nền main `54273c3`. Route `/admin/analytics` vẫn tính accuracy từ bảng attempts
trộn legacy và hiển thị confidence khởi tạo như “Skill health”. Thêm projection
chỉ đọc `teacher-practice.v1`: tổng lượt hoàn tất/câu đúng/người học hoạt động
trong bảy ngày, lọc shared receipt đúng activity/rules/skill và loại demo/guest,
legacy/story/IELTS. Fresh replay là công luyện mới; exact retry không thêm lượt.
Tách guided practice với transcript matching, không suy mastery/phát âm/CEFR.
Giữ trường cũ tương thích, UI chỉ hiển thị method mới; lesson counts được ghi rõ
là learner reports, không hiển thị score/confidence cũ thành kết quả đã kiểm tra.
Đổi tài khoản/logout hoặc phản hồi cũ phải ẩn báo cáo ngay; có retry/guest/role
và fallback API cũ an toàn. Không thay schema, save, XP hay chính sách cấp quyền.
Nghiệm thu memory/PG/race/HTTP role, browser tài khoản thật + render lifecycle,
mobile 390×551/844 và đủ CI trên head cuối. Chỉ kiểm tra trên GitHub Actions
theo yêu cầu người dùng. Head `695b3ad` đã qua sáu jobs tại
[CI 187](https://github.com/Loccao102/LocCaoEnglish/actions/runs/41959011220),
216 E2E (41.6m), không flaky. Hai ảnh mobile đã xem, review không có blocker;
[PR #32](https://github.com/Loccao102/LocCaoEnglish/pull/32) đã merge thành
`7805b50`. Lát cắt đã nghiệm thu; toàn CORE-005 vẫn in_progress. Contract: ADR 017.

### Câu trả lời gốc và provenance của Adventure (`done`, 2026-11-05)

Owner/task: Codex, branch `codex/core005-adventure-provenance`, nền main `54273c3`.
Rà store cho thấy first-clear Adventure ghi đáp án chuẩn vào `attempts.answer`
kể cả câu người chơi trả lời sai, đồng thời để source/version thành legacy mặc
định. Sửa ghi đúng câu trả lời đã nộp, source story-guided riêng, hash catalog và
phiên bản luật đang dùng. Không đổi chấm điểm, reward/first-clear transaction,
save/API hoặc review answer chuẩn; không sửa/backfill lịch sử cũ. Không đưa quest
Adventure vào shared learning practice, mastery hoặc checked-practice rank.
Nghiệm thu PostgreSQL đúng/sai/first-clear concurrent/retry/replay/restart và
giữ lịch sử legacy; chỉ qua GitHub Actions theo yêu cầu. Head `e91b0b6` đạt sáu
jobs/210 E2E tại CI 188, sau đó nằm trong source tổ hợp `651c946` đạt CI 201.
Đã merge qua PR #35 `c601292`, không backfill lịch sử cũ.

### Đã nghiệm thu — Ledger Word Network/Wordsmith và giữ quyền cũ (`done`, xác nhận 2026-11-03)

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

### Nghiệm thu tổng hợp phần mềm (`done`, 2026-11-05)

Đã đối chiếu toàn bộ tiêu chí với route/source/tests đang dùng, không chỉ từ một
build hoặc một màn hình. [Ma trận khôi phục](ADVANCED-ACCEPTANCE.md#core-006-cross-system-recovery-coverage)
gắn lost-response/reload, page exit, account/guest/offline/expired, PostgreSQL
reopening, rules/content versions, corrupt/unsupported copies và reward replay
với kiểm tra cụ thể. Giữ atlas Cloud Hop dùng chung badges/times giữa modes theo
contract hiện tại; chỉ cần ADR/migration mới nếu sau này quyết định tách.

Parent PR #49 `94998a8` đạt CI 225 đủ sáu jobs/256 E2E; source cuối `82871ea`
đạt [CI 229](https://github.com/Loccao102/LocCaoEnglish/actions/runs/42002431910)
đủ sáu jobs/263 E2E (46.1m), PG/race/vet và 38 focused cases. PR #51 merge
`59cf031`, giữ ancestry. Không còn blocker code cụ thể trong phạm vi recovery
hiện hành. Done là nghiệm thu software/contract và PostgreSQL CI, không phải
restart/migration trên production; DEP-001 vẫn riêng. Các ghi chú in_progress
trong lịch sử lát cắt bên dưới được chốt bởi nghiệm thu tổng hợp này.

### Fair: hai tab hoàn thành cùng checkpoint (`done`, 2026-11-05)

Owner/task: Codex, `codex/core006-fair-conflict`, nền `9638dec`. Hai tab resume
cùng run ID rồi hoàn thành khác stars/time/feathers có thể để lại queue khác
kết quả đã chốt. Server từ chối đúng bằng 409, UI hiện chỉ retry mạng vô hạn.
Phạm vi: đọc receipt Fair đúng owner/run, phân biệt conflict đã lưu với course
locked; hiển thị kết quả server và queued copy để người chơi chọn giữ bản đã lưu.
Trước ngừng thử lại bản trùng phải archive nguyên payload gốc theo owner, xác minh
lại receipt và local payload chưa đổi. Giữ nguyên cả key queue gốc; chỉ loại đúng
raw copy đã archive khỏi danh sách pending. Không xóa/sửa queue hoặc overwrite ledger.
Retry bản đã archive không dùng ID mới để nhận thêm visits, không cấp XP/rank.
API read additive; save/queue/checkpoint hiện có giữ version và dữ liệu cũ, API
cũ thiếu receipt phải giữ pending rõ ràng. Nghiệm thu memory/PG/restart/owner,
409 locked/not-found, hai tab, late response/account switch, reload, storage
blocked và phone actions; chỉ chạy runtime trên GitHub Actions.
Đã nghiệm thu qua PR #49 `94998a8`, CI 225 đủ sáu jobs/256 E2E và focused 31;
ảnh 390×551/844 cuối đã xem, merge `ff7ef88`. Không xóa queued copy để nghiệm thu.

### Khóa học theo catalog đang công khai (`done`, 2026-11-05)

Owner/task: Codex, `codex/core006-course-catalog`, nền `9dc252c`.
Rà nguồn xác nhận PostgreSQL dùng total của bài published nhưng đếm cả bookmark
của bài đã ẩn, có thể vượt 100%; memory giữ catalog seed cũ sau sửa/unpublish.
Đồng bộ catalog/metadata và đếm published trong cùng snapshot đọc, giữ bookmark
khi ẩn và phục hồi khi publish lại. Course không còn bài trả mảng rỗng và UI có
thông báo, tương thích API cũ trả null; lỗi catalog không bị coi là rỗng hợp lệ.
Không đổi API shape/schema, XP hay xóa lịch sử. Nghiệm thu memory/PG, owner,
publish/unpublish/republish, catalog rỗng và browser qua GitHub Actions.
Source `2c2550a` đã qua CI 216 đủ sáu jobs/252 E2E, ảnh rỗng và nút retry đã xem;
PR #44 merge `68f4e3e`. Không thay benchmark hay tính thưởng từ kết quả này.

### Ý định đăng nhập và phản hồi đến muộn (`done`, 2026-11-05)

Owner/task: Codex, branch `codex/core006-auth-intent`, nền `37234f8`.
AuthPanel gọi helper tự ghi token ngay khi POST trả về; chọn Play as guest,
rời trang hoặc đổi tài khoản lúc request chờ vẫn có thể bị đăng nhập lại bởi
phản hồi cũ. Tách request khỏi ghi token, chỉ commit nếu form còn mount và ý định
hiện tại/token nền chưa đổi; logout/storage/auth event hủy ý định trước. Không
đổi auth API, credentials, thời hạn token hay nhập dữ liệu guest. Nghiệm thu late
login/register sau logout/unmount/account-switch, lặp submit, lỗi/storage và
đăng nhập thật trên GitHub. Không tuyên bố toàn recovery hoàn tất từ lát cắt này.
Head `502bae3` đạt CI 209 đủ sáu jobs/251 E2E (44.5m); tổ hợp `2c2550a` đạt
CI 216/252 E2E, đã merge qua PR #44 `68f4e3e`.

### Content Studio đúng phiên đăng nhập (`done`, 2026-11-05)

Owner/task: Codex, branch `codex/core006-content-ui`, nền review `e9a881a`.
Teacher mở `/admin/content` rồi chuyển sang learner/guest vẫn thấy danh sách
draft và form cũ. Token-keyed editor và captured-token role/list/save/delete
loại view/phản hồi cũ, không gọi admin API cho guest/learner. Quyền API giữ nguyên.
401/403 khóa view; lỗi mạng giữ bản sửa của owner hiện tại, có refresh/read-back,
không báo saved/deleted từ lỗi. Không đổi schema, dữ liệu lesson hay nhập draft.
Nghiệm thu role/account/logout, late reads/writes, retry/lost response, busy,
empty catalog/nullable options và mobile 390×551/844 qua GitHub Actions.
Contract: [ADR 020](decisions/020-content-studio-owner-fence.md). Head `fbefdfc`
đạt sáu jobs/242 E2E tại CI 200 (45.5m); selector alert được sửa để phân biệt
Next route announcer, giữ nguyên các assertion. Hai ảnh mobile đã xem. Đã merge
qua PR #35 `c601292`; tổ hợp đạt CI 201.

### Khôi phục lịch ôn và owner của Review queue (`done`, 2026-11-05)

Owner/task: Codex, branch `codex/core006-review-owner` / `codex/core006-review-receipts`,
nền integration `3230a73`. `/review` đang bỏ lỗi ghi lịch, xóa câu khỏi UI rồi báo
đã lên lịch; queue chỉ tải lúc mount và POST dùng token mới nhất. Thay bằng
owner-scoped queue và operation `review-schedule.v1` có request ID, receipt và
pending metadata qua reload; không bỏ câu khi chưa xác nhận. API yêu cầu account,
exact retry không nhân interval, đổi payload conflict, receipt owner riêng và
giao dịch nguyên tử; giữ SRS formula, không XP/mastery. Không tự nhập guest queue.
Migration additive và rollback giữ receipts; contract ADR 019 trước rollout.
Nghiệm thu đúng/sai retry/lost response/reload/concurrency/owner/auth/old contract,
PG/restart/rollback, storage lỗi/corrupt, browser thật và mobile. Chỉ GitHub Actions.
Head `e9a881a` đạt sáu jobs/232 E2E tại CI 193 (44.1m), đã xem bốn ảnh mobile;
merge qua PR #35 `c601292`, tổ hợp đạt CI 201. Migration 023 chưa phát hành có
expected due time bắt buộc; không có migration suy đoán/backfill ngày cũ.

### Tiến độ và đăng ký khóa học đúng tài khoản (`done`, 2026-11-05)

Owner/task: Codex, branch `codex/core006-course-owner`, nền main `54273c3`.
Route `/courses/[slug]` đọc demo progress cho guest và giữ tiến độ A sau đổi
tài khoản; thao tác enroll dùng token tại lúc gửi thay vì owner của màn hình.
Tách catalog công khai khỏi progress cá nhân, captured-token read/write và bỏ
phản hồi cũ. Guest chỉ đọc catalog; POST enroll yêu cầu đăng nhập, GET demo cũ
giữ tương thích. Enrollment theo owner/course đã idempotent, không đổi XP/save.
Nghiệm thu auth/owner/retry, lost response, account/logout/late reads+writes,
catalog vẫn đọc khi progress lỗi, browser tài khoản thật và mobile 390×551/844.
Chỉ kiểm tra qua GitHub Actions. Head `f05b15d` đạt sáu jobs/217 E2E tại CI 189;
bản tổ hợp sửa tương phản nút đã qua CI 201, bốn ảnh 390×551/844 đã xem. Đã
merge qua PR #35 `c601292`. Contract: ADR 018. Lỗi đếm published catalog là
lát cắt tiếp theo riêng ở trên, chưa dùng kết quả cũ để nghiệm thu code mới.

### Đã nghiệm thu — Tiến độ chiến dịch và thẻ học Journey đúng tài khoản (`done`, 2026-11-05)

Owner/task: Codex, branch `codex/core006-campaign-owner`, từ head SEC-001
`d8ac8b3`. [ADR 016](decisions/016-campaign-owner-reads.md) chốt captured-token
reads cho Travel/Conversation/Work và riêng learning card của Journey. Rà soát
route thực xác nhận district giữ completion/ready của A sau đổi sang B/guest;
Journey chưa có render fence ngay theo token. Giữ GET demo compatibility ở API,
guest chỉ xem nội dung tĩnh có thông báo; không đổi luật gate/thưởng/save.
Nghiệm thu đổi account/logout, late success/error, refresh đảo thứ tự,
guest/demo, lỗi mạng/hết hạn, tách learning khỏi village/Fair, mobile và CI đủ
sáu jobs. Lát cắt này không hoàn tất toàn CORE-006.

Code được review độc lập, không có finding phải sửa; build 58 routes/typecheck
đạt. Replay production resources tái hiện lỗi A→B trên bản cũ, bản mới đạt 10/10
fixture cases (53.8s) và ca Journey cuối 1/1 (15.8s), không retry. Đã xem ảnh
notice/action 390×551/844. Fixture chỉ xác minh hiển thị/read lifecycle, không
giả nhận backend gate/thưởng; ca tài khoản thật thứ 11 và đủ sáu CI jobs còn chờ.
Xem [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md#campaign-and-journey-read-ownership--2026-10-25).

### Đã nghiệm thu — Thiết lập mục tiêu đúng owner và phục hồi lưu (`done`, 2026-11-05)

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
Tại thời điểm nghiệm thu lát cắt Daily này, chưa deploy production và toàn
CORE-006/005 còn `in_progress`. Trạng thái hiện tại theo nghiệm thu tổng hợp
ở đầu từng mục, không theo ghi chú lịch sử này.

**Phạm vi đã đối chiếu:** shared learning attempts và các ranh giới
guest/account/offline/tài khoản hết hạn đã có kiểm tra trong ma trận trên.
Atlas hiện giữ tổng hợp các mức theo contract; không đổi định dạng records.

**Hoàn tất khi:** reload giữa submit và response, rời tab, đổi tài khoản, server
restart và upgrade rules đều có kết quả dự kiến/được kiểm tra; không replay một
attempt cũ thành phần thưởng mới; snapshot không hợp lệ có đường phục hồi không
phá dữ liệu. Nếu quyết định tách atlas theo mức, phải có ADR/migration trước code.

## CORE-007 — Độ khó và chiều sâu có bằng chứng

### Bridge: topology có phiên bản (`done` trong phạm vi phần mềm, 2026-11-05)

Owner/task: Codex, `codex/core007-bridge-topology`, nền performance `94998a8`.
Người dùng yêu cầu tiếp tục chức năng nâng cao và tối ưu hiệu năng. Ba puzzle
cũ được giữ cho Practice/checkpoint v1; Adventure/Challenge mới dùng topology
v2 xác định theo seed/round, đổi đường đi và cổng nối trên cùng grid 3×3 thay
vì chỉ xáo rotation. Adventure dùng mẫu canonical 5–6 tile, Challenge có mẫu
canonical 7–9 tile, gồm serpentine; mỗi puzzle có route canonical
được kiểm tra reciprocal và budget từ số turn cần thiết + allowance hiện có.
Không đổi số vòng, stars, hearts, keepsake/XP hay thêm game/map/nhân vật.

Checkpoint vẫn outer version 1, challenge giữ version 1 và marker bridge v2
additive. Marker thiếu/1 luôn dùng chính xác generator/puzzle/budget cũ; snapshot
mới giữ marker qua reload, version lạ hoặc marker trên game khác bị từ chối
an toàn và giữ nguyên raw checkpoint. API/save ledger hiện có không đổi; rollback
phải giữ đường đọc v2, không diễn giải v2 như v1 hoặc xóa checkpoint cho test pass.

Nghiệm thu seed/round tái lập, fingerprints khác cấu trúc, route/budget giải được,
fresh unsolved, cả hai mức qua ba vòng input thật, old checkpoint vẫn đúng và
unknown version phục hồi không phá dữ liệu; ảnh/controls màn điện thoại và CI
trên source tổ hợp. Đây chưa phải số liệu playtest hay bằng chứng cân bằng cho
người thật; toàn CORE-007 tiếp tục giữ yêu cầu riêng bên dưới.

Source `82871ea` đạt CI 229 đủ sáu jobs/263 E2E (46.1m), focused run 14
38 cases (2.0m), genuine v1 resume và unknown-version raw-copy recovery. Cả
bốn ảnh Adventure/Challenge 390×551/844 đã xem với board 3D/labels/controls;
PR #51 merge `59cf031`. Không có playtest người thật hoặc dữ liệu cân bằng mới.

Owner/task: Codex, branch `codex/core007-playtest-protocol`, 2026-11-05.
Lát cắt đầu tiên: kế hoạch quan sát thủ công cho tám Fair games và ba mức khó,
phân biệt kỹ năng ngôn ngữ với trí nhớ/vận động; chưa thu telemetry hoặc bịa kết
quả. Colour Studio cần hướng dẫn đúng số giọt cho từng mode, ví dụ tỷ lệ và
recipe hint thể hiện số phần, dùng dữ liệu của session hiện có. Hướng dẫn nguyên
tắc không hiện đáp án vòng hiện tại; recipe cụ thể giữ assistance/star contract.
Không đổi seed, puzzle, thời gian, save hay luật chấm. Nghiệm thu browser input
thật, pause/help/reload/assistance, ba mode và ảnh 390×551/844 trên GitHub.
Lát cắt hướng dẫn/kế hoạch đã nghiệm thu: `ff91a41` đạt CI 208 đủ sáu jobs/245
E2E (42.2m), cả tám ảnh hướng dẫn/actions đã xem; tổ hợp `2c2550a` đạt CI 216 và
merge qua PR #44. Lát cắt hướng dẫn không bao gồm topology Bridge; phần đó đã
nghiệm thu riêng ở trên. Chưa có người chơi thật hoặc số liệu cân bằng;
toàn CORE-007 tiếp tục in_progress.
Chơi thử với người thật và điều chỉnh dựa trên kết quả vẫn chưa được thực hiện;
toàn CORE-007 không done từ tài liệu hoặc kiểm tra tự động.

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

## SEC-001 — Vá dependency frontend (`done`, P0, 2026-11-05)

Audit thực tế trên lockfile Next 16.3.4 ghi 3 dependency bị cảnh báo: Next
critical, sharp và source-map-js high. Đây là dependency advisory, chưa là bằng
chứng ứng dụng bị khai thác. Đã đối chiếu nguồn gốc: [Next image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw),
[sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)
và [release 16.4.3](https://github.com/vercel/next.js/releases/tag/v16.4.3).
Đang thực hiện trên `codex/sec001-frontend-dependencies`, từ profile head
`cdd0b51`: pin Next 16.4.3, cập nhật sharp 0.35.5 và source-map-js 1.2.2 trong
lockfile; giữ React 19.3 và các dependency không liên quan. Không đổi source app,
API, luật thưởng, schema hoặc bật thêm tính năng caching. Đọc guide trước/sau
cài đặt rồi chạy install tái lập, audit, build/typecheck, logic, assets và native
image smoke check. Browser production và sáu CI jobs vẫn cần nghiệm thu trên
head cuối; không lấy kết quả PR trước làm bằng chứng cho dependency mới.
Audit không còn advisory, build và logic/assets đã qua. CI 169 trên `17a5619`
qua sáu jobs, native transform trong container Linux và 196 browser cases không
retry/flaky. Đã xác định standalone Windows bỏ sót hai DLL của libvips, có từ bản
Next 16.3.4; thêm tracing riêng cho DLL Windows x64. Rebuild/typecheck qua,
standalone giữ đủ DLL đúng hash và native PNG transform qua trên Windows x64.
Head cuối sau correction vẫn cần sáu CI jobs; chưa nghiệm thu, chưa deploy.
Không dùng `audit fix --force`.

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

Owner/task: Codex, 2026-11-05. Đã áp dụng và xác minh ruleset
[26589636](https://github.com/Loccao102/LocCaoEnglish/rules/26589636) cho main:
PR bắt buộc; sáu check frontend/backend/ai-service/compose/integration/e2e từ
Actions app 15368; resolve review threads; không bypass, không force push/xóa
nhánh. Không gán CODEOWNERS/người duyệt; số approval bắt buộc là 0 vì chưa có
reviewer độc lập được phân công. Không bắt latest-base/linear-history, giữ
ancestry của stacked PR và review tổ hợp thực tế. Read-back effective rules,
protected:true và current_user_can_bypass:never đã xác nhận cấu hình hoạt động.

[PR thử #43](https://github.com/Loccao102/LocCaoEnglish/pull/43), head `20ffcd6`,
[CI 212](https://github.com/Loccao102/LocCaoEnglish/actions/runs/41973468716)
chỉ thất bại test chủ đích; 50 game tests cũ đạt. GitHub báo blocked và từ chối
merge thông thường với expected head bằng HTTP 405, nêu rõ frontend đang lỗi.
Main giữ nguyên `7805b50` trước/sau phép thử. PR đã đóng, không merge; không bỏ
assertion hoặc dùng bypass. Bằng chứng/giới hạn tại
[GITHUB-MERGE-GATE](GITHUB-MERGE-GATE.md) và SYSTEM-VALIDATION.
Phạm vi enforcement đã done; không có nghĩa human approval, gameplay hay toàn
dự án đã được nghiệm thu. Không deploy production hoặc đổi quyền người dùng/app.

Ban đầu 2026-10-21 và lần đọc đầu 2026-11-05, main chưa protected/rulesets rỗng.
Connector chỉ có read administration; rà UI không submit. Sau đó đã xác minh
quyền quản trị qua xác thực GitHub CLI hiện có và áp dụng REST, không tạo quyền
hoặc credential mới. JSON trong docs là template của request đã áp dụng, không
phải cơ chế tự bật policy khi commit file.

Workflow phản hồi nhanh bổ sung 19 ca đăng nhập/soạn bài/pha màu, đã đạt 19/19
(58.4s) trên `245d304`. Bộ sáu jobs/full E2E giữ nguyên, vẫn cần trước tích hợp
runtime. Các revision bị thay thế được dừng, không coi là pass. CI helper và
các chức năng đang kiểm tra đầy đủ riêng; enforcement không thay cho nghiệm thu.

**Tiêu chí đã đạt:** required check thất bại chặn merge theo quyền thông thường,
đúng nhánh/tên check, review/bypass được ghi rõ. Cấu hình không được suy từ file
checklist. Vẫn review kiến trúc, dữ liệu, ngữ nghĩa, trải nghiệm và license.

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

## Nghiệm thu và merge GitHub — 2026-11-05

Các ghi chú chờ nghiệm thu trong lịch sử bên dưới đã được giải quyết cho từng
lát cắt, không có nghĩa toàn CORE-004/005/006 đã hoàn tất:

| PR / phạm vi | Head kiểm tra / CI đủ sáu jobs | E2E | Merge vào main |
| --- | --- | --- | --- |
| [#26](https://github.com/Loccao102/LocCaoEnglish/pull/26) profile owner | `17cecb9`, [CI 174](https://github.com/Loccao102/LocCaoEnglish/actions/runs/40202949527) | 196 (31.7m) | `ec44478` |
| [#27](https://github.com/Loccao102/LocCaoEnglish/pull/27) SEC-001 | `20a3180`, [CI 179](https://github.com/Loccao102/LocCaoEnglish/actions/runs/41615325501) | 196 (37.7m) | `a2f311b` |
| [#28](https://github.com/Loccao102/LocCaoEnglish/pull/28) campaign owner | `e924a57`, [CI 180](https://github.com/Loccao102/LocCaoEnglish/actions/runs/41615453324) | 207 (36.9m) | `92ba90b` |
| [#30](https://github.com/Loccao102/LocCaoEnglish/pull/30) mission v2/v3 | `a679850`, [CI 181](https://github.com/Loccao102/LocCaoEnglish/actions/runs/41617269155) | 210 (37.4m) | `5170415` |

Đã đối chiếu sáu jobs và log E2E trên từng head; không flaky/retry. PR #27/#28
được kiểm tra lại sau reconciliation, không lấy kết quả CI 175/176 thay cho head
mới. PR #29 tài liệu đã merge thành `54273c3`. Các merge ghim expected head,
giữ ancestry và không force push. Reviews/threads không có yêu cầu đang mở;
review tĩnh độc lập không có blocker contract, không tự coi là human approval.
Từ yêu cầu dừng local, chỉ sửa source/Git và kiểm tra qua GitHub Actions; không
chạy app, build hoặc test trên máy người dùng. Chưa deploy production.

## Lịch sử đối chiếu nghiệm thu GitHub — 2026-11-03

Owner/task: Codex, branch `codex/roadmap-acceptance-20261103`; phạm vi
CORE-005/006 và SEC-001. Đối chiếu GitHub thay cho bản nháp local CORE-003 cũ;
không đưa lại code đã được merge. Main tại thời điểm rà là PR #25, `2e6379c`.

- Word Network/Wordsmith đã merge qua [PR #25](https://github.com/Loccao102/LocCaoEnglish/pull/25).
  Head `3c462a0` đạt đủ sáu jobs tại [CI 170](https://github.com/Loccao102/LocCaoEnglish/actions/runs/40163608508),
  gồm PostgreSQL/race/vet và 186 E2E (28.9m); ghi chú chờ CI trong lịch sử trên
  đã được giải quyết. Toàn CORE-005/006 vẫn `in_progress`.
- Thiết lập mục tiêu đúng tài khoản và khôi phục lần lưu chưa xác nhận:
  [PR #26](https://github.com/Loccao102/LocCaoEnglish/pull/26), `17cecb9`,
  [CI 174](https://github.com/Loccao102/LocCaoEnglish/actions/runs/40202949527),
  đủ sáu jobs và 196 E2E (31.7m). `in_review`: đã kiểm tra, chưa merge.
- SEC-001, cập nhật dependency và giữ DLL cho standalone Windows:
  [PR #27](https://github.com/Loccao102/LocCaoEnglish/pull/27), `012e721`,
  [CI 175](https://github.com/Loccao102/LocCaoEnglish/actions/runs/40202953194),
  đủ sáu jobs, native transform Linux và 196 E2E (37.8m). `in_review`, ready
  for review; cài lại/audit 0 advisory/build/native Windows đạt ngày 2026-11-03.
- Tiến độ Travel/Conversation/Work và learning summary Journey đúng owner:
  [PR #28](https://github.com/Loccao102/LocCaoEnglish/pull/28), `84fe2b2`,
  [CI 176](https://github.com/Loccao102/LocCaoEnglish/actions/runs/40203645937),
  đủ sáu jobs và 207 E2E (33.7m), gồm ca hai tài khoản/API thật. `in_review`,
  đã kiểm tra, chưa merge; không thay gate/thưởng hoặc village/Fair save.

Review độc lập không có lỗi runtime cần sửa; reviews/threads GitHub không còn
yêu cầu phải xử lý tại thời điểm đọc. Trên runtime tổng hợp `84fe2b2`,
21/21 browser cases local đạt (4.8m, không retry), đã xem 20 ảnh mobile
390×551/844. Thứ tự merge phụ thuộc: #26 → #27 → #28. Chưa merge/deploy
trong đợt đối chiếu này; commit tài liệu không thay runtime được CI xác minh.
Bằng chứng và giới hạn ở [SYSTEM-VALIDATION](SYSTEM-VALIDATION.md#github-final-head-acceptance-audit--2026-11-03).

Bước P0 được đề xuất tại thời điểm rà, `planned` trong CORE-004: chỉnh rubric hội thoại cho những
paraphrase tự nhiên đang bị bỏ sót, trước khi mở rộng nội dung. Ví dụ cần test:
“Could you tell me the departure time?” (city-transit), “How about Sunday
afternoon?” (weekend-plans) và “I misunderstood your cancellation message.”
(repair-misunderstanding). Phải chốt rules version và cách giữ attempt/receipt cũ
trước đổi pattern; vẫn chặn spam, phủ định, nhảy bước và thưởng lặp. Đây là
phạm vi biên soạn rubric có giới hạn, không tuyên bố đã hiểu ngữ nghĩa sâu hoặc
đã hiệu chuẩn IELTS overall. Không triển khai lát cắt mới trong PR tài liệu này.
