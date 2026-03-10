# Mall Admin Frontend Integration - Design Document

## 项目概述

本设计文档描述了 Mall Admin System 前端集成的完整技术方案，基于以下关键决策：

- **前端实现路径**: `D:\AI\TEST\mall-admin-system\frontend2`
- **认证参考**: `D:\AI\TEST\user-review-system` 的简化 JWT 认证方案
- **后端状态**: 已完成 70%，包括 PMS、OMS（部分）、SMS 的 API
- **已知问题**: Redis 连接、CSRF token、认证 token 等问题已在 BACKEND_FIXES_V2.md 中修复

## 系统架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         React Frontend (frontend2/Malladmin)          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │
│  │  │  Pages   │  │Components│  │ Services │            │  │
│  │  └──────────┘  └──────────┘  └──────────┘            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │
│  │  │  Hooks   │  │  Context │  │  Utils   │            │  │
│  │  └──────────┘  └──────────┘  └──────────┘            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST + JWT
                            │ (Bearer Token)
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Node.js)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Express + TypeScript                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │
│  │  │Controllers│  │ Services │  │Middleware│            │  │
│  │  │           │  │          │  │ - Auth   │            │  │
│  │  │           │  │          │  │ - CSRF   │            │  │
│  │  │           │  │          │  │ - Rate   │            │  │
│  │  └──────────┘  └──────────┘  └──────────┘            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
┌───────────────▼──────┐   ┌───────────▼──────┐
│   PostgreSQL         │   │      Redis        │
│   (主数据库)          │   │  (Rate Limiter)   │
└──────────────────────┘   └───────────────────┘
```

### 前端架构

```
src/
├── app/
│   ├── components/          # 组件
│   │   ├── ui/             # UI 组件库 (Radix UI)
│   │   ├── common/         # 通用组件
│   │   ├── products/       # 产品相关组件
│   │   ├── orders/         # 订单相关组件
│   │   ├── marketing/      # 营销相关组件
│   │   └── users/          # 用户相关组件
│   ├── pages/              # 页面组件
│   │   ├── Dashboard.tsx
│   │   ├── Products.tsx
│   │   ├── Orders.tsx
│   │   ├── Marketing.tsx
│   │   ├── Users.tsx
│   │   └── Reviews.tsx
│   ├── App.tsx
│   └── routes.tsx          # 路由配置
├── services/               # API 服务层
│   ├── api.ts             # API 客户端
│   ├── auth.ts            # 认证服务
│   ├── product.ts         # 产品服务
│   ├── order.ts           # 订单服务
│   ├── marketing.ts       # 营销服务
│   └── user.ts            # 用户服务
├── hooks/                  # 自定义 Hooks
│   ├── useAuth.ts
│   ├── useProducts.ts
│   ├── useOrders.ts
│   └── usePagination.ts
├── types/                  # TypeScript 类型
│   ├── api.ts
│   ├── auth.ts
│   ├── product.ts
│   ├── order.ts
│   └── user.ts
├── utils/                  # 工具函数
│   ├── formatters.ts
│   ├── validators.ts
│   └── constants.ts
└── styles/                 # 样式文件
    ├── index.css
    └── tailwind.css
```

## 数据库设计

### 核心表结构

#### 1. 用户相关表

```sql
-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 角色表
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 权限表
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(100) NOT NULL,
  actions TEXT[] NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户角色关联表
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- 角色权限关联表
CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
```

#### 2. 产品相关表

```sql
-- 分类表
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id),
  level INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  image_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 品牌表
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  description TEXT,
  website VARCHAR(255),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 产品表
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  brand_id UUID REFERENCES brands(id),
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  stock INTEGER DEFAULT 0,
  sku VARCHAR(100) UNIQUE,
  images TEXT[],
  status VARCHAR(20) DEFAULT 'draft',
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  sale_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 产品属性表
CREATE TABLE product_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. 订单相关表

```sql
-- 订单表
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES users(id),
  customer_name VARCHAR(100) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  total_amount DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  shipping_fee DECIMAL(10, 2) DEFAULT 0,
  final_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  payment_method VARCHAR(50),
  shipping_address JSONB NOT NULL,
  tracking_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 订单项表
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  product_image TEXT,
  sku VARCHAR(100),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 退货表
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number VARCHAR(50) UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id),
  customer_id UUID REFERENCES users(id),
  reason VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  images TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. 营销相关表

```sql
-- 秒杀活动表
CREATE TABLE flash_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 秒杀商品表
CREATE TABLE flash_sale_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flash_sale_id UUID REFERENCES flash_sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  flash_price DECIMAL(10, 2) NOT NULL,
  stock_limit INTEGER NOT NULL,
  stock_used INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- 优惠券表
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'fixed' or 'percentage'
  value DECIMAL(10, 2) NOT NULL,
  min_amount DECIMAL(10, 2) DEFAULT 0,
  max_discount DECIMAL(10, 2),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 推荐位表
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'brand', 'new', 'popular', 'topic'
  product_id UUID REFERENCES products(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 广告表
CREATE TABLE advertisements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  position VARCHAR(50) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  sort_order INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. 评论相关表

```sql
-- 评论表
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  images TEXT[],
  status VARCHAR(20) DEFAULT 'pending',
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 评论投票表
CREATE TABLE review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  vote_type VARCHAR(20) NOT NULL, -- 'helpful' or 'not_helpful'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(review_id, user_id)
);
```

### 索引设计

```sql
-- 产品索引
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- 订单索引
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- 评论索引
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
```

## API 设计

### RESTful API 规范

#### 基础 URL
```
http://localhost:3000/api/v1
```

#### 认证
所有 API 请求需要在 Header 中包含 JWT token：
```
Authorization: Bearer {token}
```

#### 统一响应格式

##### 成功响应
```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;      // ISO 8601 格式
    requestId: string;      // UUID
    version: string;        // API 版本
  };
}

// 示例
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "iPhone 14 Pro",
    "price": 999.99
  },
  "meta": {
    "timestamp": "2026-03-06T10:00:00Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "version": "v1"
  }
}
```

##### 错误响应
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // 标准错误码
    message: string;        // 用户友好的错误消息
    details?: any;          // 详细错误信息（可选）
    field?: string;         // 字段级错误（可选）
  };
  meta: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

