# Order Analytics API Testing Guide

## Overview
This document provides examples for testing the Order Analytics API endpoints using curl or Postman.

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

### 1. Get Order Analytics
Get comprehensive order statistics and analytics.

**Endpoint:** `GET /orders/analytics`

**Query Parameters:**
- `startDate` (optional): Start date for filtering (ISO 8601 format)
- `endDate` (optional): End date for filtering (ISO 8601 format)
- `groupBy` (optional): Grouping period - `day`, `week`, or `month` (default: `day`)

**curl Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/orders/analytics?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&groupBy=day" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 150,
    "totalRevenue": 45000.00,
    "averageOrderValue": 300.00,
    "ordersByStatus": {
      "pending": 10,
      "confirmed": 5,
      "paid": 8,
      "processing": 12,
      "shipped": 20,
      "delivered": 85,
      "cancelled": 8,
      "refunded": 2
    },
    "ordersByPaymentStatus": {
      "pending": 10,
      "processing": 3,
      "completed": 130,
      "failed": 5,
      "refunded": 2
    },
    "revenueByDate": [
      {
        "date": "2024-01-01",
        "revenue": 1500.00,
        "orderCount": 5
      },
      {
        "date": "2024-01-02",
        "revenue": 2100.00,
        "orderCount": 7
      }
    ],
    "topProducts": [
      {
        "productId": "123e4567-e89b-12d3-a456-426614174000",
        "productName": "iPhone 15 Pro",
        "quantity": 25,
        "revenue": 24999.75
      },
      {
        "productId": "123e4567-e89b-12d3-a456-426614174001",
        "productName": "MacBook Pro",
        "quantity": 15,
        "revenue": 29999.85
      }
    ]
  }
}
```

---

### 2. Get Order Analytics by Month
Get monthly aggregated analytics.

**curl Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/orders/analytics?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z&groupBy=month" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 1800,
    "totalRevenue": 540000.00,
    "averageOrderValue": 300.00,
    "ordersByStatus": {
      "delivered": 1500,
      "shipped": 150,
      "processing": 80,
      "cancelled": 70
    },
    "ordersByPaymentStatus": {
      "completed": 1650,
      "pending": 80,
      "failed": 50,
      "refunded": 20
    },
    "revenueByDate": [
      {
        "date": "2024-01",
        "revenue": 45000.00,
        "orderCount": 150
      },
      {
        "date": "2024-02",
        "revenue": 48000.00,
        "orderCount": 160
      },
      {
        "date": "2024-03",
        "revenue": 42000.00,
        "orderCount": 140
      }
    ],
    "topProducts": [...]
  }
}
```

---

### 3. Get Order Analytics by Week
Get weekly aggregated analytics.

**curl Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/orders/analytics?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&groupBy=week" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 150,
    "totalRevenue": 45000.00,
    "averageOrderValue": 300.00,
    "ordersByStatus": {...},
    "ordersByPaymentStatus": {...},
    "revenueByDate": [
      {
        "date": "2024-01",
        "revenue": 10500.00,
        "orderCount": 35
      },
      {
        "date": "2024-02",
        "revenue": 11200.00,
        "orderCount": 37
      }
    ],
    "topProducts": [...]
  }
}
```

---

### 4. Get All-Time Analytics
Get analytics for all orders (no date filter).

**curl Example:**
```bash
curl -X GET "http://localhost:3000/api/v1/orders/analytics" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 5000,
    "totalRevenue": 1500000.00,
    "averageOrderValue": 300.00,
    "ordersByStatus": {
      "delivered": 4200,
      "shipped": 300,
      "processing": 200,
      "cancelled": 250,
      "refunded": 50
    },
    "ordersByPaymentStatus": {
      "completed": 4500,
      "pending": 200,
      "failed": 250,
      "refunded": 50
    },
    "revenueByDate": [...],
    "topProducts": [...]
  }
}
```

---

## Analytics Metrics Explained

### Total Orders
Total number of orders in the specified date range.

### Total Revenue
Sum of all order totals (including tax and shipping) for completed orders.

### Average Order Value (AOV)
Average total amount per order.
```
AOV = Total Revenue / Total Orders
```

### Orders by Status
Distribution of orders across different statuses:
- `pending`: Order created, awaiting payment
- `confirmed`: Order confirmed, payment pending
- `paid`: Payment completed
- `processing`: Order being prepared
- `shipped`: Order shipped to customer
- `delivered`: Order delivered successfully
- `cancelled`: Order cancelled
- `refunded`: Order refunded

### Orders by Payment Status
Distribution of orders across payment statuses:
- `pending`: Payment not yet initiated
- `processing`: Payment being processed
- `completed`: Payment successful
- `failed`: Payment failed
- `refunded`: Payment refunded
- `partially_refunded`: Partial refund issued

### Revenue by Date
Time-series data showing revenue and order count grouped by the specified period (day/week/month).

### Top Products
Top 10 best-selling products by revenue, showing:
- Product ID and name
- Total quantity sold
- Total revenue generated

---

## Use Cases

### 1. Daily Sales Dashboard
```bash
# Get today's analytics
curl -X GET "http://localhost:3000/api/v1/orders/analytics?startDate=$(date -u +%Y-%m-%dT00:00:00Z)&endDate=$(date -u +%Y-%m-%dT23:59:59Z)&groupBy=day" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Monthly Performance Report
```bash
# Get current month analytics
curl -X GET "http://localhost:3000/api/v1/orders/analytics?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&groupBy=day" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Quarterly Business Review
```bash
# Get Q1 2024 analytics
curl -X GET "http://localhost:3000/api/v1/orders/analytics?startDate=2024-01-01T00:00:00Z&endDate=2024-03-31T23:59:59Z&groupBy=month" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Year-over-Year Comparison
```bash
# Get 2023 data
curl -X GET "http://localhost:3000/api/v1/orders/analytics?startDate=2023-01-01T00:00:00Z&endDate=2023-12-31T23:59:59Z&groupBy=month" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get 2024 data
curl -X GET "http://localhost:3000/api/v1/orders/analytics?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z&groupBy=month" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Caching

Analytics data is cached for 5 minutes to improve performance. The cache key includes:
- Start date
- End date
- Group by period

Subsequent requests with the same parameters will return cached data until the TTL expires.

**Cache Invalidation:**
- Automatic after 5 minutes
- Manual invalidation when orders are created/updated (for affected date ranges)

---

## Performance Considerations

### Large Date Ranges
For large date ranges (> 1 year), consider using `groupBy=month` to reduce data points:

```bash
# Good: Monthly grouping for yearly data
curl -X GET "http://localhost:3000/api/v1/orders/analytics?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z&groupBy=month"

