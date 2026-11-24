import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes';
import { errorHandler } from './middlewares/error.middleware';

dotenv.config();

export const createApp = (): Application => {
  const app = express();

  // Middlewares
  app.use(
    cors({
      origin: true,
      credentials: true,
      exposedHeaders: ['X-Node-Name', 'X-Site-Id', 'X-Site-Name', 'X-Load-Balancer'],
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Middleware gắn định danh Node và Site vào header phản hồi
  app.use((req: Request, res: Response, next) => {
    res.setHeader('X-Node-Name', process.env.NODE_ID || 'node-default');
    res.setHeader('X-Site-Id', process.env.SITE_ID || 'SITE_CENTRAL');
    res.setHeader('X-Site-Name', encodeURIComponent(process.env.SITE_NAME || 'Trụ sở chính'));
    next();
  });

  // Healthcheck endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'OK',
      siteId: process.env.SITE_ID || 'SITE_CENTRAL',
      siteName: process.env.SITE_NAME || 'Trụ sở chính - Báo cáo tổng hợp',
      nodeId: process.env.NODE_ID || 'central_app_1',
      timestamp: new Date().toISOString(),
      service: 'Warehouse Management System (WMS) Distributed Node',
      version: '2.0.0-distributed',
    });
  });

  // RESTful API Routes
  app.use('/api', apiRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
