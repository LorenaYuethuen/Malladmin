import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { sendSuccess } from '../utils/response';
import { NotFoundError } from '../utils/errors';

export const listRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, pageSize = 20, search } = req.query;
    const limit = Math.min(Number(pageSize), 100);
    const offset = (Number(page) - 1) * limit;
    const conditions: string[] = [];
    const values: any[] = [];
    let p = 0;
    if (search) { p++; conditions.push(`r.name ILIKE $${p}`); values.push(`%${search}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRes, rolesRes] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM roles r ${where}`, values),
      db.query(`
        SELECT r.id, r.name, r.description, r.created_at as "createdAt",
          (SELECT COUNT(*) FROM user_roles WHERE role_id = r.id) as "userCount",
          COALESCE(json_agg(json_build_object('id', perm.id, 'resource', perm.resource, 'actions', perm.actions, 'description', perm.description)) FILTER (WHERE perm.id IS NOT NULL), '[]') as permissions
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions perm ON rp.permission_id = perm.id
        ${where}
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT $${p + 1} OFFSET $${p + 2}
      `, [...values, limit, offset]),
    ]);
    sendSuccess(res, { items: rolesRes.rows, total: parseInt(countRes.rows[0].count), page: Number(page), pageSize: limit });
  } catch (e) { next(e); }
};

export const getRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(`
      SELECT r.id, r.name, r.description, r.created_at as "createdAt",
        (SELECT COUNT(*) FROM user_roles WHERE role_id = r.id) as "userCount",
        COALESCE(json_agg(json_build_object('id', perm.id, 'resource', perm.resource, 'actions', perm.actions, 'description', perm.description)) FILTER (WHERE perm.id IS NOT NULL), '[]') as permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions perm ON rp.permission_id = perm.id
      WHERE r.id = $1
      GROUP BY r.id
    `, [req.params.id]);
    if (!result.rows.length) throw new NotFoundError('Role', req.params.id);
    sendSuccess(res, result.rows[0]);
  } catch (e) { next(e); }
};

export const createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, permissionIds = [] } = req.body;
    const result = await db.query(`INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id`, [name, description]);
    const roleId = result.rows[0].id;
    for (const pid of permissionIds) {
      await db.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [roleId, pid]);
    }
    const role = await db.query(`SELECT id, name, description, created_at as "createdAt" FROM roles WHERE id = $1`, [roleId]);
    sendSuccess(res, role.rows[0], 'Role created', 201);
  } catch (e) { next(e); }
};

export const updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, permissionIds } = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    let p = 0;
    if (name !== undefined) { p++; fields.push(`name = $${p}`); values.push(name); }
    if (description !== undefined) { p++; fields.push(`description = $${p}`); values.push(description); }
    if (fields.length) { p++; values.push(id); await db.query(`UPDATE roles SET ${fields.join(', ')} WHERE id = $${p}`, values); }
    if (permissionIds) {
      await db.query(`DELETE FROM role_permissions WHERE role_id = $1`, [id]);
      for (const pid of permissionIds) {
        await db.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, pid]);
      }
    }
    const role = await db.query(`SELECT id, name, description FROM roles WHERE id = $1`, [id]);
    if (!role.rows.length) throw new NotFoundError('Role', id);
    sendSuccess(res, role.rows[0]);
  } catch (e) { next(e); }
};

export const deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(`DELETE FROM roles WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!result.rows.length) throw new NotFoundError('Role', req.params.id);
    sendSuccess(res, { id: req.params.id });
  } catch (e) { next(e); }
};

export const listPermissions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(`SELECT id, resource, actions, description FROM permissions ORDER BY resource`);
    sendSuccess(res, result.rows);
  } catch (e) { next(e); }
};
