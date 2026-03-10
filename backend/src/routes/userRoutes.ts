import { Router } from 'express';
import { listUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/userController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requirePermission('users', 'read'), listUsers);
router.get('/:id', authenticate, requirePermission('users', 'read'), getUser);
router.post('/', authenticate, requirePermission('users', 'write'), createUser);
router.put('/:id', authenticate, requirePermission('users', 'write'), updateUser);
router.delete('/:id', authenticate, requirePermission('users', 'delete'), deleteUser);

export default router;
