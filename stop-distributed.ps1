# ==============================================================================
# SCRIPT DỪNG HỆ THỐNG PHÂN TÁN WMS
# ==============================================================================

Write-Host "🛑 Đang dừng toàn bộ cụm Container của Hệ thống phân tán..." -ForegroundColor Yellow
docker compose -f docker-compose.distributed.yml down

Write-Host "✅ Đã tắt toàn bộ hệ thống phân tán an toàn!" -ForegroundColor Green
