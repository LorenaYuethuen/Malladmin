# Brand API Implementation

## Overview

This document describes the Brand API implementation for the Mall Admin Integration project. The Brand API provides comprehensive CRUD operations for managing product brands with features including logo upload, validation, caching, rate limiting, and RBAC.

## Implementation Date

March 5, 2026

## Requirements

Implements requirements:
- **1.4**: Brand management functionality with logo upload and brand information
- **7.5**: File upload handling for brand logos
- **8.8**: Rate limiting and RBAC middleware

## Architecture

### Files Created

1. **backend/src/controllers/brandController.ts**
   - Brand CRUD operations
   - Logo upload handling
   - Product count aggregation
   - Cache integration
   - Outbox event publishing

2. **backend/src/routes/brandRoutes.ts**
   - API versioning: `/api/v1/brands`
   - Route definitions with middleware
   - Multer configuration for logo uploads
   - OpenAPI documentation annotations

3. **backend/src/validation/brandSchemas.ts**
   - Zod validation schemas
   - Request/response type definitions
   - Input sanitization rules

### Files Modified

1. **backend/src/routes/index.ts**
   - Added brand routes registration

2. **backend/src/services/cacheService.ts**
   - Added brand cache helpers
   - Added BRAND_DETAIL TTL constant

## API Endpoints

### 1. List Brands
```
GET /api/v1/brands
```

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 20, max: 100)
- `sortBy`: 'name' | 'created_at' | 'sort_order' | 'product_count' (default: 'name')
- `sortOrder`: 'asc' | 'desc' (default: 'asc')
- `isActive`: boolean (filter by active status)
- `search`: string (search in name and description)

**Response:** PaginatedResponse<Brand>

**Features:**
- Pagination support
- Filtering by active status
- Full-text search
- Product count aggregation
- Caching (24 hours TTL)
- Rate limiting: 100 req/15min

### 2. Get Brand
```
GET /api/v1/brands/:id
```

**Response:** Brand (with productCount and recentProducts)

**Features:**
- Detailed brand information
- Product count
- Recent products (up to 10)
- Caching (1 hour TTL)
- Rate limiting: 100 req/15min

### 3. Create Brand
```
POST /api/v1/brands
```

**Request Body:**
```json
{
  "name": "string (required, unique)",
  "slug": "string (optional, auto-generated)",
  "description": "string (optional)",
  "logoUrl": "string (optional, URL)",
  "websiteUrl": "string (optional, URL)",
  "isActive": "boolean (optional, default: true)",
  "sortOrder": "number (optional, default: 0)",
  "metaTitle": "string (optional)",
  "metaDescription": "string (optional)",
  "metaKeywords": "string (optional)"
}
```

**Response:** Brand (201 Created)

**Features:**
- Auto slug generation from name
- Duplicate name/slug validation
- Transactional with outbox events
- Cache invalidation
- Rate limiting: 50 req/15min
- Idempotency support
- RBAC: requires `brands:write` permission

### 4. Update Brand
```
PUT /api/v1/brands/:id
```

**Request Body:** Partial<CreateBrandRequest>

**Response:** Brand

**Features:**
- Partial updates
- Duplicate name/slug validation
- Transactional with outbox events
- Cache invalidation
- Rate limiting: 50 req/15min
- Idempotency support
- RBAC: requires `brands:write` permission

### 5. Delete Brand
```
DELETE /api/v1/brands/:id
```

**Response:** { id: string }

**Features:**
- Validation: cannot delete brand with products
- Transactional with outbox events
- Cache invalidation
- Rate limiting: 50 req/15min
- RBAC: requires `brands:delete` permission

### 6. Upload Logo
```
POST /api/v1/brands/:id/logo
```

**Request:** multipart/form-data with 'logo' field

**Allowed file types:** JPEG, PNG, WebP, SVG
**Max file size:** 5MB

**Response:** Brand (with updated logoUrl)

**Features:**
- File type validation
- File size validation
- Unique filename generation (UUID)
- Transactional with outbox events
- Cache invalidation
- Rate limiting: 20 req/15min
- RBAC: requires `brands:write` permission

## Database Schema

Uses existing `brands` table from migration `003_create_pms_tables.sql`:

```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);
```

**Indexes:**
- `idx_brands_slug` on slug
- `idx_brands_active` on is_active
- `idx_brands_sort_order` on sort_order

## Caching Strategy

