import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';
import { sendSuccess } from '../utils/response';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { AuthRequest } from '../types';

/** GET /reviews?productId=&page=&pageSize=&sort=&rating= */
export const listReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, page = 1, pageSize = 10, sort = 'newest', rating, userId } = req.query;
    const limit = Math.min(Number(pageSize), 50);
    const offset = (Number(page) - 1) * limit;

    const conditions: string[] = ['r.is_deleted = false'];
    const values: any[] = [];
    let p = 0;

    if (productId) { p++; conditions.push(`r.product_id = $${p}`); values.push(productId); }
    if (userId) { p++; conditions.push(`r.user_id = $${p}`); values.push(userId); }
    if (rating) { p++; conditions.push(`r.rating = $${p}`); values.push(Number(rating)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'r.created_at DESC';
    if (sort === 'oldest') orderBy = 'r.created_at ASC';
    else if (sort === 'highest') orderBy = 'r.rating DESC, r.created_at DESC';
    else if (sort === 'lowest') orderBy = 'r.rating ASC, r.created_at DESC';

    const countQ = `SELECT COUNT(*) FROM reviews r ${where}`;
    const listQ = `
      SELECT r.id, r.product_id as "productId", r.user_id as "userId", r.rating, r.content,
             r.status, r.created_at as "createdAt", r.updated_at as "updatedAt",
             u.username, prod.name as "productName",
             COALESCE(json_agg(json_build_object('id', ri.id, 'imageUrl', ri.image_url, 'sortOrder', ri.sort_order))
               FILTER (WHERE ri.id IS NOT NULL), '[]') as images,
             COALESCE(SUM(CASE WHEN rv.vote_type = 'useful' THEN 1 ELSE 0 END), 0)::int as "usefulCount",
             COALESCE(SUM(CASE WHEN rv.vote_type = 'not_useful' THEN 1 ELSE 0 END), 0)::int as "notUsefulCount"
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN products prod ON r.product_id = prod.id
      LEFT JOIN review_images ri ON r.id = ri.review_id
      LEFT JOIN review_votes rv ON r.id = rv.review_id
      ${where}
      GROUP BY r.id, u.username, prod.name
      ORDER BY ${orderBy}
      LIMIT $${p + 1} OFFSET $${p + 2}`;

    const [countRes, listRes] = await Promise.all([
      db.query(countQ, values),
      db.query(listQ, [...values, limit, offset]),
    ]);

    // Mask usernames: show first char + ***
    const items = listRes.rows.map((r: any) => ({
      ...r,
      username: r.username ? r.username[0] + '***' : '鍖垮悕',
    }));

    sendSuccess(res, { items, total: parseInt(countRes.rows[0].count), page: Number(page), pageSize: limit });
  } catch (e) { next(e); }
};

/** GET /reviews/:id */
export const getReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(`
      SELECT r.id, r.product_id as "productId", r.user_id as "userId", r.rating, r.content,
             r.status, r.created_at as "createdAt", r.updated_at as "updatedAt",
             u.username, prod.name as "productName",
             COALESCE(json_agg(json_build_object('id', ri.id, 'imageUrl', ri.image_url, 'sortOrder', ri.sort_order))
               FILTER (WHERE ri.id IS NOT NULL), '[]') as images,
             COALESCE(SUM(CASE WHEN rv.vote_type = 'useful' THEN 1 ELSE 0 END), 0)::int as "usefulCount",
             COALESCE(SUM(CASE WHEN rv.vote_type = 'not_useful' THEN 1 ELSE 0 END), 0)::int as "notUsefulCount"
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN products prod ON r.product_id = prod.id
      LEFT JOIN review_images ri ON r.id = ri.review_id
      LEFT JOIN review_votes rv ON r.id = rv.review_id
      WHERE r.id = $1 AND r.is_deleted = false
      GROUP BY r.id, u.username, prod.name
    `, [req.params.id]);
    if (!result.rows.length) throw new NotFoundError('Review', req.params.id);
    sendSuccess(res, result.rows[0]);
  } catch (e) { next(e); }
};

/** POST /reviews */
export const createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const { productId, rating, content, images = [] } = req.body;

    if (!productId) throw new ValidationError('productId is required');
    if (!rating || rating < 1 || rating > 5) throw new ValidationError('Rating must be between 1 and 5');
    if (!content || content.length < 10 || content.length > 500) throw new ValidationError('Content must be 10-500 characters');
    if (images.length > 5) throw new ValidationError('Maximum 5 images allowed');

    // Check duplicate review
    const existing = await db.query(
      'SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2 AND is_deleted = false',
      [productId, userId]
    );
    if (existing.rows.length > 0) throw new ValidationError('You have already reviewed this product');

    // Insert review
    const result = await db.query(
      `INSERT INTO reviews (product_id, user_id, rating, content) VALUES ($1, $2, $3, $4) RETURNING id`,
      [productId, userId, rating, content]
    );
    const reviewId = result.rows[0].id;

    // Insert images
    for (let i = 0; i < images.length; i++) {
      await db.query(
        'INSERT INTO review_images (review_id, image_url, sort_order) VALUES ($1, $2, $3)',
        [reviewId, images[i], i]
      );
    }

    // Update product rating stats
    await db.query(`
      UPDATE products SET
        review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1 AND is_deleted = false),
        rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1 AND is_deleted = false AND status = 'approved'),
        rating_average = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE product_id = $1 AND is_deleted = false AND status = 'approved'), 0)
      WHERE id = $1
    `, [productId]);

    const review = await db.query(
      `SELECT id, product_id as "productId", user_id as "userId", rating, content, status, created_at as "createdAt" FROM reviews WHERE id = $1`,
      [reviewId]
    );
    sendSuccess(res, review.rows[0], 'Review created', 201);
  } catch (e) { next(e); }
};

