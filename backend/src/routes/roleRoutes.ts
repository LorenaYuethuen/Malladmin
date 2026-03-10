import { Router } from 'express';
import { listRoles, getRole, createRole, updateRole, deleteRole, listPermissions } from '../controllers/roleController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/permissions', authenticate, requirePermission('roles', 'read'), listPermissions);
router.get('/', authenticate, requirePermission('roles', 'read'), listRoles);
router.get('/:id', authenticate, requirePermission('roles', 'read'), getRole);
router.post('/', authenticate, requirePermission('roles', 'write'), createRole);
router.put('/:id', authenticate, requirePermission('roles', 'write'), updateRole);
router.delete('/:id', authenticate, requirePermission('roles', 'delete'), deleteRole);

export default router;
