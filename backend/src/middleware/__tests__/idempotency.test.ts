import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  idempotency,
  invalidateIdempotencyKey,
  getIdempotencyRecord,
  hasIdempotencyKey,
} from '../idempotency';
import { cacheService } from '../../services/cacheService';
import { BadRequestError } from '../../utils/errors';

// Mock dependencies
vi.mock('../../services/cacheService');
vi.mock('../../utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Idempotency Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let setHeaderMock: ReturnType<typeof vi.fn>;
  let getHeaderMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup response mocks
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnThis();
    setHeaderMock = vi.fn();
    getHeaderMock = vi.fn((name: string) => {
      if (name === 'content-type') return 'application/json';
      if (name === 'x-request-id') return 'test-request-id';
      return '';
    });

    mockRequest = {
      method: 'POST',
      path: '/api/v1/orders',
      body: { productId: '123', quantity: 2 },
      query: {},
      headers: {},
    };

    mockResponse = {
      json: jsonMock,
      status: statusMock,
      setHeader: setHeaderMock,
      getHeader: getHeaderMock,
    };

    nextFunction = vi.fn();
  });

  describe('Basic Functionality', () => {
    it('should skip idempotency check for GET requests', async () => {
      mockRequest.method = 'GET';

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(cacheService.get).not.toHaveBeenCalled();
    });

    it('should skip idempotency check for DELETE requests', async () => {
      mockRequest.method = 'DELETE';

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(cacheService.get).not.toHaveBeenCalled();
    });

    it('should skip idempotency check when no key provided and not required', async () => {
      const middleware = idempotency({ required: false });
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(cacheService.get).not.toHaveBeenCalled();
    });

    it('should throw error when idempotency key is required but not provided', async () => {
      const middleware = idempotency({ required: true });
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(
        expect.any(BadRequestError)
      );
      const error = nextFunction.mock.calls[0][0] as BadRequestError;
      expect(error.message).toContain('required');
    });
  });

  describe('Idempotency Key Validation', () => {
    it('should accept valid UUID v4 idempotency key', async () => {
      mockRequest.headers = {
        'x-idempotency-key': '550e8400-e29b-41d4-a716-446655440000',
      };

      vi.mocked(cacheService.get).mockResolvedValue(null);

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(cacheService.get).toHaveBeenCalled();
    });

    it('should accept alphanumeric idempotency key with hyphens', async () => {
      mockRequest.headers = {
        'x-idempotency-key': 'order-2024-abc123-xyz789',
      };

      vi.mocked(cacheService.get).mockResolvedValue(null);

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject idempotency key that is too short', async () => {
      mockRequest.headers = {
        'x-idempotency-key': 'short',
      };

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(
        expect.any(BadRequestError)
      );
      const error = nextFunction.mock.calls[0][0] as BadRequestError;
      expect(error.message).toContain('Invalid');
    });

    it('should reject idempotency key with invalid characters', async () => {
      mockRequest.headers = {
        'x-idempotency-key': 'invalid@key#with$special%chars',
      };

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(
        expect.any(BadRequestError)
      );
    });

    it('should reject idempotency key that is too long', async () => {
      mockRequest.headers = {
        'x-idempotency-key': 'a'.repeat(129),
      };

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(
        expect.any(BadRequestError)
      );
    });
  });

  describe('First Request Processing', () => {
    it('should process first request and cache successful response', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'x-idempotency-key': idempotencyKey };

      vi.mocked(cacheService.get).mockResolvedValue(null);
      vi.mocked(cacheService.set).mockResolvedValue(true);

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringContaining(idempotencyKey)
      );

      // Simulate successful response
      const responseBody = { orderId: '123', status: 'created' };
      mockResponse.status!(200);
      mockResponse.json!(responseBody);

      // Wait for async cache operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining(idempotencyKey),
        expect.objectContaining({
          statusCode: 200,
          body: responseBody,
        }),
        86400 // Default TTL
      );
    });

    it('should not cache error responses (4xx)', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'x-idempotency-key': idempotencyKey };

      vi.mocked(cacheService.get).mockResolvedValue(null);
      vi.mocked(cacheService.set).mockResolvedValue(true);

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Simulate error response
      mockResponse.status!(400);
      mockResponse.json!({ error: 'Bad request' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should not cache server error responses (5xx)', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'x-idempotency-key': idempotencyKey };

      vi.mocked(cacheService.get).mockResolvedValue(null);
      vi.mocked(cacheService.set).mockResolvedValue(true);

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      // Simulate server error
      mockResponse.status!(500);
      mockResponse.json!({ error: 'Internal server error' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should use custom TTL when configured', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      const customTTL = 3600;
      mockRequest.headers = { 'x-idempotency-key': idempotencyKey };

      vi.mocked(cacheService.get).mockResolvedValue(null);
      vi.mocked(cacheService.set).mockResolvedValue(true);

      const middleware = idempotency({ ttl: customTTL });
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      mockResponse.status!(201);
      mockResponse.json!({ orderId: '123' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        customTTL
      );
    });
  });

  describe('Duplicate Request Detection', () => {
    it('should return cached response for duplicate request', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'x-idempotency-key': idempotencyKey };

      // Generate the expected fingerprint based on request data
      const crypto = await import('crypto');
      const fingerprintData = {
        method: mockRequest.method,
        path: mockRequest.path,
        body: mockRequest.body,
        query: mockRequest.query,
        userId: undefined,
      };
      const expectedFingerprint = crypto
        .createHash('sha256')
        .update(JSON.stringify(fingerprintData))
        .digest('hex');

      const cachedResponse = {
        fingerprint: expectedFingerprint,
        statusCode: 201,
        body: { orderId: '123', status: 'created' },
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'cached-request-id',
        },
        createdAt: new Date().toISOString(),
      };

      vi.mocked(cacheService.get).mockResolvedValue(cachedResponse);

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(cachedResponse.body);
      expect(setHeaderMock).toHaveBeenCalledWith('X-Idempotency-Replayed', 'true');
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject idempotency key reused with different request', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'x-idempotency-key': idempotencyKey };

      const cachedResponse = {
        fingerprint: 'different-fingerprint-that-wont-match',
        statusCode: 201,
        body: { orderId: '123' },
        headers: { 'content-type': 'application/json' },
        createdAt: new Date().toISOString(),
      };

      vi.mocked(cacheService.get).mockResolvedValue(cachedResponse);

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(
        expect.any(BadRequestError)
      );
      const error = nextFunction.mock.calls[0][0] as BadRequestError;
      expect(error.message).toContain('different request');
    });

    it('should set cached headers when returning cached response', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'x-idempotency-key': idempotencyKey };

      // Generate the expected fingerprint based on request data
      const crypto = await import('crypto');
      const fingerprintData = {
        method: mockRequest.method,
        path: mockRequest.path,
        body: mockRequest.body,
        query: mockRequest.query,
        userId: undefined,
      };
      const expectedFingerprint = crypto
        .createHash('sha256')
        .update(JSON.stringify(fingerprintData))
        .digest('hex');

      const cachedResponse = {
        fingerprint: expectedFingerprint,
        statusCode: 200,
        body: { data: 'test' },
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'original-request-id',
          'x-custom-header': 'custom-value',
        },
        createdAt: new Date().toISOString(),
      };

      vi.mocked(cacheService.get).mockResolvedValue(cachedResponse);

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(setHeaderMock).toHaveBeenCalledWith('content-type', 'application/json');
      expect(setHeaderMock).toHaveBeenCalledWith('x-request-id', 'original-request-id');
      expect(setHeaderMock).toHaveBeenCalledWith('x-custom-header', 'custom-value');
      expect(setHeaderMock).toHaveBeenCalledWith('X-Idempotency-Replayed', 'true');
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom header name', async () => {
      const customHeaderName = 'X-Custom-Idempotency';
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'x-custom-idempotency': idempotencyKey };

      vi.mocked(cacheService.get).mockResolvedValue(null);

      const middleware = idempotency({ headerName: customHeaderName });
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(cacheService.get).toHaveBeenCalled();
    });

    it('should apply to custom HTTP methods', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.method = 'DELETE';
      mockRequest.headers = { 'x-idempotency-key': idempotencyKey };

      vi.mocked(cacheService.get).mockResolvedValue(null);

      const middleware = idempotency({ methods: ['POST', 'DELETE'] });
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(cacheService.get).toHaveBeenCalled();
    });
  });

  describe('Helper Functions', () => {
    it('should invalidate idempotency key', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      vi.mocked(cacheService.delete).mockResolvedValue(true);

      const result = await invalidateIdempotencyKey(idempotencyKey);

      expect(result).toBe(true);
      expect(cacheService.delete).toHaveBeenCalledWith(
        expect.stringContaining(idempotencyKey)
      );
    });

    it('should get idempotency record', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      const record = {
        fingerprint: 'abc123',
        statusCode: 200,
        body: { data: 'test' },
        headers: {},
        createdAt: new Date().toISOString(),
      };

      vi.mocked(cacheService.get).mockResolvedValue(record);

      const result = await getIdempotencyRecord(idempotencyKey);

      expect(result).toEqual(record);
      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringContaining(idempotencyKey)
      );
    });

    it('should check if idempotency key exists', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      vi.mocked(cacheService.exists).mockResolvedValue(true);

      const result = await hasIdempotencyKey(idempotencyKey);

      expect(result).toBe(true);
      expect(cacheService.exists).toHaveBeenCalledWith(
        expect.stringContaining(idempotencyKey)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle cache service errors gracefully', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'x-idempotency-key': idempotencyKey };

      vi.mocked(cacheService.get).mockRejectedValue(new Error('Redis connection failed'));

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should continue processing if cache set fails', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      mockRequest.headers = { 'x-idempotency-key': idempotencyKey };

      vi.mocked(cacheService.get).mockResolvedValue(null);
      vi.mocked(cacheService.set).mockRejectedValue(new Error('Cache write failed'));

      const middleware = idempotency();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();

      // Simulate response
      mockResponse.status!(200);
      mockResponse.json!({ data: 'test' });

      // Should not throw error even if cache set fails
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });
});
