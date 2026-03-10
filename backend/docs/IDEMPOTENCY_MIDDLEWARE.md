# Idempotency Middleware

## Overview

The idempotency middleware prevents duplicate processing of requests by caching responses based on idempotency keys. This is crucial for ensuring that critical operations (like payment processing, order creation, etc.) are not accidentally executed multiple times due to network issues, client retries, or user actions.

## Features

- **Automatic Duplicate Detection**: Identifies and prevents duplicate requests using idempotency keys
- **Response Caching**: Stores successful responses (2xx status codes) in Redis
- **Request Fingerprinting**: Validates that the same idempotency key is not reused with different request data
- **Configurable TTL**: Customizable time-to-live for idempotency records (default: 24 hours)
- **Flexible Configuration**: Apply to specific HTTP methods, use custom headers, and make keys optional or required
- **Error Resilience**: Gracefully handles cache failures without blocking requests

## Installation

The middleware is already integrated into the backend. It uses:
- Redis for storing idempotency records
- CacheService for Redis operations
- Express middleware pattern

## Usage

### Basic Usage

Apply to specific routes:

```typescript
import { idempotency } from './middleware/idempotency';
import express from 'express';

const router = express.Router();

// Apply to order creation endpoint
router.post('/api/v1/orders', idempotency(), createOrder);

// Apply to payment processing endpoint
router.post('/api/v1/payments', idempotency(), processPayment);
```

### Global Application

Apply to all state-changing methods globally:

```typescript
import { idempotency } from './middleware/idempotency';
import express from 'express';

const app = express();

// Apply globally - will only affect POST, PUT, PATCH by default
app.use(idempotency());
```

### Custom Configuration

```typescript
// Require idempotency key for critical operations
router.post('/api/v1/payments', 
  idempotency({ 
    required: true,  // Idempotency key is mandatory
    ttl: 3600        // Cache for 1 hour instead of 24 hours
  }), 
  processPayment
);

// Use custom header name
router.post('/api/v1/orders', 
  idempotency({ 
    headerName: 'X-Request-ID'
  }), 
  createOrder
);

// Apply to additional HTTP methods
router.delete('/api/v1/resources/:id', 
  idempotency({ 
    methods: ['POST', 'PUT', 'PATCH', 'DELETE']
  }), 
  deleteResource
);
```

## Client Usage

### Making Idempotent Requests

Clients should generate a unique idempotency key (UUID recommended) and include it in the request header:

```javascript
// JavaScript/TypeScript client example
import { v4 as uuidv4 } from 'uuid';

const idempotencyKey = uuidv4(); // e.g., '550e8400-e29b-41d4-a716-446655440000'

const response = await fetch('https://api.example.com/api/v1/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify({
    productId: '123',
    quantity: 2,
  }),
});
```

### Handling Responses

```javascript
// First request - processes normally
const response1 = await createOrder(idempotencyKey, orderData);
console.log(response1.status); // 201 Created

// Duplicate request with same key - returns cached response
const response2 = await createOrder(idempotencyKey, orderData);
console.log(response2.status); // 201 Created
console.log(response2.headers.get('X-Idempotency-Replayed')); // 'true'
```

### Retry Logic

```javascript
async function createOrderWithRetry(orderData, maxRetries = 3) {
  const idempotencyKey = uuidv4();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(orderData),
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }
      
      // Retry on server errors (5xx) or network issues
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      throw new Error(`Failed after ${maxRetries} attempts`);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttl` | number | 86400 (24 hours) | Time-to-live for idempotency records in seconds |
| `methods` | string[] | ['POST', 'PUT', 'PATCH'] | HTTP methods to apply idempotency to |
| `headerName` | string | 'X-Idempotency-Key' | Header name for idempotency key |
| `required` | boolean | false | Whether idempotency key is mandatory |

## Idempotency Key Format

Valid idempotency keys must:
- Be 16-128 characters long
- Contain only alphanumeric characters, hyphens, and underscores
- Be unique for each distinct operation

Recommended formats:
- UUID v4: `550e8400-e29b-41d4-a716-446655440000`
- Custom format: `order-2024-01-15-abc123xyz`

## Behavior

### First Request

1. Client sends request with idempotency key
2. Middleware checks if key exists in cache
3. Key not found - request proceeds normally
4. Response is generated (e.g., order created)
5. If response is successful (2xx), it's cached with the idempotency key
6. Response is returned to client

### Duplicate Request (Same Key, Same Data)

1. Client sends request with same idempotency key
2. Middleware finds cached response
3. Validates request fingerprint matches cached fingerprint
4. Returns cached response immediately without processing
5. Adds `X-Idempotency-Replayed: true` header

### Duplicate Key with Different Data

