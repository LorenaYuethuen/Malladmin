# 架构优化文档 (Architecture Optimization Document)

## 目录 (Table of Contents)

1. [架构与技术栈](#1-架构与技术栈)
2. [数据一致性与事件策略](#2-数据一致性与事件策略)
3. [API 标准与版本管理](#3-api-标准与版本管理)
4. [安全与授权](#4-安全与授权)
5. [数据迁移策略](#5-数据迁移策略)
6. [前端设计系统与用户体验](#6-前端设计系统与用户体验)
7. [性能与可扩展性](#7-性能与可扩展性)
8. [测试策略与 CI/CD](#8-测试策略与-cicd)
9. [分阶段实施路线图](#9-分阶段实施路线图)
10. [监控与可观测性](#10-监控与可观测性)

---

## 1. 架构与技术栈

### 1.1 整体架构设计

```mermaid
graph TB
    subgraph "客户端层 (Client Layer)"
        A[React SPA<br/>TypeScript + Tailwind CSS]
        B[状态管理<br/>React Context + Hooks]
        C[路由管理<br/>React Router v6]
    end
    
    subgraph "API 网关层 (API Gateway Layer)"
        D[Nginx / API Gateway]
        E[负载均衡器<br/>Load Balancer]
        F[限流与熔断<br/>Rate Limiting]
    end
    
    subgraph "应用服务层 (Application Layer)"
        G[认证服务<br/>Auth Service]
        H[产品服务<br/>Product Service]
        I[订单服务<br/>Order Service]
        J[营销服务<br/>Marketing Service]
        K[用户服务<br/>User Service]
    end
    
    subgraph "数据层 (Data Layer)"
        L[(PostgreSQL<br/>主数据库)]
        M[(Redis<br/>缓存层)]
        N[(Elasticsearch<br/>搜索引擎)]
        O[对象存储<br/>S3/OSS]
    end
    
    subgraph "外部集成 (External Integration)"
        P[支付网关<br/>Payment Gateway]
        Q[物流 API<br/>Logistics API]
        R[库存系统<br/>Inventory System]
    end
    
    A --> D
    D --> E
    E --> F
    F --> G
    F --> H
    F --> I
    F --> J
    F --> K
    
    G --> L
    H --> L
    I --> L
    J --> L
    K --> L
    
    H --> M
    I --> M
    J --> M
    
    H --> N
    
    H --> O
    
    I --> P
    I --> Q
    I --> R
```

### 1.2 技术栈选型与理由

#### 前端技术栈

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| React | 18.x | 成熟的组件化框架，丰富的生态系统，优秀的性能 |
| TypeScript | 5.x | 类型安全，提升代码质量和可维护性 |
| Tailwind CSS | 3.x | 实用优先的 CSS 框架，快速开发，一致的设计系统 |
| React Router | 6.x | 声明式路由，支持嵌套路由和懒加载 |
| React Query | 4.x | 强大的数据获取和缓存管理，减少样板代码 |
| Zustand | 4.x | 轻量级状态管理，简单易用，TypeScript 友好 |
| Zod | 3.x | 运行时类型验证，与 TypeScript 完美集成 |
| Vite | 5.x | 快速的开发服务器和构建工具 |

#### 后端技术栈

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| Node.js | 20.x LTS | 统一前后端语言，丰富的生态系统 |
| Express.js | 4.x | 成熟的 Web 框架，灵活可扩展 |
| PostgreSQL | 15.x | 强大的关系型数据库，支持 JSONB，事务完整性 |
| Redis | 7.x | 高性能缓存，支持多种数据结构 |
| Elasticsearch | 8.x | 全文搜索引擎，支持复杂查询和聚合 |
| Prisma | 5.x | 现代化 ORM，类型安全，优秀的开发体验 |

### 1.3 微服务架构设计

```mermaid
graph LR
    subgraph "前端应用 (Frontend)"
        A[React Admin SPA]
    end
    
    subgraph "BFF 层 (Backend for Frontend)"
        B[Admin BFF Service]
    end
    
    subgraph "核心服务 (Core Services)"
        C[Auth Service]
        D[Product Service]
        E[Order Service]
        F[Marketing Service]
        G[User Service]
    end
    
    subgraph "基础设施服务 (Infrastructure)"
        H[File Service]
        I[Notification Service]
        J[Search Service]
    end
    
    subgraph "数据存储 (Data Storage)"
        K[(PostgreSQL)]
        L[(Redis)]
        M[(Elasticsearch)]
    end
    
    A --> B
    B --> C
    B --> D
    B --> E
    B --> F
    B --> G
    
    D --> H
    E --> I
    D --> J
    
    C --> K
    D --> K
    E --> K
    F --> K
    G --> K
    
    D --> L
    E --> L
    
    J --> M
```

---

## 2. 数据一致性与事件策略

### 2.1 Transactional Outbox 模式

Transactional Outbox 模式确保数据库操作和事件发布的原子性，避免分布式事务的复杂性。

#### 架构图

```mermaid
sequenceDiagram
    participant API as API Service
    participant DB as Database
    participant Outbox as Outbox Table
    participant Worker as Outbox Worker
    participant MQ as Message Queue
    participant Consumer as Event Consumer
    
    API->>DB: BEGIN TRANSACTION
    API->>DB: INSERT/UPDATE Business Data
    API->>Outbox: INSERT Event Record
    API->>DB: COMMIT TRANSACTION
    
    Worker->>Outbox: Poll for New Events
    Outbox-->>Worker: Return Unprocessed Events
    Worker->>MQ: Publish Event
    MQ-->>Consumer: Deliver Event
    Consumer->>Consumer: Process Event
    Consumer-->>MQ: ACK
    Worker->>Outbox: Mark Event as Processed
```

#### 实现代码

```typescript
// outbox.model.ts

interface OutboxEvent {
  id: string;
  aggregateType: string; // 'order', 'product', 'user', etc.
  aggregateId: string;
  eventType: string; // 'OrderCreated', 'ProductUpdated', etc.
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

// outbox.service.ts
import { PrismaClient } from '@prisma/client';

export class OutboxService {
  constructor(private prisma: PrismaClient) {}

  async createEvent(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, any>,
    tx?: any
  ): Promise<OutboxEvent> {
    const client = tx || this.prisma;
    
    return client.outboxEvent.create({
      data: {
        aggregateType,
        aggregateId,
        eventType,
        payload,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      },
    });
  }

  async getUnprocessedEvents(limit: number = 100): Promise<OutboxEvent[]> {
    return this.prisma.outboxEvent.findMany({
      where: {
        status: 'pending',
        retryCount: { lt: this.prisma.outboxEvent.fields.maxRetries },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markAsProcessed(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'processed',
        processedAt: new Date(),
      },
    });
  }

  async markAsFailed(eventId: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'failed',
        error,
        retryCount: { increment: 1 },
      },
    });
  }
}


// outbox.worker.ts
import { OutboxService } from './outbox.service';
import { MessageQueue } from './message-queue';

export class OutboxWorker {
  private isRunning = false;
  private pollInterval = 5000; // 5 seconds

  constructor(
    private outboxService: OutboxService,
    private messageQueue: MessageQueue
  ) {}

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('Outbox worker started');
    
    while (this.isRunning) {
      try {
        await this.processEvents();
      } catch (error) {
        console.error('Error processing outbox events:', error);
      }
      
      await this.sleep(this.pollInterval);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('Outbox worker stopped');
  }

  private async processEvents(): Promise<void> {
    const events = await this.outboxService.getUnprocessedEvents();
    
    for (const event of events) {
      try {
        // Publish to message queue
        await this.messageQueue.publish(event.eventType, event.payload);
        
        // Mark as processed
        await this.outboxService.markAsProcessed(event.id);
        
        console.log(`Event ${event.id} processed successfully`);
      } catch (error) {
        console.error(`Failed to process event ${event.id}:`, error);
        await this.outboxService.markAsFailed(event.id, error.message);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


// 使用示例：订单创建时发布事件
async function createOrder(orderData: CreateOrderData): Promise<Order> {
  return await prisma.$transaction(async (tx) => {
    // 1. 创建订单
    const order = await tx.order.create({
      data: orderData,
    });

    // 2. 创建 Outbox 事件
    await outboxService.createEvent(
      'order',
      order.id,
      'OrderCreated',
      {
        orderId: order.id,
        customerId: order.customerId,
        total: order.total,
        items: order.items,
      },
      tx
    );

    return order;
  });
}
```

### 2.2 库存预留与扣减流程

库存管理是电商系统的核心，需要确保在高并发场景下不会出现超卖问题。

#### 库存状态流转图

```mermaid
stateDiagram-v2
    [*] --> Available: 初始库存
    Available --> Reserved: 下单预留
    Reserved --> Deducted: 支付成功
    Reserved --> Available: 订单取消/超时
    Deducted --> Available: 退款/退货
    Available --> [*]: 库存清零
```

#### 库存预留与扣减实现

```typescript
// inventory.service.ts
export class InventoryService {
  constructor(private prisma: PrismaClient, private redis: Redis) {}

  /**
   * 预留库存（下单时调用）
   * 使用 Redis 分布式锁确保并发安全
   */
  async reserveInventory(
    productId: string,
    skuId: string,
    quantity: number,
    orderId: string
  ): Promise<boolean> {
    const lockKey = `inventory:lock:${skuId}`;
    const lock = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');
    
    if (!lock) {
      throw new Error('Failed to acquire inventory lock');
    }

    try {
      // 检查可用库存
      const inventory = await this.prisma.inventory.findUnique({
        where: { skuId },
      });

      if (!inventory || inventory.available < quantity) {
        return false;
      }

      // 预留库存
      await this.prisma.inventory.update({
        where: { skuId },
        data: {
          available: { decrement: quantity },
          reserved: { increment: quantity },
        },
      });

      // 记录预留记录
      await this.prisma.inventoryReservation.create({
        data: {
          skuId,
          orderId,
          quantity,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15分钟过期
        },
      });

      return true;
    } finally {
      await this.redis.del(lockKey);
    }
  }


  /**
   * 扣减库存（支付成功后调用）
   */
  async deductInventory(orderId: string): Promise<void> {
    const reservations = await this.prisma.inventoryReservation.findMany({
      where: { orderId, status: 'reserved' },
    });

    for (const reservation of reservations) {
      const lockKey = `inventory:lock:${reservation.skuId}`;
      const lock = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');
      
      if (!lock) {
        throw new Error('Failed to acquire inventory lock');
      }

      try {
        // 扣减预留库存
        await this.prisma.inventory.update({
          where: { skuId: reservation.skuId },
          data: {
            reserved: { decrement: reservation.quantity },
            sold: { increment: reservation.quantity },
          },
        });

        // 更新预留记录状态
        await this.prisma.inventoryReservation.update({
          where: { id: reservation.id },
          data: { status: 'deducted' },
        });
      } finally {
        await this.redis.del(lockKey);
      }
    }
  }

  /**
   * 释放库存（订单取消或超时）
   */
  async releaseInventory(orderId: string): Promise<void> {
    const reservations = await this.prisma.inventoryReservation.findMany({
      where: { orderId, status: 'reserved' },
    });

    for (const reservation of reservations) {
      const lockKey = `inventory:lock:${reservation.skuId}`;
      const lock = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');
      
      if (!lock) {
        throw new Error('Failed to acquire inventory lock');
      }

      try {
        // 释放预留库存
        await this.prisma.inventory.update({
          where: { skuId: reservation.skuId },
          data: {
            available: { increment: reservation.quantity },
            reserved: { decrement: reservation.quantity },
          },
        });

        // 更新预留记录状态
        await this.prisma.inventoryReservation.update({
          where: { id: reservation.id },
          data: { status: 'released' },
        });
      } finally {
        await this.redis.del(lockKey);
      }
    }
  }
}
```



### 2.3 幂等性保证

在分布式系统中，幂等性是确保系统可靠性的关键。

#### 幂等性中间件实现

```typescript
// idempotency.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import crypto from 'crypto';

export class IdempotencyMiddleware {
  constructor(private redis: Redis) {}

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // 只对 POST, PUT, PATCH 请求进行幂等性检查
      if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
        return next();
      }

      const idempotencyKey = req.headers['idempotency-key'] as string;
      
      if (!idempotencyKey) {
        return res.status(400).json({
          error: 'Idempotency-Key header is required',
        });
      }

      // 生成请求指纹
      const requestFingerprint = this.generateFingerprint(req);
      const cacheKey = `idempotency:${idempotencyKey}`;

      // 检查是否已处理过
      const cachedResponse = await this.redis.get(cacheKey);
      
      if (cachedResponse) {
        const parsed = JSON.parse(cachedResponse);
        
        // 验证请求指纹是否匹配
        if (parsed.fingerprint !== requestFingerprint) {
          return res.status(422).json({
            error: 'Idempotency key reused with different request',
          });
        }

        // 返回缓存的响应
        return res.status(parsed.status).json(parsed.body);
      }

      // 拦截响应
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        // 缓存响应（24小时）
        this.redis.setex(
          cacheKey,
          86400,
          JSON.stringify({
            fingerprint: requestFingerprint,
            status: res.statusCode,
            body,
          })
        );

        return originalJson(body);
      };

      next();
    };
  }

  private generateFingerprint(req: Request): string {
    const data = {
      method: req.method,
      path: req.path,
      body: req.body,
      query: req.query,
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }
}


// 使用示例
import express from 'express';
import { IdempotencyMiddleware } from './idempotency.middleware';

const app = express();
const idempotencyMiddleware = new IdempotencyMiddleware(redis);

app.use(idempotencyMiddleware.middleware());

app.post('/api/orders', async (req, res) => {
  // 业务逻辑
  const order = await createOrder(req.body);
  res.json(order);
});
```

---

## 3. API 标准与版本管理

### 3.1 RESTful API 设计规范

#### API 命名规范

| 操作 | HTTP 方法 | 路径示例 | 说明 |
|------|-----------|----------|------|
| 列表查询 | GET | `/api/v1/products` | 获取资源列表 |
| 详情查询 | GET | `/api/v1/products/:id` | 获取单个资源 |
| 创建资源 | POST | `/api/v1/products` | 创建新资源 |
| 更新资源 | PUT | `/api/v1/products/:id` | 完整更新资源 |
| 部分更新 | PATCH | `/api/v1/products/:id` | 部分更新资源 |
| 删除资源 | DELETE | `/api/v1/products/:id` | 删除资源 |
| 批量操作 | POST | `/api/v1/products/batch` | 批量操作 |

#### 统一响应格式

```typescript
// api-response.types.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string; // 仅开发环境
}

export interface ResponseMeta {
  timestamp: string;
  requestId: string;
  version: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 成功响应示例
{
  "success": true,
  "data": {
    "id": "prod_123",
    "name": "Product Name",
    "price": 99.99
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123",
    "version": "1.0.0"
  }
}

// 错误响应示例
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product with ID prod_123 not found",
    "details": {
      "productId": "prod_123"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123",
    "version": "1.0.0"
  }
}
```



### 3.2 错误码标准

```typescript
// error-codes.ts
export enum ErrorCode {
  // 通用错误 (1000-1999)
  INTERNAL_SERVER_ERROR = 'ERR_1000',
  INVALID_REQUEST = 'ERR_1001',
  UNAUTHORIZED = 'ERR_1002',
  FORBIDDEN = 'ERR_1003',
  NOT_FOUND = 'ERR_1004',
  VALIDATION_ERROR = 'ERR_1005',
  RATE_LIMIT_EXCEEDED = 'ERR_1006',
  
  // 产品相关错误 (2000-2999)
  PRODUCT_NOT_FOUND = 'ERR_2000',
  PRODUCT_ALREADY_EXISTS = 'ERR_2001',
  INVALID_PRODUCT_DATA = 'ERR_2002',
  PRODUCT_OUT_OF_STOCK = 'ERR_2003',
  
  // 订单相关错误 (3000-3999)
  ORDER_NOT_FOUND = 'ERR_3000',
  INVALID_ORDER_STATUS = 'ERR_3001',
  ORDER_CANNOT_BE_CANCELLED = 'ERR_3002',
  PAYMENT_FAILED = 'ERR_3003',
  INSUFFICIENT_INVENTORY = 'ERR_3004',
  
  // 用户相关错误 (4000-4999)
  USER_NOT_FOUND = 'ERR_4000',
  USER_ALREADY_EXISTS = 'ERR_4001',
  INVALID_CREDENTIALS = 'ERR_4002',
  EMAIL_ALREADY_REGISTERED = 'ERR_4003',
  
  // 营销相关错误 (5000-5999)
  COUPON_NOT_FOUND = 'ERR_5000',
  COUPON_EXPIRED = 'ERR_5001',
  COUPON_ALREADY_USED = 'ERR_5002',
  INVALID_COUPON_CODE = 'ERR_5003',
}

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.INTERNAL_SERVER_ERROR]: '服务器内部错误',
  [ErrorCode.INVALID_REQUEST]: '无效的请求',
  [ErrorCode.UNAUTHORIZED]: '未授权访问',
  [ErrorCode.FORBIDDEN]: '禁止访问',
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.VALIDATION_ERROR]: '数据验证失败',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求频率超限',
  
  [ErrorCode.PRODUCT_NOT_FOUND]: '产品不存在',
  [ErrorCode.PRODUCT_ALREADY_EXISTS]: '产品已存在',
  [ErrorCode.INVALID_PRODUCT_DATA]: '无效的产品数据',
  [ErrorCode.PRODUCT_OUT_OF_STOCK]: '产品库存不足',
  
  [ErrorCode.ORDER_NOT_FOUND]: '订单不存在',
  [ErrorCode.INVALID_ORDER_STATUS]: '无效的订单状态',
  [ErrorCode.ORDER_CANNOT_BE_CANCELLED]: '订单无法取消',
  [ErrorCode.PAYMENT_FAILED]: '支付失败',
  [ErrorCode.INSUFFICIENT_INVENTORY]: '库存不足',
  
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.USER_ALREADY_EXISTS]: '用户已存在',
  [ErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',
  [ErrorCode.EMAIL_ALREADY_REGISTERED]: '邮箱已被注册',
  
  [ErrorCode.COUPON_NOT_FOUND]: '优惠券不存在',
  [ErrorCode.COUPON_EXPIRED]: '优惠券已过期',
  [ErrorCode.COUPON_ALREADY_USED]: '优惠券已使用',
  [ErrorCode.INVALID_COUPON_CODE]: '无效的优惠券代码',
};
```



### 3.3 API 版本管理策略

#### URL 版本控制

```typescript
// 推荐方式：URL 路径版本控制
GET /api/v1/products
GET /api/v2/products

// 版本路由配置
import express from 'express';
import { v1Router } from './routes/v1';
import { v2Router } from './routes/v2';

const app = express();

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// 默认路由指向最新版本
app.use('/api', v2Router);
```

#### 版本兼容性策略

```typescript
// version.middleware.ts
export class VersionMiddleware {
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const version = this.extractVersion(req);
      
      // 检查版本是否支持
      if (!this.isSupportedVersion(version)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_API_VERSION',
            message: `API version ${version} is not supported`,
            details: {
              supportedVersions: ['v1', 'v2'],
              deprecatedVersions: [],
            },
          },
        });
      }

      // 检查版本是否已弃用
      if (this.isDeprecatedVersion(version)) {
        res.setHeader('X-API-Deprecated', 'true');
        res.setHeader('X-API-Sunset-Date', '2024-12-31');
      }

      req.apiVersion = version;
      next();
    };
  }

  private extractVersion(req: Request): string {
    // 从 URL 路径提取版本
    const match = req.path.match(/^\/api\/(v\d+)\//);
    return match ? match[1] : 'v1';
  }

  private isSupportedVersion(version: string): boolean {
    return ['v1', 'v2'].includes(version);
  }

  private isDeprecatedVersion(version: string): boolean {
    return ['v1'].includes(version);
  }
}
```

### 3.4 OpenAPI 规范

```yaml
# openapi.yaml
openapi: 3.0.3
info:
  title: Mall Admin API
  version: 1.0.0
  description: E-commerce admin management API
  contact:
    name: API Support
    email: api@example.com

servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://staging-api.example.com/v1
    description: Staging server

paths:
  /products:
    get:
      summary: Get product list
      tags:
        - Products
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: status
          in: query
          schema:
            type: string
            enum: [active, inactive, draft]
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProductListResponse'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

components:
  schemas:
    Product:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        price:
          type: number
        status:
          type: string
          enum: [active, inactive, draft]
      required:
        - id
        - name
        - price
        - status

    ProductListResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: array
          items:
            $ref: '#/components/schemas/Product'
        meta:
          $ref: '#/components/schemas/ResponseMeta'

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
        error:
          $ref: '#/components/schemas/ApiError'

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
```



---

## 4. 安全与授权

### 4.1 JWT 认证流程

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant API as API Gateway
    participant Auth as Auth Service
    participant DB as Database
    participant Redis as Redis Cache
    
    Client->>API: POST /auth/login<br/>{username, password}
    API->>Auth: 验证凭证
    Auth->>DB: 查询用户信息
    DB-->>Auth: 返回用户数据
    Auth->>Auth: 验证密码
    Auth->>Auth: 生成 JWT Token
    Auth->>Redis: 存储 Session
    Auth-->>API: 返回 Token
    API-->>Client: {accessToken, refreshToken}
    
    Client->>API: GET /products<br/>Authorization: Bearer {token}
    API->>API: 验证 Token
    API->>Redis: 检查 Session
    Redis-->>API: Session 有效
    API->>API: 解析用户权限
    API-->>Client: 返回数据
```

#### JWT 实现

```typescript
// jwt.service.ts
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export class JWTService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry = '15m';
  private refreshTokenExpiry = '7d';

  constructor(private redis: Redis) {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET!;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET!;
  }

  generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'mall-admin',
      audience: 'mall-admin-api',
    });
  }

  generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(
      { userId: payload.userId },
      this.refreshTokenSecret,
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'mall-admin',
        audience: 'mall-admin-api',
      }
    );
  }

  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  verifyRefreshToken(token: string): { userId: string } {
    try {
      return jwt.verify(token, this.refreshTokenSecret) as { userId: string };
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  async storeRefreshToken(userId: string, token: string): Promise<void> {
    const key = `refresh_token:${userId}`;
    await this.redis.setex(key, 7 * 24 * 60 * 60, token); // 7 days
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    const key = `refresh_token:${userId}`;
    await this.redis.del(key);
  }

  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    const key = `refresh_token:${userId}`;
    const storedToken = await this.redis.get(key);
    return storedToken === token;
  }
}
```



### 4.2 RBAC 权限控制

#### 权限模型

```mermaid
erDiagram
    USER ||--o{ USER_ROLE : has
    ROLE ||--o{ USER_ROLE : assigned_to
    ROLE ||--o{ ROLE_PERMISSION : has
    PERMISSION ||--o{ ROLE_PERMISSION : granted_to
    PERMISSION ||--|| RESOURCE : controls
    
    USER {
        string id PK
        string username
        string email
        string status
    }
    
    ROLE {
        string id PK
        string name
        string description
        boolean is_system
    }
    
    PERMISSION {
        string id PK
        string name
        string resource
        string action
    }
    
    RESOURCE {
        string id PK
        string name
        string path
        string method
    }
```

#### RBAC 实现

```typescript
// rbac.service.ts
export class RBACService {
  constructor(private prisma: PrismaClient) {}

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // 收集所有权限（去重）
    const permissions = new Map<string, Permission>();
    
    for (const userRole of user.roles) {
      for (const rolePermission of userRole.role.permissions) {
        const permission = rolePermission.permission;
        permissions.set(permission.id, permission);
      }
    }

    return Array.from(permissions.values());
  }

  async hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    return permissions.some(
      p => p.resource === resource && p.action === action
    );
  }

  async hasAnyPermission(
    userId: string,
    requiredPermissions: Array<{ resource: string; action: string }>
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    return requiredPermissions.some(required =>
      permissions.some(
        p => p.resource === required.resource && p.action === required.action
      )
    );
  }

  async hasAllPermissions(
    userId: string,
    requiredPermissions: Array<{ resource: string; action: string }>
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    return requiredPermissions.every(required =>
      permissions.some(
        p => p.resource === required.resource && p.action === required.action
      )
    );
  }
}
```



#### 权限中间件

```typescript
// permission.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { RBACService } from './rbac.service';

export interface PermissionRequirement {
  resource: string;
  action: string;
}

export class PermissionMiddleware {
  constructor(private rbacService: RBACService) {}

  require(requirements: PermissionRequirement | PermissionRequirement[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const requiredPermissions = Array.isArray(requirements)
        ? requirements
        : [requirements];

      const hasPermission = await this.rbacService.hasAllPermissions(
        userId,
        requiredPermissions
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
            details: {
              required: requiredPermissions,
            },
          },
        });
      }

      next();
    };
  }

  requireAny(requirements: PermissionRequirement[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const hasPermission = await this.rbacService.hasAnyPermission(
        userId,
        requirements
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          },
        });
      }

      next();
    };
  }
}

// 使用示例
import express from 'express';

const app = express();
const permissionMiddleware = new PermissionMiddleware(rbacService);

// 需要单个权限
app.get(
  '/api/products',
  permissionMiddleware.require({ resource: 'product', action: 'read' })
);

// 需要多个权限
app.post(
  '/api/products',
  permissionMiddleware.require([
    { resource: 'product', action: 'create' },
    { resource: 'inventory', action: 'write' },
  ])
);

// 需要任一权限
app.get(
  '/api/reports',
  permissionMiddleware.requireAny([
    { resource: 'report', action: 'read' },
    { resource: 'admin', action: 'all' },
  ])
);
```



### 4.3 安全检查清单

#### 输入验证

```typescript
// validation.middleware.ts
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export class ValidationMiddleware {
  static validate(schema: z.ZodSchema) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        req.body = await schema.parseAsync(req.body);
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error.errors,
            },
          });
        }
        next(error);
      }
    };
  }
}

