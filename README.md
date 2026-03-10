# Mall Admin System (商城后台管理系统)

完整的电商后台管理系统，包含后端 API 和前端管理界面。

## 项目结构

```
mall-admin-system/
├── backend/                    # 后端 API (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── api/               # API 路由和控制器
│   │   ├── config/            # 配置
│   │   ├── controllers/       # 控制器
│   │   ├── database/          # 数据库连接和迁移
│   │   ├── middleware/        # 中间件
│   │   ├── routes/            # 路由
│   │   ├── services/          # 业务逻辑服务
│   │   ├── types/             # TypeScript 类型
│   │   ├── utils/             # 工具函数
│   │   └── validation/        # 数据验证
│   ├── docs/                  # API 文档
│   ├── uploads/               # 文件上传目录
│   ├── .env                   # 环境变量
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # 前端管理界面
│   └── mall-admin/            # React + TypeScript 管理后台
│       ├── src/
│       │   └── app/
│       │       ├── components/    # 通用组件
│       │       ├── pages/         # 页面组件
│       │       ├── services/      # API 服务
│       │       ├── types/         # TypeScript 类型
│       │       └── routes.tsx     # 路由配置
│       ├── package.json
│       └── vite.config.ts
│
├── .kiro/                      # Kiro 配置和规范
│   └── specs/                 # 功能规范文档
│
├── docker-compose.yml          # Docker 编排配置
├── .env                        # 环境变量
└── README.md                   # 本文件
```

## 技术栈

### 后端
- **语言**: TypeScript
- **框架**: Express.js
- **数据库**: PostgreSQL 15
- **缓存**: Redis 7
- **ORM**: 原生 SQL (pg)
- **认证**: JWT
- **文档**: OpenAPI/Swagger

### 前端
- **语言**: TypeScript
- **框架**: React 18
- **构建工具**: Vite
- **UI 库**: Ant Design / Material-UI
- **状态管理**: React Context / Zustand
- **路由**: React Router v6

## 系统模块

### 1. 产品管理系统 (PMS)
- 产品管理 (CRUD)
- 分类管理
- 品牌管理
- 属性管理
- 批量导入/导出

### 2. 订单管理系统 (OMS)
- 订单管理
- 订单状态跟踪
- 退货/退款管理
- 物流管理
- 订单分析

### 3. 库存管理系统 (IMS)
- 库存查询
- 库存预留
- 库存释放
- 库存调整
- 低库存预警

### 4. 营销管理系统 (SMS)
- 优惠券管理
- 秒杀活动
- 推荐位管理
- 广告管理

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- Docker & Docker Compose
- npm >= 9.0.0

### 1. 克隆项目

```bash
cd mall-admin-system
```

### 2. 启动数据库服务

```bash
docker compose up -d
```

这将启动：
- PostgreSQL (端口 5432)
- Redis (端口 6379)

### 3. 启动后端

```bash
cd backend
npm install
npm run build
npm start
```

后端将在 http://localhost:3000 启动

### 4. 启动前端

```bash
cd frontend/mall-admin
npm install
npm run dev
```

前端将在 http://localhost:5173 启动

## 环境变量配置

### 后端 (.env)

```env
# 服务器配置
NODE_ENV=development
PORT=3000
API_VERSION=v1

# 数据库配置 (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=mall_user
DB_PASSWORD=mall_password
DB_NAME=mall_admin
DB_POOL_MIN=2
DB_POOL_MAX=20

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT配置
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRES_IN=7d

# CORS配置
CORS_ORIGIN=http://localhost:5173
```

## API 文档

### 后端 API 端点

