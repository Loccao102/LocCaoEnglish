# Điều kiện hoàn tất

Áp dụng cùng [PROJECT-RULES](PROJECT-RULES.md). Đánh dấu không áp dụng kèm lý do
nếu tiêu chí không thuộc thay đổi; không bỏ trống để tạo cảm giác đã kiểm tra.

## Cho mọi task

- [ ] Có ID roadmap/bug, phạm vi rõ và hành vi mong đợi.
- [ ] Tiêu chí nghiệm thu được đáp ứng bằng thay đổi thực tế, không chỉ mock/demo.
- [ ] Không làm mất công việc ngoài scope; diff đủ rõ để người khác review.
- [ ] Đã kiểm tra phù hợp theo CONTRIBUTING và lưu bằng chứng/lệnh/kết quả.
- [ ] Docs/contract/trạng thái roadmap khớp với code; không gọi phần planned là đã có.
- [ ] Mọi giới hạn, bước deploy và kiểm tra chưa chạy được ghi rõ.
- [ ] PR có mô tả trước/sau, cách xác minh và rủi ro; khi cần merge, các required
  checks/review đã đạt. Không tự coi việc push là merge hoặc deploy.

## Khi sửa luật chơi hoặc attempt

- [ ] Có input hợp lệ, mục tiêu, thắng/thua, cooldown và chặn input sau kết thúc.
- [ ] Có ít nhất đường thành công, đường sai/thất bại và retry; thưởng không lặp.
- [ ] Gợi ý, replay, đáp án lộ và correction được phản ánh đúng loại bằng chứng.
- [ ] Thử thách sinh từ seed tái hiện được, có lời giải và ngân sách khả thi.
- [ ] Không đạt đúng chỉ bằng vị trí đáp án cố định; không tăng khó bằng UI khó đọc.
- [ ] Pause/reload/round transition không đổi luật, không reset penalty hoặc tăng thưởng.
- [ ] Hoàn thành đường chơi mới qua input thật trên browser nếu có UI tương tác;
  test engine trực tiếp không được dùng thay cho kiểm tra renderer/input.

## Khi sửa save, API hoặc rewards

- [ ] Giữ đúng owner; kiểm tra guest/account và đổi tài khoản nếu bị ảnh hưởng.
- [ ] Cùng ID + cùng payload không ghi lặp; khác payload bị từ chối.
- [ ] Mất phản hồi/offline/retry/concurrency không làm mất queue hay thưởng lặp.
- [ ] Không trộn Fair keepsakes, story rewards, learning evidence và competitive score.
- [ ] Save cũ/contract cũ có migration hoặc từ chối an toàn được mô tả.
- [ ] Database test tách riêng; phân biệt memory test với PostgreSQL test.
- [ ] Trình tự triển khai và phục hồi không đòi xóa dữ liệu người chơi.

## Khi sửa UI/assets

- [ ] Input keyboard/touch, focus và pause tiếp tục dùng được.
- [ ] Nhãn không chồng/ra ngoài playfield; màn nhỏ được kiểm tra khi bố cục thay đổi.
- [ ] Có xem ảnh/render thực tế; không chỉ dựa vào bounding box hoặc build.
- [ ] Assets đúng phong cách, nguồn/quyền dùng rõ, runtime và exports nhất quán.

## Trạng thái bàn giao

- `planned`: chưa bắt đầu; `in_progress`: đang làm; `in_review`: code/docs đã có,
  còn review hoặc xác minh; `blocked`: ghi rõ điều kiện chặn và cách gỡ;
  `done`: tiêu chí và các kiểm tra áp dụng đã đạt, có bằng chứng/commit/PR.
- Deploy không mặc định thuộc mọi task. Nếu scope có deploy, phải xác minh môi
  trường đích trước khi done. Nếu không, ghi “chưa deploy” khi cần để tránh hiểu nhầm.
- Chủ dự án yêu cầu bỏ testing: ghi ngoại lệ, phần đã làm và chưa xác minh. Không
  ghi test pass, không tự nâng task lên done khi tiêu chí đó còn thiếu.
