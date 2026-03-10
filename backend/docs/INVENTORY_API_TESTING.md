# Inventory Management API Testing Guide

## Overview
This document provides examples for testing the Inventory Management API endpoints using curl or Postman.

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Inventory Operations Flow

```
1. Check Availability → 2. Reserve → 3. Deduct (on payment) → Order Complete
                                  ↓
                              4. Release (on cancel/timeout)
```

## API Endpoints

### 1. Get Inventory
Get current inventory status for a product.

**Endpoint:** `GET /inventory/:productId`

**curl Example:**
```bash
curl -X GET http://localhost:3000/api/v1/inventory/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "productId": "123e4567-e89b-12d3-a456-426614174000",
    "quantity": 100,
    "reservedQuantity": 10,
    "availableQuantity": 90,
    "lowStockThreshold": 20,
    "isInStock": true,
    "isLowStock": false,
    "lastRestockedAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 2. Check Inventory Availability
Check if sufficient inventory is available for multiple products.

**Endpoint:** `POST /inventory/check`

**Request Body:**
```json
{
  "items": [
    {
      "productId": "123e4567-e89b-12d3-a456-426614174000",
      "quantity": 5
    },
    {
      "productId": "123e4567-e89b-12d3-a456-426614174001",
      "quantity": 3
    }
  ]
}
```

**curl Example:**
```bash
curl -X POST http://localhost:3000/api/v1/inventory/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "items": [
      {
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "quantity": 5
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allAvailable": true,
    "items": [
      {
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "available": true,
        "availableQuantity": 90,
        "requestedQuantity": 5,
        "isInStock": true,
        "isLowStock": false
      },
      {
        "productId": "123e4567-e89b-12d3-a456-426614174001",
        "available": false,
        "availableQuantity": 2,
        "requestedQuantity": 3,
        "isInStock": true,
        "isLowStock": true
      }
    ]
  }
}
```

---

### 3. Reserve Inventory
Reserve inventory for pending orders (increases reserved_quantity).

**Endpoint:** `POST /inventory/reserve`

**Request Body:**
```json
{
  "items": [
    {
      "productId": "123e4567-e89b-12d3-a456-426614174000",
      "quantity": 5
    }
  ],
  "orderId": "123e4567-e89b-12d3-a456-426614174002"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:3000/api/v1/inventory/reserve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "items": [
      {
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "quantity": 5
      }
    ],
    "orderId": "123e4567-e89b-12d3-a456-426614174002"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "results": [
      {
        "success": true,
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "previousQuantity": 100,
        "newQuantity": 100,
        "previousReserved": 10,
        "newReserved": 15,
        "availableQuantity": 85,
        "message": "Reserved 5 units"
      }
    ]
  },
  "message": "Inventory reserved successfully"
}
```

**Failure Response (Insufficient Stock):**
```json
{
  "success": false,
  "error": {
    "code": "INVENTORY_RESERVATION_FAILED",
    "message": "Failed to reserve inventory for some items",
    "details": [
      {
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "reason": "Insufficient inventory. Available: 2, Requested: 5"
      }
    ]
  },
  "data": {
    "results": []
  }
}
```

---

### 4. Deduct Inventory
Deduct inventory when order is confirmed/paid (decreases both quantity and reserved_quantity).

**Endpoint:** `POST /inventory/deduct`

**Request Body:**
```json
{
  "items": [
    {
      "productId": "123e4567-e89b-12d3-a456-426614174000",
      "quantity": 5
    }
  ],
  "orderId": "123e4567-e89b-12d3-a456-426614174002"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:3000/api/v1/inventory/deduct \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "items": [
      {
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "quantity": 5
      }
    ],
    "orderId": "123e4567-e89b-12d3-a456-426614174002"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "results": [
      {
        "success": true,
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "previousQuantity": 100,
        "newQuantity": 95,
        "previousReserved": 15,
        "newReserved": 10,
        "availableQuantity": 85,
        "message": "Deducted 5 units"
      }
    ]
  },
  "message": "Inventory deducted successfully"
}
```

---

### 5. Release Inventory
Release reserved inventory when order is cancelled or payment fails (decreases reserved_quantity only).

**Endpoint:** `POST /inventory/release`

**Request Body:**
```json
{
  "items": [
    {
      "productId": "123e4567-e89b-12d3-a456-426614174000",
      "quantity": 5
    }
  ],
  "orderId": "123e4567-e89b-12d3-a456-426614174002"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:3000/api/v1/inventory/release \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "items": [
      {
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "quantity": 5
      }
    ],
    "orderId": "123e4567-e89b-12d3-a456-426614174002"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "results": [
      {
        "success": true,
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "previousQuantity": 100,
        "newQuantity": 100,
        "previousReserved": 15,
        "newReserved": 10,
        "availableQuantity": 90,
        "message": "Released 5 units"
      }
    ]
  },
  "message": "Inventory released successfully"
}
```

---

### 6. Update Inventory (Restock)
Update inventory quantity and low stock threshold (Admin only).

**Endpoint:** `PUT /inventory/:productId`

**Request Body:**
```json
{
  "quantity": 200,
  "lowStockThreshold": 30
}
```

**curl Example:**
```bash
curl -X PUT http://localhost:3000/api/v1/inventory/123e4567-e89b-12d3-a456-426614174000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -d '{
    "quantity": 200,
    "lowStockThreshold": 30
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "productId": "123e4567-e89b-12d3-a456-426614174000",
    "quantity": 200,
    "reservedQuantity": 10,
    "availableQuantity": 190,
    "lowStockThreshold": 30,
    "isInStock": true,
    "isLowStock": false,
    "lastRestockedAt": "2024-01-15T11:00:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  },
  "message": "Inventory updated successfully"
}
```

---

### 7. Get Low Stock Alerts
Get list of products with low or out of stock inventory (Admin only).

**Endpoint:** `GET /inventory/alerts/low-stock`

**Query Parameters:**
- `limit` (optional): Maximum number of alerts to return (default: 50)

**curl Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/inventory/alerts/low-stock?limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "productName": "iPhone 15 Pro",
        "availableQuantity": 0,
        "lowStockThreshold": 10,
        "isOutOfStock": true
      },
      {
        "productId": "123e4567-e89b-12d3-a456-426614174001",
        "productName": "MacBook Pro",
        "availableQuantity": 5,
        "lowStockThreshold": 10,
        "isOutOfStock": false
      }
    ],
    "count": 2
  }
}
```

