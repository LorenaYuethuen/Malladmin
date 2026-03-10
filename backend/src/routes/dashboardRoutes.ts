import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getStats,
  getSalesTrend,
  getOrderStatusDistribution,
  getTopProducts,
  getRecentOrders,
} from '../controllers/dashboardController';

const router = Router();

router.use(authenticate);

router.get('/stats', getStats);
router.get('/sales-trend', getSalesTrend);
router.get('/order-status', getOrderStatusDistribution);
router.get('/top-products', getTopProducts);
router.get('/recent-orders', getRecentOrders);

export default router;
