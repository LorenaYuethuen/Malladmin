# 故障排查指南

## 🔧 当前问题解决方案

### 问题 1: 后端启动失败 - order.ts 语法错误 ✅ 已修复

**错误信息：**
```
ERROR: Expected "}" but found end of file
D:\AI\TEST\backend\src\types\order.ts:247:10
```

**原因：** `backend/src/types/order.ts` 文件末尾的 `TrackingStatus` enum 不完整

**解决方案：** ✅ 已修复！文件已更新。

---

### 问题 2: rateLimiter 导入错误 ✅ 已修复

**错误信息：**
```
TypeError: (0 , import_rateLimiter.rateLimiter) is not a function
at backend/src/routes/returnRoutes.ts:26:27
```

**原因：** `rateLimiter` 不是导出的函数，应该使用 `createRateLimiter`

**解决方案：** ✅ 已修复！以下文件已更新：
- `backend/src/routes/returnRoutes.ts`
- `backend/src/routes/inventoryRoutes.ts`

**验证修复：**
```bash
cd backend
npm run dev
```

应该看到：
```
Server running on port 3000
Database connected successfully
```

---

### 问题 3: validate 中间件导入错误 ✅ 已修复

**错误信息：**
```
TypeError: (0 , import_validation.validate) is not a function
at backend/src/routes/returnRoutes.ts:40
```

**原因：** 
- `validation.ts` 中间件导出的是 `validateRequest` 函数
- 但 `returnRoutes.ts` 和 `inventoryRoutes.ts` 导入的是 `validate`
- 导致运行时找不到函数

**解决方案：** ✅ 已修复！以下文件已更新：

1. **backend/src/routes/returnRoutes.ts**
   - 将 `import { validate }` 改为 `import { validateRequest }`
   - 所有路由处理器中的 `validate()` 改为 `validateRequest()`

2. **backend/src/routes/inventoryRoutes.ts**
   - 将 `import { validate }` 改为 `import { validateRequest }`
   - 所有路由处理器中的 `validate()` 改为 `validateRequest()`
   - 修复了 rate limiter 配置中的语法错误（删除了多余的 `message:` 属性）

**验证修复：**
```bash
cd backend
npm run dev
```

现在后端应该能够成功启动！

---

### 问题 4: Outbox Processor Unhandled Rejection ✅ 已修复

**错误信息：**
```
error: Unhandled Rejection at: {"0":"r","1":"e","2":"a","3":"s","4":"o","5":"n","6":":","service":"mall-admin-api","timestamp":"2026-03-06 13:19:06"}
```

**原因：** 
1. `eventPublisher.ts` 导入了不存在的 `redisClient`，实际导出的是 `redis`
2. `server.ts` 中的 `unhandledRejection` 处理器日志格式化错误

**解决方案：** ✅ 已修复！以下文件已更新：

1. **backend/src/services/eventPublisher.ts**
   - 将 `import { redisClient }` 改为 `import redis`
   - 所有 `redisClient.xxx()` 改为 `redis.getClient().xxx()`
   - 修复了 `publish()`, `subscribe()`, `consumeFromQueue()`, `getQueueLength()`, `clearQueue()` 方法

2. **backend/src/server.ts**
   - 修复了 `unhandledRejection` 处理器的日志格式
   - 在开发环境下不立即退出，便于调试

**验证修复：**
```bash
cd backend
npm run dev
```

应该看到：
```
Server running on port 3000
Database connected successfully
Redis connected successfully
Outbox processor started
```

不应该再有 "Unhandled Rejection" 错误。

---

### 问题 5: 前端代理错误 - ECONNREFUSED

**错误信息：**
```
[vite] http proxy error: /api/reviews?page=1&limit=10
AggregateError [ECONNREFUSED]
```

**原因：** 前端尝试连接后端 API，但后端服务未运行

**解决方案：**

#### 步骤 1: 确保后端正在运行

```bash
cd D:\AI\TEST\backend
npm run dev
```

#### 步骤 2: 验证后端健康状态

打开浏览器或使用 curl：
```bash
curl http://localhost:3000/health
```

应该返回：
```json
{"status":"ok"}
```

#### 步骤 3: 重启前端

```bash
cd D:\AI\TEST\frontend\mall-admin
npm run dev
```

---

## 🚀 完整启动流程

### 1. 启动后端服务

```bash
# 进入后端目录
cd D:\AI\TEST\backend

# 安装依赖（如果还没安装）
npm install

# 运行数据库迁移
npm run migrate

# 启动开发服务器
npm run dev
```

**预期输出：**
```
Server running on port 3000
Database connected successfully
Redis connected successfully
```

### 2. 启动前端服务

