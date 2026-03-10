import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/jwtService';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { AuthRequest, User } from '../types';
import { db } from '../database/connection';

/**
 * Authentication middleware - validates JWT token
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const token = JWTService.extractTokenFromHeader(req.headers.authorization);

    // In development mode, only fall back to dev admin when NO token is provided
    if (process.env.NODE_ENV === 'development' && !token) {
      // Look up the actual admin user from the database
      const devResult = await db.query(
        `SELECT u.id, u.username, u.email, u.phone, u.status, u.created_at, u.updated_at
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.name = 'admin' AND u.status = 'active'
         LIMIT 1`
      );

      if (devResult.rows.length > 0) {
        const row = devResult.rows[0];
        (req as AuthRequest).user = {
          id: row.id,
          username: row.username,
          email: row.email,
          phone: row.phone,
          roles: ['admin'],
          permissions: ['*:*'],
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      } else {
        (req as AuthRequest).user = {
          id: '00000000-0000-0000-0000-000000000000',
          username: 'dev-user',
          email: 'dev@example.com',
          phone: null,
          roles: ['admin'],
          permissions: ['*:*'],
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return next();
    }
    
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    // Check if token is blacklisted
    const isBlacklisted = await JWTService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }

    // Verify token
    const payload = JWTService.verifyAccessToken(token);

    // Fetch user from database to ensure they still exist and are active
    const result = await db.query(
      `SELECT id, username, email, phone, status, created_at, updated_at
       FROM users 
       WHERE id = $1 AND status = 'active'`,
      [payload.sub]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Attach user to request
    const user: User = {
      id: result.rows[0].id,
      username: result.rows[0].username,
      email: result.rows[0].email,
      phone: result.rows[0].phone,
      roles: payload.roles,
      permissions: payload.permissions,
      status: result.rows[0].status,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at,
    };

    (req as AuthRequest).user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = JWTService.extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      return next();
    }

    // Check if token is blacklisted
    const isBlacklisted = await JWTService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return next();
    }

    // Verify token
    const payload = JWTService.verifyAccessToken(token);

    // Fetch user from database
    const result = await db.query(
      `SELECT id, username, email, phone, status, created_at, updated_at
       FROM users 
       WHERE id = $1 AND status = 'active'`,
      [payload.sub]
    );

    if (result.rows.length > 0) {
      const user: User = {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        phone: result.rows[0].phone,
        roles: payload.roles,
        permissions: payload.permissions,
        status: result.rows[0].status,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      };

      (req as AuthRequest).user = user;
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const hasRole = roles.some(role => authReq.user!.roles.includes(role));
    
    if (!hasRole) {
      return next(
        new ForbiddenError(
          `Access denied. Required roles: ${roles.join(', ')}`
        )
      );
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (resource: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // Check if user has the required permission
    const hasPermission = authReq.user.permissions.some(permission => {
      const [permResource, permActions] = permission.split(':');
      const actions = permActions ? permActions.split(',') : [];
      
      return (
        (permResource === resource || permResource === '*') &&
        (actions.includes(action) || actions.includes('*'))
      );
    });

    if (!hasPermission) {
      return next(
        new ForbiddenError(
          `Access denied. Required permission: ${resource}:${action}`
        )
      );
    }

    next();
  };
};

/**
 * Check if user has any of the specified permissions
 */
export const requireAnyPermission = (...permissions: Array<{ resource: string; action: string }>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const hasAnyPermission = permissions.some(({ resource, action }) => {
      return authReq.user!.permissions.some(permission => {
        const [permResource, permActions] = permission.split(':');
        const actions = permActions ? permActions.split(',') : [];
        
        return (
          (permResource === resource || permResource === '*') &&
          (actions.includes(action) || actions.includes('*'))
        );
      });
    });

    if (!hasAnyPermission) {
      return next(
        new ForbiddenError('Access denied. Insufficient permissions')
      );
    }

    next();
  };
};
