import { Router } from 'express';
import {
  getRecommendations,
  getRecommendationById,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation,
  updateSortOrder,
  batchUpdateSortOrder,
  addProducts,
  removeProduct,
  updateProductSortOrder,
  getRecommendationTypes,
} from '../controllers/recommendationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Type management
router.get('/types', getRecommendationTypes);

// Batch sort order update
router.put('/sort-order', batchUpdateSortOrder);

// CRUD
router.get('/', getRecommendations);
router.get('/:id', getRecommendationById);
router.post('/', createRecommendation);
router.put('/:id', updateRecommendation);
router.delete('/:id', deleteRecommendation);

// Sort order for individual recommendation
router.put('/:id/sort-order', updateSortOrder);

// Product association
router.post('/:id/products', addProducts);
router.delete('/:id/products/:productId', removeProduct);
router.put('/:id/products/sort-order', updateProductSortOrder);

export default router;
