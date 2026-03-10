# CSRF Protection Implementation

## Overview

This document describes the CSRF (Cross-Site Request Forgery) protection implementation for the Mall Admin Integration platform. The implementation uses the **double-submit cookie pattern** with cryptographically secure tokens.

## Architecture

### Double-Submit Cookie Pattern

The CSRF protection uses the double-submit cookie pattern:

1. **Token Generation**: Server generates a cryptographically secure random token
2. **Cookie Storage**: Token is stored in an HTTP-only, secure cookie
3. **Client Inclusion**: Client must include the same token in a custom header
4. **Server Validation**: Server validates that cookie token matches header token

This pattern is effective because:
- Attackers cannot read cookies from other domains (Same-Origin Policy)
- Attackers cannot set custom headers in cross-origin requests
- The token is cryptographically secure (32 bytes of random data)

### Security Features

1. **Cryptographically Secure Tokens**: Uses `crypto.randomBytes()` for token generation
2. **Timing-Safe Comparison**: Uses `crypto.timingSafeEqual()` to prevent timing attacks
3. **Token Rotation**: Tokens are rotated on authentication state changes (login/logout)
4. **HTTP-Only Cookies**: Prevents XSS attacks from stealing tokens
5. **Secure Flag**: Cookies are marked secure in production (HTTPS only)
6. **SameSite Strict**: Prevents cookies from being sent in cross-site requests

## Usage

### 1. Getting a CSRF Token

Clients must first obtain a CSRF token before making state-changing requests:

```typescript
// GET /api/csrf-token
const response = await fetch('/api/csrf-token', {
  credentials: 'include', // Important: include cookies
});

const { csrfToken } = await response.json();
```

The server will:
- Generate a new token if none exists
- Set the token in an HTTP-only cookie
- Return the token in the response body

### 2. Including CSRF Token in Requests

For all state-changing requests (POST, PUT, PATCH, DELETE), include the token in the `X-CSRF-Token` header:

```typescript
// Example: Creating a product
const response = await fetch('/api/v1/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken, // Include the token
  },
  credentials: 'include', // Important: include cookies
  body: JSON.stringify(productData),
});
```

### 3. Applying CSRF Protection to Routes

#### Option A: Protect All State-Changing Routes

Apply CSRF validation globally to all routes:

```typescript
import { validateCsrfToken } from './middleware/csrf';

// Apply to all routes
app.use('/api', validateCsrfToken);
```

#### Option B: Protect Specific Routes

Apply CSRF protection to specific routes:

```typescript
import { csrfProtection } from './middleware/csrf';

// Protect specific route
router.post('/api/v1/products', csrfProtection, createProduct);
router.put('/api/v1/products/:id', csrfProtection, updateProduct);
router.delete('/api/v1/products/:id', csrfProtection, deleteProduct);
```

#### Option C: Conditional Protection

Skip CSRF validation for specific routes (e.g., API endpoints with other auth):

```typescript
import { skipCsrfValidation, conditionalCsrfValidation } from './middleware/csrf';

// Skip CSRF for webhook endpoints
router.post('/api/webhooks/payment', skipCsrfValidation, handlePaymentWebhook);

// Apply conditional validation globally
app.use('/api', conditionalCsrfValidation);
```

### 4. Frontend Integration

#### React/TypeScript Example

```typescript
// api/client.ts
class ApiClient {
  private csrfToken: string | null = null;

  async initialize() {
    // Fetch CSRF token on app initialization
    const response = await fetch('/api/csrf-token', {
      credentials: 'include',
    });
    const data = await response.json();
    this.csrfToken = data.csrfToken;
  }

  async post<T>(url: string, data: any): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken || '',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (response.status === 403) {
      // CSRF token might be expired, refresh it
      await this.initialize();
      // Retry the request
      return this.post(url, data);
    }

    return response.json();
  }

  // Similar methods for PUT, PATCH, DELETE...
}

export const apiClient = new ApiClient();
```

#### Axios Example

```typescript
import axios from 'axios';

// Fetch CSRF token
const { data } = await axios.get('/api/csrf-token');
const csrfToken = data.csrfToken;

// Configure axios to include CSRF token in all requests
axios.defaults.headers.common['X-CSRF-Token'] = csrfToken;
axios.defaults.withCredentials = true;

// Add response interceptor to handle CSRF token expiration
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 && error.response?.data?.error?.code === 'CSRF_TOKEN_MISMATCH') {
      // Refresh CSRF token
      const { data } = await axios.get('/api/csrf-token');
      axios.defaults.headers.common['X-CSRF-Token'] = data.csrfToken;
      
      // Retry original request
      return axios.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

## Configuration

CSRF protection can be configured via environment variables:

```env
# Enable/disable CSRF protection (default: true)
CSRF_ENABLED=true

