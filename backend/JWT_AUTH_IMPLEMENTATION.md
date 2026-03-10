# JWT Authentication Implementation

## Overview

This implementation provides a complete JWT-based authentication system with refresh token rotation, token blacklisting, and role-based access control (RBAC).

## Features

✅ **JWT Access Tokens** - Short-lived tokens (15 minutes) for API authentication
✅ **Refresh Tokens** - Long-lived tokens (7 days) for obtaining new access tokens
✅ **Token Rotation** - Automatic refresh token rotation for enhanced security
✅ **Token Blacklisting** - Redis-based blacklist for logout functionality
✅ **Role-Based Access Control** - Support for admin, merchant, and consumer roles
✅ **Permission-Based Authorization** - Fine-grained permission checking
✅ **Secure Password Hashing** - bcrypt with salt rounds
✅ **Redis Token Storage** - Refresh tokens stored in Redis with expiration

## Architecture

### Token Flow

```
1. Login
   ├─> Validate credentials
   ├─> Generate access token (15min)
   ├─> Generate refresh token (7 days)
   ├─> Store refresh token in Redis
   └─> Return both tokens

2. API Request
   ├─> Extract Bearer token
   ├─> Check if blacklisted
   ├─> Verify JWT signature
   ├─> Fetch user from database
   └─> Attach user to request

3. Token Refresh
   ├─> Validate refresh token
   ├─> Check Redis for validity
   ├─> Generate new access token
   ├─> Rotate refresh token
   └─> Return new tokens

4. Logout
   ├─> Blacklist access token
   ├─> Revoke refresh token from Redis
   └─> Return success
```

## API Endpoints

### POST /api/v1/auth/login
Login user and return tokens.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@example.com",
      "roles": ["admin"],
      "status": "active"
    }
  }
}
```

### POST /api/v1/auth/refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### POST /api/v1/auth/logout
Logout user and revoke tokens.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### POST /api/v1/auth/logout-all
Logout user from all devices.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out from all devices successfully"
  }
}
```

### GET /api/v1/auth/me
Get current user information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@example.com",
      "phone": null,
      "roles": ["admin"],
      "permissions": ["*:*"],
      "status": "active"
    }
  }
}
```

## Middleware

### authenticate
Validates JWT token and attaches user to request.

```typescript
import { authenticate } from './middleware/auth';

router.get('/protected', authenticate, (req, res) => {
  const user = (req as AuthRequest).user;
  res.json({ user });
});
```

### requireRole
Checks if user has required role(s).

```typescript
import { authenticate, requireRole } from './middleware/auth';

router.post('/admin-only', 
  authenticate, 
  requireRole('admin'), 
  handler
);

router.post('/admin-or-merchant', 
  authenticate, 
  requireRole('admin', 'merchant'), 
  handler
);
```

### requirePermission
Checks if user has specific permission.

```typescript
import { authenticate, requirePermission } from './middleware/auth';

router.post('/products', 
  authenticate, 
  requirePermission('products', 'write'), 
  createProduct
);

router.delete('/products/:id', 
  authenticate, 
  requirePermission('products', 'delete'), 
  deleteProduct
);
```

### requireAnyPermission
Checks if user has any of the specified permissions.

```typescript
import { authenticate, requireAnyPermission } from './middleware/auth';

router.get('/dashboard', 
  authenticate, 
  requireAnyPermission(
    { resource: 'products', action: 'read' },
    { resource: 'orders', action: 'read' }
  ), 
  getDashboard
);
```

## JWT Service

The `JWTService` class provides all token operations:

```typescript
import { JWTService } from './services/jwtService';

// Generate tokens
const accessToken = JWTService.generateAccessToken(user);
const { token, tokenId } = JWTService.generateRefreshToken(userId);

// Verify tokens
const payload = JWTService.verifyAccessToken(token);
const refreshPayload = JWTService.verifyRefreshToken(refreshToken);

// Store/validate refresh tokens
await JWTService.storeRefreshToken(userId, tokenId);
const isValid = await JWTService.validateRefreshToken(userId, tokenId);

