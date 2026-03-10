import { Router } from 'express';
import authRoutes from './authRoutes';
import productRoutes from './productRoutes';
import categoryRoutes from './categoryRoutes';
import brandRoutes from './brandRoutes';
import attributeRoutes from './attributeRoutes';
import orderRoutes from './orderRoutes';
import returnRoutes from './returnRoutes';
import inventoryRoutes from './inventoryRoutes';
import couponRoutes from './couponRoutes';
import flashSaleRoutes from './flashSaleRoutes';
import recommendationRoutes from './recommendationRoutes';
import advertisementRoutes from './advertisementRoutes';
import dashboardRoutes from './dashboardRoutes';
import userRoutes from './userRoutes';
import roleRoutes from './roleRoutes';
import menuRoutes from './menuRoutes';
import auditLogRoutes from './auditLogRoutes';
import reviewRoutes from './reviewRoutes';
import { listPermissions } from '../controllers/roleController';
import { authenticate, requirePermission } from '../middleware/auth';
import { validateCsrfToken } from '../middleware/csrf';

const router = Router();

// Apply CSRF protection to all state-changing routes (POST, PUT, PATCH, DELETE)
// GET, HEAD, OPTIONS are automatically exempt
router.use(validateCsrfToken);

// Register route modules
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/brands', brandRoutes);
router.use('/attributes', attributeRoutes);
router.use('/orders', orderRoutes);
router.use('/returns', returnRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/coupons', couponRoutes);
router.use('/flash-sales', flashSaleRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/advertisements', advertisementRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.get('/permissions', authenticate, requirePermission('roles', 'read'), listPermissions);
router.use('/menus', menuRoutes);
router.use('/reviews', reviewRoutes);
router.use('/audit-logs', auditLogRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
