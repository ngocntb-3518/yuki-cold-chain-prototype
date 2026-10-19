# LAB-2 — Prototype Product B: Hệ thống chuỗi kho lạnh thực phẩm (Yuki Cold Logistics)

Prototype chạy thật cho đề Product B (RFP `YCL-RFP-2026-01 v2.0`), dựng tiếp từ gói đề xuất LAB-1.

- **URL:** _(điền sau khi deploy Vercel)_
- **Tài khoản demo cho giảng viên:** _(điền sau khi tạo user trong Supabase Auth)_
- **Stack:** Next.js 15 (App Router) · Supabase (Postgres + Auth) · Vercel
- **Ngôn ngữ giao diện:** tiếng Nhật (theo NFR-LOC-01 của RFP — khách hàng Nhật)

---

## 1. Phạm vi màn hình (chốt lại từ 55 màn của LAB-1)

| Màn prototype | Đường dẫn | Màn LAB-1 | Feature LAB-1 | Làm thật gì |
|---|---|---|---|---|
| ログイン | `/login` | SCR-00-01 | F11-01 | Supabase Auth email/password; middleware chặn mọi trang và API khi chưa đăng nhập |
| ホーム | `/` | SCR-00-02 | F11-02 | Đếm việc đang chờ (alarm, cách ly, đơn chưa phân bổ, business review, tuyến nháp) |
| 入荷検品 | `/inbound` | SCR-02-02 | F02-02/04/05 | Chặn khi thiếu trường P0; so nhiệt đo với ngưỡng có version; lệch → tạo lô **cách ly**; kiểm vị trí đúng dải nhiệt; mã bò đúng 10 chữ số; gạo bắt buộc xuất xứ |
| 在庫・隔離 | `/inventory` | SCR-03-07, SCR-03-06 | F03-06/07 | Tra tồn; QC gỡ cách ly / hủy, **bắt buộc lý do**, không tự release |
| 引当・出荷 | `/allocation` | SCR-04-01, SCR-05-01 | F04-01…08 | **Màn trọng tâm**: đánh giá từng lô theo thứ tự ①消費期限 → ②dải nhiệt → ③cách ly → ④cửa sổ giao theo hợp đồng → ⑤**日付逆転** → FEFO/FIFO; **banner cảnh báo 日付逆転**; hợp đồng chưa có quy tắc → business review; phân bổ nguyên tử trong 1 transaction |
| 納品履歴 | `/history` | SCR-04-03 | F04-09 | Lịch sử giao đã nhận theo khách × SKU (nguồn của 日付逆転), chỉ ghi thêm |
| 温度警報 | `/alarms` | SCR-08-01, SCR-08-02 | F08-01/02/03 | Import CSV logger → phát hiện vượt ngưỡng → tạo alarm; đồng hồ đếm 15 phút; ghi lần review đầu |
| 配車・拘束時間 | `/routes` | SCR-07-02, SCR-07-03 | F07-02/04 | Timeline từng tài xế; kiểm lái liên tục 4h, ràng buộc 13h/15h, nghỉ giữa ca 9h/11h, lái TB 2 ngày 9h; **vi phạm → không cho công bố**; lưu version quy tắc khi công bố |
| トレース | `/trace` | SCR-09-01 | F09-04 | Tìm theo mã lô / mã bò 10 chữ số / xuất xứ gạo → đơn → khách |
| マスタ | `/masters` | SCR-01-01/03/06 | F01-01/03/06 | Xem SKU (12 SKU của R-02), hợp đồng (15 của R-04), ngưỡng nhiệt (chỉ đọc) |

### Để ngoài phạm vi so với LAB-1 và lý do

| Nhóm (LAB-1) | Không làm | Lý do |
|---|---|---|
| FN-01 Master | Sửa master, luồng duyệt maker-checker | Prototype dùng master cố định từ fixture RFP; trọng tâm là quy tắc nghiệp vụ |
| FN-03 Tồn kho | Put-away đề xuất vị trí, kiểm kê blind count, di chuyển nội bộ | Không chứa bẫy đọc-hiểu; effort lớn so với giá trị demo |
| FN-05 Xuất hàng | Picking task, verify barcode, kiểm trước xuất | Cần thiết bị scan thật |
| FN-06 POD | POD offline trên thiết bị tài xế, bằng chứng theo 車上渡し/軒先渡し, khiếu nại | Cần managed device, queue offline mã hóa — thay bằng nút "納品確定" (mock) |
| FN-07 Tuyến | Tạo tuyến từ đơn, chèn nghỉ tự động, sự kiện bất khả kháng | Cần dịch vụ bản đồ; prototype chỉ kiểm tuyến đã có |
| FN-08 HACCP | Deviation case đầy đủ, completeness queue, sanitation, review ngày/tháng | Giữ phần cốt lõi (alarm + SLA 15 phút) |
| FN-09 Thu hồi | Recall case, thông báo thu hồi | Chỉ làm tra cứu truy xuất |
| FN-10 Báo cáo | 12 báo cáo, KPI, export audit | Không cần cho luồng chính |
| FN-12 Tích hợp | ERP, bản đồ, mail relay, IdP công ty, archive | Bên thứ ba — được phép mock theo đề |
| FN-13 Migration | Tool migration, rehearsal | Dữ liệu demo đổ thẳng bằng seed |

## 2. Phần nào là mock và nếu làm thật cần gì

