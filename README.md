# SapaSense 🏔

> Hệ thống gợi ý lộ trình du lịch Sa Pa (Lào Cai) cá nhân hóa theo ngữ cảnh tức thời và thời tiết thời gian thực.
> Hướng dẫn triển khai đầy đủ: xem [DEPLOY.md](DEPLOY.md).

SapaSense là web app gợi ý lộ trình cá nhân hóa tại Sa Pa (Lào Cai) dựa trên tâm trạng, thời gian, ngân sách, nhóm đi cùng và thời tiết.

## Chạy ngay

```bash
cd sapasense
npm install
npm run dev      # → http://localhost:3000
npm test         # unit test (vitest)
npm run build    # build production (tsc + vite)
```

Không cần API key. Thuật toán chạy hoàn toàn trên trình duyệt; chỉ cần mạng cho nền bản đồ OSM, thời tiết Open-Meteo và font Google. Sau lần mở đầu, app dùng được offline (PWA).

## Dữ liệu Sa Pa

- Nguồn: `sapa-lao-cai-dia-diem.xlsx` → `src/data/places.ts` (**35 địa điểm**: 5 điểm tham quan `SP***`, 15 nơi lưu trú `NN***`, 15 điểm ăn uống `AM***`).
- Địa điểm lưu trú có `type: 'lodging'`: **không** được xếp vào lộ trình, chỉ hiện ở tab **Chỗ ở** (lọc theo ngân sách).
- Giờ mở cửa trong file Excel được chuyển thành quy tắc `src/data/schedule.ts` (giờ mở / giờ nhận khách cuối).
- Mùa đẹp: `src/data/seasons.ts` hiện có SP001–SP003 (lấy từ mẹo trong file Excel); các điểm khác mặc định "quanh năm".
- Quán ăn chưa có thực đơn đã kiểm chứng nguồn (`src/data/menus.ts` để trống) nên giá hiển thị là **ước tính** từ file Excel.
- Chế độ "Người địa phương" (`src/data/localMode.ts`) và số liệu phỏng vấn (`src/data/interviewData.ts`) đang **để trống** — chưa có dữ liệu Sa Pa. Điền theo mẫu trong từng file.
- Khu vực: Núi Ngũ Chỉ Sơn · VQG Hoàng Liên · Hồ Séo Mý Tỷ · Bản Tả Phìn · Thác Tình Yêu.
- Thời tiết lấy tại tọa độ Sa Pa (22.3364°N, 103.8438°E); vị trí người dùng ngoài khung 22.15–22.55°N, 103.6–104.05°E bị bỏ qua.

## Tính năng

- Onboarding ngắn (tâm trạng, ngân sách, thời gian, nhóm) hoặc **✨ Gợi ý cho tôi ngay**
- Lộ trình có bản đồ Leaflet, chỉ đường Google Maps, chia sẻ link, xuất PDF
- Tự đẩy điểm ngoài trời ra khi trời mưa; lọc theo giờ mở cửa và mùa
- Tab Lộ trình / Bản đồ / Chỗ ở / Đánh giá; trang "Của tôi" (yêu thích, đã ghé, lịch sử)
- Đồng bộ thiết bị mã hoá đầu-cuối và Admin (Cloudflare D1) — tùy chọn
- Hiệu ứng GSAP (`src/utils/motion.ts`): vào trang đầu, chuyển bước onboarding, thẻ lộ trình hiện theo cuộn; tự tắt khi hệ điều hành bật "giảm chuyển động"
- Ảnh địa điểm: đặt `public/places/<MÃ>.webp` (xem `public/places/README.txt`)
- Trang **Khám phá** (`ExploreScreen`): duyệt theo nhóm, khu vực, giá, tìm kiếm; trang chi tiết có giờ mở cửa, địa chỉ, mùa đẹp, chỉ đường
- Cảnh báo an toàn theo thời tiết (`utils/safety.ts`): giông, mưa, sương mù, rét
- Đặc sản, lễ hội (có nguồn, `src/data/guide.ts`) và nút **Thêm vào lịch** (.ics)
- Tiếng Việt / English

## Vào Admin

Nút **⚙ Quản trị hệ thống** ở trang Welcome, hoặc `Ctrl + Shift + A`, hoặc `/#admin`. Mật khẩu mặc định khi phát triển: `sapasense2026` (đặt `VITE_ADMIN_PASSWORD` để đổi).

## Cấu hình tùy chọn (`.env.local`)

```
VITE_ADMIN_PASSWORD=mat-khau-cua-ban
VITE_REVIEW_ENDPOINT=https://script.google.com/macros/s/.../exec
VITE_API_URL=https://sapasense-api.<ban>.workers.dev
```

## Server dùng chung (Cloudflare D1, tùy chọn)

```bash
cd sync-server
npx wrangler login
npx wrangler d1 create sapasense                 # dán database_id vào wrangler.toml
npx wrangler d1 execute sapasense --remote --file=schema.sql
cd .. && npm run db:seed                         # sinh sync-server/seed.sql từ src/data/places.ts
cd sync-server && npx wrangler d1 execute sapasense --remote --file=seed.sql
npx wrangler secret put ADMIN_TOKENS             # vd: chu:Xk39...:editor,ban:Yq82...:viewer
# sửa ALLOWED_ORIGIN trong wrangler.toml, rồi:
npx wrangler deploy
```

Chạy thử cục bộ: `npm run sync-server`.

## Cập nhật sau khi deploy

| Bạn muốn… | Làm gì |
|---|---|
| Sửa/thêm/xoá địa điểm, giá, tọa độ | `/#admin` → Địa điểm |
| Sửa nhiều địa điểm trong `places.ts` | `npm run db:push` |
| Sửa giao diện / thuật toán / bản dịch | `npm test`, rồi đẩy code hoặc `npm run build` |
| Sửa backend | `npm test`, rồi `npm run deploy:api` |
| Đối chiếu tọa độ | `npm run verify:places` (OSM, hoặc `GOOGLE_MAPS_KEY=...`) |

## Việc nên làm tiếp

- Tọa độ lấy từ file Excel (cột Google Maps còn trống) — nên đối chiếu bằng `npm run verify:places`.
- Một số khách sạn/nhà hàng trong file có cùng tọa độ (vd. Topas Ecolodge và nhà hàng 360°); đó là dữ liệu nguồn.
- Bộ lọc an toàn theo lượng mưa/tầm nhìn theo từng độ cao (như mô tả trong báo cáo) chưa có: hiện app dùng mã thời tiết Open-Meteo để loại điểm ngoài trời khi mưa.

## Nguồn dữ liệu mùa đẹp
`src/data/seasons.ts` (24 địa điểm ngoài trời) tổng hợp từ [VinWonders – Đi Sa Pa mùa nào đẹp](https://vinwonders.com/vi/wonderpedia/news/di-sa-pa-mua-nao-dep-lao-cai/) và [Báo Lào Cai – mai anh đào Sa Pa](https://baolaocai.vn/ruc-ro-sac-hoa-mai-anh-dao-tuyet-dep-o-sa-pa-post888464.html), cùng ghi chú trong dữ liệu địa điểm. Đây là mức tham khảo chung; cần đối chiếu thực tế từng năm.

## Giấy phép
Mã nguồn theo giấy phép MIT (xem `LICENSE`). Ảnh trong `public/places/` và dữ liệu địa điểm không thuộc giấy phép này; hãy bảo đảm bạn có quyền sử dụng trước khi công khai.
