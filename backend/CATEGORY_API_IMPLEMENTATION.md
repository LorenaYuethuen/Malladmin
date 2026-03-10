# Category API Implementation

## Overview

The Category API provides comprehensive CRUD operations for managing hierarchical product categories with parent-child relationships, caching, validation, and event publishing.

## Features

✅ **CRUD Operations**: Create, Read, Update, Delete categories
✅ **Hierarchical Structure**: Support for parent-child relationships with materialized paths
✅ **Slug Generation**: Automatic slug generation from category names
✅ **Validation**: Comprehensive validation including circular reference prevention
✅ **Caching**: Redis-based caching with 24-hour TTL for category data
✅ **Rate Limiting**: 100 req/min for read operations, 50 req/min for write operations
✅ **RBAC**: Role-based access control (admin, merchant roles)
✅ **Event Publishing**: Transactional outbox pattern for category events
✅ **SEO Support**: Meta title, description, and keywords for each category
✅ **Product Count**: Automatic product count aggregation per category

## API Endpoints

### List Categories
```
GET /api/v1/categories
```

**Query Parameters:**
- `parentId` (UUID | 'null'): Filter by parent category
- `isActive` (boolean): Filter by active status
- `includeChildren` (boolean): Build hierarchical tree structure
- `level` (number): Filter by depth level
- `search` (string): Search in name and description

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Electronics",
    "slug": "electronics",
    "description": "Electronic devices and accessories",
    "parentId": null,
    "path": "/uuid/",
    "level": 0,
    "sortOrder": 1,
    "imageUrl": "https://...",
    "icon": "icon-name",
    "isActive": true,
    "metaTitle": "Electronics Category",
    "metaDescription": "Browse our electronics",
    "metaKeywords": "electronics, devices",
    "productCount": 150,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
]
```

### Get Category
```
GET /api/v1/categories/:id
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Electronics",
  "slug": "electronics",
  "description": "Electronic devices and accessories",
  "parentId": null,
  "path": "/uuid/",
  "level": 0,
  "sortOrder": 1,
  "imageUrl": "https://...",
  "icon": "icon-name",
  "isActive": true,
  "metaTitle": "Electronics Category",
  "metaDescription": "Browse our electronics",
  "metaKeywords": "electronics, devices",
  "productCount": 150,
  "parent": null,
  "children": [
    {
      "id": "uuid",
      "name": "Smartphones",
      "slug": "smartphones",
      "level": 1,
      "sortOrder": 1,
      "isActive": true,
      "productCount": 50
    }
  ],
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

### Create Category
```
POST /api/v1/categories
Authorization: Bearer <token>
X-Idempotency-Key: <optional-key>
```

**Required Permissions:** `categories:write`

**Request Body:**
```json
{
  "name": "Smartphones",
  "slug": "smartphones",
  "description": "Mobile phones and accessories",
  "parentId": "parent-uuid",
  "sortOrder": 1,
  "imageUrl": "https://...",
  "icon": "icon-name",
  "isActive": true,
  "metaTitle": "Smartphones Category",
  "metaDescription": "Browse our smartphones",
  "metaKeywords": "smartphones, mobile"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Smartphones",
    "slug": "smartphones",
    "parentId": "parent-uuid",
    "path": "/parent-uuid/uuid/",
    "level": 1,
    "sortOrder": 1,
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  },
  "message": "Category created successfully"
}
```

### Update Category
```
PUT /api/v1/categories/:id
Authorization: Bearer <token>
X-Idempotency-Key: <optional-key>
```

**Required Permissions:** `categories:write`

**Request Body:** (all fields optional)
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "isActive": false
}
```

**Response:** `200 OK`

### Delete Category
```
DELETE /api/v1/categories/:id
Authorization: Bearer <token>
```

**Required Permissions:** `categories:delete`

**Validations:**
- Cannot delete category with subcategories
- Cannot delete category with products

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid"
  },
  "message": "Category deleted successfully"
}
```

## Validation Rules

### Slug Validation
- Auto-generated from name if not provided
- Must be unique across all categories
- Format: lowercase letters, numbers, and hyphens only
- Pattern: `^[a-z0-9-]+$`

### Parent-Child Relationships
- ✅ Parent category must exist
- ✅ Category cannot be its own parent
- ✅ Prevents circular references (category cannot be moved under its own descendant)
- ✅ Path and level are automatically calculated by database trigger