/** PUT /reviews/:id */
export const updateReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const { id } = req.params;
    const { rating, content, status } = req.body;

    // Check ownership (admin can update status)
    const existing = await db.query('SELECT user_id, created_at FROM reviews WHERE id = $1 AND is_deleted = false', [id]);
    if (!existing.rows.length) throw new NotFoundError('Review', id);

    const isAdmin = authReq.user!.permissions.some((p: string) => p === '*:*');
    const isOwner = existing.rows[0].user_id === userId;

    if (!isOwner && !isAdmin) throw new ForbiddenError('You can only edit your own reviews');

    // 24-hour edit window for non-admin
    if (isOwner && !isAdmin) {
      const createdAt = new Date(existing.rows[0].created_at);
      const hoursSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince > 24) throw new ForbiddenError('Reviews can only be edited within 24 hours');
    }

    const fields: string[] = [];
    const values: any[] = [];
    let p = 0;

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) throw new ValidationError('Rating must be between 1 and 5');
      p++; fields.push(`rating = $${p}`); values.push(rating);
    }
    if (content !== undefined) {
      if (content.length < 10 || content.length > 500) throw new ValidationError('Content must be 10-500 characters');
      p++; fields.push(`content = $${p}`); values.push(content);
    }
    if (status !== undefined && isAdmin) {
      p++; fields.push(`status = $${p}`); values.push(status);
    }

    if (fields.length) {
      p++; values.push(id);
      await db.query(`UPDATE reviews SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p}`, values);
    }

    const review = await db.query(
      `SELECT id, product_id as "productId", user_id as "userId", rating, content, status, updated_at as "updatedAt" FROM reviews WHERE id = $1`,
      [id]
    );
    sendSuccess(res, review.rows[0]);
  } catch (e) { next(e); }
};

/** DELETE /reviews/:id */
export const deleteReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const { id } = req.params;

    const existing = await db.query('SELECT user_id, product_id FROM reviews WHERE id = $1 AND is_deleted = false', [id]);
    if (!existing.rows.length) throw new NotFoundError('Review', id);

    const isAdmin = authReq.user!.permissions.some((p: string) => p === '*:*');
    if (existing.rows[0].user_id !== userId && !isAdmin) {
      throw new ForbiddenError('You can only delete your own reviews');
    }

    // Soft delete
    await db.query('UPDATE reviews SET is_deleted = true, deleted_at = NOW() WHERE id = $1', [id]);

    // Update product rating stats
    const deletedProductId = existing.rows[0].product_id;
    await db.query(`
      UPDATE products SET
        review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1 AND is_deleted = false),
        rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1 AND is_deleted = false AND status = 'approved'),
        rating_average = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE product_id = $1 AND is_deleted = false AND status = 'approved'), 0)
      WHERE id = $1
    `, [deletedProductId]);
    sendSuccess(res, { id });
  } catch (e) { next(e); }
};

/** POST /reviews/:id/vote */
export const voteReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const { id } = req.params;
    const { voteType } = req.body;

    if (!['useful', 'not_useful'].includes(voteType)) throw new ValidationError('voteType must be useful or not_useful');

    // Check review exists
    const review = await db.query('SELECT id FROM reviews WHERE id = $1 AND is_deleted = false', [id]);
    if (!review.rows.length) throw new NotFoundError('Review', id);

    // Upsert vote
    await db.query(
      `INSERT INTO review_votes (review_id, user_id, vote_type) VALUES ($1, $2, $3)
       ON CONFLICT (review_id, user_id) DO UPDATE SET vote_type = $3`,
      [id, userId, voteType]
    );

    // Return updated counts
    const counts = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN vote_type = 'useful' THEN 1 ELSE 0 END), 0)::int as "usefulCount",
        COALESCE(SUM(CASE WHEN vote_type = 'not_useful' THEN 1 ELSE 0 END), 0)::int as "notUsefulCount"
      FROM review_votes WHERE review_id = $1
    `, [id]);

    sendSuccess(res, counts.rows[0]);
  } catch (e) { next(e); }
};

/** GET /reviews/stats?productId= */
export const getReviewStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId } = req.query;
    if (!productId) throw new ValidationError('productId is required');

    const result = await db.query(`
      SELECT
        COUNT(*)::int as "totalReviews",
        COALESCE(ROUND(AVG(rating)::numeric, 1), 0) as "averageRating",
        COALESCE(SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END), 0)::int as "star5",
        COALESCE(SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END), 0)::int as "star4",
        COALESCE(SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END), 0)::int as "star3",
        COALESCE(SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END), 0)::int as "star2",
        COALESCE(SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END), 0)::int as "star1"
      FROM reviews WHERE product_id = $1 AND is_deleted = false AND status = 'approved'
    `, [productId]);

    sendSuccess(res, result.rows[0]);
  } catch (e) { next(e); }
};
