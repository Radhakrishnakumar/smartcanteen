import { Router, Request, Response } from 'express';
import { HealthCheckResponse } from '../types/index.js';
import { config } from '../config/env.js';

const router = Router();

router.get('/health', (req: Request, res: Response<HealthCheckResponse>) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'smart-canteen-backend',
    version: '0.1.0',
    uptime: Math.floor(process.uptime()),
    environment: config.nodeEnv,
  });
});

export default router;
