# Attribute API Implementation

## Overview

This document describes the implementation of the Attribute API for the Product Management System (PMS). The Attribute API provides CRUD operations for managing product attributes with support for different attribute types, validation, caching, and event publishing.

## Implementation Date

December 2024

## Requirements Addressed

- **Requirement 1.5**: Product attribute management with type validation
- **Requirement 8.8**: API versioning, rate limiting, and RBAC middleware

## Architecture

### Files Created

1. **backend/src/validation/attributeSchemas.ts**
   - Zod validation schemas for attribute operations
   - Attribute type enum (text, select, multiselect, color, number, boolean)
   - Option validation for select/multiselect types
   - Request/response type definitions

2. **backend/src/controllers/attributeController.ts**
   - CRUD controller methods
   - Product-attribute association logic
   - Cache integration
   - Event publishing via outbox pattern
   - Comprehensive error handling

3. **backend/src/routes/attributeRoutes.ts**
   - RESTful route definitions
   - Middleware integration (auth, validation, rate limiting, idempotency)
   - OpenAPI documentation comments
   - Permission-based access control

### Files Modified

1. **backend/src/routes/index.ts**
   - Registered attribute routes at `/api/v1/attributes`

2. **backend/src/services/cacheService.ts**
   - Added attribute cache helpers
   - Added ATTRIBUTE_DETAIL TTL constant (1 hour)
   - Added ATTRIBUTE_LIST TTL constant (24 hours)

3. **backend/src/types/outbox.ts**
   - Added 'attribute' to AggregateType
   - Added ATTRIBUTE_CREATED, ATTRIBUTE_UPDATED, ATTRIBUTE_DELETED event types

## API Endpoints

### Base URL
```
/api/v1/attributes
```

### Endpoints

#### 1. List Attributes
```
GET /api/v1/attributes
```

**Query Parameters:**
- `page`: number (default: 1)
- `limit`: number (default: 20, max: 100)
- `sortBy`: 'name' | 'created_at' | 'sort_order' | 'type' (default: 'sort_order')
- `sortOrder`: 'asc' | 'desc' (default: 'asc')
- `type`: 'text' | 'select' | 'multiselect' | 'color' | 'number' | 'boolean'
- `isFilterable`: boolean
- `isVisible`: boolean
- `search`: string

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Color",
        "slug": "color",
        "type": "select",
        "options": [
          {"value": "red", "label": "Red"},
          {"value": "blue", "label": "Blue"}
        ],
        "isRequired": false,
        "isFilterable": true,
        "isVisible": true,
        "sortOrder": 0,
        "description": "Product color",
        "productCount": 25,
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Rate Limit:** 100 requests per 15 minutes
**Access:** Public

#### 2. Get Attribute by ID
```
GET /api/v1/attributes/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Color",
    "slug": "color",
    "type": "select",
    "options": [...],
    "isRequired": false,
    "isFilterable": true,
    "isVisible": true,
    "sortOrder": 0,
    "description": "Product color",
    "productCount": 25,
    "recentProducts": [
      {
        "id": "uuid",
        "name": "Product Name",
        "slug": "product-name",
        "value": "red",
        "imageUrl": "https://..."
      }
    ],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

**Rate Limit:** 100 requests per 15 minutes
**Access:** Public

#### 3. Get Attributes by Product
```
GET /api/v1/attributes/by-product/:productId
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Color",
      "slug": "color",
      "type": "select",
      "options": [...],
      "value": "red",
      "productAttributeId": "uuid",
      "isRequired": false,
      "isFilterable": true,
      "isVisible": true,
      "sortOrder": 0
    }
  ]
}
```

**Rate Limit:** 100 requests per 15 minutes
**Access:** Public

#### 4. Create Attribute
```
POST /api/v1/attributes
```

**Request Body:**
```json
{
  "name": "Color",
  "slug": "color",
  "type": "select",
  "options": [
    {"value": "red", "label": "Red"},
    {"value": "blue", "label": "Blue"}
  ],
  "isRequired": false,
  "isFilterable": true,
  "isVisible": true,
  "sortOrder": 0,
  "description": "Product color"
}
```

**Validations:**
- Name is required and must be unique
- Slug is auto-generated if not provided
- Options are required for select/multiselect types
- Options should not be provided for other types

**Rate Limit:** 50 requests per 15 minutes
**Access:** Private (admin, merchant)
**Permissions:** attributes:write
**Idempotency:** Supported via X-Idempotency-Key header

#### 5. Update Attribute
```
PUT /api/v1/attributes/:id
```

**Request Body:** Partial<CreateAttributeRequest>

**Validations:**
- Cannot change type if attribute is used by products
- Name and slug must be unique
- Options validation based on type

**Rate Limit:** 50 requests per 15 minutes
**Access:** Private (admin, merchant)
**Permissions:** attributes:write
**Idempotency:** Supported via X-Idempotency-Key header

#### 6. Delete Attribute
```
DELETE /api/v1/attributes/:id
```

**Validations:**
- Cannot delete attribute that is used by products

**Rate Limit:** 50 requests per 15 minutes
**Access:** Private (admin)
**Permissions:** attributes:delete

## Attribute Types

### Supported Types

1. **text**: Free-form text input
   - No options required
   - Example: Product description, warranty information

2. **select**: Single selection from predefined options
   - Options required
   - Example: Size (S, M, L, XL)

3. **multiselect**: Multiple selections from predefined options
   - Options required
   - Example: Features (WiFi, Bluetooth, GPS)

4. **color**: Color picker
   - No options required
   - Example: Product color

5. **number**: Numeric input
   - No options required
   - Example: Weight, dimensions

6. **boolean**: Yes/No toggle
   - No options required
   - Example: Waterproof, wireless

### Option Format

For select and multiselect types:
```json
{
  "options": [
    {
      "value": "red",
      "label": "Red"
    },
    {
      "value": "blue",
      "label": "Blue"
    }
  ]
}
```

## Caching Strategy

### Cache Keys

- **List**: `attribute:list:page:{page}:limit:{limit}:{filters}`
- **Detail**: `attribute:{id}`
- **Product Attributes**: `attribute:product:{productId}`

### Cache TTL

- **List**: 24 hours
- **Detail**: 1 hour
- **Product Attributes**: 1 hour

### Cache Invalidation

- **On Create**: Invalidate all list caches
- **On Update**: Invalidate detail cache and all list caches
- **On Delete**: Invalidate detail cache and all list caches

## Event Publishing

### Outbox Pattern

All state-changing operations publish events via the transactional outbox pattern:

1. **ATTRIBUTE_CREATED**
   ```json
   {
     "aggregateType": "attribute",
     "aggregateId": "uuid",
     "eventType": "ATTRIBUTE_CREATED",
     "payload": {
       "attributeId": "uuid",
       "name": "Color",
       "slug": "color",
       "type": "select",
       "createdBy": "user-uuid"
     }
   }
   ```

2. **ATTRIBUTE_UPDATED**
   ```json
   {
     "aggregateType": "attribute",
     "aggregateId": "uuid",
     "eventType": "ATTRIBUTE_UPDATED",
     "payload": {
       "attributeId": "uuid",
       "updatedFields": ["name", "options"],
       "updatedBy": "user-uuid"
     }
   }
   ```

3. **ATTRIBUTE_DELETED**
   ```json
   {
     "aggregateType": "attribute",
     "aggregateId": "uuid",
     "eventType": "ATTRIBUTE_DELETED",
     "payload": {
       "attributeId": "uuid",
       "name": "Color",
       "deletedBy": "user-uuid"
     }
   }
   ```

## Security

### Authentication

- JWT-based authentication via `authenticate` middleware
- Token validation and user context injection

### Authorization

- Role-based access control (RBAC)
- Permission checks: `attributes:write`, `attributes:delete`
- Admin and merchant roles supported

### Rate Limiting

- **Read Operations**: 100 requests per 15 minutes
- **Write Operations**: 50 requests per 15 minutes
- Redis-based rate limiting with user-specific counters

### Input Validation

- Zod schema validation for all requests
- SQL injection prevention via parameterized queries
- XSS protection via input sanitization

## Database Schema

### attributes Table

```sql
CREATE TABLE attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('text', 'select', 'multiselect', 'color', 'number', 'boolean')),
  options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_filterable BOOLEAN NOT NULL DEFAULT TRUE,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### product_attributes Table