// 示例
{
  "success": false,
  "error": {
    "code": "ERR_2001",
    "message": "产品名称不能为空",
    "field": "name"
  },
  "meta": {
    "timestamp": "2026-03-06T10:00:00Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "version": "v1"
  }
}
```

##### 分页响应
```typescript
interface PaginatedResponse<T> {
  success: true;
  data: {
    items: T[];
    pagination: {
      total: number;        // 总记录数
      page: number;         // 当前页码（从 1 开始）
      limit: number;        // 每页记录数
      totalPages: number;   // 总页数
      hasNext: boolean;     // 是否有下一页
      hasPrev: boolean;     // 是否有上一页
    };
  };
  meta: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

// 示例
{
  "success": true,
  "data": {
    "items": [
      { "id": "1", "name": "Product 1" },
      { "id": "2", "name": "Product 2" }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "meta": {
    "timestamp": "2026-03-06T10:00:00Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "version": "v1"
  }
}
```

#### 标准错误码体系

##### 通用错误 (1000-1999)
```typescript
const COMMON_ERRORS = {
  ERR_1000: '服务器内部错误',
  ERR_1001: '请求参数无效',
  ERR_1002: '资源未找到',
  ERR_1003: '请求方法不允许',
  ERR_1004: '请求超时',
  ERR_1005: '请求频率超限',
  ERR_1006: '服务暂时不可用',
  ERR_1007: '数据库连接失败',
  ERR_1008: '缓存服务不可用',
  ERR_1009: '第三方服务调用失败',
  ERR_1010: '文件上传失败',
  ERR_1011: '文件格式不支持',
  ERR_1012: '文件大小超限',
  ERR_1013: '幂等性冲突',
  ERR_1014: '并发冲突',
  ERR_1015: '权限不足',
  ERR_1016: '认证失败',
  ERR_1017: 'Token 已过期',
  ERR_1018: 'Token 无效',
};
```

##### 产品相关错误 (2000-2999)
```typescript
const PRODUCT_ERRORS = {
  ERR_2000: '产品操作失败',
  ERR_2001: '产品名称不能为空',
  ERR_2002: '产品价格必须大于 0',
  ERR_2003: '产品库存不足',
  ERR_2004: '产品不存在',
  ERR_2005: '产品已下架',
  ERR_2006: '产品 SKU 重复',
  ERR_2007: '分类不存在',
  ERR_2008: '品牌不存在',
  ERR_2009: '产品图片上传失败',
  ERR_2010: '产品属性无效',
  ERR_2011: '产品库存预留失败',
  ERR_2012: '产品库存扣减失败',
  ERR_2013: '产品库存释放失败',
};
```

##### 订单相关错误 (3000-3999)
```typescript
const ORDER_ERRORS = {
  ERR_3000: '订单操作失败',
  ERR_3001: '订单不存在',
  ERR_3002: '订单状态无效',
  ERR_3003: '订单无法取消',
  ERR_3004: '订单无法修改',
  ERR_3005: '订单金额计算错误',
  ERR_3006: '订单商品为空',
  ERR_3007: '收货地址无效',
  ERR_3008: '支付方式不支持',
  ERR_3009: '优惠券无效',
  ERR_3010: '优惠券已使用',
  ERR_3011: '优惠券已过期',
  ERR_3012: '订单创建失败',
  ERR_3013: '订单支付失败',
  ERR_3014: '订单发货失败',
  ERR_3015: '退货申请失败',
  ERR_3016: '退货状态无效',
};
```

##### 用户相关错误 (4000-4999)
```typescript
const USER_ERRORS = {
  ERR_4000: '用户操作失败',
  ERR_4001: '用户名或密码错误',
  ERR_4002: '用户不存在',
  ERR_4003: '用户已存在',
  ERR_4004: '用户名格式无效',
  ERR_4005: '邮箱格式无效',
  ERR_4006: '手机号格式无效',
  ERR_4007: '密码强度不足',
  ERR_4008: '用户已被禁用',
  ERR_4009: '角色不存在',
  ERR_4010: '权限不存在',
  ERR_4011: '用户角色分配失败',
  ERR_4012: '角色权限分配失败',
};
```

##### 营销相关错误 (5000-5999)
```typescript
const MARKETING_ERRORS = {
  ERR_5000: '营销活动操作失败',
  ERR_5001: '秒杀活动不存在',
  ERR_5002: '秒杀活动未开始',
  ERR_5003: '秒杀活动已结束',
  ERR_5004: '秒杀商品库存不足',
  ERR_5005: '秒杀商品不存在',
  ERR_5006: '优惠券不存在',
  ERR_5007: '优惠券库存不足',
  ERR_5008: '优惠券使用条件不满足',
  ERR_5009: '推荐位不存在',
  ERR_5010: '广告不存在',
  ERR_5011: '广告位已满',
};
```

### API 端点列表

#### 1. 认证 API
```
POST   /auth/login          # 用户登录
POST   /auth/logout         # 用户登出
POST   /auth/refresh        # 刷新 token
GET    /auth/me             # 获取当前用户信息
```

#### 2. 产品 API
```
GET    /products            # 获取产品列表
GET    /products/:id        # 获取产品详情
POST   /products            # 创建产品
PUT    /products/:id        # 更新产品
DELETE /products/:id        # 删除产品
POST   /products/bulk       # 批量操作
GET    /products/:id/reviews # 获取产品评论
```

#### 3. 分类 API
```
GET    /categories          # 获取分类列表
GET    /categories/:id      # 获取分类详情
POST   /categories          # 创建分类
PUT    /categories/:id      # 更新分类
DELETE /categories/:id      # 删除分类
```

#### 4. 品牌 API
```
GET    /brands              # 获取品牌列表
GET    /brands/:id          # 获取品牌详情
POST   /brands              # 创建品牌
PUT    /brands/:id          # 更新品牌
DELETE /brands/:id          # 删除品牌
```

#### 5. 订单 API
```
GET    /orders              # 获取订单列表
GET    /orders/:id          # 获取订单详情
POST   /orders              # 创建订单
PUT    /orders/:id          # 更新订单
PUT    /orders/:id/status   # 更新订单状态
POST   /orders/:id/shipping # 添加物流信息
GET    /orders/analytics    # 订单分析
```

#### 6. 退货 API
```
GET    /returns             # 获取退货列表
GET    /returns/:id         # 获取退货详情
POST   /returns             # 创建退货申请
PUT    /returns/:id/status  # 更新退货状态
```

#### 7. 营销 API
```
GET    /flash-sales         # 获取秒杀列表
POST   /flash-sales         # 创建秒杀活动
GET    /coupons             # 获取优惠券列表
POST   /coupons             # 创建优惠券
GET    /recommendations     # 获取推荐列表
POST   /recommendations     # 创建推荐
GET    /advertisements      # 获取广告列表
POST   /advertisements      # 创建广告
```

#### 8. 用户 API
```
GET    /users               # 获取用户列表
GET    /users/:id           # 获取用户详情
POST   /users               # 创建用户
PUT    /users/:id           # 更新用户
DELETE /users/:id           # 删除用户
GET    /roles               # 获取角色列表
POST   /roles               # 创建角色
GET    /permissions         # 获取权限列表
```

#### 9. 评论 API
```
GET    /reviews             # 获取评论列表
GET    /reviews/:id         # 获取评论详情
PUT    /reviews/:id/status  # 更新评论状态
DELETE /reviews/:id         # 删除评论
POST   /reviews/:id/reply   # 回复评论
```

#### 10. 仪表板 API
```
GET    /dashboard/stats     # 获取统计数据
GET    /dashboard/sales-trend # 获取销售趋势
GET    /dashboard/top-products # 获取热销商品
```

## 组件设计

### Design Tokens 系统

#### Token 定义
```typescript
// design-tokens.ts
export const designTokens = {
  // Colors
  colors: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',  // 主色
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    secondary: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',  // 辅助色
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      500: '#22c55e',  // 成功色
      700: '#15803d',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      500: '#f59e0b',  // 警告色
      700: '#b45309',
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      500: '#ef4444',  // 错误色
      700: '#b91c1c',
    },
    neutral: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
    },
  },
  
