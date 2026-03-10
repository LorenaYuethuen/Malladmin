import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { sendSuccess } from '../utils/response';
import { NotFoundError } from '../utils/errors';

export const listAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, pageSize = 20, userId, action, resource, startDate, endDate } = req.query;
    const limit = Math.min(Number(pageSize), 100);
    const offset = (Number(page) - 1) * limit;
    const conditions: string[] = [];
    const values: any[] = [];
    let p = 0;
    if (userId) { p++; conditions.push(`al.user_id = $${p}`); values.push(userId); }
    if (action) { p++; conditions.push(`al.action ILIKE $${p}`); values.push(`%${action}%`); }
    if (resource) { p++; conditions.push(`al.resource ILIKE $${p}`); values.push(`%${resource}%`); }
    if (startDate) { p++; conditions.push(`al.created_at >= $${p}`); values.push(startDate); }
    if (endDate) { p++; conditions.push(`al.created_at < $${p}::date + interval '1 day'`); values.push(endDate); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRes, logsRes] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM audit_logs al ${where}`, values),
      db.query(`
        SELECT al.id, al.user_id as "userId", u.username, al.action, al.resource,
          al.resource_id as "resourceId", al.details, al.ip_address as "ipAddress",
          al.created_at as "createdAt"
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${where}
        ORDER BY al.created_at DESC
        LIMIT $${p + 1} OFFSET $${p + 2}
      `, [...values, limit, offset]),
    ]);
    sendSuccess(res, { items: logsRes.rows, total: parseInt(countRes.rows[0].count), page: Number(page), pageSize: limit });
  } catch (e) { next(e); }
};

export const getAuditLog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(`
      SELECT al.id, al.user_id as "userId", u.username, al.action, al.resource,
        al.resource_id as "resourceId", al.details, al.ip_address as "ipAddress",
        al.created_at as "createdAt"
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = $1
    `, [req.params.id]);
    if (!result.rows.length) throw new NotFoundError('AuditLog', req.params.id);
    sendSuccess(res, result.rows[0]);
  } catch (e) { next(e); }
};