---

## Inventory Operation Scenarios

### Scenario 1: Normal Order Flow
```
1. Check availability → All items available
2. Reserve inventory → Reserved successfully
3. Customer pays → Deduct inventory
4. Order complete → Inventory permanently reduced
```

### Scenario 2: Order Cancellation
```
1. Check availability → All items available
2. Reserve inventory → Reserved successfully
3. Customer cancels → Release inventory
4. Inventory restored → Available quantity increased
```

### Scenario 3: Payment Timeout
```
1. Check availability → All items available
2. Reserve inventory → Reserved successfully
3. Payment timeout (15 min) → Auto-release inventory
4. Inventory restored → Available quantity increased
```

### Scenario 4: Insufficient Stock
```
1. Check availability → Some items unavailable
2. Show error to customer → Cannot proceed with order
3. No inventory changes → System remains consistent
```

---

## Atomic Operations

All inventory operations use database transactions with row-level locking (`FOR UPDATE`) to prevent race conditions:

- **Reserve**: Locks row → Checks availability → Updates reserved_quantity → Commits
- **Deduct**: Locks row → Checks reserved → Updates both quantities → Commits
- **Release**: Locks row → Checks reserved → Updates reserved_quantity → Commits

If any item in a batch operation fails, the entire transaction is rolled back.

---

## Computed Fields

The following fields are automatically computed by the database:

- `available_quantity` = `quantity` - `reserved_quantity`
- `is_in_stock` = `available_quantity` > 0
- `is_low_stock` = `available_quantity` <= `low_stock_threshold` AND `available_quantity` > 0

---

## Testing Checklist

- [ ] Get inventory for a product
- [ ] Check availability for multiple products
- [ ] Reserve inventory successfully
- [ ] Reserve inventory with insufficient stock (should fail)
- [ ] Deduct inventory after reservation
- [ ] Deduct inventory without reservation (should fail)
- [ ] Release reserved inventory
- [ ] Update inventory (restock)
- [ ] Get low stock alerts
- [ ] Test concurrent reservations (race condition)
- [ ] Test transaction rollback on partial failure
- [ ] Test rate limiting (100 requests per 15 minutes)
- [ ] Test authentication (missing/invalid token)
- [ ] Test CSRF protection

---

## Concurrency Testing

Test race conditions with concurrent requests:

```bash
# Terminal 1
curl -X POST http://localhost:3000/api/v1/inventory/reserve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN1" \
  -d '{"items":[{"productId":"PRODUCT_ID","quantity":50}]}'

# Terminal 2 (simultaneously)
curl -X POST http://localhost:3000/api/v1/inventory/reserve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN2" \
  -d '{"items":[{"productId":"PRODUCT_ID","quantity":50}]}'
```

Expected: Only one request should succeed if total available is < 100.

---

## Error Responses

### 400 Bad Request - Insufficient Stock
```json
{
  "success": false,
  "error": {
    "code": "INVENTORY_RESERVATION_FAILED",
    "message": "Failed to reserve inventory for some items",
    "details": [
      {
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "reason": "Insufficient inventory. Available: 2, Requested: 5"
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
    "message": "Inventory not found for this product"
  }
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many inventory requests, please try again later"
  }
}
```