  // Typography
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: 'Menlo, Monaco, Consolas, "Courier New", monospace',
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem',// 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  // Spacing
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
  },
  
  // Border Radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    base: '0.25rem',  // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    full: '9999px',
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  
  // Transitions
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  // Z-Index
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
};

// Tailwind CSS 配置
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: designTokens.colors,
      fontFamily: designTokens.typography.fontFamily,
      fontSize: designTokens.typography.fontSize,
      fontWeight: designTokens.typography.fontWeight,
      spacing: designTokens.spacing,
      borderRadius: designTokens.borderRadius,
      boxShadow: designTokens.shadows,
      transitionDuration: designTokens.transitions,
      zIndex: designTokens.zIndex,
    },
  },
};
```

#### 使用 Design Tokens
```typescript
// 在组件中使用
function Button({ variant = 'primary', children }: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded-md font-medium transition-colors';
  
  const variantClasses = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600',
    secondary: 'bg-secondary-500 text-white hover:bg-secondary-600',
    outline: 'border-2 border-primary-500 text-primary-500 hover:bg-primary-50',
  };
  
  return (
    <button className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </button>
  );
}

// 使用 CSS-in-JS
import styled from 'styled-components';

const StyledButton = styled.button`
  padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
  background-color: ${designTokens.colors.primary[500]};
  color: white;
  border-radius: ${designTokens.borderRadius.md};
  font-weight: ${designTokens.typography.fontWeight.medium};
  transition: background-color ${designTokens.transitions.base};
  
  &:hover {
    background-color: ${designTokens.colors.primary[600]};
  }
`;
```

### 通用组件

#### 1. DataTable 组件
```typescript
interface Column<T> {
  key: keyof T;
  title: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, record: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    onPageChange: (page: number) => void;
  };
  onSort?: (field: string, order: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
  rowKey: keyof T;
}

