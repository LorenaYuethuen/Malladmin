import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { sendSuccess } from '../utils/response';
import { NotFoundError } from '../utils/errors';

export const listMenus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(
      `SELECT id, name, path, icon, parent_id as "parentId", sort_order as "sortOrder",
        permission_key as "permissionKey", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
       FROM menus ORDER BY sort_order ASC, created_at ASC`
    );
    sendSuccess(res, result.rows);
  } catch (e) { next(e); }
};

export const getMenuTree = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(
      `SELECT id, name, path, icon, parent_id as "parentId", sort_order as "sortOrder",
        permission_key as "permissionKey", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
       FROM menus ORDER BY sort_order ASC, created_at ASC`
    );
    const items = result.rows;
    const map = new Map(items.map((m: any) => [m.id, { ...m, children: [] }]));
    const roots: any[] = [];
    for (const item of map.values()) {
      if (item.parentId) {
        const parent = map.get(item.parentId);
        if (parent) parent.children.push(item);
        else roots.push(item);
      } else {
        roots.push(item);
      }
    }
    sendSuccess(res, roots);
  } catch (e) { next(e); }
};

export const createMenu = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, path, icon, parentId, sortOrder = 0, permissionKey, isActive = true } = req.body;
    const result = await db.query(
      `INSERT INTO menus (name, path, icon, parent_id, sort_order, permission_key, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [name, path || null, icon || null, parentId || null, sortOrder, permissionKey || null, isActive]
    );
    const menu = await db.query(
      `SELECT id, name, path, icon, parent_id as "parentId", sort_order as "sortOrder",
        permission_key as "permissionKey", is_active as "isActive", created_at as "createdAt"
       FROM menus WHERE id = $1`,
      [result.rows[0].id]
    );
    sendSuccess(res, menu.rows[0], 'Menu created', 201);
  } catch (e) { next(e); }
};

export const updateMenu = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, path, icon, parentId, sortOrder, permissionKey, isActive } = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    let p = 0;
    if (name !== undefined) { p++; fields.push(`name = $${p}`); values.push(name); }
    if (path !== undefined) { p++; fields.push(`path = $${p}`); values.push(path || null); }
    if (icon !== undefined) { p++; fields.push(`icon = $${p}`); values.push(icon || null); }
    if (parentId !== undefined) { p++; fields.push(`parent_id = $${p}`); values.push(parentId || null); }
    if (sortOrder !== undefined) { p++; fields.push(`sort_order = $${p}`); values.push(sortOrder); }
    if (permissionKey !== undefined) { p++; fields.push(`permission_key = $${p}`); values.push(permissionKey || null); }
    if (isActive !== undefined) { p++; fields.push(`is_active = $${p}`); values.push(isActive); }
    if (!fields.length) { sendSuccess(res, { id }); return; }
    p++; values.push(id);
    await db.query(`UPDATE menus SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p}`, values);
    const menu = await db.query(
      `SELECT id, name, path, icon, parent_id as "parentId", sort_order as "sortOrder",
        permission_key as "permissionKey", is_active as "isActive", updated_at as "updatedAt"
       FROM menus WHERE id = $1`,
      [id]
    );
    if (!menu.rows.length) throw new NotFoundError('Menu', id);
    sendSuccess(res, menu.rows[0]);
  } catch (e) { next(e); }
};

export const deleteMenu = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(`DELETE FROM menus WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!result.rows.length) throw new NotFoundError('Menu', req.params.id);
    sendSuccess(res, { id: req.params.id });
  } catch (e) { next(e); }
};
