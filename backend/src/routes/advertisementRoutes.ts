import { Router } from 'express';
import {
  getAdvertisements,
  getAdvertisementById,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
  incrementAdView,
  incrementAdClick,
  getAdvertisementsByPosition,
} from '../controllers/advertisementController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CRUD
router.get('/', getAdvertisements);
router.get('/position/:position', getAdvertisementsByPosition);
router.get('/:id', getAdvertisementById);
router.post('/', createAdvertisement);
router.put('/:id', updateAdvertisement);
router.delete('/:id', deleteAdvertisement);

// Analytics
router.post('/:id/click', incrementAdClick);
router.post('/:id/view', incrementAdView);

export default router;