function DataTable<T>({ 
  data, 
  columns, 
  loading, 
  pagination,
  onSort,
  onRowClick,
  rowKey 
}: DataTableProps<T>) {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const handleSort = (field: string) => {
    const newOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortOrder(newOrder);
    onSort?.(field, newOrder);
  };
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-neutral-200">
        <thead className="bg-neutral-50">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider"
                style={{ width: column.width }}
              >
                {column.sortable ? (
                  <button
                    onClick={() => handleSort(String(column.key))}
                    className="flex items-center gap-1 hover:text-neutral-700"
                  >
                    {column.title}
                    {sortField === column.key && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                ) : (
                  column.title
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-neutral-200">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-4 text-center">
                <LoadingSpinner />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-4 text-center text-neutral-500">
                暂无数据
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={String(row[rowKey])}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-neutral-50' : ''}
              >
                {columns.map((column) => (
                  <td key={String(column.key)} className="px-6 py-4 whitespace-nowrap">
                    {column.render
                      ? column.render(row[column.key], row)
                      : String(row[column.key])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      {pagination && (
        <Pagination
          total={pagination.total}
          page={pagination.page}
          limit={pagination.limit}
          onPageChange={pagination.onPageChange}
        />
      )}
    </div>
  );
}
```

#### 2. SearchBar 组件
```typescript
interface Filter {
  key: string;
  label: string;
  type: 'select' | 'date' | 'dateRange';
  options?: { label: string; value: string }[];
}

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  filters?: Filter[];
  onFilterChange?: (filters: Record<string, any>) => void;
}

function SearchBar({ placeholder, onSearch, filters, onFilterChange }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  
  const handleSearch = () => {
    onSearch(query);
  };
  
  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filterValues, [key]: value };
    setFilterValues(newFilters);
    onFilterChange?.(newFilters);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={placeholder || '搜索...'}
          className="flex-1 px-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={handleSearch}
          className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
        >
          搜索
        </button>
      </div>
      
      {filters && filters.length > 0 && (
        <div className="flex gap-4">
          {filters.map((filter) => (
            <div key={filter.key} className="flex items-center gap-2">
              <label className="text-sm text-neutral-600">{filter.label}:</label>
              {filter.type === 'select' && (
                <select
                  value={filterValues[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  className="px-3 py-1 border border-neutral-300 rounded-md"
                >
                  <option value="">全部</option>
                  {filter.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 3. ImageUpload 组件
```typescript
interface ImageUploadProps {
  value?: string[];
  onChange: (urls: string[]) => void;
  maxCount?: number;
  maxSize?: number; // MB
  accept?: string;
}

function ImageUpload({ 
  value = [], 
  onChange, 
  maxCount = 10, 
  maxSize = 5,
  accept = 'image/*'
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  
  const handleUpload = async (files: FileList) => {
    if (value.length + files.length > maxCount) {
      toast.error(`最多上传 ${maxCount} 张图片`);
      return;
    }
    
    setUploading(true);
    
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        if (file.size > maxSize * 1024 * 1024) {
          throw new Error(`图片 ${file.name} 超过 ${maxSize}MB`);
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios.post('/api/v1/upload', formData);
        return response.data.data.url;
      });
      
      const urls = await Promise.all(uploadPromises);
      onChange([...value, ...urls]);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };
  
  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {value.map((url, index) => (
          <div key={index} className="relative group">
            <img
              src={url}
              alt={`Upload ${index + 1}`}
              className="w-full h-32 object-cover rounded-md"
            />
            <button
              onClick={() => handleRemove(index)}
              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}
        
        {value.length < maxCount && (
          <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-neutral-300 rounded-md cursor-pointer hover:border-primary-500">
            <input
              type="file"
              multiple
              accept={accept}
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
              className="hidden"
              disabled={uploading}
            />
            <div className="text-center">
              {uploading ? (
                <LoadingSpinner />
              ) : (
                <>
                  <div className="text-4xl text-neutral-400">+</div>
                  <div className="text-sm text-neutral-500">上传图片</div>
                </>
              )}
            </div>
          </label>
        )}
      </div>
      
      <div className="text-sm text-neutral-500">
        最多上传 {maxCount} 张图片，每张不超过 {maxSize}MB
      </div>
    </div>
  );
}
```

#### 4. StatusBadge 组件
```typescript
interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
}

const STATUS_CONFIG: Record<string, { label: string; variant: StatusBadgeProps['variant'] }> = {
  // 产品状态
  draft: { label: '草稿', variant: 'default' },
  published: { label: '已发布', variant: 'success' },
  archived: { label: '已归档', variant: 'default' },
  
  // 订单状态
  pending: { label: '待处理', variant: 'warning' },
  processing: { label: '处理中', variant: 'info' },
  shipped: { label: '已发货', variant: 'info' },
  delivered: { label: '已送达', variant: 'success' },
  cancelled: { label: '已取消', variant: 'error' },
  
  // 支付状态
  unpaid: { label: '未支付', variant: 'warning' },
  paid: { label: '已支付', variant: 'success' },
  refunded: { label: '已退款', variant: 'default' },
};

function StatusBadge({ status, variant }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, variant: 'default' };
  const finalVariant = variant || config.variant;
  
  const variantClasses = {
    success: 'bg-success-50 text-success-700 border-success-200',
    warning: 'bg-warning-50 text-warning-700 border-warning-200',
    error: 'bg-error-50 text-error-700 border-error-200',
    info: 'bg-primary-50 text-primary-700 border-primary-200',
    default: 'bg-neutral-50 text-neutral-700 border-neutral-200',
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantClasses[finalVariant]}`}>
      {config.label}
    </span>
  );
}
```

### 页面组件

#### 1. ProductList 页面
- 产品表格
- 搜索和筛选
- 批量操作
- 分页

#### 2. ProductForm 页面
- 基本信息表单
- 图片上传
- 分类选择
- 属性管理

#### 3. OrderList 页面
- 订单表格
- 高级筛选
- 状态管理
- 导出功能

#### 4. OrderDetail 页面
- 订单信息展示
- 客户信息
- 商品列表
- 物流跟踪
- 状态更新

## 状态管理

### 使用 React Context + Hooks

```typescript
// AuthContext
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  hasPermission: (resource: string, action: string) => boolean;
}

// ProductContext
interface ProductContextType {
  products: Product[];
  loading: boolean;
  error: Error | null;
  fetchProducts: (params: ProductQuery) => Promise<void>;
  createProduct: (data: ProductInput) => Promise<void>;
  updateProduct: (id: string, data: ProductInput) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
}
```

## 安全设计

### 1. JWT 认证流程

#### Token 类型
```typescript
interface TokenPair {
  accessToken: string;   // 短期访问令牌（15 分钟）
  refreshToken: string;  // 长期刷新令牌（7 天）
}

interface AccessTokenPayload {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
  iat: number;           // 签发时间
  exp: number;           // 过期时间
}

interface RefreshTokenPayload {
  userId: string;
  tokenId: string;       // 唯一标识，用于撤销
  iat: number;
  exp: number;
}
```

#### 认证流程
```typescript
// 1. 用户登录
POST /api/v1/auth/login
Request: {
  username: string;
  password: string;
}
Response: {
  success: true,
  data: {
    accessToken: string,
    refreshToken: string,
    user: {
      id: string,
      username: string,
      email: string,
      roles: string[]
    }
  }
}

// 2. 存储 Token
// - accessToken 存储在内存（React state）
// - refreshToken 存储在 httpOnly cookie（更安全）
// - 用户信息存储在 localStorage

// 3. 请求拦截器自动附加 Token
axios.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 4. 响应拦截器处理 Token 过期
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && error.response?.data?.error?.code === 'ERR_1017') {
      // Token 过期，尝试刷新
      const newTokens = await refreshAccessToken();
      if (newTokens) {
        // 重试原请求
        error.config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return axios.request(error.config);
      } else {
        // 刷新失败，跳转登录
        redirectToLogin();
      }
    }
    return Promise.reject(error);
  }
);

// 5. 刷新 Token
POST /api/v1/auth/refresh
Request: {
  refreshToken: string  // 从 cookie 自动发送
}
Response: {
  success: true,
  data: {
    accessToken: string,
    refreshToken: string  // 可选：轮换刷新令牌
  }
}

// 6. 登出
POST /api/v1/auth/logout
// 清除客户端 Token
// 后端将 refreshToken 加入黑名单（Redis）
```

#### Redis Session 存储
```typescript
// Session 数据结构
interface UserSession {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
  loginTime: number;
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
}

// Redis Key 设计
// session:{userId}:{tokenId} -> UserSession (TTL: 7 天)
// blacklist:{tokenId} -> true (TTL: 7 天)

// 后端中间件验证
async function verifyToken(token: string): Promise<AccessTokenPayload> {
  // 1. 验证 JWT 签名和过期时间
  const payload = jwt.verify(token, JWT_SECRET);
  
  // 2. 检查 Token 是否在黑名单
  const isBlacklisted = await redis.exists(`blacklist:${payload.tokenId}`);
  if (isBlacklisted) {
    throw new Error('Token has been revoked');
  }
  
  // 3. 更新 Session 活动时间
  await redis.hset(`session:${payload.userId}:${payload.tokenId}`, 'lastActivity', Date.now());
  
  return payload;
}
```

### 2. RBAC 权限控制

#### 权限模型
```typescript
// 用户-角色-权限模型
interface User {
  id: string;
  username: string;
  roles: Role[];
}

interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

interface Permission {
  id: string;
  resource: string;      // 资源名称，如 'products', 'orders'
  actions: string[];     // 操作列表，如 ['read', 'write', 'delete']
}

// 权限检查函数
function hasPermission(user: User, resource: string, action: string): boolean {
  return user.roles.some(role =>
    role.permissions.some(permission =>
      permission.resource === resource &&
      permission.actions.includes(action)
    )
  );
}
```

#### 后端权限中间件
```typescript
// 权限装饰器
function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // 从 JWT 解析
    
    if (!hasPermission(user, resource, action)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ERR_1015',
          message: '权限不足'
        }
      });
    }
    
    next();
  };
}

// 使用示例
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

#### 前端权限控制
```typescript
// 路由级权限
<ProtectedRoute permission={{ resource: 'products', action: 'read' }}>
  <ProductList />
</ProtectedRoute>

// 组件级权限
function ProductActions({ product }: { product: Product }) {
  const { hasPermission } = useAuth();
  
  return (
    <div>
      {hasPermission('products', 'write') && (
        <Button onClick={() => handleEdit(product)}>编辑</Button>
      )}
      {hasPermission('products', 'delete') && (
        <Button onClick={() => handleDelete(product)}>删除</Button>
      )}
    </div>
  );
}

// 菜单权限过滤
function filterMenuByPermissions(menu: MenuItem[], user: User): MenuItem[] {
  return menu.filter(item => {
    if (item.permission) {
      const [resource, action] = item.permission.split(':');
      return hasPermission(user, resource, action);
    }
    return true;
  }).map(item => ({
    ...item,
    children: item.children ? filterMenuByPermissions(item.children, user) : undefined
  }));
}
```

### 3. 幂等性实现

#### 幂等性 Key 机制
```typescript
// 客户端生成幂等性 Key
import { v4 as uuidv4 } from 'uuid';

async function createOrder(orderData: OrderInput) {
  const idempotencyKey = uuidv4();
  
  return axios.post('/api/v1/orders', orderData, {
    headers: {
      'Idempotency-Key': idempotencyKey
    }
  });
}

// 后端幂等性中间件
async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  
  if (!idempotencyKey) {
    return next(); // 非幂等性请求
  }
  
  // 检查 Redis 缓存
  const cachedResponse = await redis.get(`idempotency:${idempotencyKey}`);
  
  if (cachedResponse) {
    // 返回缓存的响应
    return res.json(JSON.parse(cachedResponse));
  }
  
  // 拦截响应
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    // 缓存响应（24 小时）
    redis.setex(`idempotency:${idempotencyKey}`, 86400, JSON.stringify(data));
    return originalJson(data);
  };
  
  next();
}

// 应用到需要幂等性的路由
router.post('/orders', 
  authenticate,
  idempotencyMiddleware,
  createOrder
);
```

### 4. 输入验证
```typescript
// 使用 React Hook Form + Zod
const productSchema = z.object({
  name: z.string().min(1, '产品名称不能为空').max(255, '产品名称过长'),
  price: z.number().positive('价格必须大于 0'),
  stock: z.number().int('库存必须是整数').nonnegative('库存不能为负'),
  categoryId: z.string().uuid('分类 ID 格式无效'),
  brandId: z.string().uuid('品牌 ID 格式无效').optional(),
  description: z.string().max(5000, '描述过长').optional(),
  images: z.array(z.string().url('图片 URL 格式无效')).max(10, '最多 10 张图片'),
});

// 后端验证
import { z } from 'zod';

function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ERR_1001',
            message: '请求参数无效',
            details: error.errors
          }
        });
      }
      next(error);
    }
  };
}

// 使用示例
router.post('/products',
  authenticate,
  validateRequest(productSchema),
  createProduct
);
```

### 5. CSRF 防护
```typescript
// 后端生成 CSRF Token
import csrf from 'csurf';

const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// 获取 CSRF Token
router.get('/auth/csrf-token', csrfProtection, (req, res) => {
  res.json({
    success: true,
    data: {
      csrfToken: req.csrfToken()
    }
  });
});

// 前端在表单提交时附加 CSRF Token
axios.interceptors.request.use(async (config) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase() || '')) {
    const csrfToken = await getCsrfToken();
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});
```

## 性能优化

### 1. 多层缓存策略

#### 缓存层级架构
```
┌─────────────────────────────────────────────────────────────┐
│                    浏览器缓存层                              │
│  - LocalStorage (用户信息、偏好设置)                         │
│  - SessionStorage (临时数据)                                 │
│  - Memory Cache (组件状态)                                   │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    CDN 缓存层                                │
│  - 静态资源 (JS, CSS, 图片)                                 │
│  - Cache-Control: public, max-age=31536000                  │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Redis 缓存层                              │
│  - 热点数据 (产品列表、分类树)                              │
│  - Session 数据                                              │
│  - 分布式锁                                                  │
│  - 幂等性缓存                                                │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    数据库层                                  │
│  - PostgreSQL (持久化数据)                                   │
│  - 查询结果缓存                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Redis 缓存策略
```typescript
// 缓存 Key 设计
const CACHE_KEYS = {
  PRODUCT_LIST: (page: number, limit: number) => `products:list:${page}:${limit}`,
  PRODUCT_DETAIL: (id: string) => `products:detail:${id}`,
  CATEGORY_TREE: 'categories:tree',
  BRAND_LIST: 'brands:list',
  USER_PERMISSIONS: (userId: string) => `users:${userId}:permissions`,
  FLASH_SALE_STOCK: (saleId: string, productId: string) => `flash:${saleId}:${productId}:stock`,
};

// 缓存 TTL 配置
const CACHE_TTL = {
  SHORT: 60,           // 1 分钟 - 频繁变化的数据
  MEDIUM: 300,         // 5 分钟 - 一般数据
  LONG: 3600,          // 1 小时 - 相对稳定的数据
  VERY_LONG: 86400,    // 24 小时 - 很少变化的数据
};

// 缓存服务封装
class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set(key: string, value: any, ttl: number = CACHE_TTL.MEDIUM): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value));
  }
  
  async del(key: string | string[]): Promise<void> {
    await redis.del(key);
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

// 使用示例
async function getProducts(page: number, limit: number) {
  const cacheKey = CACHE_KEYS.PRODUCT_LIST(page, limit);
  
  // 尝试从缓存获取
  let products = await cacheService.get(cacheKey);
  
  if (!products) {
    // 缓存未命中，从数据库查询
    products = await db.products.findMany({
      skip: (page - 1) * limit,
      take: limit,
    });
    
    // 写入缓存
    await cacheService.set(cacheKey, products, CACHE_TTL.MEDIUM);
  }
  
  return products;
}

// 缓存失效策略
async function updateProduct(id: string, data: ProductInput) {
  // 更新数据库
  const product = await db.products.update({
    where: { id },
    data,
  });
  
  // 失效相关缓存
  await cacheService.del(CACHE_KEYS.PRODUCT_DETAIL(id));
  await cacheService.invalidatePattern('products:list:*');
  
  return product;
}
```

#### 前端数据缓存
```typescript
// 使用 SWR 实现客户端缓存
import useSWR from 'swr';

function useProducts(page: number, limit: number) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/v1/products?page=${page}&limit=${limit}`,
    fetcher,
    {
      revalidateOnFocus: false,      // 窗口聚焦时不重新验证
      revalidateOnReconnect: true,   // 重新连接时重新验证
      dedupingInterval: 2000,        // 2 秒内相同请求去重
      focusThrottleInterval: 5000,   // 5 秒内只触发一次聚焦重新验证
    }
  );
  
  return {
    products: data?.data?.items || [],
    pagination: data?.data?.pagination,
    isLoading,
    error,
    refresh: mutate,
  };
}
```

### 2. 库存预留与扣减流程

#### Redis 分布式锁实现
```typescript
class RedisLock {
  async acquire(key: string, ttl: number = 10): Promise<string | null> {
    const lockId = uuidv4();
    const result = await redis.set(
      `lock:${key}`,
      lockId,
      'EX', ttl,
      'NX'  // 只在 key 不存在时设置
    );
    return result === 'OK' ? lockId : null;
  }
  
  async release(key: string, lockId: string): Promise<boolean> {
    // Lua 脚本保证原子性
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await redis.eval(script, 1, `lock:${key}`, lockId);
    return result === 1;
  }
}

// 使用分布式锁
async function reserveStock(productId: string, quantity: number): Promise<boolean> {
  const lockKey = `product:${productId}`;
  const lockId = await redisLock.acquire(lockKey, 5);
  
  if (!lockId) {
    throw new Error('获取锁失败，请稍后重试');
  }
  
  try {
    // 检查库存
    const product = await db.products.findUnique({ where: { id: productId } });
    if (!product || product.stock < quantity) {
      return false;
    }
    
    // 预留库存
    await db.products.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } }
    });
    
    // 记录预留信息
    await db.stockReservations.create({
      data: {
        productId,
        quantity,
        status: 'reserved',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 分钟后过期
      }
    });
    
    return true;
  } finally {
    await redisLock.release(lockKey, lockId);
  }
}
```

#### 库存状态流转
```typescript
// 库存预留状态
enum StockReservationStatus {
  RESERVED = 'reserved',   // 已预留
  CONFIRMED = 'confirmed', // 已确认（订单支付成功）
  RELEASED = 'released',   // 已释放（订单取消或超时）
}

// 预留库存
async function reserveStock(orderId: string, items: OrderItem[]): Promise<void> {
  for (const item of items) {
    const success = await reserveStock(item.productId, item.quantity);
    if (!success) {
      // 回滚已预留的库存
      await rollbackReservations(orderId);
      throw new Error(`产品 ${item.productId} 库存不足`);
    }
  }
}

// 确认扣减（订单支付成功）
async function confirmStockDeduction(orderId: string): Promise<void> {
  await db.stockReservations.updateMany({
    where: { orderId, status: 'reserved' },
    data: { status: 'confirmed' }
  });
}

// 释放库存（订单取消或超时）
async function releaseStock(orderId: string): Promise<void> {
  const reservations = await db.stockReservations.findMany({
    where: { orderId, status: 'reserved' }
  });
  
  for (const reservation of reservations) {
    // 恢复库存
    await db.products.update({
      where: { id: reservation.productId },
      data: { stock: { increment: reservation.quantity } }
    });
    
    // 更新预留状态
    await db.stockReservations.update({
      where: { id: reservation.id },
      data: { status: 'released' }
    });
  }
}

// 定时任务：清理过期预留
async function cleanupExpiredReservations(): Promise<void> {
  const expiredReservations = await db.stockReservations.findMany({
    where: {
      status: 'reserved',
      expiresAt: { lt: new Date() }
    }
  });
  
  for (const reservation of expiredReservations) {
    await releaseStock(reservation.orderId);
  }
}
```

### 3. 秒杀场景优化

#### 库存预热到 Redis
```typescript
// 秒杀开始前预热库存
async function preheatFlashSaleStock(saleId: string): Promise<void> {
  const saleProducts = await db.flashSaleProducts.findMany({
    where: { flashSaleId: saleId }
  });
  
  for (const product of saleProducts) {
    const key = CACHE_KEYS.FLASH_SALE_STOCK(saleId, product.productId);
    await redis.set(key, product.stockLimit - product.stockUsed);
  }
}

// Lua 脚本保证库存扣减原子性
const DEDUCT_STOCK_SCRIPT = `
  local key = KEYS[1]
  local quantity = tonumber(ARGV[1])
  local stock = tonumber(redis.call('get', key) or 0)
  
  if stock >= quantity then
    redis.call('decrby', key, quantity)
    return 1
  else
    return 0
  end
`;

// 秒杀下单
async function createFlashSaleOrder(
  saleId: string,
  productId: string,
  userId: string,
  quantity: number
): Promise<Order> {
  // 1. 检查用户是否已购买（防止重复购买）
  const existingOrder = await redis.get(`flash:${saleId}:user:${userId}:${productId}`);
  if (existingOrder) {
    throw new Error('您已参与过该秒杀活动');
  }
  
  // 2. 使用 Lua 脚本扣减 Redis 库存
  const stockKey = CACHE_KEYS.FLASH_SALE_STOCK(saleId, productId);
  const result = await redis.eval(DEDUCT_STOCK_SCRIPT, 1, stockKey, quantity);
  
  if (result === 0) {
    throw new Error('库存不足');
  }
  
  // 3. 异步创建订单（消息队列）
  await messageQueue.publish('flash-sale-orders', {
    saleId,
    productId,
    userId,
    quantity,
    timestamp: Date.now(),
  });
  
  // 4. 记录用户购买标记（24 小时过期）
  await redis.setex(`flash:${saleId}:user:${userId}:${productId}`, 86400, '1');
  
  // 5. 返回预订单信息
  return {
    orderId: uuidv4(),
    status: 'processing',
    message: '订单处理中，请稍后查看订单详情',
  };
}

// 异步订单处理（消费者）
async function processFlashSaleOrder(message: FlashSaleOrderMessage): Promise<void> {
  try {
    // 创建订单
    const order = await db.orders.create({
      data: {
        userId: message.userId,
        // ... 其他订单信息
      }
    });
    
    // 更新数据库库存
    await db.flashSaleProducts.update({
      where: {
        flashSaleId_productId: {
          flashSaleId: message.saleId,
          productId: message.productId,
        }
      },
      data: {
        stockUsed: { increment: message.quantity }
      }
    });
    
    // 通知用户订单创建成功
    await notificationService.send(message.userId, {
      type: 'order_created',
      orderId: order.id,
    });
  } catch (error) {
    // 订单创建失败，恢复 Redis 库存
    const stockKey = CACHE_KEYS.FLASH_SALE_STOCK(message.saleId, message.productId);
    await redis.incrby(stockKey, message.quantity);
    
    // 通知用户订单创建失败
    await notificationService.send(message.userId, {
      type: 'order_failed',
      reason: error.message,
    });
  }
}
```

### 4. 代码分割
```typescript
// 路由懒加载
const Products = lazy(() => import('./pages/Products'));
const Orders = lazy(() => import('./pages/Orders'));
const Marketing = lazy(() => import('./pages/Marketing'));
const Users = lazy(() => import('./pages/Users'));

// 使用 Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/products" element={<Products />} />
    <Route path="/orders" element={<Orders />} />
    <Route path="/marketing" element={<Marketing />} />
    <Route path="/users" element={<Users />} />
  </Routes>
</Suspense>
```

### 5. 虚拟滚动
```typescript
// 大列表使用虚拟滚动
import { FixedSizeList } from 'react-window';

function ProductList({ products }: { products: Product[] }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={products.length}
      itemSize={80}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <ProductRow product={products[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

### 6. 图片优化
```typescript
// 图片懒加载
<img
  src={product.image}
  loading="lazy"
  alt={product.name}
/>

// 响应式图片
<picture>
  <source srcSet={product.imageWebp} type="image/webp" />
  <source srcSet={product.imageJpg} type="image/jpeg" />
  <img src={product.imageJpg} alt={product.name} loading="lazy" />
</picture>

// 图片 CDN 优化
function getOptimizedImageUrl(url: string, width: number, quality: number = 80): string {
  return `${CDN_URL}/${url}?w=${width}&q=${quality}&format=auto`;
}
```

## 测试策略

### 1. 单元测试
- 工具函数测试
- 组件测试
- Hook 测试

### 2. 集成测试
- API 集成测试
- 用户流程测试

### 3. E2E 测试
- 关键业务流程
- 跨页面操作

## 部署方案

### 开发环境
```bash
# 前端
cd frontend2
npm run dev

# 后端
cd backend
npm run dev
```

### 生产环境
```bash
# 构建前端
cd frontend2
npm run build

# 部署到 Nginx/CDN
```

## 监控和日志

### 1. 监控架构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端监控                                  │
│  - Sentry (错误监控)                                         │
│  - Web Vitals (性能监控)                                     │
│  - Google Analytics (用户行为)                               │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    后端监控                                  │
│  - Prometheus (指标收集)                                     │
│  - Winston (日志记录)                                        │
│  - Jaeger (分布式追踪)                                       │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    可视化与告警                              │
│  - Grafana (指标可视化)                                      │
│  - ELK Stack (日志分析)                                      │
│  - AlertManager (告警管理)                                   │
└─────────────────────────────────────────────────────────────┘
```

### 2. Prometheus 指标收集

#### 指标定义
```typescript
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

// 创建指标注册表
const register = new Registry();

// HTTP 请求计数器
const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// HTTP 请求延迟直方图
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// 数据库连接池
const dbConnectionPoolGauge = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Current size of database connection pool',
  labelNames: ['pool_name', 'state'],
  registers: [register],
});

// Redis 操作计数器
const redisOperationCounter = new Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

// 业务指标
const orderCreatedCounter = new Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['status'],
  registers: [register],
});

const productViewCounter = new Counter({
  name: 'products_viewed_total',
  help: 'Total number of product views',
  labelNames: ['product_id'],
  registers: [register],
});

const flashSaleStockGauge = new Gauge({
  name: 'flash_sale_stock_remaining',
  help: 'Remaining stock for flash sale products',
  labelNames: ['sale_id', 'product_id'],
  registers: [register],
});
```

#### 指标收集中间件
```typescript
// Express 中间件
function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // 请求完成后记录指标
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestCounter.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
    
    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode,
      },
      duration
    );
  });
  
  next();
}

// 应用中间件
app.use(metricsMiddleware);

// 暴露指标端点
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

#### 业务指标收集
```typescript
// 订单创建
async function createOrder(orderData: OrderInput): Promise<Order> {
  try {
    const order = await db.orders.create({ data: orderData });
    
    // 记录指标
    orderCreatedCounter.inc({ status: 'success' });
    
    return order;
  } catch (error) {
    orderCreatedCounter.inc({ status: 'error' });
    throw error;
  }
}

// 产品浏览
async function viewProduct(productId: string): Promise<void> {
  productViewCounter.inc({ product_id: productId });
  
  await db.products.update({
    where: { id: productId },
    data: { viewCount: { increment: 1 } }
  });
}

// 秒杀库存监控
async function monitorFlashSaleStock(): Promise<void> {
  const activeSales = await db.flashSales.findMany({
    where: {
      status: 'active',
      startTime: { lte: new Date() },
      endTime: { gte: new Date() },
    },
    include: { products: true },
  });
  
  for (const sale of activeSales) {
    for (const product of sale.products) {
      const remaining = product.stockLimit - product.stockUsed;
      flashSaleStockGauge.set(
        { sale_id: sale.id, product_id: product.productId },
        remaining
      );
    }
  }
}

// 定时更新指标
setInterval(monitorFlashSaleStock, 10000); // 每 10 秒更新一次
```

### 3. Winston 日志系统

#### 日志配置
```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 创建 logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'mall-admin-api' },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    
    // 错误日志文件（按天轮转）
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
    }),
    
    // 所有日志文件（按天轮转）
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
    
    // 访问日志文件
    new DailyRotateFile({
      filename: 'logs/access-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      maxSize: '20m',
      maxFiles: '7d',
    }),
  ],
});

