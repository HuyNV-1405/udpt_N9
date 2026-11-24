import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';

const router = Router();

// Endpoint kiểm tra trạng thái Node và Phân mảnh hiện tại
router.get('/node-status', async (req: Request, res: Response) => {
  try {
    const siteId = process.env.SITE_ID || 'SITE_CENTRAL';
    const siteName = process.env.SITE_NAME || 'Trụ sở chính - Báo cáo tổng hợp';
    const nodeId = process.env.NODE_ID || 'central_app_1';
    const lbPort = process.env.LB_PORT || (siteId === 'SITE_HN' ? '8001' : siteId === 'SITE_HCM' ? '8002' : '8000');

    // Kiểm tra kết nối CSDL
    let dbStatus = 'CONNECTED';
    let warehouseCount = 0;
    let inventoryRecordCount = 0;

    try {
      warehouseCount = await prisma.kho.count();
      inventoryRecordCount = await prisma.tonKho.count();
    } catch (e: any) {
      dbStatus = `ERROR: ${e.message}`;
    }

    res.json({
      success: true,
      data: {
        nodeId,
        siteId,
        siteName,
        loadBalancer: {
          name: `Nginx Load Balancer (${siteName})`,
          port: lbPort,
          clusterInstances: [
            nodeId.replace(/_2$/, '_1'),
            nodeId.replace(/_1$/, '_2')
          ]
        },
        database: {
          status: dbStatus,
          warehouses: warehouseCount,
          inventoryRecords: inventoryRecordCount,
          fragmentation: siteId === 'SITE_HN' ? 'TON_KHO_HN (Kho miền Bắc)' : siteId === 'SITE_HCM' ? 'TON_KHO_HCM (Kho miền Nam)' : 'CENTRAL_CONSOLIDATED (Tổng hợp toàn quốc)'
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint trả về sơ đồ phân tán (Topology)
router.get('/topology', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      sites: [
        {
          id: 'SITE_CENTRAL',
          name: 'Site 1: Trụ sở chính - Báo cáo tổng hợp',
          loadBalancer: 'http://localhost:8000',
          nodes: ['central_app_1', 'central_app_2'],
          database: { primary: 'db_central_primary (Port 5431)', replica: 'db_central_replica (Port 6431)' },
          role: 'Quản lý Master Data & Báo cáo BI tổng hợp'
        },
        {
          id: 'SITE_HN',
          name: 'Site 2: Kho miền Bắc - Node HN',
          loadBalancer: 'http://localhost:8001',
          nodes: ['hn_app_1', 'hn_app_2'],
          database: { primary: 'db_hn_primary (Port 5432)', replica: 'db_hn_replica (Port 6432)' },
          fragment: 'TON_KHO_HN'
        },
        {
          id: 'SITE_HCM',
          name: 'Site 3: Kho miền Nam - Node HCM',
          loadBalancer: 'http://localhost:8002',
          nodes: ['hcm_app_1', 'hcm_app_2'],
          database: { primary: 'db_hcm_primary (Port 5433)', replica: 'db_hcm_replica (Port 6433)' },
          fragment: 'TON_KHO_HCM'
        }
      ]
    }
  });
});

export default router;
