# Frontend2 Setup Complete

## 完成时间
2026-03-06

## 已完成的工作

### 1. 环境配置 ✅
- 创建 `.env` 文件配置 API 地址
- API Base URL: `http://localhost:3000/api/v1`

### 2. 类型定义 ✅
创建了以下类型文件：
- `src/types/auth.ts` - 认证相关类型
- `src/types/api.ts` - API 响应类型

### 3. 服务层实现 ✅

#### AuthService (`src/services/auth.ts`)
参考 user-review-system 的简单实现：
- `login()` - 用户登录
- `logout()` - 用户登出
- `getToken()` - 获取存储的 token
- `getUser()` - 获取存储的用户信息
- `isAuthenticated()` - 检查认证状态
- `hasRole()` - 检查用户角色
- `hasPermission()` - 检查用户权限

#### ApiClient (`src/services/api.ts`)
- 自动注入 JWT token
- 401 错误自动跳转登录
- 请求超时处理
- 支持 GET, POST, PUT, PATCH, DELETE

### 4. 页面实现 ✅

#### 登录页面 (`src/app/pages/Login.tsx`)
- 简洁的登录表单
- 用户名/密码登录
- 错误提示
- 加载状态

#### 受保护路由 (`src/app/components/ProtectedRoute.tsx`)
- 未认证用户自动跳转到登录页
- 保护所有需要认证的路由

### 5. 路由配置 ✅
更新了 `src/app/routes.tsx`：
- 添加 `/login` 路由
- 所有其他路由使用 `ProtectedRoute` 保护

### 6. 后端认证改进 ✅
修改了 `backend/src/controllers/authController.ts`：
- 支持 username 或 email 登录
- 返回格式兼容前端
- 添加 `expiresIn` 字段

---

## 项目结构

```
frontend2/
├── .env                          # 环境变量配置
├── src/
│   ├── types/
│   │   ├── auth.ts              # 认证类型
│   │   └── api.ts               # API 类型
│   ├── services/
│   │   ├── auth.ts              # 认证服务
│   │   └── api.ts               # API 客户端
│   ├── app/
│   │   ├── components/
│   │   │   ├── Layout.tsx       # 布局组件
│   │   │   └── ProtectedRoute.tsx  # 受保护路由
│   │   ├── pages/
│   │   │   ├── Login.tsx        # 登录页面
│   │   │   ├── Dashboard.tsx    # 仪表板
│   │   │   ├── Products.tsx     # 产品列表
│   │   │   └── ...              # 其他页面
│   │   ├── App.tsx              # 应用入口
│   │   └── routes.tsx           # 路由配置
│   ├── styles/
│   │   └── ...                  # 样式文件
│   └── main.tsx                 # React 入口
└── package.json
```

---

## 启动指南

### 1. 启动后端
```bash
cd mall-admin-system/backend
npm run dev
```
后端运行在: `http://localhost:3000`

### 2. 启动前端
```bash
cd mall-admin-system/frontend2
npm run dev
```
前端运行在: `http://localhost:5173`

### 3. 访问应用
打开浏览器访问: `http://localhost:5173`

---

## 认证流程

### 登录流程
1. 用户在登录页面输入用户名和密码
2. 前端调用 `AuthService.login()`
3. 发送 POST 请求到 `/api/v1/auth/login`
4. 后端验证凭据并返回 JWT token
5. 前端存储 token 和用户信息到 localStorage
6. 跳转到首页

### API 请求流程
1. 前端调用 `apiClient.get/post/put/delete()`
2. ApiClient 自动从 localStorage 获取 token
3. 添加 `Authorization: Bearer {token}` 头
4. 发送请求到后端
5. 如果返回 401，自动跳转到登录页

### 登出流程
1. 用户点击登出按钮
2. 调用 `AuthService.logout()`
3. 清除 localStorage 中的 token 和用户信息
4. 跳转到登录页

---

## 开发环境配置

### 后端认证状态
- ✅ 开发环境下，`authenticate` 中间件使用模拟用户
- ✅ 登录 API 已实现，支持 username/email 登录
- ✅ JWT token 生成和验证已实现

### 前端认证状态
- ✅ 登录页面已实现
- ✅ 受保护路由已实现
- ✅ API 客户端自动处理认证
- ✅ Token 存储在 localStorage

---

## 测试账号

### 开发环境
由于后端在开发环境下使用模拟用户，你可以：
1. 直接访问受保护的页面（无需登录）
2. 或者使用登录页面（需要真实的用户账号）

### 创建测试用户
如果需要测试真实登录，需要在数据库中创建用户：

```sql
-- 创建测试用户 (密码: password)
INSERT INTO users (id, username, email, password_hash, status)
VALUES (
  gen_random_uuid(),
  'admin',
  'admin@example.com',
  '$2b$10$YourHashedPasswordHere',  -- bcrypt hash of 'password'
  'active'
);

-- 分配管理员角色
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'admin' AND r.name = 'admin';
```

或者运行数据库种子脚本（如果有）：
```bash
cd mall-admin-system/backend
npm run db:seed
```

---

## API 端点

### 认证相关
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/logout` - 用户登出
- `POST /api/v1/auth/refresh` - 刷新 token
- `GET /api/v1/auth/me` - 获取当前用户信息

### 业务功能
- `GET /api/v1/products` - 获取产品列表
- `GET /api/v1/categories` - 获取分类列表
- `GET /api/v1/brands` - 获取品牌列表
- `GET /api/v1/orders` - 获取订单列表
- ... 更多 API

---

## 下一步工作

### 高优先级
1. ⏳ 实现产品管理页面的 API 集成
2. ⏳ 实现分类管理页面的 API 集成
3. ⏳ 实现品牌管理页面的 API 集成
4. ⏳ 添加用户信息显示（头部导航栏）
5. ⏳ 添加登出按钮

### 中优先级
6. ⏳ 实现订单管理页面
7. ⏳ 实现库存管理页面
8. ⏳ 实现营销管理页面
9. ⏳ 添加权限控制（基于角色）
10. ⏳ 添加数据加载状态

### 低优先级
11. ⏳ Token 自动刷新机制
12. ⏳ 记住登录状态
13. ⏳ 密码重置功能
14. ⏳ 用户注册功能

---

## 技术栈

### 前端
- React 18.3.1
- React Router 7.13.0
- Vite 6.3.5
- Tailwind CSS 4.1.12
- Radix UI (组件库)
- Material UI (图标)
- TypeScript

### 后端
- Node.js + Express
- TypeScript
- PostgreSQL (数据库)
- Redis (缓存)
- JWT (认证)
- bcrypt (密码加密)

---

## 参考实现

本实现参考了 `user-review-system` 的简单认证方案：
- 简单的 JWT 认证
- Bearer token 方式
- localStorage 存储
- 自动 token 注入

---

## 故障排查

### 前端无法连接后端
1. 检查后端是否运行: `http://localhost:3000/health`
2. 检查 `.env` 文件中的 API 地址
3. 检查浏览器控制台的网络请求

### 登录失败
1. 检查用户名和密码是否正确
2. 检查数据库中是否有该用户
3. 检查后端日志

### Token 过期
1. 重新登录获取新 token
2. 或实现 token 自动刷新机制

---

**创建日期**: 2026-03-06
**最后更新**: 2026-03-06
**状态**: ✅ 基础功能完成，可以开始开发业务功能