# Avoid: Daily grouping for yearly data (365 data points)
curl -X GET "http://localhost:3000/api/v1/orders/analytics?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z&groupBy=day"
```

### Real-time vs Cached Data
- For real-time dashboards: Accept 5-minute cache delay
- For critical decisions: Wait for cache expiration or implement cache invalidation

---

## Testing Checklist

- [ ] Get analytics for today
- [ ] Get analytics for current month
- [ ] Get analytics for custom date range
- [ ] Get analytics with daily grouping
- [ ] Get analytics with weekly grouping
- [ ] Get analytics with monthly grouping
- [ ] Get all-time analytics (no date filter)
- [ ] Verify cache behavior (same request returns cached data)
- [ ] Test with invalid date formats
- [ ] Test with future dates
- [ ] Test with end date before start date
- [ ] Test rate limiting (100 requests per 15 minutes)
- [ ] Test authentication (missing/invalid token)
- [ ] Test authorization (non-admin/merchant access)

---

## Sample Dashboard Queries

### Executive Dashboard
```javascript
// Fetch multiple analytics in parallel
const [today, thisMonth, lastMonth, topProducts] = await Promise.all([
  fetch('/api/v1/orders/analytics?startDate=' + todayStart + '&endDate=' + todayEnd),
  fetch('/api/v1/orders/analytics?startDate=' + monthStart + '&endDate=' + monthEnd),
  fetch('/api/v1/orders/analytics?startDate=' + lastMonthStart + '&endDate=' + lastMonthEnd),
  fetch('/api/v1/orders/analytics?groupBy=month')
]);
```

### Sales Trend Chart
```javascript
// Get last 30 days with daily grouping
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const response = await fetch(
  `/api/v1/orders/analytics?startDate=${thirtyDaysAgo.toISOString()}&endDate=${new Date().toISOString()}&groupBy=day`
);

const data = await response.json();
const chartData = data.data.revenueByDate.map(item => ({
  date: item.date,
  revenue: item.revenue,
  orders: item.orderCount
}));
```

---

## Error Responses

### 400 Bad Request - Invalid Date Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "startDate",
        "message": "Invalid datetime format"
      }
    ]
  }
}
```

### 400 Bad Request - Invalid Group By
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "groupBy",
        "message": "Must be one of: day, week, month"
      }
    ]
  }
}
```

### 403 Forbidden - Insufficient Permissions
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions to access order analytics"
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

---

## Integration with Frontend

### React Example
```typescript
import { useState, useEffect } from 'react';

interface OrderAnalytics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  revenueByDate: Array<{
    date: string;
    revenue: number;
    orderCount: number;
  }>;
}

function useOrderAnalytics(startDate?: string, endDate?: string, groupBy: string = 'day') {
  const [analytics, setAnalytics] = useState<OrderAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ groupBy });
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const response = await fetch(
          `/api/v1/orders/analytics?${params.toString()}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const data = await response.json();
        setAnalytics(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [startDate, endDate, groupBy]);

  return { analytics, loading, error };
}

// Usage in component
function Dashboard() {
  const { analytics, loading, error } = useOrderAnalytics(
    '2024-01-01T00:00:00Z',
    '2024-01-31T23:59:59Z',
    'day'
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!analytics) return null;

  return (
    <div>
      <h1>Order Analytics</h1>
      <div>Total Orders: {analytics.totalOrders}</div>
      <div>Total Revenue: ${analytics.totalRevenue.toFixed(2)}</div>
      <div>Average Order Value: ${analytics.averageOrderValue.toFixed(2)}</div>
      {/* Render charts and tables */}
    </div>
  );
}
```

---

## Notes

- All monetary values are in the system's base currency (e.g., USD)
- Dates are in ISO 8601 format with timezone (UTC recommended)
- Analytics include all order statuses unless filtered
- Revenue calculations include tax and shipping costs
- Top products are ranked by total revenue, not quantity
- Cache TTL is 5 minutes for all analytics queries
- Rate limit is 100 requests per 15 minutes per user
