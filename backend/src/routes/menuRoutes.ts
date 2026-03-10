import { Router } from 'express';
import { listMenus, getMenuTree, createMenu, updateMenu, deleteMenu } from '../controllers/menuController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/tree', authenticate, getMenuTree);
router.get('/', authenticate, listMenus);
router.post('/', authenticate, requirePermission('menus', 'write'), createMenu);
router.put('/:id', authenticate, requirePermission('menus', 'write'), updateMenu);
router.delete('/:id', authenticate, requirePermission('menus', 'delete'), deleteMenu);

export default router;
