# Vietnix Deployment Setup

Hướng dẫn setup lần đầu để đưa `thuvienso.top` chạy trên Vietnix shared hosting (cPanel Node.js Selector).

Sau khi setup xong **một lần**, mỗi lần deploy chỉ cần chạy `bash scripts/deploy.sh` từ máy local — GitHub Actions tự SSH vào Vietnix và pull code.

---

## A. Trên Cloudflare R2 (storage cho media)

Đảm bảo bạn đã có:
- 1 bucket R2 đã tạo
- 1 API token có quyền `Object Read & Write` cho bucket đó

Ghi lại 4 giá trị:
- `R2_ENDPOINT` — `https://<account-id>.r2.cloudflarestorage.com`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

(R2 cần CORS cho phép `https://thuvienso.top` gửi PUT — nếu chưa cấu hình thì upload trực tiếp từ trình duyệt sẽ fail. Vào R2 bucket → Settings → CORS Policy → thêm rule cho phép PUT/GET từ origin của site.)

---

## B. Trên Vietnix cPanel (Setup Node.js App)

### B.1. Tạo Node.js App
**cPanel → Setup Node.js App → Create Application**:

| Field | Giá trị |
|-------|---------|
| Node.js version | **20.x** (cao nhất Vietnix hỗ trợ) |
| Application mode | **Production** |
| Application root | `thu-vien-so` (relative to home; tức là `/home/thuvien7/thu-vien-so`) |
| Application URL | `thuvienso.top` (root, không phải subdirectory) |
| Application startup file | để trống — Passenger sẽ dùng `npm start` qua scripts trong package.json |
| Passenger log file | `/home/thuvien7/passenger.log` (mặc định cũng ok) |

Bấm **Create**.

### B.2. Add tất cả Environment Variables
Sau khi tạo xong, scroll xuống section **Environment variables** và add từng dòng (lấy giá trị từ `.env` cũ trên Vercel hoặc local):

```
NODE_ENV                = production
DATABASE_URL            = postgresql://...   (Neon connection string)
PAYLOAD_SECRET          = <random 32+ chars>
NEXTAUTH_SECRET         = <random 32+ chars>
NEXTAUTH_URL            = https://thuvienso.top
NEXT_PUBLIC_SERVER_URL  = https://thuvienso.top

# R2 (Cloudflare)
R2_ENDPOINT             = https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID        = ...
R2_SECRET_ACCESS_KEY    = ...
R2_BUCKET_NAME          = ...

# Cron / webhooks
CRON_SECRET             = <same value as GitHub repo secret>

# Web2M / SePay (nếu dùng)
WEB2M_TOKEN             = ...
SEPAY_API_KEY           = ...

# Email (nếu dùng)
SMTP_HOST               = ...
SMTP_USER               = ...
SMTP_PASS               = ...
```

> ⚠️ Mỗi lần thay đổi env vars phải bấm **Save** + **Restart App** ở góc trên cPanel Node.js App.

### B.3. Mở Terminal trên cPanel và chạy lần đầu

Vào **cPanel → Terminal** (icon trong section Advanced):

```bash
# 1. Vào home dir
cd ~

# 2. Clone repo deploy branch (đã có .next/ build sẵn từ máy local)
git clone -b deploy https://github.com/thuviensovns/thu-vien-so.git

# 3. Cài dependencies
cd thu-vien-so
npm install --omit=dev --no-audit --no-fund

# 4. Copy update script
cp scripts/update-vietnix.sh ~/update.sh
chmod +x ~/update.sh

# 5. Test update.sh chạy được
bash ~/update.sh
```

Nếu bước 5 chạy ok (báo "Vietnix update DONE"), tiếp tục:

### B.4. Verify Node.js app đang chạy
- Quay lại **Setup Node.js App** → bấm **Restart** ở app vừa tạo
- Mở `https://thuvienso.top` → nên thấy trang chủ (không còn 503)

Nếu vẫn 503: xem log tại **cPanel → Errors** hoặc tail Passenger log:
```bash
tail -50 ~/passenger.log
```

---

## C. Trên GitHub repo (auto-deploy)

Đã setup sẵn 4 secrets:
- `VIETNIX_HOST` ✅
- `VIETNIX_PORT` ✅
- `VIETNIX_USER` ✅
- `VIETNIX_SSH_KEY` ✅

Workflow [.github/workflows/deploy-vietnix.yml](../.github/workflows/deploy-vietnix.yml) tự chạy mỗi khi branch `deploy` có commit mới.

---

## D. Workflow deploy hằng ngày

Sau khi setup xong:

```bash
# Trên máy local — sửa code rồi:
bash scripts/deploy.sh
```

Script sẽ:
1. Build Next.js local (tạo `.next/`)
2. Push branch `deploy` lên GitHub
3. → GitHub Actions tự SSH vào Vietnix
4. → Vietnix chạy `~/update.sh`: git pull + npm install + restart Node app
5. → Web live trong ~30s

---

## E. Troubleshooting

### Vẫn thấy 404 Vercel khi vào `thuvienso.top`
DNS đã trỏ về Vietnix `103.200.23.68`, nhưng browser cache DNS cũ. Fix:
```cmd
# Windows Command Prompt as Admin:
ipconfig /flushdns
```
Hoặc test bằng Incognito.

### Upload media báo lỗi CORS
Vào R2 bucket → Settings → CORS Policy:
```json
[{
  "AllowedOrigins": ["https://thuvienso.top", "http://localhost:3000"],
  "AllowedMethods": ["GET", "PUT"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}]
```

### App không restart sau khi `~/update.sh` chạy
Đường dẫn `RESTART_FILE` trong `~/update.sh` không khớp. Tìm đường dẫn thật bằng:
```bash
find ~ -name "restart.txt" 2>/dev/null
ls ~/nodevenv/
```
Sửa biến `RESTART_FILE` trong `~/update.sh` theo đường dẫn đúng.

### Legacy media (audio/video cũ) trên Vercel Blob bị mất
Các URL dạng `*.public.blob.vercel-storage.com` vẫn có thể đọc được CHO ĐẾN KHI bạn xóa Vercel project. Để migrate qua R2:
- Tạm thời cứ để URL cũ hoạt động
- Khi rảnh, viết script migration: enumerate products có `audioR2Key` bắt đầu bằng `https://`, download → upload R2 → update DB
