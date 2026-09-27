# Hướng dẫn đóng góp

Áp dụng cho developer và coding agent. Bắt đầu bằng [quy tắc dự án](docs/PROJECT-RULES.md),
[roadmap](docs/ROADMAP.md) và [Definition of Done](docs/DEFINITION-OF-DONE.md).
Agent phải đọc [AGENTS.md](AGENTS.md); mục lục đầy đủ ở [docs/README](docs/README.md).

## 1. Nhận việc

1. Kiểm tra `git status`, branch và diff; không ghi đè việc đang có.
2. Chọn ID trong roadmap, kiểm tra phụ thuộc và tiêu chí nghiệm thu. Ghi người/task
   đang thực hiện khi chuyển sang `in_progress`; không tự nhận các mục khác đã xong.
3. Đọc docs miền và xác định route → component → engine → API/store đang dùng.
4. Với bug, ghi cách tái hiện và hành vi mong đợi. Với contract mới, viết ngắn
   input/output, các invariant, tương thích và kế hoạch kiểm tra trước khi code.

Mặc định làm CORE-001 trước mở rộng nội dung. Một task đang được chủ dự án chỉ định
cụ thể được tiếp tục trong phạm vi đó; ghi lý do lệch ưu tiên nếu có.

## 2. Phát triển

- Dùng branch `codex/<ten-ngan>` cho branch mới của agent, trừ khi có chỉ định khác.
  Tiếp tục branch/task hiện có khi phù hợp; không tạo worktree/branch chỉ để đổi tên.
- Làm một lát cắt hoàn chỉnh; PR phải review được và không trộn nhiều refactor không
  liên quan. Dùng nguồn catalog/luật chung của miền.
- Nếu thay schema, bổ sung migration và startup schema tương ứng theo convention
  repo; mô tả thứ tự triển khai và cách giữ queue/save cũ.
- Lưu thay đổi vào repo. Sửa docs cùng code, đặc biệt API, reward, checkpoint và seed.
- Không thêm API hay UI với dữ liệu giả nhưng trình bày như đã đồng bộ thành công.

## 3. Chạy local

Theo [README — Run locally](README.md#run-locally) cho Docker hoặc hot reload.
Kiểm tra process/port đang có trước khi khởi động lại. `npm run dev:stack` dùng
web 3102, API 8080, AI 8090 theo mặc định; Docker web dùng 3000. Không dừng dịch vụ
không thuộc task. Không coi memory mode là account persistence bền vững.

## 4. Kiểm tra theo phạm vi

| Thay đổi | Kiểm tra cần thực hiện |
| --- | --- |
| Docs/PR template | Đọc lại, xác minh đường dẫn/file/lệnh, `git diff --check`; không cần rebuild app |
| Fair rules, checkpoint, scoring | `npm run test:game`, `npm run build`, E2E các hành vi bị ảnh hưởng |
| Learning attempts/grade/rewards | Go tests và vet; PostgreSQL/concurrency nếu đổi store; browser/API flow liên quan |
| UI, camera, input, renderer | Build, browser tương tác thật, pause/reload; kiểm tra kích thước nhỏ khi đổi bố cục |
| API/schema/auth/queue | Go tests, vet, database test tách biệt; retry/conflict/account-switch/old-save và API E2E liên quan |
| Assets/catalog/export | Các script verify tương ứng; nếu thay model, kiểm tra animation/biểu cảm và render/export |
| AI service | Compile, unittest, endpoint/fallback liên quan; ghi rõ provider thật hay giả lập |

Lệnh chuẩn từ root:

```sh
npm run test:game
npm run build
npm run assets:verify
npm run assets:verify:3d
```

Browser với stack đang chạy (chỉ chọn file/case liên quan khi kiểm tra local):

```sh
E2E_BASE_URL=http://127.0.0.1:3102 npm run test:e2e -- tests/e2e/fair-difficulty.spec.ts --reporter=line
```

PowerShell tương đương; D3D11 chỉ dành cho môi trường Windows hỗ trợ backend đó:

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:3102'
$env:E2E_GL_BACKEND='d3d11'
npm run test:e2e -- tests/e2e/fair-difficulty.spec.ts --reporter=line
```

Backend, chạy từ `backend/`:

```sh
go test ./...
go vet ./...
TEST_DATABASE_URL=postgres://loccao:loccao@127.0.0.1:5432/loccao_system_test?sslmode=disable go test -race ./...
```

Dòng cuối chỉ dùng database test riêng có tên `loccao_system_test`; race detector
cần toolchain tương thích. CI chạy PostgreSQL/race trên Linux. Không có biến DB
thì store tests local chủ yếu dùng memory, phải ghi đúng giới hạn đó.

AI, chạy từ `ai-service/` trong môi trường có dependencies:

```sh
python -m compileall app
python -m unittest discover -s tests -v
```

CI chạy ma trận đầy đủ trong [workflow](.github/workflows/ci.yml). Không chỉnh
workflow chỉ để né lỗi. Khi một kiểm tra bị môi trường chặn, giữ nguyên lỗi/bằng
chứng, báo rõ phần chưa xác minh; không thử vượt chính sách môi trường.

## 5. PR và bàn giao

Dùng [PR template](.github/PULL_REQUEST_TEMPLATE.md). Trước khi báo hoàn tất:

- So diff/staged files, loại secret/build output không liên quan.
- Kiểm tra theo [Definition of Done](docs/DEFINITION-OF-DONE.md).
- Ghi lệnh/kết quả gắn với revision; test pass ở commit cũ không tự áp dụng cho code mới.
- Cập nhật roadmap và docs miền. Nếu thay đổi nhỏ chỉ sửa tài liệu quy tắc, không
  cần ghi vào lịch sử kiểm tra gameplay.
- Báo commit/PR, trạng thái CI đúng thực tế và rủi ro triển khai. “Đã push”, “đã
  merge”, “đã deploy” là ba trạng thái khác nhau.
- Không merge/deploy ngoài quyền đã được giao. PR pending CI chưa được ghi là
  production-ready. Nếu còn lỗi thuộc scope, tiếp tục sửa hoặc ghi blocked cụ thể.