```sql
CREATE TABLE product_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, attribute_id)
);
```

## Error Handling

### Standard Error Responses

```json
{
  "success": false,
  "error": {
    "code": "ATTRIBUTE_NOT_FOUND",
    "message": "Attribute with ID {id} not found"
  }
}
```

### Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `ATTRIBUTE_NOT_FOUND`: Attribute not found
- `CONFLICT`: Duplicate name or slug
- `FORBIDDEN`: Insufficient permissions
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Testing

### Unit Tests

Test coverage should include:
- Controller methods
- Validation schemas
- Cache operations
- Event publishing

### Integration Tests

Test scenarios:
- CRUD operations
- Product-attribute associations
- Permission checks
- Rate limiting
- Cache invalidation

### Property-Based Tests

Test properties:
- Attribute type validation
- Option validation for select types
- Slug generation uniqueness
- Cache consistency

## Performance Considerations

### Database Optimization

- Indexed columns: slug, type, is_filterable, sort_order
- Efficient JOIN queries for product associations
- Pagination for large result sets

### Caching

- Aggressive caching for list operations (24 hours)
- Shorter TTL for detail views (1 hour)
- Cache warming for frequently accessed attributes

### Query Optimization

- Select only required fields
- Use COUNT(*) for pagination totals
- Limit product associations to 10 recent products

## Monitoring

### Metrics to Track

- Request rate per endpoint
- Cache hit/miss ratio
- Average response time
- Error rate by type
- Event publishing success rate

### Logging

- Request/response logging with correlation IDs
- Error logging with stack traces
- Cache operation logging
- Event publishing logging

## Future Enhancements

1. **Attribute Groups**: Group related attributes together
2. **Conditional Attributes**: Show/hide attributes based on other attribute values
3. **Attribute Validation Rules**: Custom validation rules per attribute
4. **Bulk Operations**: Bulk create/update/delete attributes
5. **Attribute Templates**: Predefined attribute sets for common product types
6. **Localization**: Multi-language support for attribute names and options
7. **Attribute History**: Track changes to attribute definitions over time

## Related Documentation

- [Product API Implementation](./PRODUCT_API_IMPLEMENTATION.md)
- [Category API Implementation](./CATEGORY_API_IMPLEMENTATION.md)
- [Brand API Implementation](./BRAND_API_IMPLEMENTATION.md)
- [Cache Service Documentation](./docs/CACHE_SERVICE.md)
- [Outbox Pattern Documentation](./docs/OUTBOX_PATTERN.md)
- [API Response Format](./docs/API_RESPONSE_FORMAT.md)

## Conclusion

The Attribute API implementation follows established patterns from the Product, Category, and Brand APIs, providing a consistent and robust interface for managing product attributes. The implementation includes comprehensive validation, caching, event publishing, and security measures to ensure reliability and performance.