# Cookie name for CSRF token (default: csrf-token)
CSRF_COOKIE_NAME=csrf-token

# Header name for CSRF token (default: x-csrf-token)
CSRF_HEADER_NAME=x-csrf-token

# Token length in bytes (default: 32)
CSRF_TOKEN_LENGTH=32
```

## Token Lifecycle

### Token Generation
- Tokens are generated using `crypto.randomBytes(32)` (256 bits of entropy)
- Tokens are hex-encoded (64 characters)
- Each token is unique and unpredictable

### Token Storage
- Tokens are stored in HTTP-only cookies (cannot be accessed by JavaScript)
- Cookies have `SameSite=Strict` to prevent cross-site transmission
- Cookies are marked `Secure` in production (HTTPS only)
- Cookie lifetime: 24 hours

### Token Rotation
Tokens are automatically rotated in the following scenarios:
- User logs in (`/auth/login`)
- User logs out (`/auth/logout`)
- Token expires (24 hours)

### Token Validation
For each state-changing request:
1. Extract token from cookie
2. Extract token from `X-CSRF-Token` header
3. Verify both tokens exist
4. Compare tokens using timing-safe comparison
5. Proceed if tokens match, reject otherwise

## Error Handling

### CSRF Token Missing in Cookie
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "CSRF token missing in cookie"
  }
}
```

**Solution**: Client needs to fetch a CSRF token first via `/api/csrf-token`

### CSRF Token Missing in Header
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "CSRF token missing in request header"
  }
}
```

**Solution**: Include the token in the `X-CSRF-Token` header

### CSRF Token Mismatch
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "CSRF token mismatch"
  }
}
```

**Solution**: Token may have expired or been rotated. Fetch a new token via `/api/csrf-token`

## Security Considerations

### When to Use CSRF Protection

✅ **Use CSRF protection for:**
- Form submissions
- State-changing API operations (POST, PUT, PATCH, DELETE)
- Operations that modify user data
- Operations that trigger side effects

❌ **Don't use CSRF protection for:**
- Read-only operations (GET requests are automatically exempt)
- Public API endpoints with API key authentication
- Webhook endpoints from trusted third parties
- Server-to-server API calls

### Additional Security Measures

CSRF protection works best when combined with:

1. **SameSite Cookies**: Already implemented (`SameSite=Strict`)
2. **CORS Configuration**: Restrict allowed origins
3. **Content-Type Validation**: Validate `Content-Type` headers
4. **Origin/Referer Checking**: Additional validation layer
5. **Rate Limiting**: Prevent brute force attacks

### Known Limitations

1. **Subdomain Attacks**: If an attacker controls a subdomain, they may be able to set cookies
   - **Mitigation**: Use separate domains for user content
   
2. **XSS Vulnerabilities**: If XSS exists, attacker can read the token from the response
   - **Mitigation**: Implement proper XSS protection (already done via helmet and input sanitization)

3. **Token Fixation**: Attacker might try to fix a token value
   - **Mitigation**: Token rotation on authentication state changes

## Testing

### Unit Tests

Run CSRF middleware tests:

```bash
npm test csrf
```

### Integration Tests

Test CSRF protection in API endpoints:

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('CSRF Protection Integration', () => {
  const app = createApp();

  it('should reject POST request without CSRF token', async () => {
    const response = await request(app)
      .post('/api/v1/products')
      .send({ name: 'Test Product' });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('CSRF token');
  });

  it('should accept POST request with valid CSRF token', async () => {
    // Get CSRF token
    const tokenResponse = await request(app)
      .get('/api/csrf-token');

    const csrfToken = tokenResponse.body.csrfToken;
    const cookies = tokenResponse.headers['set-cookie'];

    // Make authenticated request with CSRF token
    const response = await request(app)
      .post('/api/v1/products')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Test Product' });

    expect(response.status).not.toBe(403);
  });
});
```

## Troubleshooting

### Issue: CSRF token not being set

**Symptoms**: Client receives 403 errors, no CSRF cookie in browser

**Solutions**:
1. Ensure `credentials: 'include'` is set in fetch/axios
2. Check CORS configuration allows credentials
3. Verify cookie-parser middleware is installed
4. Check browser console for cookie errors

### Issue: CSRF token mismatch

**Symptoms**: Token exists but validation fails

**Solutions**:
1. Ensure cookie and header token are the same
2. Check for token rotation (login/logout)
3. Verify token hasn't expired (24 hours)
4. Check for multiple tabs causing token conflicts

### Issue: CSRF protection blocking legitimate requests

**Symptoms**: All POST/PUT/DELETE requests fail with 403

**Solutions**:
1. Verify CSRF token is being included in headers
2. Check that cookies are being sent with requests
3. Ensure CORS is properly configured
4. Consider using `skipCsrfValidation` for specific routes

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Double Submit Cookie Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)
- [SameSite Cookie Attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
