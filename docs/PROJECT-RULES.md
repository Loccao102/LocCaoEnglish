# Quy tắc dự án

Có hiệu lực từ 2026-09-27. Áp dụng cho người đóng góp và coding agent, gồm code,
content, assets, dữ liệu, cấu hình và tài liệu. “Phải/không được” là yêu cầu bắt buộc;
“nên” là khuyến nghị. Đây là quy tắc phát triển, không phải cam kết mọi code cũ đã
đáp ứng. Nợ kỹ thuật được theo dõi trong [ROADMAP](ROADMAP.md).

## R01 — Làm nền trước, mở rộng sau

Mặc định ưu tiên: tính đúng của kết quả → độ bền save/khôi phục → vòng chơi chung →
chất lượng quyết định trong game → nội dung → trang trí. Không dùng số lượng game,
map hay nhân vật để thay cho chiều sâu. Không viết lại toàn hệ thống khi có thể
hoàn tất một lát cắt dọc từ input đến lưu kết quả. Đổi ưu tiên theo yêu cầu rõ ràng
của chủ dự án thì ghi lý do ở task/PR; không tự đặt thêm vòng xin phép cho việc đã
được giao.

## R02 — Một nơi quyết định luật cho mỗi miền

- Fair: `lib/game/festival-session.ts` sở hữu trạng thái, input hợp lệ, thắng/thua,
  thời gian và kết quả; `challenge.ts` sở hữu cấu hình độ khó/sinh thử thách.
- `components/game/` trình bày trạng thái; `lib/game/three/` xử lý hình ảnh, chuyển
  động và va chạm, chuyển tương tác về session. Không cấp thưởng từ render loop.
- Go API/store là ranh giới dữ liệu tài khoản, giao dịch và phân quyền. PostgreSQL
  là lưu trữ bền vững; memory mode là dữ liệu tạm và phải được ghi rõ.
- Learning engine mới phải có vòng đời attempt dùng chung và adapter theo kỹ năng;
  không kéo phần chấm ngôn ngữ vào session của game hội chợ.
- Dùng catalog chung nếu miền đã có; không tạo bản JSON/đáp án/số vòng sao chép
  riêng ở UI, backend và export mà không có cơ chế đồng bộ xác minh.

## R03 — Điểm và bằng chứng phải có nguồn gốc

| Loại dữ liệu | Ranh giới bắt buộc |
| --- | --- |
| Fair keepsakes | Client báo kết quả cá nhân; không cấp learning XP, coin hoặc rank |
| Story rewards | Chấm quest và cấp first-clear reward theo contract story; retry không cấp lặp |
| Learning mastery / XP | Chỉ mở rộng qua kết quả attempt được server xác thực/chấm; không thêm điểm cố định cho mọi câu trả lời |
| Competitive results | Không tin score do browser tự quyết; cần phiên/kết quả được server kiểm chứng |
| Coach/IELTS estimates | Ghi rõ phương pháp, provider và giới hạn; không trình bày như điểm thi chính thức |
| Speaking | Transcript match, heuristic và acoustic assessment là các loại bằng chứng khác nhau |

`/v1/attempts` hiện còn nhận accuracy từ client: đây là nợ CORE-001. Không tuyên bố
nó đã an toàn cho mastery/rank, không thêm tính năng thưởng dựa trên điểm tự báo.
`answer` mới phải phân biệt câu trả lời thật của người chơi với đáp án chuẩn, không
ghi đáp án mẫu như thể người chơi đã trả lời đúng.

## R04 — Một kết quả, một lần ghi nhận

Run/attempt phải có ID ổn định, tài khoản sở hữu, content/rules version khi cần.
Retry cùng ID và payload trả lại kết quả đã ghi; đổi payload phải bị từ chối.
Reward và completion phải được ghi nguyên tử ở server. Kiểm tra gửi lặp, mất phản
hồi, request đồng thời và response về sai thứ tự khi sửa persistence.

Không được xóa hàng đợi offline sau request lỗi. Không đẩy queue của tài khoản A
bằng token tài khoản B. Guest tách riêng; không tự gộp vào tài khoản lúc đăng nhập.

## R05 — Save là contract có phiên bản

Thay đổi schema, seed generator hoặc luật diễn giải checkpoint phải quyết định
rõ: giữ tương thích, migrate hoặc từ chối an toàn. Không âm thầm đổi bài toán của
ván đang chơi. Pause/help/tab ẩn không tiếp tục tính thời gian trong nền; reload
không trừ thời gian đã rời game theo contract Fair hiện tại.

Migration phải chạy lại an toàn, không làm mất dữ liệu, có trình tự deploy và
phương án phục hồi. Backend nhận contract mới trước khi frontend gửi contract mới.
Không downgrade/xóa schema hay reset save để che lỗi triển khai. Database test phải
tách riêng, không dùng database người chơi để chạy kiểm tra ghi/xóa.

## R06 — Độ khó phải công bằng và giải được

Mỗi thay đổi game phải nêu input, mục tiêu, luật thắng/thua, feedback, retry, điểm,
gợi ý và cách tăng độ khó. Thử thách sinh ngẫu nhiên phải tái hiện được từ seed.
Phải kiểm tra tồn tại lời giải, thời gian/turn budget phù hợp và không đã giải sẵn.