// 使用示例
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  sku: z.string().regex(/^[A-Z0-9-]+$/),
  categoryId: z.string().uuid(),
  brandId: z.string().uuid(),
  images: z.array(z.string().url()).max(10),
});

app.post(
  '/api/products',
  ValidationMiddleware.validate(createProductSchema),
  async (req, res) => {
    // req.body 已经过验证和类型转换
    const product = await productService.create(req.body);
    res.json({ success: true, data: product });
  }
);
```

#### XSS 防护

```typescript
// xss.middleware.ts
import xss from 'xss';

export class XSSMiddleware {
  static sanitize() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }
      if (req.params) {
        req.params = this.sanitizeObject(req.params);
      }
      next();
    };
  }

  private static sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return xss(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = this.sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return obj;
  }
}
```

#### CSRF 防护

```typescript
// csrf.middleware.ts
import csrf from 'csurf';

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});

app.use(csrfProtection);

// 在响应中包含 CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({
    success: true,
    data: {
      csrfToken: req.csrfToken(),
    },
  });
});
```

#### 速率限制

```typescript
// rate-limit.middleware.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Redis } from 'ioredis';

export class RateLimitMiddleware {
  static create(redis: Redis, options: {
    windowMs: number;
    max: number;
    message?: string;
  }) {
    return rateLimit({
      store: new RedisStore({
        client: redis,
        prefix: 'rate_limit:',
      }),
      windowMs: options.windowMs,
      max: options.max,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: options.message || 'Too many requests',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }
}

// 使用示例
// 通用 API 限制：每 15 分钟 100 次请求
app.use('/api', RateLimitMiddleware.create(redis, {
  windowMs: 15 * 60 * 1000,
  max: 100,
}));

// 登录接口限制：每 15 分钟 5 次请求
app.use('/api/auth/login', RateLimitMiddleware.create(redis, {
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts',
}));
```



---

## 5. 数据迁移策略

### 5.1 七阶段迁移计划

```mermaid
graph LR
    A[阶段1<br/>数据评估] --> B[阶段2<br/>环境准备]
    B --> C[阶段3<br/>Schema迁移]
    C --> D[阶段4<br/>数据迁移]
    D --> E[阶段5<br/>数据验证]
    E --> F[阶段6<br/>切换上线]
    F --> G[阶段7<br/>监控优化]
```

#### 阶段 1: 数据评估与分析

```typescript
// migration-assessment.ts
import { PrismaClient as OldPrismaClient } from '@prisma/old-client';
import { PrismaClient as NewPrismaClient } from '@prisma/new-client';

export class MigrationAssessment {
  constructor(
    private oldDb: OldPrismaClient,
    private newDb: NewPrismaClient
  ) {}

  async assessDataVolume(): Promise<AssessmentReport> {
    const report: AssessmentReport = {
      timestamp: new Date(),
      tables: [],
      totalRecords: 0,
      estimatedMigrationTime: 0,
    };

    // 评估各表数据量
    const tables = [
      'products',
      'categories',
      'brands',
      'orders',
      'users',
      'coupons',
    ];

    for (const table of tables) {
      const count = await this.oldDb[table].count();
      const sampleSize = Math.min(count, 1000);
      const samples = await this.oldDb[table].findMany({
        take: sampleSize,
      });

      const avgSize = this.calculateAverageSize(samples);
      const estimatedTime = this.estimateMigrationTime(count, avgSize);

      report.tables.push({
        name: table,
        recordCount: count,
        averageRecordSize: avgSize,
        estimatedMigrationTime: estimatedTime,
      });

      report.totalRecords += count;
      report.estimatedMigrationTime += estimatedTime;
    }

    return report;
  }

  private calculateAverageSize(records: any[]): number {
    const totalSize = records.reduce((sum, record) => {
      return sum + JSON.stringify(record).length;
    }, 0);
    return totalSize / records.length;
  }

  private estimateMigrationTime(count: number, avgSize: number): number {
    // 假设每秒可以迁移 1000 条记录
    const recordsPerSecond = 1000;
    return Math.ceil(count / recordsPerSecond);
  }
}

interface AssessmentReport {
  timestamp: Date;
  tables: TableAssessment[];
  totalRecords: number;
  estimatedMigrationTime: number;
}

interface TableAssessment {
  name: string;
  recordCount: number;
  averageRecordSize: number;
  estimatedMigrationTime: number;
}
```



#### 阶段 2-4: Schema 迁移与数据迁移

```typescript
// migration.service.ts
export class MigrationService {
  constructor(
    private oldDb: OldPrismaClient,
    private newDb: NewPrismaClient,
    private logger: Logger
  ) {}

  async migrateProducts(batchSize: number = 1000): Promise<MigrationResult> {
    const result: MigrationResult = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [],
    };

    const total = await this.oldDb.product.count();
    result.total = total;

    let offset = 0;
    while (offset < total) {
      try {
        const products = await this.oldDb.product.findMany({
          skip: offset,
          take: batchSize,
          include: {
            category: true,
            brand: true,
            attributes: true,
            images: true,
          },
        });

        for (const product of products) {
          try {
            await this.migrateProduct(product);
            result.success++;
          } catch (error) {
            result.failed++;
            result.errors.push({
              id: product.id,
              error: error.message,
            });
            this.logger.error(`Failed to migrate product ${product.id}`, error);
          }
        }

        offset += batchSize;
        this.logger.info(`Migrated ${offset}/${total} products`);
      } catch (error) {
        this.logger.error(`Batch migration failed at offset ${offset}`, error);
        throw error;
      }
    }

    return result;
  }

  private async migrateProduct(oldProduct: any): Promise<void> {
    // 转换数据格式
    const newProduct = {
      id: oldProduct.id,
      name: oldProduct.name,
      description: oldProduct.description,
      price: oldProduct.price,
      salePrice: oldProduct.sale_price,
      sku: oldProduct.sku,
      categoryId: oldProduct.category_id,
      brandId: oldProduct.brand_id,
      status: this.mapProductStatus(oldProduct.status),
      createdAt: oldProduct.created_at,
      updatedAt: oldProduct.updated_at,
      // 转换属性
      attributes: {
        create: oldProduct.attributes.map((attr: any) => ({
          attributeId: attr.attribute_id,
          value: attr.value,
        })),
      },
      // 转换图片
      images: {
        create: oldProduct.images.map((img: any, index: number) => ({
          url: img.url,
          sortOrder: index,
          isMain: index === 0,
        })),
      },
    };

    await this.newDb.product.create({
      data: newProduct,
    });
  }

  private mapProductStatus(oldStatus: string): string {
    const statusMap: Record<string, string> = {
      '0': 'draft',
      '1': 'active',
      '2': 'inactive',
      '3': 'archived',
    };
    return statusMap[oldStatus] || 'draft';
  }
}

interface MigrationResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}
```



#### 阶段 5: 数据验证脚本

```typescript
// migration-validation.ts
export class MigrationValidation {
  constructor(
    private oldDb: OldPrismaClient,
    private newDb: NewPrismaClient
  ) {}

