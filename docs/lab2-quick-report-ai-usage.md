# LAB-2 Quick Report — Làm việc với AI

**Bài:** Prototype Product B — Yuki Cold Logistics (chuỗi kho lạnh thực phẩm)
**Người làm:** __________ · **Ngày nộp:** __________

## 1. Công cụ / skill đã dùng

| Công cụ | Dùng vào việc gì |
|---|---|
| Claude Code (desktop app, model Claude Opus) | Đọc gói đề xuất LAB-1, chốt phạm vi màn, sinh code Next.js + SQL, chạy test/lint/build, commit |
| Takumi kit (skill catalog, quy tắc YAGNI/KISS, file < 200 dòng) | Khung làm việc: plan → code → test → review |
| Supabase MCP (`apply_migration`, `execute_sql`, `get_advisors`, `query_logs`) | Áp migration, nạp seed, kiểm số dòng, đọc advisor bảo mật/hiệu năng, đọc log Auth khi debug |
| Skill `supabase`, `supabase-postgres-best-practices` | RLS, `SECURITY INVOKER`, `search_path` cho hàm `allocate_order` |
| Browser pane tích hợp | Chạy dev server, đi qua 10 kịch bản demo, gọi API đọc/ghi và chụp màn hình |
| Vitest | 17 unit test cho quy tắc nghiệp vụ, dựng từ test case bắt buộc R-06 của RFP |

## 2. Chỗ AI sinh sai — cách phát hiện và sửa

| # | AI sinh sai gì | Phát hiện thế nào | Sửa |
|---|---|---|---|
| 1 | `.env.local` để **publishable key giữ chỗ** (`placeholder-for…`) dù đã đổi URL thật. App gộp mọi lỗi Auth thành 「パスワードが正しくありません」 nên trông như sai mật khẩu | Đăng nhập 4 lần đều lỗi; log dev server có `POST /login` nhưng **log Auth của Supabase không có request `/token` nào** → request bị từ chối trước khi tới Auth. So key trong file với key thật của project (không in giá trị) → không khớp | Điền key thật, restart dev server. Ghi chú vào README: thiếu/sai key → đăng nhập báo sai mật khẩu |
| 2 | Kịch bản demo "alarm còn hạn đếm ngược" phụ thuộc thời điểm nạp seed: alarm được tạo "5 phút trước lúc load" nên ~10 phút sau đã quá hạn | Khi đi lại kịch bản, `/api/alarms` trả cả 2 alarm chưa review là `overdue: true` — lệch với README §5 | Tạo `supabase/reset-demo.sql` (truncate + seed) và ghi chú: reset ngay trước buổi demo |
| 3 | Đặt `launch.json` sai thư mục (`app/.claude/` thay vì thư mục gốc của phiên) nên không chạy được dev server | Tool báo không tìm thấy cấu hình | Chuyển về `.claude/launch.json` ở thư mục cha, chạy `npm --prefix app run dev` |
| 4 | _(phiên dựng code trước — bổ sung nếu có)_ | | |

**Kiểm chứng thay vì tin AI:** mọi kịch bản demo đều đối chiếu kết quả API với kỳ vọng trong README (日付逆転, 消費期限 hard stop, 1/3 rule, 業務レビュー, FEFO/FIFO, vi phạm giờ lái 4h/13h/15h, cách ly khi 7℃, mã bò 10 số). Sau các thao tác ghi thật, kiểm lại DB bằng SQL (số lô, allocation, audit) rồi reset.

**Phần con người làm (AI không được/không nên làm):** tạo tài khoản Supabase Auth và nhập mật khẩu, xác nhận lệnh xóa dữ liệu (truncate), deploy Vercel, cấp quyền repo cho giảng viên.

## 3. Số giờ thật

| Tuần | Việc | Giờ |
|---|---|---|
| Tuần __ | Chốt phạm vi từ LAB-1, dựng schema + code | __ h |
| Tuần __ | Dựng DB Supabase, debug đăng nhập, đi kịch bản demo, commit/push | __ h |
| Tuần __ | Deploy Vercel, hoàn thiện README + report | __ h |
| **Tổng** | | **__ h** |

## 4. Rút ra

- Thông báo lỗi chung chung ("sai mật khẩu") che mất lỗi cấu hình — debug nhanh nhất là đọc log ở phía server dịch vụ (Supabase Auth), không đoán từ UI.
- Dữ liệu demo tính theo thời gian tương đối thì phải có cách reset nhanh; nên viết sẵn script reset từ đầu.
- AI viết code nhanh, nhưng bước kiểm thử từng kịch bản với kỳ vọng nghiệp vụ vẫn phải làm kỹ — đó là chỗ phát hiện được lỗi #1 và #2.