Không dựa vào vị trí đáp án cố định. Không vừa hiện đáp án vừa tính là unassisted
mastery. Có thể hỗ trợ học, nhưng phải ghi nhận và diễn giải kết quả đúng contract.
Không tăng khó bằng chữ nhỏ, vùng bấm thiếu rõ ràng, camera che mục tiêu hoặc input
bị tính nhiều lần. Không tuyên bố “game đã thú vị/cân bằng” chỉ từ test tự động.

## R07 — Giao diện phục vụ người chơi

Giữ controls bàn phím/touch, pause, focus, thông báo lỗi và đường quay lại.
Các nhãn Fair phải đọc được, nằm trong playfield, không chồng nhau; xác minh cả
màn 390 × 551 và 390 × 844 khi đổi bố cục/HUD. Không chỉ kiểm tra desktop.
Giữ phong cách chibi tròn, biểu cảm thân thiện, màu sáng và cá tính riêng đã mô tả
trong [CHIBI-CAST](CHIBI-CAST.md). Trong UI không lộ thuật ngữ triển khai trừ khi
nó giúp người chơi hiểu lỗi, quyền riêng tư hoặc nơi dữ liệu đang được lưu.

## R08 — Assets có nguồn gốc rõ ràng

Chỉ dùng assets tự tạo hoặc được cấp quyền phù hợp. Không sao chép nhân vật, logo,
sprite hay model từ game thương mại để “giống ảnh”. Ghi nguồn, license/quyền dùng,
prompt và các sửa đổi theo manifest/provenance hiện có; không đoán quyền sử dụng.
Khi thay nguồn model/catalog, cập nhật export, manifest/checksum và ZIP liên quan
cùng một thay đổi; dùng script của dự án và chạy xác minh. Không tải runtime từ
nguồn bên ngoài chỉ để né quản lý assets trong repo.

## R09 — Code phải đọc và sửa tiếp được

Dùng module theo trách nhiệm, type rõ tại API/persistence boundary, validate dữ
liệu vào. Không thêm component/session lớn chứa lẫn network, chấm điểm và render.
Không tạo file mới dạng một dòng minify; khi sửa một vùng khó đọc, định dạng vùng
đó đủ để review, không trộn reformat toàn repo vào PR chức năng.
Comment giải thích lý do/invariant. Không sửa file sinh tự động như nguồn chính.
Đọc docs của Next.js đang cài trước thay đổi Next/React theo AGENTS; không suy từ
phiên bản cũ. Dependency mới phải có lý do cụ thể và lockfile tương ứng.

## R10 — Xác minh thật, báo cáo thật

Chạy ma trận kiểm tra trong [CONTRIBUTING](../CONTRIBUTING.md) theo thay đổi.
Test phải kiểm tra hành vi/rủi ro, không chỉ chép lại implementation. Không bỏ test,
giảm assertion, bắt lỗi rồi bỏ qua hoặc đổi dữ liệu để làm CI xanh. Fixture Practice
chỉ dành cho regression luật cũ; test nâng cao phải thực sự chọn/kiểm tra mức đó.

Ghi commit, lệnh, kết quả và giới hạn. “Build pass”, “logic pass”, “browser pass” và
“playtested” là các bằng chứng khác nhau. Nếu kiểm tra bị chặn hoặc chủ dự án yêu
cầu bỏ qua, ghi rõ và để trạng thái `in_review`/`blocked` phù hợp; không gọi là đã
kiểm chứng. Không thêm test cho sửa docs/format đơn thuần khi kiểm tra link/diff đủ.

## R11 — Không làm mất công việc hoặc dữ liệu

Kiểm tra git trước sửa, giữ thay đổi của người khác. Không force push, reset/clean
phá hủy, xóa dữ liệu, đổi secret hay deploy production ngoài phạm vi được giao.
Không log token, password, raw audio hoặc dữ liệu người học vào docs/test artifacts.
Chỉ gửi microphone audio khi người dùng thực hiện chức năng đánh giá tương ứng;
không tự thêm thu thập nền. Telemetry mới cần mô tả dữ liệu, mục đích và retention.

## R12 — Docs, PR và cách áp dụng luật

Mỗi PR phải nêu ID roadmap (hoặc bug cụ thể), hành vi trước/sau, xác minh và rủi ro
save/API. Thay contract phải cập nhật docs miền; quyết định kiến trúc phải có ADR.
ROADMAP là nguồn duy nhất của trạng thái; không tạo thêm TODO/backlog song song.
Reviewer dùng [Definition of Done](DEFINITION-OF-DONE.md), không merge khi check
bắt buộc đang lỗi hoặc phần nghiệm thu còn chưa đáp ứng.

AGENTS giúp agent đọc luật; CONTRIBUTING và PR template đưa luật vào review.
CI hiện có kiểm tra frontend, backend, AI, compose, integration và E2E. Tài liệu
không thể tự cưỡng chế mọi người tuân thủ: cấu hình branch protection/required
reviews của GitHub chưa được xác minh hoặc thay đổi trong đợt này (GOV-002).
Không được tuyên bố merge đã bị GitHub chặn nếu chưa xác minh cấu hình đó.

Ngoại lệ phải nêu phạm vi, lý do, rủi ro và việc còn lại trong PR. Yêu cầu rõ ràng
của chủ dự án quyết định phạm vi/ưu tiên; quy tắc repo không thay thế hướng dẫn cấp
cao hơn của môi trường thực thi. Sửa quy tắc bằng một thay đổi có thể review,
không âm thầm bỏ luật để hợp thức hóa cách làm.