  async validateProducts(): Promise<ValidationReport> {
    const report: ValidationReport = {
      tableName: 'products',
      totalOld: 0,
      totalNew: 0,
      matched: 0,
      mismatched: 0,
      missing: 0,
      issues: [],
    };

    // 统计总数
    report.totalOld = await this.oldDb.product.count();
    report.totalNew = await this.newDb.product.count();

    // 批量验证
    const batchSize = 1000;
    let offset = 0;

    while (offset < report.totalOld) {
      const oldProducts = await this.oldDb.product.findMany({
        skip: offset,
        take: batchSize,
      });

      for (const oldProduct of oldProducts) {
        const newProduct = await this.newDb.product.findUnique({
          where: { id: oldProduct.id },
        });

        if (!newProduct) {
          report.missing++;
          report.issues.push({
            id: oldProduct.id,
            type: 'missing',
            message: 'Product not found in new database',
          });
          continue;
        }

        // 验证关键字段
        const isValid = this.validateProductFields(oldProduct, newProduct);
        if (isValid) {
          report.matched++;
        } else {
          report.mismatched++;
          report.issues.push({
            id: oldProduct.id,
            type: 'mismatch',
            message: 'Product data mismatch',
            details: this.getFieldDifferences(oldProduct, newProduct),
          });
        }
      }

      offset += batchSize;
    }

    return report;
  }