export default logger;
```

#### 日志中间件
```typescript
// 请求日志中间件
function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.http('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
    });
  });
  
  next();
}

app.use(requestLogger);
```

#### 结构化日志
```typescript
// 业务日志
logger.info('Order created', {
  orderId: order.id,
  userId: user.id,
  amount: order.finalAmount,
  items: order.items.length,
});

logger.warn('Low stock alert', {
  productId: product.id,
  productName: product.name,
  currentStock: product.stock,
  threshold: 10,
});

logger.error('Payment failed', {
  orderId: order.id,
  userId: user.id,
  error: error.message,
  stack: error.stack,
});

// 安全日志
logger.warn('Failed login attempt', {
  username: credentials.username,
  ip: req.ip,
  userAgent: req.get('user-agent'),
});

logger.info('User logged out', {
  userId: user.id,
  sessionDuration: sessionDuration,
});

// 性能日志
logger.info('Slow query detected', {
  query: 'SELECT * FROM products',
  duration: '2.5s',
  threshold: '1s',
});
```

### 4. Jaeger 分布式追踪

#### 追踪配置
```typescript
import { initTracer } from 'jaeger-client';

const config = {
  serviceName: 'mall-admin-api',
  sampler: {
    type: 'probabilistic',
    param: 0.1, // 采样率 10%
  },
  reporter: {
    logSpans: true,
    agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
    agentPort: 6831,
  },
};

