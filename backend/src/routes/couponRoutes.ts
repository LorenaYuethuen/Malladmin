import { Router } from 'express';
import {
  getCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  getCouponStats,
  validateCoupon,
  getCouponUsage,
} from '../controllers/couponController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Coupon CRUD
router.get('/', getCoupons);
router.get('/:id', getCouponById);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);

// Status management
router.put('/:id/status', toggleCouponStatus);

// Usage statistics
router.get('/:id/stats', getCouponStats);

// Coupon validation and usage records
router.post('/validate', validateCoupon);
router.get('/:id/usage', getCouponUsage);

export default router;