### Deletion Constraints
- ❌ Cannot delete category with subcategories
- ❌ Cannot delete category with products
- ✅ Must move or delete children/products first

## Hierarchical Structure

Categories use a **materialized path** approach for efficient tree queries:

```
Electronics (level 0, path: /uuid1/)
├── Smartphones (level 1, path: /uuid1/uuid2/)
│   ├── Android (level 2, path: /uuid1/uuid2/uuid3/)
│   └── iOS (level 2, path: /uuid1/uuid2/uuid4/)
└── Laptops (level 1, path: /uuid1/uuid5/)
```

**Benefits:**
- Fast ancestor/descendant queries
- Efficient tree traversal
- Simple level-based filtering
- Automatic path calculation via database trigger

## Caching Strategy

### Cache Keys
- List: `category:list:{filters}`
- Detail: `category:{id}`
- Tree: `category:tree`

### TTL
- Category list: 24 hours
- Category detail: 24 hours

### Invalidation
- On create: Invalidate all list caches
- On update: Invalidate detail + all list caches
- On delete: Invalidate detail + all list caches

## Event Publishing

Categories use the **Transactional Outbox Pattern** for reliable event publishing:

### Events
- `CATEGORY_CREATED`: Published when a new category is created
- `CATEGORY_UPDATED`: Published when a category is updated
- `CATEGORY_DELETED`: Published when a category is deleted

### Event Payload Example
```json
{
  "aggregateType": "category",
  "aggregateId": "uuid",
  "eventType": "CATEGORY_CREATED",
  "payload": {
    "categoryId": "uuid",
    "name": "Smartphones",
    "slug": "smartphones",
    "parentId": "parent-uuid",
    "createdBy": "user-uuid"
  }
}
```

## Rate Limiting

- **Read Operations** (GET): 100 requests per 15 minutes
- **Write Operations** (POST, PUT, DELETE): 50 requests per 15 minutes

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid slug format",
    "details": {
      "field": "slug",
      "value": "Invalid_Slug"
    }
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Category with ID uuid not found"
  }
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Category with this slug already exists",
    "details": {
      "slug": "electronics"
    }
  }
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later"
  }
}
```

## Database Schema

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  path TEXT, -- Materialized path (e.g., '/uuid1/uuid2/')
  level INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  icon VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_path ON categories(path);
CREATE INDEX idx_categories_active ON categories(is_active);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);
CREATE INDEX idx_categories_level ON categories(level);

-- Trigger for automatic path calculation
CREATE TRIGGER update_category_path_trigger
  BEFORE INSERT OR UPDATE OF parent_id ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_category_path();
```

## Implementation Files

- **Controller**: `backend/src/controllers/categoryController.ts`
- **Routes**: `backend/src/routes/categoryRoutes.ts`
- **Validation**: `backend/src/validation/categorySchemas.ts`
- **Types**: `backend/src/types/product.ts` (Category interface)
- **Migration**: `backend/src/database/migrations/003_create_pms_tables.sql`

## Testing

### Manual Testing with cURL

```bash
# List all categories
curl http://localhost:3000/api/v1/categories

# Get category by ID
curl http://localhost:3000/api/v1/categories/{id}

# Create category
curl -X POST http://localhost:3000/api/v1/categories \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Smartphones",
    "description": "Mobile phones and accessories",
    "parentId": "parent-uuid"
  }'

# Update category
curl -X PUT http://localhost:3000/api/v1/categories/{id} \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "isActive": false
  }'

# Delete category
curl -X DELETE http://localhost:3000/api/v1/categories/{id} \
  -H "Authorization: Bearer <token>"
```

## Next Steps

- [ ] Write unit tests for category controller
- [ ] Write integration tests for category API
- [ ] Add property-based tests for hierarchical operations
- [ ] Implement category reordering endpoint
- [ ] Add category image upload endpoint
- [ ] Create OpenAPI/Swagger documentation

## Related Documentation

- [Product API Implementation](./PRODUCT_API_IMPLEMENTATION.md)
- [Cache Service Documentation](./docs/CACHE_SERVICE.md)
- [Outbox Pattern Documentation](./docs/OUTBOX_PATTERN.md)
- [Authentication Documentation](./JWT_AUTH_IMPLEMENTATION.md)