  private validateProductFields(oldProduct: any, newProduct: any): boolean {
    return (
      oldProduct.name === newProduct.name &&
      oldProduct.price === newProduct.price &&
      oldProduct.sku === newProduct.sku &&
      oldProduct.category_id === newProduct.categoryId &&
      oldProduct.brand_id === newProduct.brandId
    );
  }

  private getFieldDifferences(oldProduct: any, newProduct: any): any {
    const differences: any = {};
    
    if (oldProduct.name !== newProduct.name) {
      differences.name = { old: oldProduct.name, new: newProduct.name };
    }
    if (oldProduct.price !== newProduct.price) {
      differences.price = { old: oldProduct.price, new: newProduct.price };
    }
    // ... 其他字段比较

    return differences;
  }

  async generateValidationReport(): Promise<string> {
    const reports = await Promise.all([
      this.validateProducts(),
      this.validateOrders(),
      this.validateUsers(),
    ]);

    let markdown = '# 数据迁移验证报告\n\n';
    markdown += `生成时间: ${new Date().toISOString()}\n\n`;

    for (const report of reports) {
      markdown += `## ${report.tableName}\n\n`;
      markdown += `- 原数据库记录数: ${report.totalOld}\n`;
      markdown += `- 新数据库记录数: ${report.totalNew}\n`;
      markdown += `- 匹配记录数: ${report.matched}\n`;
      markdown += `- 不匹配记录数: ${report.mismatched}\n`;
      markdown += `- 缺失记录数: ${report.missing}\n\n`;

      if (report.issues.length > 0) {
        markdown += `### 问题列表\n\n`;
        for (const issue of report.issues.slice(0, 10)) {
          markdown += `- ID: ${issue.id}, 类型: ${issue.type}, 消息: ${issue.message}\n`;
        }
        if (report.issues.length > 10) {
          markdown += `\n... 还有 ${report.issues.length - 10} 个问题\n`;
        }
      }

      markdown += '\n';
    }

    return markdown;
  }
}

interface ValidationReport {
  tableName: string;
  totalOld: number;
  totalNew: number;
  matched: number;
  mismatched: number;
  missing: number;
  issues: ValidationIssue[];
}

interface ValidationIssue {
  id: string;
  type: 'missing' | 'mismatch' | 'invalid';
  message: string;
  details?: any;
}
```



---

## 6. 前端设计系统与用户体验

### 6.1 组件层次结构

```mermaid
graph TB
    A[Design System] --> B[Tokens]
    A --> C[Primitives]
    A --> D[Components]
    A --> E[Patterns]
    
    B --> B1[Colors]
    B --> B2[Typography]
    B --> B3[Spacing]
    B --> B4[Shadows]
    
    C --> C1[Button]
    C --> C2[Input]
    C --> C3[Select]
    C --> C4[Checkbox]
    
    D --> D1[Form]
    D --> D2[Table]
    D --> D3[Modal]
    D --> D4[Card]
    
    E --> E1[ProductForm]
    E --> E2[OrderList]
    E --> E3[Dashboard]
```

### 6.2 可复用组件库

#### Design Tokens

```typescript
// design-tokens.ts
export const tokens = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      500: '#6b7280',
      700: '#374151',
      900: '#111827',
    },
    success: {
      500: '#10b981',
      600: '#059669',
    },
    error: {
      500: '#ef4444',
      600: '#dc2626',
    },
    warning: {
      500: '#f59e0b',
      600: '#d97706',
    },
  },
  
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['Fira Code', 'monospace'],
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  
  spacing: {
    0: '0',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    12: '3rem',    // 48px
    16: '4rem',    // 64px
  },
  
  borderRadius: {
    none: '0',
    sm: '0.125rem',  // 2px
    base: '0.25rem', // 4px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem',   // 12px
    full: '9999px',
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
};
```



#### 基础组件示例

```typescript
// components/Button.tsx
import React from 'react';
import { tokens } from '../design-tokens';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick,
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors';
  
  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 disabled:bg-gray-300',
    outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 disabled:border-gray-300 disabled:text-gray-300',
    ghost: 'text-primary-600 hover:bg-primary-50 disabled:text-gray-300',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};

// components/DataTable.tsx
import React from 'react';