```bash
# 进入前端目录
cd D:\AI\TEST\frontend\mall-admin

# 安装依赖（如果还没安装）
npm install

# 启动开发服务器
npm run dev
```

**预期输出：**
```
VITE v6.3.5  ready in 853 ms
➜  Local:   http://localhost:5173/
```

### 3. 访问应用

打开浏览器访问：`http://localhost:5173/orders`

---

## 🔍 常见问题诊断

### 问题：后端无法连接数据库

**症状：**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方案：**

1. 确认 PostgreSQL 正在运行：
```bash
# Windows
services.msc
# 查找 PostgreSQL 服务，确保状态为"正在运行"
```

2. 检查数据库配置：
```bash
# 查看 backend/.env 文件
cat backend/.env
```

确保配置正确：
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mall_admin
DB_USER=postgres
DB_PASSWORD=your_password
```

3. 测试数据库连接：
```bash
psql -h localhost -U postgres -d mall_admin
```

---

### 问题：后端无法连接 Redis

**症状：**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**解决方案：**

1. 启动 Redis：
```bash
# Windows (如果使用 WSL)
wsl
redis-server

# 或使用 Windows Redis
redis-server.exe
```

2. 验证 Redis 运行：
```bash
redis-cli ping
```

应该返回：`PONG`

---

### 问题：前端 API 请求 404

**症状：**
```
GET http://localhost:3000/api/v1/orders 404 (Not Found)
```

**解决方案：**

1. 检查后端路由是否正确注册：
```bash
# 查看 backend/src/routes/index.ts
```

2. 确认 API 端点存在：
```bash
curl http://localhost:3000/api/v1/orders
```

3. 检查前端 API 配置：
```bash
# 查看 frontend/mall-admin/.env
cat frontend/mall-admin/.env
```

应该包含：
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

---

### 问题：前端 CORS 错误

**症状：**
```
Access to fetch at 'http://localhost:3000/api/v1/orders' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**解决方案：**

1. 检查后端 CORS 配置：
```typescript
// backend/src/app.ts
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
```

2. 重启后端服务

---

### 问题：认证失败 - 401 Unauthorized

**症状：**
```
GET http://localhost:3000/api/v1/orders 401 (Unauthorized)
```

**解决方案：**

1. 获取 JWT Token：
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

2. 在前端设置 Token：
```typescript
// 在浏览器控制台
localStorage.setItem('auth_token', 'YOUR_TOKEN_HERE');
```

3. 刷新页面

---

## 📋 启动检查清单

在启动应用前，确保以下服务都在运行：

- [ ] PostgreSQL 数据库（端口 5432）
- [ ] Redis 服务（端口 6379）
- [ ] 后端服务（端口 3000）
- [ ] 前端服务（端口 5173）

### 快速检查命令

```bash
# 检查 PostgreSQL
psql -h localhost -U postgres -c "SELECT version();"

# 检查 Redis
redis-cli ping

# 检查后端
curl http://localhost:3000/health

# 检查前端
curl http://localhost:5173
```

---

## 🛠️ 开发工具推荐

### 1. 数据库管理工具
- **pgAdmin** - PostgreSQL 图形化管理工具
- **DBeaver** - 通用数据库管理工具

### 2. API 测试工具
- **Postman** - API 测试和文档
- **Insomnia** - 轻量级 API 客户端
- **Thunder Client** - VS Code 扩展

### 3. Redis 管理工具
- **Redis Desktop Manager** - Redis 图形化客户端
- **RedisInsight** - Redis 官方工具

---

## 📞 获取帮助

如果问题仍未解决，请提供以下信息：

1. **错误信息**
   - 完整的错误堆栈
   - 浏览器控制台输出
   - 后端日志

2. **环境信息**
   - Node.js 版本：`node --version`
   - npm 版本：`npm --version`
   - PostgreSQL 版本：`psql --version`
   - Redis 版本：`redis-cli --version`

3. **配置文件**
   - `backend/.env`
   - `frontend/mall-admin/.env`

---

## 🎯 快速修复命令

如果一切都失败了，尝试完全重置：

```bash
# 停止所有服务
# Ctrl+C 停止后端和前端

# 清理并重新安装
cd D:\AI\TEST\backend
rm -rf node_modules
npm install

cd D:\AI\TEST\frontend\mall-admin
rm -rf node_modules
npm install

# 重置数据库
cd D:\AI\TEST\backend
npm run migrate:reset
npm run migrate
npm run seed

# 重启服务
npm run dev

# 在新终端
cd D:\AI\TEST\frontend\mall-admin
npm run dev
```

---

**最后更新：** 2024-01-15  
**维护者：** Development Team
