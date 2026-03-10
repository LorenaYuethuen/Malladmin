import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../database/connection';
import { sendSuccess } from '../utils/response';
import { NotFoundError, ValidationError } from '../utils/errors';

export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, pageSize = 20, search, status, roleId } = req.query;
    const limit = Math.min(Number(pageSize), 100);
    const offset = (Number(page) - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let p = 0;

    if (search) { p++; conditions.push(`(u.username ILIKE $${p} OR u.email ILIKE $${p})`); values.push(`%${search}%`); }
    if (status) { p++; conditions.push(`u.status = $${p}`); values.push(status); }
    if (roleId) { p++; conditions.push(`EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = $${p})`); values.push(roleId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRes, usersRes] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM users u ${where}`, values),
      db.query(`
        SELECT u.id, u.username, u.email, u.status, u.created_at as "createdAt", u.updated_at as "updatedAt",
          COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL), '[]') as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        ${where}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT $${p + 1} OFFSET $${p + 2}
      `, [...values, limit, offset]),
    ]);

    sendSuccess(res, { items: usersRes.rows, total: parseInt(countRes.rows[0].count), page: Number(page), pageSize: limit });
  } catch (e) { next(e); }
};

export const getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(`
      SELECT u.id, u.username, u.email, u.status, u.created_at as "createdAt", u.updated_at as "updatedAt",
        COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL), '[]') as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [req.params.id]);
    if (!result.rows.length) throw new NotFoundError('User', req.params.id);
    sendSuccess(res, result.rows[0]);
  } catch (e) { next(e); }
};

export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, email, password, status = 'active', roleIds = [] } = req.body;
    if (!password) throw new ValidationError('Password is required');
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, status) VALUES ($1, $2, $3, $4) RETURNING id`,
      [username, email, hash, status]
    );
    const userId = result.rows[0].id;
    for (const roleId of roleIds) {
      await db.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, roleId]);
    }
    const user = await db.query(`SELECT id, username, email, status, created_at as "createdAt" FROM users WHERE id = $1`, [userId]);
    sendSuccess(res, user.rows[0], 'User created', 201);
  } catch (e) { next(e); }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { username, email, password, status, roleIds } = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    let p = 0;
    if (username) { p++; fields.push(`username = $${p}`); values.push(username); }
    if (email) { p++; fields.push(`email = $${p}`); values.push(email); }
    if (status) { p++; fields.push(`status = $${p}`); values.push(status); }
    if (password) { p++; fields.push(`password_hash = $${p}`); values.push(await bcrypt.hash(password, 10)); }
    if (fields.length) {
      p++; values.push(id);
      await db.query(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p}`, values);
    }
    if (roleIds) {
      await db.query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);
      for (const roleId of roleIds) {
        await db.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, roleId]);
      }
    }
    const user = await db.query(`SELECT id, username, email, status, created_at as "createdAt" FROM users WHERE id = $1`, [id]);
    if (!user.rows.length) throw new NotFoundError('User', id);
    sendSuccess(res, user.rows[0]);
  } catch (e) { next(e); }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(`DELETE FROM users WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!result.rows.length) throw new NotFoundError('User', req.params.id);
    sendSuccess(res, { id: req.params.id });
  } catch (e) { next(e); }
};
