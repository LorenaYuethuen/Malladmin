import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JWTService } from '../services/jwtService';
import { User } from '../types';

describe('JWT Authentication', () => {
  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    phone: null,
    roles: ['admin'],
    permissions: ['*:*'],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('JWTService', () => {
    it('should generate access token', () => {
      const token = JWTService.generateAccessToken(mockUser);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should generate refresh token', () => {
      const { token, tokenId } = JWTService.generateRefreshToken(mockUser.id);
      expect(token).toBeTruthy();
      expect(tokenId).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(typeof tokenId).toBe('string');
    });

    it('should verify valid access token', () => {
      const token = JWTService.generateAccessToken(mockUser);
      const payload = JWTService.verifyAccessToken(token);
      
      expect(payload.sub).toBe(mockUser.id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.roles).toEqual(mockUser.roles);
      expect(payload.permissions).toEqual(mockUser.permissions);
    });

    it('should verify valid refresh token', () => {
      const { token, tokenId } = JWTService.generateRefreshToken(mockUser.id);
      const payload = JWTService.verifyRefreshToken(token);
      
      expect(payload.sub).toBe(mockUser.id);
      expect(payload.tokenId).toBe(tokenId);
    });

    it('should extract token from Authorization header', () => {
      const token = 'test-token-123';
      const header = `Bearer ${token}`;
      
      const extracted = JWTService.extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    it('should return null for invalid Authorization header', () => {
      expect(JWTService.extractTokenFromHeader(undefined)).toBeNull();
      expect(JWTService.extractTokenFromHeader('InvalidFormat')).toBeNull();
      expect(JWTService.extractTokenFromHeader('Basic token')).toBeNull();
    });

    it('should get token TTL', () => {
      const token = JWTService.generateAccessToken(mockUser);
      const ttl = JWTService.getTokenTTL(token);
      
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(15 * 60); // 15 minutes
    });
  });

  describe('Token Payload', () => {
    it('should include all required fields in access token', () => {
      const token = JWTService.generateAccessToken(mockUser);
      const payload = JWTService.verifyAccessToken(token);
      
      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('email');
      expect(payload).toHaveProperty('roles');
      expect(payload).toHaveProperty('permissions');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
    });

    it('should include all required fields in refresh token', () => {
      const { token } = JWTService.generateRefreshToken(mockUser.id);
      const payload = JWTService.verifyRefreshToken(token);
      
      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('tokenId');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
    });
  });
});
