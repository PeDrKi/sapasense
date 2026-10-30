# Hướng dẫn triển khai — SapaSense

Kiến trúc: **Cloudflare Pages** (giao diện) + **Cloudflare Worker** (API) + **Cloudflare D1** (cơ sở dữ liệu). Tất cả nằm trong gói miễn phí cho quy mô cá nhân.
Cần: Node.js **22** (`nvm use`), tài khoản [Cloudflare](https://dash.cloudflare.com) và [GitHub](https://github.com).

> Các bước dưới đây chưa được thử trên tài khoản Cloudflare thật. Nếu một lệnh báo lỗi, giữ nguyên thông báo để dò nguyên nhân.

## 0. Chạy thử trên máy (10 phút)
```bash
npm install
npm test                    # kỳ vọng: tất cả test qua
npm run dev                 # mở http://localhost:5173
```
- Tạo một lộ trình thử. Mở `http://localhost:5173/#admin` để xem trang quản trị (khi chưa có API, mật khẩu là `ADMIN_PASSWORD` trong code — chỉ là cổng phía trình duyệt).
- Thử cả backend: ở cửa sổ 1 `ADMIN_TOKENS="chu:token-dai-1:editor,ban:token-dai-2:viewer" npm run sync-server`, ở cửa sổ 2 `VITE_API_URL=http://localhost:8787 npm run dev`, rồi vào `/#admin` đăng nhập bằng `token-dai-1`.

## Cách nhanh nhất: GitHub + Vercel (chỉ frontend, không cần backend)
App tính lộ trình ngay trong trình duyệt nên chỉ cần frontend là chạy đủ tính năng chính (đồng bộ máy và Admin cloud là phần tuỳ chọn).
1. Tạo repo trên GitHub rồi đẩy code lên (xem mục 1 bên dưới).
2. Vào [vercel.com](https://vercel.com) → **Add New → Project** → chọn repo. Vercel tự nhận Vite nhờ `vercel.json`; không cần đổi gì.
3. **Environment Variables** nên đặt: `VITE_ADMIN_PASSWORD` = mật khẩu Quản trị của bạn (không đặt thì dùng mật khẩu mặc định công khai trong mã).
4. **Deploy**. Mỗi lần `git push` lên `main`, Vercel tự build lại.
5. Thay thế: bật **GitHub Pages** (Settings → Pages → Source = GitHub Actions); file `.github/workflows/deploy.yml` đã có sẵn, và app dùng đường dẫn tương đối nên chạy được cả khi nằm trong thư mục con.

Lưu ý: mọi biến `VITE_*` đều lộ công khai trong bản build; mật khẩu Admin kiểu này chỉ phù hợp demo.

## 1. Đưa code lên GitHub
Tạo repository (nên *Private*), rồi:
```bash
git init && git add . && git commit -m "sapasense"
git branch -M main
git remote add origin https://github.com/<tên-bạn>/sapasense.git
git push -u origin main
```
`.gitignore` đã loại `node_modules`, `dist`, `.env`. **Không đưa `.env` có khoá thật lên GitHub.**

## 2. Backend: D1 + Worker
```bash
cd sync-server
npx wrangler login
npx wrangler d1 create sapasense
```
- Lệnh in ra `database_id`. Dán vào `sync-server/wrangler.toml` ở dòng `database_id = "..."`.
```bash
npx wrangler d1 execute sapasense --remote --file=schema.sql   # tạo bảng
cd ..
npm run db:push                                                  # nạp toàn bộ địa điểm vào D1
npx wrangler secret put ADMIN_TOKENS --config sync-server/wrangler.toml
```
- Khi được hỏi, nhập danh sách admin, ví dụ: `chu:Xk39-chuoi-dai-ngau-nhien:editor,ban:Yq82-chuoi-dai-khac:viewer`
  (mỗi token ≥ 8 ký tự, nên dùng ≥ 24 ký tự ngẫu nhiên; `editor` được sửa, `viewer` chỉ xem).
```bash
npm run deploy:api
```
- Lệnh in ra địa chỉ, dạng `https://sapasense-api.<tên>.workers.dev`. **Ghi lại địa chỉ này.**
- Kiểm tra: mở `<địa chỉ>/v1/places` trên trình duyệt, phải thấy danh sách JSON các địa điểm.

## 3. Frontend: Cloudflare Pages nối GitHub
1. Dashboard Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → chọn repo.
2. Cấu hình build:
   - Build command: `npm run build`
   - Build output directory: `dist`
3. **Environment variables** (mục *Variables and Secrets*), thêm:
   - `NODE_VERSION` = `22`
   - `VITE_API_URL` = địa chỉ Worker ở bước 2 (không có dấu `/` cuối)
4. **Save and Deploy**. Lần build đầu mất vài phút. Kết quả: `https://<dự-án>.pages.dev`.

## 4. Cho phép site gọi API (CORS)
- Sửa `sync-server/wrangler.toml`: `ALLOWED_ORIGIN = "https://<dự-án>.pages.dev"` (đúng tên miền site, không có `/` cuối; nếu dùng tên miền riêng thì dùng tên miền đó).
- Deploy lại: `npm run deploy:api`.
- Bỏ qua bước này thì trình duyệt sẽ chặn mọi yêu cầu từ site tới API.

## 5. Kiểm tra sau khi deploy
- [ ] Mở site trên điện thoại, tạo được lộ trình, bản đồ hiện đúng.
- [ ] Mở `https://<site>/admin` (hoặc bấm Ctrl+Shift+1), đăng nhập bằng token editor; thấy danh sách địa điểm, thống kê, nhật ký.
- [ ] Đăng nhập bằng token viewer: không thấy nút Sửa/Xoá.
- [ ] Gửi thử một đánh giá từ app, thấy nó trong Admin → Đánh giá, rồi xoá nó.
- [ ] Đồng bộ: tạo mã đồng bộ ở máy A, nhập ở máy B, đánh dấu yêu thích ở A và xem B có cập nhật.
- [ ] Tắt mạng rồi mở lại site: app vẫn chạy (PWA).

## 6. Cập nhật về sau
| Bạn muốn… | Làm gì |
|---|---|
| Sửa/thêm/xoá một địa điểm, đổi giá, toạ độ | `https://<site>/#admin` → Địa điểm (không cần deploy; người dùng thấy sau ≤ 1 phút) |
| Sửa nhiều địa điểm trong `src/data/places.ts` | `npm run db:push` |
| Sửa giao diện / thuật toán / bản dịch | `npm test`, rồi `git push` (Pages tự build) |
| Sửa backend (`sync-server/`) | `npm test`, rồi `npm run deploy:api` |
| Đổi / thêm admin | `npx wrangler secret put ADMIN_TOKENS --config sync-server/wrangler.toml` |

Lưu ý: `db:push` **ghi đè** địa điểm cùng `id` (kể cả chỗ sửa tay trong Admin) và **không xoá** địa điểm đã bỏ khỏi file. Mỗi đợt sửa chỉ nên chọn một nơi để sửa.

## 7. Sự cố thường gặp
| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| Admin báo không kết nối / đồng bộ lỗi | `ALLOWED_ORIGIN` sai, hoặc `VITE_API_URL` sai/thiếu → sửa rồi build lại (`VITE_*` được nhúng lúc build) |
| Đăng nhập Admin báo sai token | Token trong `ADMIN_TOKENS` phải ≥ 8 ký tự, đúng dạng `tên:token:vai_trò`; đặt lại secret |
| Địa điểm trên site không đổi sau khi sửa | Cache API 60 giây; tải lại trang. PWA có thể giữ bản cũ — đóng hẳn tab rồi mở lại |
| `wrangler d1 execute` báo không tìm thấy database | `database_id` trong `wrangler.toml` chưa dán hoặc sai |
| Build Pages lỗi `node:sqlite` hay phiên bản Node | Thêm biến `NODE_VERSION=22` |
| Gửi đánh giá báo "quá nhiều" | Giới hạn 5 đánh giá/giờ cho mỗi IP |

## 8. Giới hạn đã biết
- Chưa có CAPTCHA cho đánh giá.
- Ai có mã đồng bộ thì đọc và sửa được dữ liệu của mã đó.
- Một số toạ độ chưa đối chiếu với Google Maps; giờ mở cửa chưa có trong dữ liệu.
- Mới có 3 địa điểm có thực đơn đầy đủ.
