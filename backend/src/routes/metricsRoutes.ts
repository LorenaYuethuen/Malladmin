/**
 * Metrics Routes
 * Exposes Prometheus metrics endpoint
 */

import { Router, Request, Response } from 'express';
import { getMetrics, getMetricsContentType } from '../services/metricsService';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /metrics
 * Returns Prometheus metrics in text format
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', getMetricsContentType());
    const metrics = await getMetrics();
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics', { error });
    res.status(500).send('Error generating metrics');
  }
});

export default router;