1. Client sends request with same idempotency key but different data
2. Middleware finds cached response
3. Validates request fingerprint - **mismatch detected**
4. Returns 400 Bad Request error
5. Error message: "Idempotency key has been used with a different request"

### Error Responses

- Only successful responses (2xx status codes) are cached
- Error responses (4xx, 5xx) are not cached
- This allows clients to retry failed requests with the same idempotency key

## Request Fingerprinting

The middleware generates a fingerprint for each request based on:
- HTTP method
- Request path
- Request body
- Query parameters
- User ID (if authenticated)

This ensures that the same idempotency key cannot be reused for different operations.

## Helper Functions

### Invalidate Idempotency Key

Manually invalidate an idempotency key (useful for testing or cleanup):

```typescript
import { invalidateIdempotencyKey } from './middleware/idempotency';

await invalidateIdempotencyKey('550e8400-e29b-41d4-a716-446655440000');
```

### Get Idempotency Record

Retrieve an idempotency record for debugging:

```typescript
import { getIdempotencyRecord } from './middleware/idempotency';

const record = await getIdempotencyRecord('550e8400-e29b-41d4-a716-446655440000');
console.log(record);
// {
//   fingerprint: 'abc123...',
//   statusCode: 201,
//   body: { orderId: '123', status: 'created' },
//   headers: { 'content-type': 'application/json' },
//   createdAt: '2024-01-15T10:30:00Z'
// }
```

### Check if Key Exists

Check if an idempotency key exists in cache:

```typescript
import { hasIdempotencyKey } from './middleware/idempotency';

const exists = await hasIdempotencyKey('550e8400-e29b-41d4-a716-446655440000');
console.log(exists); // true or false
```

## Best Practices

### 1. Use for Critical Operations

Apply idempotency middleware to operations that should not be executed multiple times:
- Payment processing
- Order creation
- Account creation
- Money transfers
- Inventory updates

### 2. Generate Keys Client-Side

Always generate idempotency keys on the client side before making requests. This ensures the same key is used for retries.

### 3. Store Keys for Retries

Store the idempotency key with the operation context so retries use the same key:

```typescript
// Store key with operation
const operation = {
  idempotencyKey: uuidv4(),
  orderData: { productId: '123', quantity: 2 },
};

// Use same key for retries
await createOrder(operation.idempotencyKey, operation.orderData);
```

### 4. Set Appropriate TTL

Choose TTL based on your use case:
- Short-lived operations (e.g., API rate limiting): 15 minutes
- Standard operations (e.g., order creation): 24 hours
- Long-lived operations (e.g., batch processing): 7 days

### 5. Handle Replayed Responses

Check for the `X-Idempotency-Replayed` header to know if a response was cached:

```typescript
if (response.headers.get('X-Idempotency-Replayed') === 'true') {
  console.log('This is a cached response from a previous request');
}
```

### 6. Don't Reuse Keys

Never reuse an idempotency key for different operations. Each unique operation should have its own unique key.

## Error Handling

### Cache Failures

If Redis is unavailable:
- GET operations: Request proceeds without idempotency check
- SET operations: Request completes successfully, but response is not cached

This ensures the system remains available even if caching fails.

### Validation Errors

- Missing required key: 400 Bad Request
- Invalid key format: 400 Bad Request
- Key reused with different data: 400 Bad Request

## Monitoring

Monitor idempotency middleware performance:

```typescript
// Cache statistics
import { cacheService } from './services/cacheService';

const stats = cacheService.getStats();
console.log(stats);
// {
//   hits: 150,
//   misses: 50,
//   sets: 50,
//   deletes: 10,
//   errors: 0,
//   hitRate: 0.75
// }
```

## Testing

The middleware includes comprehensive unit tests covering:
- Basic functionality (method filtering, optional/required keys)
- Key validation (format, length)
- First request processing (caching successful responses)
- Duplicate request detection (returning cached responses)
- Custom configuration (headers, methods, TTL)
- Helper functions (invalidate, get, exists)
- Error handling (cache failures, validation errors)

Run tests:

```bash
npm test -- idempotency.test.ts
```

## Security Considerations

1. **User Isolation**: Request fingerprints include user ID to prevent cross-user replay attacks
2. **Key Validation**: Strict format validation prevents injection attacks
3. **TTL Limits**: Automatic expiration prevents indefinite storage
4. **Fingerprint Validation**: Prevents key reuse with different data

## Related Documentation

- [Cache Service Documentation](./CACHE_SERVICE.md)
- [Redis Configuration](../src/database/redis.ts)
- [API Response Format](./API_RESPONSE_FORMAT.md)

## Requirements Satisfied

This implementation satisfies the following requirements from the Mall Admin Integration spec:

- **Requirement 7.6**: API Service SHALL implement request caching where appropriate for performance optimization
- **Requirement 14.2**: Payment Integration SHALL handle secure payment gateway communication (idempotency prevents duplicate payments)