export interface Column<T> {
  key: string;
  title: string;
  render?: (value: any, record: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  rowKey: keyof T;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  pagination,
  onSort,
  rowKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDirection(newDirection);
    onSort?.(key, newDirection);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                style={{ width: column.width }}
              >
                <div className="flex items-center space-x-1">
                  <span>{column.title}</span>
                  {column.sortable && (
                    <button
                      onClick={() => handleSort(column.key)}
                      className="hover:text-gray-700"
                    >
                      {sortKey === column.key ? (
                        sortDirection === 'asc' ? '↑' : '↓'
                      ) : (
                        '↕'
                      )}
                    </button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-4 text-center">
                <div className="flex justify-center">
                  <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-4 text-center text-gray-500">
                暂无数据
              </td>
            </tr>
          ) : (
            data.map((record) => (
              <tr key={String(record[rowKey])} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {column.render
                      ? column.render(record[column.key], record)
                      : record[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      {pagination && (
        <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="text-sm text-gray-700">
            显示 {(pagination.page - 1) * pagination.limit + 1} 到{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} 条，
            共 {pagination.total} 条
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page * pagination.limit >= pagination.total}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```



### 6.3 国际化 (i18n)

```typescript
// i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import zhTranslations from './locales/zh.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      zh: { translation: zhTranslations },
    },
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

// i18n/locales/zh.json
{
  "common": {
    "save": "保存",
    "cancel": "取消",
    "delete": "删除",
    "edit": "编辑",
    "search": "搜索",
    "filter": "筛选",
    "export": "导出",
    "import": "导入"
  },
  "product": {
    "title": "产品管理",
    "list": "产品列表",
    "create": "创建产品",
    "edit": "编辑产品",
    "name": "产品名称",
    "price": "价格",
    "status": "状态",
    "category": "分类",
    "brand": "品牌"
  },
  "order": {
    "title": "订单管理",
    "list": "订单列表",
    "detail": "订单详情",
    "status": {
      "pending": "待处理",
      "confirmed": "已确认",
      "shipped": "已发货",
      "delivered": "已送达",
      "cancelled": "已取消"
    }
  }
}

// 使用示例
import { useTranslation } from 'react-i18next';

export const ProductList: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('product.title')}</h1>
      <button>{t('product.create')}</button>
    </div>
  );
};
```

### 6.4 无障碍访问 (Accessibility)

```typescript
// components/AccessibleButton.tsx
import React from 'react';

export interface AccessibleButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  onClick,
  ariaLabel,
  disabled = false,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className="focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      {children}
    </button>
  );
};

// components/AccessibleForm.tsx
export const AccessibleForm: React.FC = () => {
  return (
    <form>
      <div className="form-group">
        <label htmlFor="product-name" className="block text-sm font-medium text-gray-700">
          产品名称
          <span className="text-red-500" aria-label="必填">*</span>
        </label>
        <input
          id="product-name"
          type="text"
          required
          aria-required="true"
          aria-describedby="product-name-help"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
        />
        <p id="product-name-help" className="mt-1 text-sm text-gray-500">
          请输入产品的完整名称
        </p>
      </div>
      
      <div className="form-group" role="group" aria-labelledby="status-label">
        <span id="status-label" className="block text-sm font-medium text-gray-700">
          产品状态
        </span>
        <div className="mt-2 space-y-2">
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="status"
              value="active"
              className="focus:ring-primary-500"
              aria-label="激活状态"
            />
            <span className="ml-2">激活</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="status"
              value="inactive"
              className="focus:ring-primary-500"
              aria-label="未激活状态"
            />
            <span className="ml-2">未激活</span>
          </label>
        </div>
      </div>
    </form>
  );
};
```



---

## 7. 性能与可扩展性

### 7.1 多层缓存策略

```mermaid
graph TB
    A[客户端请求] --> B{浏览器缓存}
    B -->|命中| C[返回缓存数据]
    B -->|未命中| D{CDN 缓存}
    D -->|命中| C
    D -->|未命中| E{Redis 缓存}
    E -->|命中| C
    E -->|未命中| F{数据库查询}
    F --> G[写入 Redis]
    G --> H[写入 CDN]
    H --> I[写入浏览器]
    I --> C
```

#### 缓存实现

```typescript
// cache.service.ts
import { Redis } from 'ioredis';

export class CacheService {
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // 缓存装饰器
  static cacheable(ttl: number = 3600) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
        const cacheService = this.cacheService as CacheService;

        // 尝试从缓存获取
        const cached = await cacheService.get(cacheKey);
        if (cached !== null) {
          return cached;
        }

        // 执行原方法
        const result = await originalMethod.apply(this, args);

        // 写入缓存
        await cacheService.set(cacheKey, result, ttl);

        return result;
      };

      return descriptor;
    };
  }
}

// 使用示例
export class ProductService {
  constructor(
    private prisma: PrismaClient,
    private cacheService: CacheService
  ) {}

  @CacheService.cacheable(3600) // 缓存 1 小时
  async getProduct(id: string): Promise<Product> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        images: true,
      },
    });
  }

  async updateProduct(id: string, data: UpdateProductData): Promise<Product> {
    const product = await this.prisma.product.update({
      where: { id },
      data,
    });

    // 清除相关缓存
    await this.cacheService.delPattern(`ProductService:getProduct:*${id}*`);
    await this.cacheService.delPattern(`ProductService:getProducts:*`);

    return product;
  }
}
```



### 7.2 数据库优化

#### 索引策略

```sql
-- 产品表索引
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('english', name));

-- 订单表索引
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- 复合索引
CREATE INDEX idx_products_category_status ON products(category_id, status);
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);

-- 部分索引（只索引活跃产品）
CREATE INDEX idx_active_products ON products(id) WHERE status = 'active';
```

#### 查询优化

```typescript
// 使用 Prisma 的查询优化
export class OptimizedProductService {
  constructor(private prisma: PrismaClient) {}

  // 使用 select 只查询需要的字段
  async getProductList(params: ProductListParams) {
    return this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        status: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        // 不查询 description 等大字段
      },
      where: params.filters,
      orderBy: params.orderBy,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    });
  }

  // 使用批量查询减少数据库往返
  async getProductsWithDetails(ids: string[]) {
    const [products, categories, brands] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: ids } },
      }),
      this.prisma.category.findMany({
        where: { id: { in: products.map(p => p.categoryId) } },
      }),
      this.prisma.brand.findMany({
        where: { id: { in: products.map(p => p.brandId) } },
      }),
    ]);

    // 在应用层组装数据
    return products.map(product => ({
      ...product,
      category: categories.find(c => c.id === product.categoryId),
      brand: brands.find(b => b.id === product.brandId),
    }));
  }

  // 使用游标分页处理大数据集
  async getProductsCursor(cursor?: string, limit: number = 20) {
    return this.prisma.product.findMany({
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }
}
```



### 7.3 秒杀场景处理

```typescript
// flash-sale.service.ts
export class FlashSaleService {
  constructor(
    private redis: Redis,
    private prisma: PrismaClient,
    private messageQueue: MessageQueue
  ) {}

  /**
   * 秒杀预热：将库存加载到 Redis
   */
  async warmUpFlashSale(flashSaleId: string): Promise<void> {
    const flashSale = await this.prisma.flashSale.findUnique({
      where: { id: flashSaleId },
      include: { products: true },
    });

    if (!flashSale) {
      throw new Error('Flash sale not found');
    }

    // 将每个产品的库存加载到 Redis
    for (const product of flashSale.products) {
      const stockKey = `flash_sale:${flashSaleId}:stock:${product.id}`;
      await this.redis.set(stockKey, product.stock);
    }

    console.log(`Flash sale ${flashSaleId} warmed up`);
  }

  /**
   * 秒杀抢购：使用 Lua 脚本保证原子性
   */
  async purchase(
    flashSaleId: string,
    productId: string,
    userId: string,
    quantity: number = 1
  ): Promise<boolean> {
    const stockKey = `flash_sale:${flashSaleId}:stock:${productId}`;
    const userKey = `flash_sale:${flashSaleId}:user:${userId}:${productId}`;

    // Lua 脚本：检查库存、检查用户购买限制、扣减库存
    const luaScript = `
      local stock_key = KEYS[1]
      local user_key = KEYS[2]
      local quantity = tonumber(ARGV[1])
      local max_per_user = tonumber(ARGV[2])
      
      -- 检查库存
      local stock = tonumber(redis.call('GET', stock_key) or 0)
      if stock < quantity then
        return 0  -- 库存不足
      end
      
      -- 检查用户购买限制
      local user_purchased = tonumber(redis.call('GET', user_key) or 0)
      if user_purchased + quantity > max_per_user then
        return -1  -- 超过购买限制
      end
      
      -- 扣减库存
      redis.call('DECRBY', stock_key, quantity)
      
      -- 记录用户购买数量
      redis.call('INCRBY', user_key, quantity)
      redis.call('EXPIRE', user_key, 86400)  -- 24小时过期
      
      return 1  -- 成功
    `;

    const result = await this.redis.eval(
      luaScript,
      2,
      stockKey,
      userKey,
      quantity,
      5  // 每人限购 5 件
    );

    if (result === 1) {
      // 异步创建订单
      await this.messageQueue.publish('flash_sale.order.create', {
        flashSaleId,
        productId,
        userId,
        quantity,
      });
      return true;
    }

    return false;
  }

  /**
   * 异步创建订单（消息队列消费者）
   */
  async createOrderAsync(data: {
    flashSaleId: string;
    productId: string;
    userId: string;
    quantity: number;
  }): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 创建订单
        const order = await tx.order.create({
          data: {
            customerId: data.userId,
            items: {
              create: {
                productId: data.productId,
                quantity: data.quantity,
                // ... 其他字段
              },
            },
            status: 'pending',
          },
        });

        // 扣减数据库库存
        await tx.inventory.update({
          where: { productId: data.productId },
          data: {
            available: { decrement: data.quantity },
            reserved: { increment: data.quantity },
          },
        });

        console.log(`Order ${order.id} created for flash sale`);
      });
    } catch (error) {
      console.error('Failed to create flash sale order:', error);
      
      // 回滚 Redis 库存
      const stockKey = `flash_sale:${data.flashSaleId}:stock:${data.productId}`;
      await this.redis.incrby(stockKey, data.quantity);
    }
  }
}
```



---

## 8. 测试策略与 CI/CD

### 8.1 测试金字塔

```mermaid
graph TB
    A[E2E Tests<br/>10%] --> B[Integration Tests<br/>20%]
    B --> C[Unit Tests<br/>70%]
    
    style A fill:#ff6b6b
    style B fill:#ffd93d
    style C fill:#6bcf7f