### Cache Keys
- List: `brand:list:page:{page}:limit:{limit}:{filters}`
- Detail: `brand:{id}`

### Cache TTL
- Brand list: 24 hours
- Brand detail: 1 hour

### Cache Invalidation
- On create: invalidate all list caches
- On update: invalidate detail and all list caches
- On delete: invalidate detail and all list caches

## Security Features

### Rate Limiting
- List/Get: 100 requests per 15 minutes
- Create/Update/Delete: 50 requests per 15 minutes
- Logo upload: 20 requests per 15 minutes

### RBAC Permissions
- Read operations: Public access
- Create/Update: `brands:write` permission
- Delete: `brands:delete` permission
- Logo upload: `brands:write` permission

### Input Validation
- Zod schema validation for all inputs
- URL validation for logoUrl and websiteUrl
- UUID validation for brand IDs
- File type and size validation for uploads

### Data Integrity
- Unique constraints on name and slug
- Cannot delete brand with associated products
- Transactional operations with rollback on error

## Event Publishing

All brand operations publish events to the outbox for reliable event-driven architecture:

- `BRAND_CREATED`: When a new brand is created
- `BRAND_UPDATED`: When a brand is updated (including logo)
- `BRAND_DELETED`: When a brand is deleted

## Error Handling

### Standard Error Responses
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Brand not found
- `409 Conflict`: Duplicate name or slug
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server errors

### Validation Errors
- Duplicate brand name
- Duplicate slug
- Invalid URL format
- Invalid file type for logo
- File size exceeds limit
- Cannot delete brand with products

## Testing Recommendations

### Unit Tests
- [ ] Test slug generation from brand name
- [ ] Test duplicate name/slug validation
- [ ] Test brand creation with all fields
- [ ] Test brand update with partial fields
- [ ] Test brand deletion validation (with products)
- [ ] Test cache invalidation on CRUD operations

### Integration Tests
- [ ] Test complete brand CRUD workflow
- [ ] Test logo upload with valid file
- [ ] Test logo upload with invalid file type
- [ ] Test logo upload with oversized file
- [ ] Test rate limiting enforcement
- [ ] Test RBAC permission checks
- [ ] Test idempotency key handling
- [ ] Test pagination and filtering
- [ ] Test search functionality

### Property-Based Tests
- [ ] Brand data validation ensures integrity
- [ ] Slug generation is consistent and unique
- [ ] Cache invalidation maintains consistency

## Usage Examples

### Create a Brand
```bash
curl -X POST http://localhost:3000/api/v1/brands \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Nike",
    "description": "Athletic footwear and apparel",
    "websiteUrl": "https://www.nike.com",
    "isActive": true
  }'
```

### Upload Brand Logo
```bash
curl -X POST http://localhost:3000/api/v1/brands/<brand-id>/logo \
  -H "Authorization: Bearer <token>" \
  -F "logo=@/path/to/logo.png"
```

### List Brands with Filtering
```bash
curl -X GET "http://localhost:3000/api/v1/brands?page=1&limit=20&isActive=true&search=nike"
```

## Consistency with Product and Category APIs

The Brand API follows the same patterns as Product and Category APIs:

1. **API Versioning**: `/api/v1/brands`
2. **Validation**: Zod schemas with consistent error handling
3. **Caching**: Redis caching with appropriate TTLs
4. **Rate Limiting**: Tiered rate limits based on operation type
5. **RBAC**: Permission-based access control
6. **Idempotency**: Support for idempotency keys
7. **Outbox Events**: Reliable event publishing
8. **OpenAPI Documentation**: Comprehensive API documentation
9. **Error Handling**: Standardized error responses
10. **Logging**: Structured logging with correlation IDs

## Future Enhancements

1. **CDN Integration**: Upload logos to S3/CDN instead of local storage
2. **Image Processing**: Automatic image optimization and resizing
3. **Brand Analytics**: Track brand performance metrics
4. **Brand Relationships**: Support for brand hierarchies (parent brands)
5. **Bulk Operations**: Bulk brand import/export
6. **Brand Verification**: Verification workflow for brand authenticity
7. **Social Media Integration**: Link brand social media accounts
8. **Brand Stories**: Rich content for brand storytelling

## Conclusion

The Brand API implementation provides a complete, production-ready solution for brand management with enterprise-grade features including validation, caching, rate limiting, RBAC, and event-driven architecture. The implementation follows established patterns from Product and Category APIs ensuring consistency across the platform.
