import { Router } from 'express';
import { listReviews, getReview, createReview, updateReview, deleteReview, voteReview, getReviewStats } from '../controllers/reviewController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticate, getReviewStats);
router.get('/', authenticate, listReviews);
router.get('/:id', authenticate, getReview);
router.post('/', authenticate, requirePermission('reviews', 'write'), createReview);
router.put('/:id', authenticate, requirePermission('reviews', 'write'), updateReview);
router.delete('/:id', authenticate, requirePermission('reviews', 'delete'), deleteReview);
router.post('/:id/vote', authenticate, voteReview);

export default router;