```

### 8.2 单元测试示例

```typescript
// product.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductService } from './product.service';
import { PrismaClient } from '@prisma/client';

describe('ProductService', () => {
  let productService: ProductService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    productService = new ProductService(prisma);
  });

  describe('getProduct', () => {
    it('should return product by id', async () => {
      const mockProduct = {
        id: 'prod_123',
        name: 'Test Product',
        price: 99.99,
        status: 'active',
      };

      vi.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct);

      const result = await productService.getProduct('prod_123');

      expect(result).toEqual(mockProduct);
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod_123' },
        include: expect.any(Object),
      });
    });

    it('should throw error when product not found', async () => {
      vi.spyOn(prisma.product, 'findUnique').mockResolvedValue(null);

      await expect(productService.getProduct('invalid_id')).rejects.toThrow(
        'Product not found'
      );
    });
  });

  describe('createProduct', () => {
    it('should create product with valid data', async () => {
      const createData = {
        name: 'New Product',
        price: 49.99,
        sku: 'SKU-001',
        categoryId: 'cat_123',
        brandId: 'brand_123',
      };

      const mockCreatedProduct = {
        id: 'prod_new',
        ...createData,
        status: 'draft',
        createdAt: new Date(),
      };

      vi.spyOn(prisma.product, 'create').mockResolvedValue(mockCreatedProduct);

      const result = await productService.createProduct(createData);

      expect(result).toEqual(mockCreatedProduct);
      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining(createData),
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: '',
        price: -10,
      };

      await expect(productService.createProduct(invalidData)).rejects.toThrow(
        'Validation error'
      );
    });
  });
});
```



### 8.3 集成测试示例

```typescript
// product.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ProductService } from './product.service';
import { CacheService } from './cache.service';
import { Redis } from 'ioredis';

describe('Product Integration Tests', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let productService: ProductService;
  let cacheService: CacheService;

  beforeAll(async () => {
    // 使用测试数据库
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });

    redis = new Redis(process.env.TEST_REDIS_URL);
    cacheService = new CacheService(redis);
    productService = new ProductService(prisma, cacheService);

    // 清理测试数据
    await prisma.product.deleteMany();
    await redis.flushdb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  it('should create product and cache it', async () => {
    const productData = {
      name: 'Integration Test Product',
      price: 99.99,
      sku: 'INT-001',
      categoryId: 'cat_test',
      brandId: 'brand_test',
    };

    // 创建产品
    const product = await productService.createProduct(productData);
    expect(product.id).toBeDefined();

    // 验证数据库
    const dbProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(dbProduct).toBeTruthy();
    expect(dbProduct.name).toBe(productData.name);

    // 第一次查询（应该从数据库）
    const fetchedProduct1 = await productService.getProduct(product.id);
    expect(fetchedProduct1).toEqual(product);

    // 第二次查询（应该从缓存）
    const fetchedProduct2 = await productService.getProduct(product.id);
    expect(fetchedProduct2).toEqual(product);

    // 验证缓存
    const cacheKey = `ProductService:getProduct:["${product.id}"]`;
    const cached = await cacheService.get(cacheKey);
    expect(cached).toBeTruthy();
  });

  it('should invalidate cache when product is updated', async () => {
    const product = await productService.createProduct({
      name: 'Cache Test Product',
      price: 49.99,
      sku: 'CACHE-001',
      categoryId: 'cat_test',
      brandId: 'brand_test',
    });

    // 查询产品（写入缓存）
    await productService.getProduct(product.id);

    // 更新产品
    const updatedProduct = await productService.updateProduct(product.id, {
      name: 'Updated Product',
      price: 59.99,
    });

    // 验证缓存已清除
    const cacheKey = `ProductService:getProduct:["${product.id}"]`;
    const cached = await cacheService.get(cacheKey);
    expect(cached).toBeNull();

    // 再次查询应该返回更新后的数据
    const fetchedProduct = await productService.getProduct(product.id);
    expect(fetchedProduct.name).toBe('Updated Product');
    expect(fetchedProduct.price).toBe(59.99);
  });
});
```



### 8.4 契约测试示例

```typescript
// product.contract.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// 定义 API 契约
const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  salePrice: z.number().positive().optional(),
  sku: z.string().regex(/^[A-Z0-9-]+$/),
  categoryId: z.string().uuid(),
  brandId: z.string().uuid(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const ProductListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(ProductSchema),
  meta: z.object({
    pagination: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  }),
});

