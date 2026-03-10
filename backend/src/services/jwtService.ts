import jwt, { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import config from '../config';
import { JWTPayload, RefreshTokenPayload, User } from '../types';
import { UnauthorizedError } from '../utils/errors';
import redis from '../database/redis';
import { v4 as uuidv4 } from 'uuid';

export class JWTService {
  /**
   * Generate access token for authenticated user
   */
  static generateAccessToken(user: User): string {
    const payload: any = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    };

    const options: SignOptions = {
      expiresIn: config.jwt.expiresIn as StringValue | number,
    };

    const token = jwt.sign(payload, config.jwt.secret, options);
    
    return String(token);
  }

  /**
   * Generate refresh token with unique token ID
   */
  static generateRefreshToken(userId: string): { token: string; tokenId: string } {
    const tokenId = uuidv4();
    
    const payload: any = {
      sub: userId,
      tokenId,
    };

    const options: SignOptions = {
      expiresIn: config.jwt.refreshExpiresIn as StringValue | number,
    };

    const token = jwt.sign(payload, config.jwt.refreshSecret, options);

    return { token: String(token), tokenId };
  }

  /**
   * Verify and decode access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid access token');
      }
      throw new UnauthorizedError('Token verification failed');
    }
  }

  /**
   * Verify and decode refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw new UnauthorizedError('Token verification failed');
    }
  }

  /**
   * Store refresh token in Redis with expiration
   */
  static async storeRefreshToken(
    userId: string,
    tokenId: string,
    expiresIn: number = 7 * 24 * 60 * 60 // 7 days in seconds
  ): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;
    await redis.setex(key, expiresIn, 'valid');
  }

  /**
   * Validate refresh token exists in Redis
   */
  static async validateRefreshToken(userId: string, tokenId: string): Promise<boolean> {
    const key = `refresh_token:${userId}:${tokenId}`;
    const exists = await redis.exists(key);
    return exists === 1;
  }

  /**
   * Revoke refresh token (remove from Redis)
   */
  static async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;
    await redis.del(key);
  }

  /**
   * Revoke all refresh tokens for a user
   */
  static async revokeAllRefreshTokens(userId: string): Promise<void> {
    const pattern = `refresh_token:${userId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      const client = redis.getClient();
      await client.del(keys);
    }
  }

  /**
   * Add access token to blacklist (for logout)
   */
  static async blacklistAccessToken(token: string, expiresIn: number): Promise<void> {
    const key = `blacklist:${token}`;
    await redis.setex(key, expiresIn, 'blacklisted');
  }

  /**
   * Check if access token is blacklisted
   */
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `blacklist:${token}`;
    const exists = await redis.exists(key);
    return exists === 1;
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Get remaining TTL for a token (in seconds)
   */
  static getTokenTTL(token: string): number {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) {
        return 0;
      }
      
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - now;
      return Math.max(0, ttl);
    } catch {
      return 0;
    }
  }

  /**
   * Rotate refresh token (revoke old, generate new)
   */
  static async rotateRefreshToken(
    userId: string,
    oldTokenId: string
  ): Promise<{ token: string; tokenId: string }> {
    // Revoke old token
    await this.revokeRefreshToken(userId, oldTokenId);
    
    // Generate new token
    const { token, tokenId } = this.generateRefreshToken(userId);
    
    // Store new token
    await this.storeRefreshToken(userId, tokenId);
    
    return { token, tokenId };
  }
}
