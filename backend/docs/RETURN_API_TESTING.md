# Return Management API Testing Guide

## Overview
This document provides examples for testing the Return Management API endpoints using curl or Postman.

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### 1. Create Return Request
Create a new return request for delivered orders.

**Endpoint:** `POST /returns`

**Request Body:**
```json
{
  "orderId": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "123e4567-e89b-12d3-a456-426614174001",
  "items": [
    {
      "orderItemId": "123e4567-e89b-12d3-a456-426614174002",
      "quantity": 1,
      "reason": "商品有质量问题",
      "condition": "已拆封未使用"
    }
  ],
  "reason": "商品有质量问题",
  "description": "商品收到后发现有明显瑕疵",
  "refundMethod": "original_payment"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:3000/api/v1/returns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "orderId": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "123e4567-e89b-12d3-a456-426614174001",
    "items": [
      {
        "orderItemId": "123e4567-e89b-12d3-a456-426614174002",
        "quantity": 1,
        "reason": "商品有质量问题"
      }
    ],
    "reason": "商品有质量问题"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "returnNumber": "RET-20240115-123456",
    "orderId": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "123e4567-e89b-12d3-a456-426614174001",
    "status": "pending",
    "reason": "商品有质量问题",
    "refundAmount": 99.99,
    "refundStatus": "pending",
    "requestedAt": "2024-01-15T10:30:00Z",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "Return request created successfully"
}
```

---

### 2. List Return Requests
Get a list of return requests with optional filters.

**Endpoint:** `GET /returns`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `sortBy` (optional): Sort field (requestedAt, refundAmount, status)
- `sortOrder` (optional): Sort order (asc, desc)
- `status` (optional): Filter by status (pending, approved, rejected, completed)
- `userId` (optional): Filter by user ID
- `orderId` (optional): Filter by order ID
- `returnNumber` (optional): Search by return number
- `startDate` (optional): Filter by start date (ISO 8601)
- `endDate` (optional): Filter by end date (ISO 8601)

**curl Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/returns?page=1&limit=20&status=pending" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174003",
        "returnNumber": "RET-20240115-123456",
        "orderId": "123e4567-e89b-12d3-a456-426614174000",
        "status": "pending",
        "refundAmount": 99.99,
        "requestedAt": "2024-01-15T10:30:00Z",
        "order": {
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "orderNumber": "ORD-20240115-123456",
          "total": 199.99
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

---

### 3. Get Return Request by ID
Get detailed information about a specific return request.

**Endpoint:** `GET /returns/:id`

**curl Example:**
```bash
curl -X GET http://localhost:3000/api/v1/returns/123e4567-e89b-12d3-a456-426614174003 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "returnNumber": "RET-20240115-123456",
    "orderId": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "123e4567-e89b-12d3-a456-426614174001",
    "status": "pending",
    "reason": "商品有质量问题",
    "description": "商品收到后发现有明显瑕疵",
    "refundAmount": 99.99,
    "refundMethod": "original_payment",
    "refundStatus": "pending",
    "adminNotes": null,
    "requestedAt": "2024-01-15T10:30:00Z",
    "approvedAt": null,
    "rejectedAt": null,
    "completedAt": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "order": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "orderNumber": "ORD-20240115-123456",
      "total": 199.99
    },
    "items": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174004",
        "returnRequestId": "123e4567-e89b-12d3-a456-426614174003",
        "orderItemId": "123e4567-e89b-12d3-a456-426614174002",
        "quantity": 1,
        "reason": "商品有质量问题",
        "condition": "已拆封未使用",
        "refundAmount": 99.99,
        "status": "pending",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

---

### 4. Approve Return Request
Approve a pending return request (Admin only).

**Endpoint:** `PUT /returns/:id/process`

**Request Body:**
```json
{
  "action": "approve",
  "adminNotes": "退货申请已审核通过，请寄回商品"
}
```

**curl Example:**
```bash
curl -X PUT http://localhost:3000/api/v1/returns/123e4567-e89b-12d3-a456-426614174003/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "action": "approve",
    "adminNotes": "退货申请已审核通过"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "returnNumber": "RET-20240115-123456",
    "status": "approved",
    "approvedAt": "2024-01-15T11:00:00Z",
    "adminNotes": "退货申请已审核通过，请寄回商品"
  },
  "message": "Return request approved successfully"
}
```

---

### 5. Reject Return Request
Reject a pending return request (Admin only).

**Endpoint:** `PUT /returns/:id/process`

**Request Body:**
```json
{
  "action": "reject",
  "adminNotes": "商品使用痕迹明显，不符合退货条件"
}
```

**curl Example:**
```bash
curl -X PUT http://localhost:3000/api/v1/returns/123e4567-e89b-12d3-a456-426614174003/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "action": "reject",
    "adminNotes": "不符合退货条件"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "returnNumber": "RET-20240115-123456",
    "status": "rejected",
    "rejectedAt": "2024-01-15T11:00:00Z",
    "adminNotes": "商品使用痕迹明显，不符合退货条件"
  },
  "message": "Return request rejected successfully"
}
```

---

### 6. Complete Return Request
Mark an approved return as completed and process refund (Admin only).

**Endpoint:** `PUT /returns/:id/process`

**Request Body:**
```json
{
  "action": "complete",
  "adminNotes": "商品已收到，退款已处理"
}
```

**curl Example:**
```bash
curl -X PUT http://localhost:3000/api/v1/returns/123e4567-e89b-12d3-a456-426614174003/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "action": "complete",
    "adminNotes": "退款已处理"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "returnNumber": "RET-20240115-123456",
    "status": "completed",
    "refundStatus": "completed",
    "completedAt": "2024-01-15T12:00:00Z",
    "adminNotes": "商品已收到，退款已处理"
  },
  "message": "Return request completed successfully"
}
```

---

### 7. Cancel Return Request
Cancel a pending return request (User can cancel their own returns).

**Endpoint:** `DELETE /returns/:id`

**curl Example:**
```bash
curl -X DELETE http://localhost:3000/api/v1/returns/123e4567-e89b-12d3-a456-426614174003 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174003",
    "returnNumber": "RET-20240115-123456",
    "status": "cancelled"
  },
  "message": "Return request cancelled successfully"
}
```

---

## Return Status Flow

```
pending → approved → completed
   ↓         ↓
rejected  cancelled
```

1. **pending**: Initial status when return request is created
2. **approved**: Admin approves the return request
3. **rejected**: Admin rejects the return request
4. **completed**: Return is completed and refund is processed
5. **cancelled**: User cancels the return request (only when pending)

---

## Common Return Reasons

- `商品有质量问题` - Defective product
- `收到错误商品` - Wrong item received
- `商品与描述不符` - Not as described
- `尺寸不合适` - Size issue
- `不想要了` - Changed mind
- `运输过程中损坏` - Damaged during shipping
- `商品缺少配件` - Missing parts
- `其他原因` - Other reasons

---

## Testing Checklist

- [ ] Create return request for delivered order
- [ ] List return requests with filters
- [ ] Get return request details
- [ ] Approve return request (admin)
- [ ] Reject return request (admin)
- [ ] Complete return request (admin)
- [ ] Cancel return request (user)
- [ ] Test validation errors (invalid order, wrong status, etc.)
- [ ] Test rate limiting (50 requests per 15 minutes)
- [ ] Test authentication (missing/invalid token)
- [ ] Test CSRF protection

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "orderId",
        "message": "Invalid order ID format"
      }
    ]
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Return request not found"
  }
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many return requests, please try again later"
  }
}
```
