# ==============================================================================
# SCRIPT KHỞI ĐỘNG HỆ THỐNG PHÂN TÁN WMS (3 SITES - 6 APPS - 3 LOAD BALANCERS)
# ==============================================================================

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "🚀 KHỞI ĐỘNG HỆ THỐNG QUẢN LÝ KHO PHÂN TÁN WMS (DISTRIBUTED SYSTEM)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Khởi chạy toàn bộ cụm Container Docker
Write-Host "`n📦 [1/3] Đang khởi động các cụm Container qua Docker Compose..." -ForegroundColor Yellow
docker compose -f docker-compose.distributed.yml up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Lỗi khi khởi chạy Docker Compose!" -ForegroundColor Red
    exit 1
}

Write-Host "`n⏳ [2/3] Đang đợi các cơ sở dữ liệu khởi động sẵn sàng (10 giây)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 2. Khởi tạo Schema và Seeding dữ liệu cho từng Site
Write-Host "`n🌱 [3/3] Đang khởi tạo CSDL & nạp phân mảnh dữ liệu cho 3 Site..." -ForegroundColor Yellow

# Seed Site 1: Central
Write-Host "   -> Đang thiết lập CSDL Site 1 (Trụ sở chính - Cổng 5431)..." -ForegroundColor White
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5431/wms_central_db?schema=public"
$env:SITE_TARGET="CENTRAL"
npx prisma db push --schema=./backend/prisma/schema.prisma --accept-data-loss
npx ts-node ./distributed/scripts/seed-distributed.ts

# Seed Site 2: HN
Write-Host "   -> Đang thiết lập CSDL Site 2 (Kho miền Bắc - Cổng 5432)..." -ForegroundColor White
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wms_hn_db?schema=public"
$env:SITE_TARGET="HN"
npx prisma db push --schema=./backend/prisma/schema.prisma --accept-data-loss
npx ts-node ./distributed/scripts/seed-distributed.ts

# Seed Site 3: HCM
Write-Host "   -> Đang thiết lập CSDL Site 3 (Kho miền Nam - Cổng 5434)..." -ForegroundColor White
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5434/wms_hcm_db?schema=public"
$env:SITE_TARGET="HCM"
npx prisma db push --schema=./backend/prisma/schema.prisma --accept-data-loss
npx ts-node ./distributed/scripts/seed-distributed.ts

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "✅ HỆ THỐNG PHÂN TÁN ĐÃ KHỞI CHẠY THÀNH CÔNG 100%!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 DANH SÁCH ĐIỂM TRUY CẬP HỆ THỐNG (ENDPOINTS):" -ForegroundColor White
Write-Host "------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "🏢 Site 1 (Trụ sở chính - Tổng hợp): http://localhost:8000" -ForegroundColor Cyan
Write-Host "   - Load Balancer: Port 8000 (Điều phối central_app_1 & central_app_2)"
Write-Host "   - Database Primary: Port 5431 | Replica: Port 6431"
Write-Host ""
Write-Host "🏛️ Site 2 (Kho miền Bắc - Node HN):  http://localhost:8001" -ForegroundColor Cyan
Write-Host "   - Load Balancer: Port 8001 (Điều phối hn_app_1 & hn_app_2)"
Write-Host "   - Database Primary: Port 5432 | Replica: Port 6432"
Write-Host ""
Write-Host "🏬 Site 3 (Kho miền Nam - Node HCM): http://localhost:8002" -ForegroundColor Cyan
Write-Host "   - Load Balancer: Port 8002 (Điều phối hcm_app_1 & hcm_app_2)"
Write-Host "   - Database Primary: Port 5434 | Replica: Port 6433"
Write-Host ""
Write-Host "📬 Message Broker: Apache Kafka: localhost:9092" -ForegroundColor Magenta
Write-Host "   - Topics: wms.inventory.events, wms.transfer.events, wms.sync.periodic" -ForegroundColor Gray
Write-Host ""
Write-Host "🔄 Dịch vụ đồng bộ liên Site (Kafka Sync Worker): http://localhost:5055/sync/status" -ForegroundColor Cyan
Write-Host "   - Xem stream sự kiện Kafka trực tiếp: http://localhost:5055/kafka/events" -ForegroundColor Gray
Write-Host "💻 Giao diện Frontend: http://localhost:5173 (Chuyển đổi Site ngay trên Header)" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "👉 Để mở giao diện Web, chạy lệnh: cd frontend; npm run dev" -ForegroundColor Green