// Revoke tokens
await JWTService.revokeRefreshToken(userId, tokenId);
await JWTService.revokeAllRefreshTokens(userId);

// Blacklist access tokens
await JWTService.blacklistAccessToken(token, ttl);
const isBlacklisted = await JWTService.isTokenBlacklisted(token);

// Rotate refresh token
const newTokens = await JWTService.rotateRefreshToken(userId, oldTokenId);
```

## Database Schema

### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### roles
```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### permissions
```sql
CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    resource VARCHAR(100) NOT NULL,
    actions TEXT[] NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### user_roles
```sql
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);
```

### role_permissions
```sql
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);
```

## Redis Keys

### Refresh Tokens
```
refresh_token:{userId}:{tokenId} -> "valid"
TTL: 7 days
```

### Blacklisted Access Tokens
```
blacklist:{token} -> "blacklisted"
TTL: Remaining token lifetime
```

## Security Features

### Password Hashing
- bcrypt with 10 salt rounds
- Passwords never stored in plain text
- Secure comparison using bcrypt.compare()

### Token Security
- Short-lived access tokens (15 minutes)
- Refresh token rotation on each use
- Token blacklisting for logout
- Redis-based token storage with expiration

### Permission System
- Resource-based permissions (e.g., "products:read,write")
- Wildcard support ("*:*" for full access)
- Role-based permission inheritance
- Fine-grained access control

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRES_IN=7d

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Infrastructure
```bash
docker-compose up -d
```

### 4. Run Migrations
```bash
npm run migrate
```

### 5. Seed Database
```bash
npm run seed
```

### 6. Start Server
```bash
npm run dev
```

## Test Users

After running the seed script, you'll have these test users:

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | admin123 | admin |
| merchant@example.com | merchant123 | merchant |
| consumer@example.com | consumer123 | consumer |

## Testing with cURL

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

### Access Protected Route
```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### Refresh Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh_token>"}'
```

### Logout
```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh_token>"}'
```

## Best Practices

1. **Always use HTTPS in production** - Tokens should never be transmitted over HTTP
2. **Store tokens securely** - Use httpOnly cookies or secure storage
3. **Implement token refresh** - Refresh tokens before they expire
4. **Handle token expiration** - Implement automatic refresh on 401 errors
5. **Logout on all devices** - Provide option to revoke all sessions
6. **Monitor failed login attempts** - Implement rate limiting and account lockout
7. **Rotate secrets regularly** - Change JWT secrets periodically
8. **Use strong passwords** - Enforce password complexity requirements

## Error Handling

All authentication errors return standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password"
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123",
    "version": "v1"
  }
}
```

Common error codes:
- `UNAUTHORIZED` (401) - Invalid credentials or token
- `FORBIDDEN` (403) - Insufficient permissions
- `VALIDATION_ERROR` (400) - Invalid request data

## Next Steps

- [ ] Implement rate limiting for login endpoint
- [ ] Add email verification
- [ ] Add password reset functionality
- [ ] Add two-factor authentication (2FA)
- [ ] Add OAuth2 integration
- [ ] Add session management UI
- [ ] Add audit logging for authentication events
- [ ] Add IP-based access control

## Requirements Satisfied

✅ **Requirement 8.1** - JWT-based authentication system
✅ **Requirement 8.6** - Session management with timeout policies
✅ **Requirement 13.1** - Multi-role system support
✅ **Requirement 13.6** - Role switching functionality
✅ **Requirement 13.7** - Role-based data access restrictions

## Files Created

- `src/services/jwtService.ts` - JWT token operations
- `src/middleware/auth.ts` - Authentication and authorization middleware
- `src/controllers/authController.ts` - Authentication endpoints
- `src/routes/authRoutes.ts` - Authentication routes
- `src/routes/index.ts` - Route registration
- `src/database/migrations/001_create_users_tables.sql` - Database schema
- `src/database/migrate.ts` - Migration runner
- `src/database/seed.ts` - Database seeding
- `JWT_AUTH_IMPLEMENTATION.md` - This documentation