describe('Product API Contract Tests', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

  it('GET /api/products should match contract', async () => {
    const response = await fetch(`${API_BASE_URL}/api/products?page=1&limit=10`);
    const data = await response.json();

    // 验证响应符合契约
    expect(() => ProductListResponseSchema.parse(data)).not.toThrow();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('GET /api/products/:id should match contract', async () => {
    // 先创建一个产品
    const createResponse = await fetch(`${API_BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Contract Test Product',
        price: 99.99,
        sku: 'CONTRACT-001',
        categoryId: 'cat_test',
        brandId: 'brand_test',
      }),
    });
    const createData = await createResponse.json();
    const productId = createData.data.id;

    // 查询产品
    const response = await fetch(`${API_BASE_URL}/api/products/${productId}`);
    const data = await response.json();

    // 验证响应符合契约
    expect(() => ProductSchema.parse(data.data)).not.toThrow();
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(productId);
  });

  it('POST /api/products should validate request body', async () => {
    const invalidData = {
      name: '', // 空名称
      price: -10, // 负价格
      sku: 'invalid sku', // 无效 SKU 格式
    };

    const response = await fetch(`${API_BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});
```



### 8.5 E2E 测试示例

```typescript
// product.e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('Product Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should create a new product', async ({ page }) => {
    // 导航到产品列表
    await page.click('text=产品管理');
    await page.waitForURL('**/products');

    // 点击创建按钮
    await page.click('button:has-text("创建产品")');
    await page.waitForSelector('form');

    // 填写表单
    await page.fill('input[name="name"]', 'E2E Test Product');
    await page.fill('input[name="price"]', '99.99');
    await page.fill('input[name="sku"]', 'E2E-001');
    await page.selectOption('select[name="categoryId"]', 'cat_test');
    await page.selectOption('select[name="brandId"]', 'brand_test');
    await page.fill('textarea[name="description"]', 'This is an E2E test product');

    // 提交表单
    await page.click('button[type="submit"]');

    // 验证成功消息
    await expect(page.locator('.toast-success')).toContainText('产品创建成功');

    // 验证产品出现在列表中
    await page.waitForURL('**/products');
    await expect(page.locator('table')).toContainText('E2E Test Product');
  });

  test('should edit an existing product', async ({ page }) => {
    await page.goto('http://localhost:3000/products');

    // 点击第一个产品的编辑按钮
    await page.click('table tbody tr:first-child button:has-text("编辑")');
    await page.waitForSelector('form');

    // 修改产品名称
    await page.fill('input[name="name"]', 'Updated Product Name');
    await page.fill('input[name="price"]', '149.99');

    // 提交表单
    await page.click('button[type="submit"]');

    // 验证成功消息
    await expect(page.locator('.toast-success')).toContainText('产品更新成功');

    // 验证更新后的数据
    await expect(page.locator('table')).toContainText('Updated Product Name');
    await expect(page.locator('table')).toContainText('149.99');
  });

  test('should delete a product', async ({ page }) => {
    await page.goto('http://localhost:3000/products');

    // 点击第一个产品的删除按钮
    await page.click('table tbody tr:first-child button:has-text("删除")');

    // 确认删除
    await page.click('button:has-text("确认")');

    // 验证成功消息
    await expect(page.locator('.toast-success')).toContainText('产品删除成功');

    // 验证产品从列表中消失
    await page.waitForTimeout(1000);
    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('should filter products by category', async ({ page }) => {
    await page.goto('http://localhost:3000/products');

    // 选择分类筛选
    await page.selectOption('select[name="categoryFilter"]', 'cat_electronics');

    // 等待列表更新
    await page.waitForTimeout(500);

    // 验证所有显示的产品都属于该分类
    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const categoryCell = rows.nth(i).locator('td:nth-child(4)');
      await expect(categoryCell).toContainText('Electronics');
    }
  });

  test('should search products by name', async ({ page }) => {
    await page.goto('http://localhost:3000/products');

    // 输入搜索关键词
    await page.fill('input[name="search"]', 'Test');

    // 等待搜索结果
    await page.waitForTimeout(500);

    // 验证搜索结果
    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const nameCell = rows.nth(i).locator('td:nth-child(2)');
      await expect(nameCell).toContainText(/Test/i);
    }
  });
});
```



### 8.6 性能测试示例

```typescript
// product.performance.test.ts
import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('Product Performance Tests', () => {
  it('should load product list within 200ms', async () => {
    const start = performance.now();
    
    const response = await fetch('http://localhost:3000/api/products?page=1&limit=20');
    const data = await response.json();
    
    const end = performance.now();
    const duration = end - start;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(duration).toBeLessThan(200);
  });

  it('should handle 100 concurrent requests', async () => {
    const requests = Array.from({ length: 100 }, () =>
      fetch('http://localhost:3000/api/products?page=1&limit=20')
    );

    const start = performance.now();
    const responses = await Promise.all(requests);
    const end = performance.now();

    const duration = end - start;
    const successCount = responses.filter(r => r.status === 200).length;

    expect(successCount).toBe(100);
    expect(duration).toBeLessThan(5000); // 5秒内完成
  });

  it('should cache product details effectively', async () => {
    const productId = 'prod_test_123';

    // 第一次请求（冷缓存）
    const start1 = performance.now();
    await fetch(`http://localhost:3000/api/products/${productId}`);
    const end1 = performance.now();
    const coldDuration = end1 - start1;

    // 第二次请求（热缓存）
    const start2 = performance.now();
    await fetch(`http://localhost:3000/api/products/${productId}`);
    const end2 = performance.now();
    const hotDuration = end2 - start2;

    // 缓存命中应该快至少 50%
    expect(hotDuration).toBeLessThan(coldDuration * 0.5);
  });
});
```

### 8.7 CI/CD Pipeline 配置

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '20.x'
  POSTGRES_VERSION: '15'
  REDIS_VERSION: '7'

jobs:
  lint:
    name: Lint Code
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ESLint
        run: npm run lint
      
      - name: Run Prettier
        run: npm run format:check
      
      - name: TypeScript type check
        run: npm run type-check

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unit

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run database migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Build application
        run: npm run build
      
      - name: Start application
        run: npm run start &
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
      
      - name: Wait for application
        run: npx wait-on http://localhost:3000
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  build:
    name: Build Application
    runs-on: ubuntu-latest
    needs: [lint, unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build
          path: dist/

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [build, e2e-tests]
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.example.com
    steps:
      - uses: actions/checkout@v3
      
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build
          path: dist/
      
      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # 部署命令（例如：rsync, scp, 或云服务 CLI）

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build, e2e-tests]
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://example.com
    steps:
      - uses: actions/checkout@v3
      
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build
          path: dist/
      
      - name: Deploy to production
        run: |
          echo "Deploying to production environment..."
          # 部署命令
```



---

## 9. 分阶段实施路线图

### 9.1 实施阶段概览

```mermaid
gantt
    title 商城管理系统集成实施计划
    dateFormat  YYYY-MM-DD
    section 阶段A: 基础设施
    环境搭建           :a1, 2024-01-01, 7d
    认证授权系统       :a2, after a1, 10d
    API 基础架构       :a3, after a1, 10d
    
    section 阶段B: 核心功能
    产品管理系统       :b1, after a2, 14d
    订单管理系统       :b2, after b1, 14d
    库存集成           :b3, after b1, 10d
    
    section 阶段C: 营销功能
    优惠券系统         :c1, after b2, 10d
    秒杀活动           :c2, after c1, 10d
    推荐系统           :c3, after c1, 10d
    
    section 阶段D: 用户管理
    用户管理系统       :d1, after b2, 10d
    角色权限管理       :d2, after d1, 7d
    
    section 阶段E: 优化上线
    性能优化           :e1, after c2, 10d
    数据迁移           :e2, after d2, 14d
    测试验收           :e3, after e1, 10d
    生产上线           :e4, after e3, 3d
```

### 9.2 阶段 A: 基础设施搭建（2-3 周）

#### 目标
建立项目基础架构，包括开发环境、认证系统和 API 基础设施。

#### 交付物
- ✅ 项目脚手架和开发环境配置
- ✅ JWT 认证系统实现
- ✅ RBAC 权限控制框架
- ✅ API 网关和中间件
- ✅ 数据库 Schema 设计
- ✅ Redis 缓存配置
- ✅ 日志和监控系统

#### 验收标准
1. 开发环境可以正常启动
2. 用户可以登录并获取 JWT Token
3. API 请求可以通过认证和授权验证
4. 数据库连接正常，可以执行 CRUD 操作
5. Redis 缓存功能正常
6. 日志可以正确记录和查询

#### 关键代码示例

```typescript
// 项目结构
src/
├── config/           # 配置文件
├── middleware/       # 中间件
│   ├── auth.middleware.ts
│   ├── permission.middleware.ts
│   ├── error.middleware.ts
│   └── logging.middleware.ts
├── services/         # 业务服务
│   ├── auth.service.ts
│   └── user.service.ts
├── routes/           # 路由
│   └── auth.routes.ts
├── utils/            # 工具函数
│   ├── jwt.util.ts
│   └── logger.util.ts
└── app.ts            # 应用入口
```



### 9.3 阶段 B: 核心功能开发（4-5 周）

#### 目标
实现产品管理、订单管理和库存集成等核心电商功能。

#### 交付物
- ✅ 产品管理完整功能（CRUD、分类、品牌、属性）
- ✅ 订单管理完整功能（创建、查询、状态管理）
- ✅ 库存系统集成（预留、扣减、释放）
- ✅ 支付系统集成
- ✅ 物流系统集成
- ✅ 前端产品和订单管理界面

#### 验收标准
1. 可以创建、编辑、删除产品
2. 产品分类和品牌管理功能正常
3. 订单可以正常创建和查询
4. 订单状态流转正确
5. 库存预留和扣减逻辑正确，无超卖
6. 支付回调处理正常
7. 物流信息可以正确查询和更新

#### 关键功能实现

```typescript
// 订单创建流程
async function createOrder(orderData: CreateOrderData): Promise<Order> {
  return await prisma.$transaction(async (tx) => {
    // 1. 验证库存
    for (const item of orderData.items) {
      const available = await inventoryService.checkAvailability(
        item.productId,
        item.quantity
      );
      if (!available) {
        throw new Error(`Product ${item.productId} out of stock`);
      }
    }

    // 2. 预留库存
    for (const item of orderData.items) {
      await inventoryService.reserveInventory(
        item.productId,
        item.skuId,
        item.quantity,
        orderId
      );
    }

    // 3. 创建订单
    const order = await tx.order.create({
      data: {
        customerId: orderData.customerId,
        items: {
          create: orderData.items,
        },
        total: calculateTotal(orderData.items),
        status: 'pending',
      },
    });

    // 4. 创建支付记录
    await tx.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        status: 'pending',
      },
    });

    // 5. 发布订单创建事件
    await outboxService.createEvent(
      'order',
      order.id,
      'OrderCreated',
      { orderId: order.id, customerId: order.customerId },
      tx
    );

    return order;
  });
}
```

### 9.4 阶段 C: 营销功能开发（3-4 周）

#### 目标
实现优惠券、秒杀活动和推荐系统等营销功能。

#### 交付物
- ✅ 优惠券管理系统（创建、发放、使用、验证）
- ✅ 秒杀活动管理（活动配置、库存预热、抢购逻辑）
- ✅ 推荐系统（品牌推荐、新品推荐、热门推荐）
- ✅ 广告管理系统
- ✅ 前端营销管理界面

#### 验收标准
1. 优惠券可以正常创建和发放
2. 优惠券使用规则验证正确
3. 秒杀活动可以正常配置和启动
4. 秒杀抢购无超卖问题
5. 推荐系统可以正常配置和展示
6. 广告可以正常管理和投放

### 9.5 阶段 D: 用户管理开发（2-3 周）

#### 目标
实现用户管理、角色权限管理等功能。

#### 交付物
- ✅ 用户管理系统（CRUD、状态管理）
- ✅ 角色管理系统（角色创建、权限分配）
- ✅ 菜单管理系统（菜单配置、权限关联）
- ✅ 资源管理系统（API 权限配置）
- ✅ 前端用户和权限管理界面

#### 验收标准
1. 用户可以正常创建和管理
2. 角色可以正常创建和分配权限
3. 菜单权限控制正确
4. API 权限验证正确
5. 用户登录后只能看到有权限的菜单和功能

### 9.6 阶段 E: 优化与上线（3-4 周）

#### 目标
性能优化、数据迁移、测试验收和生产上线。

#### 交付物
- ✅ 性能优化（缓存、数据库索引、查询优化）
- ✅ 数据迁移脚本和验证
- ✅ 完整的测试覆盖（单元、集成、E2E）
- ✅ 监控和告警配置
- ✅ 部署文档和运维手册
- ✅ 生产环境部署

#### 验收标准
1. API 响应时间 < 200ms (P95)
2. 数据迁移成功率 > 99.9%
3. 测试覆盖率 > 80%
4. 监控指标正常采集
5. 生产环境稳定运行 24 小时无重大问题



---

## 10. 监控与可观测性

### 10.1 监控架构

```mermaid
graph TB
    subgraph "应用层 (Application)"
        A[React Frontend]
        B[Express Backend]
        C[Background Workers]
    end
    
    subgraph "监控采集 (Collection)"
        D[Prometheus]
        E[Grafana Loki]
        F[Jaeger]
    end
    
    subgraph "可视化 (Visualization)"
        G[Grafana]
        H[Kibana]
    end
    
    subgraph "告警 (Alerting)"
        I[AlertManager]
        J[PagerDuty]
        K[Slack]
    end
    
    A --> D
    B --> D
    C --> D
    
    A --> E
    B --> E
    C --> E
    
    B --> F
    
    D --> G
    E --> G
    F --> G
    
    E --> H
    
    D --> I
    I --> J
    I --> K
```

### 10.2 关键指标监控

#### 应用指标

```typescript
// metrics.service.ts
import { Counter, Histogram, Gauge, register } from 'prom-client';

export class MetricsService {
  // HTTP 请求计数器
  private httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
  });

  // HTTP 请求延迟
  private httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  });

  // 数据库查询延迟
  private dbQueryDuration = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  });

  // 缓存命中率
  private cacheHits = new Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_name'],
  });

  private cacheMisses = new Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_name'],
  });

  // 订单指标
  private ordersCreated = new Counter({
    name: 'orders_created_total',
    help: 'Total number of orders created',
    labelNames: ['status'],
  });

  private orderValue = new Histogram({
    name: 'order_value_dollars',
    help: 'Order value in dollars',
    buckets: [10, 50, 100, 500, 1000, 5000],
  });

  // 库存指标
  private inventoryLevel = new Gauge({
    name: 'inventory_level',
    help: 'Current inventory level',
    labelNames: ['product_id', 'sku'],
  });

  // 记录 HTTP 请求
  recordHttpRequest(method: string, route: string, status: number, duration: number) {
    this.httpRequestsTotal.inc({ method, route, status });
    this.httpRequestDuration.observe({ method, route, status }, duration);
  }

  // 记录数据库查询
  recordDbQuery(operation: string, table: string, duration: number) {
    this.dbQueryDuration.observe({ operation, table }, duration);
  }

  // 记录缓存命中
  recordCacheHit(cacheName: string) {
    this.cacheHits.inc({ cache_name: cacheName });
  }

  // 记录缓存未命中
  recordCacheMiss(cacheName: string) {
    this.cacheMisses.inc({ cache_name: cacheName });
  }

  // 记录订单创建
  recordOrderCreated(status: string, value: number) {
    this.ordersCreated.inc({ status });
    this.orderValue.observe(value);
  }

  // 更新库存水平
  updateInventoryLevel(productId: string, sku: string, level: number) {
    this.inventoryLevel.set({ product_id: productId, sku }, level);
  }

  // 获取所有指标
  getMetrics(): string {
    return register.metrics();
  }
}

// 使用示例：监控中间件
export function metricsMiddleware(metricsService: MetricsService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      metricsService.recordHttpRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration
      );
    });

    next();
  };
}
```



### 10.3 日志管理

```typescript
// logger.service.ts
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'mall-admin',
        environment: process.env.NODE_ENV,
      },
      transports: [
        // 控制台输出
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        
        // 文件输出
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
        
        // Elasticsearch 输出
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: process.env.ELASTICSEARCH_URL,
          },
          index: 'mall-admin-logs',
        }),
      ],
    });
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  error(message: string, error?: Error, meta?: any) {
    this.logger.error(message, {
      error: {
        message: error?.message,
        stack: error?.stack,
      },
      ...meta,
    });
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }

  // 结构化日志
  logRequest(req: Request, res: Response, duration: number) {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  logDbQuery(operation: string, table: string, duration: number, error?: Error) {
    if (error) {
      this.error('Database query failed', error, {
        operation,
        table,
        duration,
      });
    } else {
      this.debug('Database query', {
        operation,
        table,
        duration,
      });
    }
  }

  logBusinessEvent(event: string, data: any) {
    this.info('Business event', {
      event,
      data,
    });
  }
}

// 使用示例
const logger = new LoggerService();

// 记录 HTTP 请求
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });
  next();
});

// 记录业务事件
logger.logBusinessEvent('order.created', {
  orderId: 'order_123',
  customerId: 'user_456',
  total: 99.99,
});
```



### 10.4 分布式追踪

```typescript
// tracing.service.ts
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PrismaInstrumentation } from '@prisma/instrumentation';

export class TracingService {
  private tracer: any;

  constructor() {
    const provider = new NodeTracerProvider();

    // 配置 Jaeger 导出器
    const exporter = new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    });

    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.register();

    // 自动注入
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation(),
        new ExpressInstrumentation(),
        new PrismaInstrumentation(),
      ],
    });

    this.tracer = trace.getTracer('mall-admin');
  }

  // 创建 Span
  async traceOperation<T>(
    name: string,
    operation: () => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    const span = this.tracer.startSpan(name, {
      attributes,
    });

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        operation
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  // 添加事件到当前 Span
  addEvent(name: string, attributes?: Record<string, any>) {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  // 设置 Span 属性
  setAttribute(key: string, value: any) {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute(key, value);
    }
  }
}

// 使用示例
const tracingService = new TracingService();

// 追踪订单创建流程
async function createOrder(orderData: CreateOrderData): Promise<Order> {
  return tracingService.traceOperation(
    'order.create',
    async () => {
      // 验证库存
      await tracingService.traceOperation(
        'inventory.validate',
        async () => {
          for (const item of orderData.items) {
            const available = await inventoryService.checkAvailability(
              item.productId,
              item.quantity
            );
            if (!available) {
              throw new Error('Out of stock');
            }
          }
        },
        { itemCount: orderData.items.length }
      );

      // 创建订单
      const order = await tracingService.traceOperation(
        'database.order.create',
        async () => {
          return prisma.order.create({
            data: orderData,
          });
        },
        { customerId: orderData.customerId }
      );

      tracingService.addEvent('order.created', {
        orderId: order.id,
        total: order.total,
      });

      return order;
    },
    { customerId: orderData.customerId }
  );
}
```



### 10.5 告警配置

```yaml
# prometheus/alerts.yml
groups:
  - name: application_alerts
    interval: 30s
    rules:
      # API 响应时间告警
      - alert: HighAPILatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API latency detected"
          description: "95th percentile API latency is {{ $value }}s (threshold: 1s)"

      # 错误率告警
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"

      # 数据库连接池告警
      - alert: DatabaseConnectionPoolExhausted
        expr: db_connection_pool_active / db_connection_pool_max > 0.9
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "Connection pool usage is {{ $value | humanizePercentage }}"

      # 缓存命中率告警
      - alert: LowCacheHitRate
        expr: rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) < 0.7
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value | humanizePercentage }} (threshold: 70%)"

      # 库存告警
      - alert: LowInventory
        expr: inventory_level < 10
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Low inventory level"
          description: "Product {{ $labels.product_id }} has only {{ $value }} items left"

      # 订单处理延迟告警
      - alert: OrderProcessingDelay
        expr: time() - order_created_timestamp > 300
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Order processing delayed"
          description: "Order {{ $labels.order_id }} has been pending for {{ $value }}s"

  - name: infrastructure_alerts
    interval: 30s
    rules:
      # CPU 使用率告警
      - alert: HighCPUUsage
        expr: process_cpu_usage > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value | humanizePercentage }}"

      # 内存使用率告警
      - alert: HighMemoryUsage
        expr: process_memory_usage / process_memory_limit > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      # Redis 连接告警
      - alert: RedisConnectionFailed
        expr: redis_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis connection failed"
          description: "Cannot connect to Redis instance"

      # PostgreSQL 连接告警
      - alert: PostgreSQLConnectionFailed
        expr: pg_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL connection failed"
          description: "Cannot connect to PostgreSQL instance"
```



### 10.6 Grafana 仪表板配置

```json
{
  "dashboard": {
    "title": "Mall Admin System Overview",
    "panels": [
      {
        "title": "API Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "API Latency (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{route}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Database Query Duration",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))",
            "legendFormat": "{{operation}} {{table}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))",
            "legendFormat": "{{cache_name}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Orders Created",
        "targets": [
          {
            "expr": "rate(orders_created_total[5m])",
            "legendFormat": "{{status}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active Users",
        "targets": [
          {
            "expr": "count(rate(http_requests_total[5m]) > 0) by (user_id)",
            "legendFormat": "Active Users"
          }
        ],
        "type": "stat"
      },
      {
        "title": "System Resources",
        "targets": [
          {
            "expr": "process_cpu_usage",
            "legendFormat": "CPU Usage"
          },
          {
            "expr": "process_memory_usage / process_memory_limit",
            "legendFormat": "Memory Usage"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

---

## 总结

本架构优化文档涵盖了商城管理系统集成的全方位技术方案，包括：

1. **架构设计**: 采用微服务架构，前后端分离，支持水平扩展
2. **数据一致性**: 使用 Transactional Outbox 模式确保分布式事务一致性
3. **API 标准**: 统一的 RESTful API 设计，版本管理和错误处理
4. **安全保障**: JWT 认证、RBAC 权限控制、XSS/CSRF 防护
5. **数据迁移**: 七阶段迁移计划，确保数据完整性和业务连续性
6. **前端设计**: 组件化设计系统，支持国际化和无障碍访问
7. **性能优化**: 多层缓存策略，数据库优化，秒杀场景处理
8. **测试策略**: 完整的测试金字塔，包含单元、集成、契约和 E2E 测试
9. **实施路线**: 分五个阶段逐步实施，每个阶段都有明确的交付物和验收标准
10. **监控运维**: 全面的监控指标、日志管理、分布式追踪和告警配置

通过遵循本文档的架构设计和最佳实践，可以构建一个高性能、高可用、易维护的电商管理系统。

---

## 附录

### A. 技术栈版本清单

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20.x LTS | 运行时环境 |
| React | 18.x | 前端框架 |
| TypeScript | 5.x | 类型系统 |
| Express.js | 4.x | Web 框架 |
| PostgreSQL | 15.x | 关系型数据库 |
| Redis | 7.x | 缓存和消息队列 |
| Prisma | 5.x | ORM |
| Vite | 5.x | 构建工具 |
| Vitest | 1.x | 测试框架 |
| Playwright | 1.x | E2E 测试 |
| Prometheus | 2.x | 监控系统 |
| Grafana | 10.x | 可视化平台 |
| Jaeger | 1.x | 分布式追踪 |

### B. 环境变量配置示例

```bash
# .env.example

# 应用配置
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.example.com

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/mall_admin
DATABASE_POOL_SIZE=20

# Redis 配置
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# JWT 配置
JWT_ACCESS_SECRET=your-access-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# 文件存储配置
S3_BUCKET=mall-admin-files
S3_REGION=us-east-1
S3_ACCESS_KEY=
S3_SECRET_KEY=

# 支付配置
PAYMENT_GATEWAY_URL=https://payment.example.com
PAYMENT_API_KEY=

# 物流配置
LOGISTICS_API_URL=https://logistics.example.com
LOGISTICS_API_KEY=

# 监控配置
PROMETHEUS_PORT=9090
JAEGER_ENDPOINT=http://localhost:14268/api/traces
ELASTICSEARCH_URL=http://localhost:9200

# 日志配置
LOG_LEVEL=info
LOG_FILE_PATH=./logs
```

### C. 参考资源

- [Prisma Documentation](https://www.prisma.io/docs)
- [React Documentation](https://react.dev)
- [Express.js Guide](https://expressjs.com)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)
- [Redis Documentation](https://redis.io/docs)
- [Prometheus Documentation](https://prometheus.io/docs)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs)
- [Microservices Patterns](https://microservices.io/patterns)