#### 认证
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/logout` - 用户登出
- `POST /api/v1/auth/refresh` - 刷新 Token

#### 产品管理 (PMS)
- `GET /api/v1/products` - 获取产品列表
- `POST /api/v1/products` - 创建产品
- `GET /api/v1/products/:id` - 获取产品详情
- `PUT /api/v1/products/:id` - 更新产品
- `DELETE /api/v1/products/:id` - 删除产品
- `GET /api/v1/categories` - 获取分类列表
- `GET /api/v1/brands` - 获取品牌列表
- `GET /api/v1/attributes` - 获取属性列表

#### 订单管理 (OMS)
- `GET /api/v1/orders` - 获取订单列表
- `GET /api/v1/orders/:id` - 获取订单详情
- `PUT /api/v1/orders/:id/status` - 更新订单状态
- `GET /api/v1/orders/analytics` - 订单分析
- `GET /api/v1/returns` - 获取退货列表
- `POST /api/v1/returns/:id/approve` - 审批退货

#### 库存管理 (IMS)
- `GET /api/v1/inventory/:productId` - 查询库存
- `POST /api/v1/inventory/check` - 批量检查库存
- `POST /api/v1/inventory/reserve` - 预留库存
- `POST /api/v1/inventory/release` - 释放库存

#### 营销管理 (SMS)
- `GET /api/v1/coupons` - 获取优惠券列表
- `POST /api/v1/coupons` - 创建优惠券
- `GET /api/v1/flash-sales` - 获取秒杀活动列表
- `GET /api/v1/recommendations` - 获取推荐位列表
- `GET /api/v1/advertisements` - 获取广告列表

#### 健康检查
- `GET /health` - 服务健康检查

## 数据库

### PostgreSQL 连接信息

- **Host**: localhost
- **Port**: 5432
- **Database**: mall_admin
- **User**: mall_user
- **Password**: mall_password

### 数据库表

#### 用户管理 (UMS)
- `ums_users` - 用户表
- `ums_roles` - 角色表
- `ums_permissions` - 权限表

#### 产品管理 (PMS)
- `pms_products` - 产品表
- `pms_categories` - 分类表
- `pms_brands` - 品牌表
- `pms_attributes` - 属性表
- `pms_product_images` - 产品图片表

#### 订单管理 (OMS)
- `oms_orders` - 订单表
- `oms_order_items` - 订单项表
- `oms_returns` - 退货表
- `oms_shipping` - 物流表

#### 营销管理 (SMS)
- `sms_coupons` - 优惠券表
- `sms_flash_sales` - 秒杀活动表
- `sms_recommendations` - 推荐位表
- `sms_advertisements` - 广告表

### 运行数据库迁移

```bash
cd backend
npm run migrate
```

## 开发指南

### 后端开发

```bash
cd backend

# 开发模式 (热重载)
npm run dev

# 编译
npm run build

# 生产模式
npm start

# 运行测试
npm test
```

### 前端开发

```bash
cd frontend/mall-admin

# 开发模式
npm run dev

# 编译
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

## Docker 支持

### 启动所有服务

```bash
docker compose up -d
```

### 停止所有服务

```bash
docker compose down
```

### 查看日志

```bash
# 所有服务
docker compose logs -f

# 特定服务
docker compose logs -f postgres
docker compose logs -f redis
```

## 测试

### 后端测试

```bash
cd backend
npm test
```

### 前端测试

```bash
cd frontend/mall-admin
npm test
```

## 部署

### 生产环境部署

1. 设置环境变量
2. 构建后端和前端
3. 使用 PM2 或 Docker 部署

```bash
# 后端
cd backend
npm run build
pm2 start dist/server.js --name mall-admin-api

# 前端
cd frontend/mall-admin
npm run build
# 将 dist/ 目录部署到 Nginx 或其他静态服务器
```

## 监控和日志

- **日志位置**: `backend/logs/`
- **Prometheus 指标**: http://localhost:3000/metrics
- **健康检查**: http://localhost:3000/health

## 故障排查

参考 `TROUBLESHOOTING.md` 文档

## 相关文档

- `BACKEND_FIXES_COMPLETE.md` - 后端修复完成报告
- `OMS_INTEGRATION_COMPLETE.md` - OMS 集成完成报告
- `CURRENT_STATUS_SUMMARY.md` - 当前状态总结
- `backend/docs/` - 详细的 API 文档

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT

## 联系方式

如有问题，请提交 Issue。