const tracer = initTracer(config, {});

export default tracer;
```

#### 追踪中间件
```typescript
import { FORMAT_HTTP_HEADERS, Tags } from 'opentracing';

function tracingMiddleware(req: Request, res: Response, next: NextFunction) {
  const parentSpanContext = tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
  
  const span = tracer.startSpan(req.path, {
    childOf: parentSpanContext || undefined,
    tags: {
      [Tags.SPAN_KIND]: Tags.SPAN_KIND_RPC_SERVER,
      [Tags.HTTP_METHOD]: req.method,
      [Tags.HTTP_URL]: req.url,
    },
  });
  
  // 将 span 附加到请求对象
  req.span = span;
  
  res.on('finish', () => {
    span.setTag(Tags.HTTP_STATUS_CODE, res.statusCode);
    
    if (res.statusCode >= 400) {
      span.setTag(Tags.ERROR, true);
    }
    
    span.finish();
  });
  
  next();
}

app.use(tracingMiddleware);
```

#### 业务追踪
```typescript
async function createOrder(req: Request, orderData: OrderInput): Promise<Order> {
  const span = tracer.startSpan('create_order', {
    childOf: req.span,
  });
  
  try {
    // 1. 验证库存
    const stockSpan = tracer.startSpan('check_stock', { childOf: span });
    await checkStock(orderData.items);
    stockSpan.finish();
    
    // 2. 创建订单
    const dbSpan = tracer.startSpan('db_insert_order', { childOf: span });
    const order = await db.orders.create({ data: orderData });
    dbSpan.finish();
    
    // 3. 扣减库存
    const deductSpan = tracer.startSpan('deduct_stock', { childOf: span });
    await deductStock(orderData.items);
    deductSpan.finish();
    
    span.setTag('order_id', order.id);
    span.setTag('order_amount', order.finalAmount);
    
    return order;
  } catch (error) {
    span.setTag(Tags.ERROR, true);
    span.log({
      event: 'error',
      message: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    span.finish();
  }
}
```

### 5. 前端监控

#### Sentry 错误监控
```typescript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  integrations: [new BrowserTracing()],
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  beforeSend(event, hint) {
    // 过滤敏感信息
    if (event.request) {
      delete event.request.cookies;
    }
    return event;
  },
});

