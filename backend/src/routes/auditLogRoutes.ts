import { Router } from 'express';
import { listAuditLogs, getAuditLog } from '../controllers/auditLogController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requirePermission('audit-logs', 'read'), listAuditLogs);
router.get('/:id', authenticate, requirePermission('audit-logs', 'read'), getAuditLog);

export default router;
