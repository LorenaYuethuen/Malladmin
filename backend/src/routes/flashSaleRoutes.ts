import { Router } from 'express';
import {
  getFlashSales,
  getFlashSaleById,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
  updateFlashSaleStatus,
  addProductToFlashSale,
  removeProductFromFlashSale,
  deductFlashSaleStock,
  checkUserPurchase,
} from '../controllers/flashSaleController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Flash Sale CRUD
router.get('/', getFlashSales);
router.get('/:id', getFlashSaleById);
router.post('/', createFlashSale);
router.put('/:id', updateFlashSale);
router.delete('/:id', deleteFlashSale);

// Status management
router.put('/:id/status', updateFlashSaleStatus);

// Flash Sale Products
router.post('/:id/products', addProductToFlashSale);
router.delete('/:id/products/:productId', removeProductFromFlashSale);

// Stock deduction (atomic via Lua script)
router.post('/:id/products/:productId/deduct', deductFlashSaleStock);

// User purchase check
router.get('/:id/products/:productId/check-purchase', checkUserPurchase);

export default router;
