## Vấn đề và kết quả

Roadmap ID / bug:

Mô tả trigger, hành vi trước và sau. Nêu rõ phần đã triển khai và phần còn thiếu.
Nếu không theo thứ tự core-first, ghi yêu cầu/phạm vi và lý do.

## Contract và dữ liệu

- Miền bị ảnh hưởng: story / Fair / learning / IELTS / assets / docs
- API, save, seed/rules version, migration, retry và owner: thay đổi gì? Hoặc N/A.
- Triển khai/rollback: thứ tự và cách giữ dữ liệu. Hoặc N/A.

## Xác minh

| Lệnh / thao tác | Kết quả | Revision / bằng chứng |
| --- | --- | --- |
| | | |

Kiểm tra chưa chạy/bị chặn và lý do:
CI hiện tại:

## Checklist bắt buộc

- [ ] Đã đọc AGENTS.md (agent), CONTRIBUTING.md và docs/PROJECT-RULES.md.
- [ ] Đạt các mục áp dụng trong docs/DEFINITION-OF-DONE.md; N/A có lý do.
- [ ] Không thêm điểm/accuracy cố định hoặc client score làm trusted reward.
- [ ] Retry, save cũ và account boundary đã kiểm tra nếu bị ảnh hưởng.
- [ ] Đã chơi qua browser và xem màn hình nhỏ nếu sửa gameplay/UI.
- [ ] Assets có provenance và export khớp nguồn nếu bị ảnh hưởng.
- [ ] Đã cập nhật docs/ROADMAP.md và docs contract tương ứng.
- [ ] Không bỏ test/giảm assertion để che lỗi; không lẫn pass cũ với revision mới.

## Giới hạn và phần tiếp theo

Ghi rủi ro còn lại, ngoại lệ, blocker và roadmap ID tiếp theo.
Đừng đánh dấu mục chưa xác minh. Push/merge/deploy là các trạng thái riêng.