// 错误边界
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}

// 手动捕获错误
try {
  await createOrder(orderData);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: 'order_creation',
    },
    extra: {
      orderData,
    },
  });
}
```

#### Web Vitals 性能监控
```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  // 发送到分析服务
  fetch('/api/v1/analytics/web-vitals', {
    method: 'POST',
    body: JSON.stringify(metric),
    headers: { 'Content-Type': 'application/json' },
  });
}

// 收集性能指标
getCLS(sendToAnalytics);  // Cumulative Layout Shift
getFID(sendToAnalytics);  // First Input Delay
getFCP(sendToAnalytics);  // First Contentful Paint
getLCP(sendToAnalytics);  // Largest Contentful Paint
getTTFB(sendToAnalytics); // Time to First Byte
```

#### 用户行为追踪
```typescript
// 页面浏览
function trackPageView(page: string) {
  logger.info('Page view', {
    page,
    userId: getCurrentUser()?.id,
    timestamp: new Date().toISOString(),
  });
}

// 用户操作
function trackEvent(category: string, action: string, label?: string, value?: number) {
  logger.info('User event', {
    category,
    action,
    label,
    value,
    userId: getCurrentUser()?.id,
    timestamp: new Date().toISOString(),
  });
}

// 使用示例
trackPageView('/products');
trackEvent('Product', 'View', productId);
trackEvent('Order', 'Create', orderId, orderAmount);
```

### 6. 告警配置

#### Prometheus 告警规则
```yaml
# prometheus-alerts.yml
groups:
  - name: api_alerts
    interval: 30s
    rules:
      # HTTP 错误率告警
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status_code=~"5.."}[5m])) 
          / 
          sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High HTTP error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"
      
      # API 响应时间告警
      - alert: SlowAPIResponse
        expr: |
          histogram_quantile(0.95, 
            rate(http_request_duration_seconds_bucket[5m])
          ) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API response time is slow"
          description: "95th percentile is {{ $value }}s"
      
      # 数据库连接池告警
      - alert: DatabaseConnectionPoolExhausted
        expr: |
          db_connection_pool_size{state="idle"} < 2
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"
      
      # Redis 连接失败告警
      - alert: RedisConnectionFailure
        expr: |
          rate(redis_operations_total{status="error"}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High Redis operation failure rate"
      
      # 秒杀库存告警
      - alert: FlashSaleStockLow
        expr: |
          flash_sale_stock_remaining < 10
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Flash sale stock is running low"
          description: "Only {{ $value }} items remaining"
```

### 7. Grafana 仪表板

#### 仪表板配置
```json
{
  "dashboard": {
    "title": "Mall Admin API Dashboard",
    "panels": [
      {
        "title": "HTTP Request Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (method)"
          }
        ]
      },
      {
        "title": "HTTP Error Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status_code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))"
          }
        ]
      },
      {
        "title": "API Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Orders Created",
        "targets": [
          {
            "expr": "sum(rate(orders_created_total[5m]))"
          }
        ]
      },
      {
        "title": "Flash Sale Stock",
        "targets": [
          {
            "expr": "flash_sale_stock_remaining"
          }
        ]
      }
    ]
  }
}
```

## 文档规范

### 代码注释
```typescript
/**
 * 获取产品列表
 * @param params 查询参数
 * @returns 产品列表和分页信息
 */
