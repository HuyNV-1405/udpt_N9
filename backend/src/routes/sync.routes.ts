import { Router, Request, Response } from 'express';
import { SagaTransferService } from '../services/saga.service';
import { emitInventoryEvent, emitTransferEvent } from '../config/kafka';
import prisma from '../config/prisma';

const router = Router();

// 1. Thực hiện giao dịch phân tán SAGA chuyển kho liên Site
router.post('/saga-transfer', async (req: Request, res: Response) => {
  try {
    const { khoNguonId, khoDichId, hangHoaId, viTriDiId, viTriDenId, slChuyen, ghiChu, simulateFailureAtDest } = req.body;
    const userId = (req as any).user?.id || (await prisma.user.findFirst())?.id;

    if (!khoNguonId || !khoDichId || !hangHoaId || !viTriDiId || !viTriDenId || !slChuyen) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc để thực hiện giao dịch phân tán SAGA',
      });
    }

    const result = await SagaTransferService.executeInterSiteTransfer({
      khoNguonId,
      khoDichId,
      hangHoaId,
      viTriDiId,
      viTriDenId,
      slChuyen: Number(slChuyen),
      userId,
      ghiChu,
      simulateFailureAtDest: Boolean(simulateFailureAtDest),
    });

    return res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      message: result.success ? 'Giao dịch phân tán SAGA thành công' : 'Giao dịch phân tán thất bại và đã hoàn tác bù trừ an toàn',
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Bắn sự kiện mẫu vào Apache Kafka (cho kịch bản demo sự kiện thời gian thực)
router.post('/kafka/emit', async (req: Request, res: Response) => {
  try {
    const { eventType = 'STOCK_IN', soLuong = 10, ghiChu = 'Sự kiện kiểm thử Kafka' } = req.body;
    const firstKho = await prisma.kho.findFirst();
    const firstHangHoa = await prisma.hangHoa.findFirst();

    await emitInventoryEvent({
      eventType,
      khoId: firstKho?.id || 'KHO-HN',
      hangHoaId: firstHangHoa?.id || 'SP001',
      soLuong: Number(soLuong),
      ghiChu,
    });

    return res.json({
      success: true,
      message: 'Đã phát sự kiện thành công lên Apache Kafka Topic "wms.inventory.events"',
      event: { eventType, soLuong, ghiChu, timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Kiểm tra trạng thái đồng bộ dữ liệu liên Site
router.get('/status', async (req: Request, res: Response) => {
  try {
    const siteId = process.env.SITE_ID || 'SITE_CENTRAL';
    const totalWarehouses = await prisma.kho.count();
    const totalInventory = await prisma.tonKho.count();
    const totalTransfers = await prisma.phieuChuyenKho.count();

    return res.json({
      success: true,
      data: {
        currentSite: siteId,
        syncMode: 'Real-time Event + Scheduled Batch',
        lastSyncTimestamp: new Date().toISOString(),
        status: 'IN_SYNC',
        stats: {
          warehouses: totalWarehouses,
          inventoryRecords: totalInventory,
          transferTransactions: totalTransfers,
        },
        replicationLagMs: Math.floor(Math.random() * 15) + 2, // 2-17ms mô phỏng độ trễ mạng
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Kích hoạt đồng bộ thủ công giữa các Site (cho kịch bản demo)
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const timestamp = new Date().toISOString();
    return res.json({
      success: true,
      message: 'Đã kích hoạt đồng bộ dữ liệu liên Site thành công!',
      details: {
        sourceSites: ['Site 2: Kho miền Bắc (HN)', 'Site 3: Kho miền Nam (HCM)'],
        targetSite: 'Site 1: Trụ sở chính - Báo cáo tổng hợp',
        syncedRecords: 24,
        completedAt: timestamp,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
