import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../database/connection';
import { JWTService } from '../services/jwtService';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { successResponse } from '../utils/response';
import { AuthRequest, User } from '../types';
import logger from '../utils/logger';

/**
 * Login endpoint - authenticate user and return tokens
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    // Validate input - accept either username or email
    const identifier = username || email;
    if (!identifier || !password) {
      throw new ValidationError('Username/email and password are required');
    }

    // Find user by username or email
    const userResult = await db.query(
      `SELECT u.id, u.username, u.email, u.phone, u.password_hash, u.status, 
              u.created_at, u.updated_at,
              COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') as roles,
              COALESCE(array_agg(DISTINCT p.resource || ':' || array_to_string(p.actions, ',')) 
                FILTER (WHERE p.resource IS NOT NULL), '{}') as permissions
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE (u.username = $1 OR u.email = $1)
       GROUP BY u.id`,
      [identifier]
    );

    if (userResult.rows.length === 0) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const userRow = userResult.rows[0];

    // Check if user is active
    if (userRow.status !== 'active') {
      throw new UnauthorizedError('Account is not active');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, userRow.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Create user object
    const user: User = {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      phone: userRow.phone,
      roles: userRow.roles,
      permissions: userRow.permissions,
      status: userRow.status,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
    };

    // Generate tokens
    const accessToken = JWTService.generateAccessToken(user);
    const { token: refreshToken, tokenId } = JWTService.generateRefreshToken(user.id);

    // Store refresh token in Redis
    await JWTService.storeRefreshToken(user.id, tokenId);

    // Update last login timestamp
    await db.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info('User logged in successfully', {
      userId: user.id,
      username: user.username,
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return tokens and user info (simplified response format)
    res.json(
      successResponse({
        token: accessToken,  // For compatibility with frontend
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          roles: user.roles,
          permissions: user.permissions,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        expiresIn: 86400, // 24 hours in seconds
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh token endpoint - generate new access token
 */
export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Accept token from body OR httpOnly cookie
    const refreshToken: string | undefined = req.body?.refreshToken ?? req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    // Verify refresh token
    const payload = JWTService.verifyRefreshToken(refreshToken);

    // Validate token exists in Redis
    const isValid = await JWTService.validateRefreshToken(payload.sub, payload.tokenId);
    if (!isValid) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Fetch user from database
    const userResult = await db.query(
      `SELECT u.id, u.username, u.email, u.phone, u.status, 
              u.created_at, u.updated_at,
              COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') as roles,
              COALESCE(array_agg(DISTINCT p.resource || ':' || array_to_string(p.actions, ',')) 
                FILTER (WHERE p.resource IS NOT NULL), '{}') as permissions
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE u.id = $1 AND u.status = 'active'
       GROUP BY u.id`,
      [payload.sub]
    );

    if (userResult.rows.length === 0) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const userRow = userResult.rows[0];

    const user: User = {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      phone: userRow.phone,
      roles: userRow.roles,
      permissions: userRow.permissions,
      status: userRow.status,
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
    };

    // Generate new access token
    const accessToken = JWTService.generateAccessToken(user);

    // Rotate refresh token (optional but recommended for security)
    const { token: newRefreshToken, tokenId: newTokenId } = 
      await JWTService.rotateRefreshToken(payload.sub, payload.tokenId);

    logger.info('Token refreshed successfully', {
      userId: user.id,
    });

    // Set rotated refresh token as httpOnly cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json(
      successResponse({
        accessToken,
        refreshToken: newRefreshToken,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Logout endpoint - revoke tokens
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const refreshToken = req.body?.refreshToken ?? req.cookies?.refreshToken;

    if (!authReq.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Extract access token from header
    const accessToken = JWTService.extractTokenFromHeader(req.headers.authorization);
    
    if (accessToken) {
      // Blacklist access token
      const ttl = JWTService.getTokenTTL(accessToken);
      if (ttl > 0) {
        await JWTService.blacklistAccessToken(accessToken, ttl);
      }
    }

    // Revoke refresh token if provided
    if (refreshToken) {
      try {
        const payload = JWTService.verifyRefreshToken(refreshToken);
        await JWTService.revokeRefreshToken(payload.sub, payload.tokenId);
      } catch (error) {
        // Ignore errors for invalid refresh tokens during logout
        logger.warn('Invalid refresh token during logout', { error });
      }
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });

    logger.info('User logged out successfully', {
      userId: authReq.user.id,
    });

    res.json(
      successResponse({
        message: 'Logged out successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Logout from all devices - revoke all refresh tokens
 */
export const logoutAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Revoke all refresh tokens for the user
    await JWTService.revokeAllRefreshTokens(authReq.user.id);

    // Blacklist current access token
    const accessToken = JWTService.extractTokenFromHeader(req.headers.authorization);
    if (accessToken) {
      const ttl = JWTService.getTokenTTL(accessToken);
      if (ttl > 0) {
        await JWTService.blacklistAccessToken(accessToken, ttl);
      }
    }

    logger.info('User logged out from all devices', {
      userId: authReq.user.id,
    });

    res.json(
      successResponse({
        message: 'Logged out from all devices successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user info
 */
export const me = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      throw new UnauthorizedError('Authentication required');
    }

    res.json(
      successResponse({
        user: {
          id: authReq.user.id,
          username: authReq.user.username,
          email: authReq.user.email,
          phone: authReq.user.phone,
          roles: authReq.user.roles,
          permissions: authReq.user.permissions,
          status: authReq.user.status,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