async function getProducts(params: ProductQuery): Promise<ProductListResponse> {
  // ...
}
```

### API 文档
使用 Swagger/OpenAPI 生成

### 组件文档
使用 Storybook 展示

## 总结

本设计文档涵盖了 Mall Admin Frontend Integration 项目的完整技术设计，包括：

### 核心架构
- 前后端分离架构（React + Node.js/Express）
- 多层缓存策略（浏览器、CDN、Redis、数据库）
- 微服务友好的模块化设计

### API 设计
- 统一的响应格式（成功、错误、分页）
- 标准化错误码体系（ERR_1000-5999）
- RESTful API 规范
- 完整的 API 端点定义

### 安全机制
- JWT 双 Token 认证（Access Token + Refresh Token）
- Redis Session 管理
- RBAC 权限控制（用户-角色-权限模型）
- 幂等性实现（Idempotency-Key）
- 输入验证（Zod Schema）
- CSRF 防护

### 性能优化
- 多层缓存策略（浏览器、CDN、Redis、数据库）
- Redis 分布式锁
- 库存预留与扣减流程
- 秒杀场景优化（库存预热、Lua 脚本、异步订单处理）
- 代码分割与懒加载
- 虚拟滚动
- 图片优化

### 前端设计
- Design Tokens 系统（颜色、字体、间距、阴影等）
- 通用组件库（DataTable、SearchBar、ImageUpload、StatusBadge）
- 状态管理（React Context + Hooks）
- 数据缓存（SWR）

### 数据库设计
- 完整的表结构设计（用户、产品、订单、营销、评论）
- 索引优化
- 关系设计

### 监控与可观测性
- Prometheus 指标收集（HTTP、数据库、Redis、业务指标）
- Winston 日志系统（结构化日志、日志轮转）
- Jaeger 分布式追踪
- Sentry 错误监控
- Web Vitals 性能监控
- Grafana 可视化仪表板
- AlertManager 告警管理

### 测试策略
- 单元测试
- 集成测试
- E2E 测试

下一步将根据此设计创建详细的需求文档和任务列表。