| Phần | Prototype | Làm thật cần |
|---|---|---|
| Dữ liệu | `supabase/seed.sql`: master theo fixture RFP (R-02, R-04); tên khách, lô, đơn, alarm, tuyến là dữ liệu bịa; ngày tính tương đối theo ngày load | Migration từ 6 nguồn dữ liệu thật (profiling, lineage, 2 rehearsal) |
| Đăng nhập | Email/password của Supabase Auth | SSO OIDC qua IdP công ty, MFA cho vai trò đặc quyền, xác thực managed device cho tài xế |
| Phân quyền | Mọi nhân viên đã đăng nhập đọc/ghi như nhau (RLS `to authenticated`) | RBAC theo vai trò (QC / kế hoạch / tài xế / auditor), tách người tạo và người duyệt |
| Xác nhận giao (POD) | Nút "納品確定" ghi lịch sử nhận hàng | POD trên thiết bị tài xế, offline 8h, chữ ký/ảnh theo điều kiện giao |
| Logger nhiệt | Dán nội dung CSV vào màn hình | Upload file có kiểm soát, hash SHA-256 chống trùng, lưu file gốc, timezone thiết bị |
| Giờ tài xế | Kiểm trong ngày + nghỉ giữa ca + TB 2 ngày | Cửa sổ tháng/năm (284h, 3.300h, làm thêm 960h) cần dữ liệu chấm công; đối chiếu nguồn luật chính thức trước khi đóng băng thiết kế |
| Tích hợp | Không có | ERP (CSV/SFTP), dịch vụ bản đồ, mail relay, archive |

### Giả định nghiệp vụ đang dùng (chờ khách trả lời ở phiếu câu hỏi LAB-1)

- Cửa sổ giao 1/3, 1/2 tính từ **ngày sản xuất**, làm tròn xuống theo ngày (Q12).
- 消費期限 "到来" = ngày hết hạn ≤ ngày giao (Q28).
- 日付逆転: **cùng hạn** với lần nhận trước thì vẫn giao được; chỉ so với lần giao **đã nhận** của đúng khách × SKU (Q13).
- SLA 15 phút tính từ lúc alarm được tạo khi import (Q02).
- Kéo dài 13h → 15h chỉ khi tuyến có cờ "延長条件 承認済み" (Q21).
- Dải 常温 không có khu cách ly vật lý (R-01): lô 常温 cách ly tại chỗ bằng trạng thái (Q15).

## 3. Kiến trúc

```
Trình duyệt (React client components)
   │ fetch
   ▼
Next.js API routes  (src/app/api/**)  ──►  src/lib/rules/*  (quy tắc nghiệp vụ, hàm thuần, có unit test)
   │ supabase-js + cookie session của người dùng (RLS áp dụng)
   ▼
Supabase Postgres  (supabase/migrations/*.sql) + Supabase Auth
```

- **Không có dữ liệu cứng trong code:** mọi màn đọc/ghi qua API route → Supabase.
- Quy tắc phân bổ chạy lại ở server khi bấm "引当実行", không tin kết quả xem trước của client.
- Phân bổ cả đơn trong một hàm Postgres (`allocate_order`, `SECURITY INVOKER`): trừ tồn có điều kiện, lỗi một lô thì cả đơn không đổi.
- Bảng lịch sử (`inspections`, `allocations`, `delivery_history`, `audit_events`) chỉ cho INSERT — không UPDATE/DELETE.

## 4. Chạy local

```bash
npm install
cp .env.example .env.local   # điền URL và publishable key của project Supabase
npm run dev
```

Database: chạy 2 file trong `supabase/migrations/` rồi `supabase/seed.sql` (Supabase SQL Editor hoặc CLI `supabase db push` + seed).

Kiểm tra:

```bash
npm test        # 17 unit test cho quy tắc, dựng từ test case bắt buộc R-06 của RFP
npm run lint
npm run build
```

## 5. Kịch bản demo (dữ liệu seed)

| Đơn | Thấy gì |
|---|---|
| ORD-001 (CUS-003 × CHI-002 sữa chua) | Banner **日付逆転**: lô L-CHI002-A cũ hơn lô khách đã nhận → bị loại; lô cách ly bị loại dù hạn sớm; chọn L-CHI002-B (cùng hạn với lần nhận trước → được) |
| ORD-002 (CUS-001 × CHI-001 bò, 消費期限) | Lô đến hạn đúng ngày giao → **hard stop**; lô cũ hơn lịch sử của CUS-001 → 日付逆転 |
| ORD-003 (CUS-004 × CHI-001) | Cùng lô bò đó **được** giao cho CUS-004 — lịch sử của khách khác không ảnh hưởng |
| ORD-004 (gạo, 1/3) | Lô cũ quá hạn giao 1/3 → loại; lô mới được chọn |
| ORD-005 / ORD-007 | Hợp đồng AGR-014 / AGR-008 chưa có quy tắc → **業務レビュー保留**, không tự áp quy tắc |
| ORD-006 (FRO-001) | FEFO; 2 lô cùng hạn → lô nhập trước được lấy trước; chia số lượng qua nhiều lô |
| Tuyến RT-002 / RT-003 | Lái liên tục 4h20, ràng buộc 14h không có điều kiện kéo dài, 15h30 vượt tối đa → **không công bố được**; RT-001 công bố được |
| 温度警報 | Alarm còn hạn (đếm ngược) và alarm quá 15 phút (tô đỏ); import CSV mẫu tạo alarm mới |
| 入荷検品 | Nhập CHI-001 với mã bò 9 chữ số → bị chặn; nhập nhiệt 7℃ cho hàng 冷蔵 → lô vào C-Q-01 (cách ly) |
