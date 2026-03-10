# Frontend Migration Plan

## 目标

1. 使用 `frontend2/Malladmin` 作为新的前端实现
2. 简化认证系统，参考 `user-review-system` 的实现
3. 连接到现有的 Mall Admin Backend API

## 当前状态

### 现有前端 (frontend/)
- 位置: `mall-admin-system/frontend/`
- 技术栈: React + Vite
- 状态: 基本功能已实现，但需要改进

### 新前端 (frontend2/Malladmin/)
- 位置: `mall-admin-system/frontend2/Malladmin/`
- 技术栈: React + Vite + Tailwind CSS + shadcn/ui
- 组件库: Radix UI + Material UI
- 状态: 需要配置和实现

### 后端 API
- 位置: `mall-admin-system/backend/`
- 端口: 3000
- API Base: `http://localhost:3000/api/v1`
- 认证: JWT (当前在开发环境下已禁用)

## 迁移步骤

### Phase 1: 环境配置

#### 1.1 安装依赖
```bash
cd mall-admin-system/frontend2/Malladmin
npm install
# 或
pnpm install
```

#### 1.2 创建环境变量文件
创建 `.env` 文件：
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_API_TIMEOUT=30000
```

#### 1.3 配置 Vite
更新 `vite.config.ts` 添加代理配置（如果需要）

---

### Phase 2: API 客户端实现

#### 2.1 创建 API 服务层
参考 `user-review-system` 的简单实现：

**文件结构**:
```
src/
├── services/
│   ├── api.ts          # API 客户端基础类
│   ├── auth.ts         # 认证服务
│   ├── category.ts     # 分类服务
│   ├── brand.ts        # 品牌服务
│   ├── product.ts      # 产品服务
│   └── ...
├── types/
│   ├── auth.ts         # 认证类型
│   ├── api.ts          # API 响应类型
│   └── ...
└── hooks/
    ├── useAuth.ts      # 认证 Hook
    └── useApi.ts       # API Hook
```

#### 2.2 实现简化的认证系统

**认证流程**:
1. 用户登录 → 获取 JWT token
2. Token 存储在 localStorage
3. 每个 API 请求自动附加 token
4. Token 过期时自动跳转到登录页

**参考 user-review-system 的实现**:
- 简单的 JWT 验证
- Bearer token 认证
- 基于角色的权限控制

---

### Phase 3: 认证系统实现

#### 3.1 后端认证改进

当前状态：
- ✅ 开发环境下已禁用认证（使用模拟用户）
- ⏳ 需要实现真实的登录 API

需要实现的 API：
```typescript
POST /api/v1/auth/login
{
  "username": "admin",
  "password": "password"
}

Response:
{
  "success": true,
  "data": {
    "token": "jwt-token-here",
    "user": {
      "id": "user-id",
      "username": "admin",
      "email": "admin@example.com",
      "roles": ["admin"],
      "permissions": ["*:*"]
    },
    "expiresIn": 86400
  }
}
```

#### 3.2 前端认证实现

**创建认证服务** (`src/services/auth.ts`):
```typescript
export class AuthService {
  private static TOKEN_KEY = 'auth_token';
  private static USER_KEY = 'auth_user';

  static async login(username: string, password: string) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem(this.TOKEN_KEY, data.data.token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(data.data.user));
    }
    
    return data;
  }

  static logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
```

**创建 API 客户端** (`src/services/api.ts`):
```typescript
export class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = AuthService.getToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token 过期，跳转到登录页
      AuthService.logout();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || 'Request failed');
    }

    return data.data;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const queryString = params
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this.request<T>(`${endpoint}${queryString}`, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
);
```

---

### Phase 4: 页面实现

#### 4.1 登录页面
- 位置: `src/app/pages/Login.tsx`
- 功能: 用户名/密码登录
- UI: 使用 shadcn/ui 组件

#### 4.2 主要功能页面
1. Dashboard (仪表板)
2. Products (产品管理)
3. Categories (分类管理)
4. Brands (品牌管理)
5. Orders (订单管理)
6. Inventory (库存管理)
7. Marketing (营销管理)

#### 4.3 路由配置
使用 React Router 配置路由和权限保护

---

### Phase 5: 后端认证 API 实现

#### 5.1 创建登录控制器
文件: `backend/src/controllers/authController.ts`

需要实现的功能：
- ✅ 用户登录
- ✅ Token 生成
- ⏳ Token 刷新
- ⏳ 用户注册（可选）
- ⏳ 密码重置（可选）

#### 5.2 更新认证中间件
文件: `backend/src/middleware/auth.ts`

当前状态：
- ✅ 开发环境下使用模拟用户
- ⏳ 生产环境需要真实的 JWT 验证

---

## 技术栈对比

### User Review System (参考)
```typescript
// 简单的 JWT 认证
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

// 验证 token
const decoded = jwt.verify(token, JWT_SECRET);

// 附加用户信息到请求
req.user = {
  id: decoded.id,
  username: decoded.username,
  role: decoded.role
};
```

### Mall Admin System (当前)
```typescript
// 更复杂的认证系统
- JWT Service (token 生成、验证、刷新)
- Token 黑名单
- 数据库用户验证
- 基于角色和权限的访问控制
```

### 建议的简化方案
```typescript
// 保留核心功能，简化实现
- JWT 基础认证
- 简单的角色验证
- Token 存储在 localStorage
- 开发环境下可选的模拟认证
```

---

## 实施优先级

### 高优先级 (立即实施)
1. ✅ 配置新前端环境
2. ✅ 创建 API 客户端
3. ✅ 实现登录页面
4. ✅ 实现基础认证流程

### 中优先级 (第二阶段)
5. ⏳ 实现主要功能页面
6. ⏳ 完善后端登录 API
7. ⏳ 添加权限控制

### 低优先级 (后续优化)
8. ⏳ Token 刷新机制
9. ⏳ 用户注册功能
10. ⏳ 密码重置功能

---

## 开发环境配置

### 前端启动
```bash
cd mall-admin-system/frontend2/Malladmin
npm install
npm run dev
```

预期端口: `http://localhost:5173`

### 后端启动
```bash
cd mall-admin-system/backend
npm run dev
```

预期端口: `http://localhost:3000`

---

## 下一步行动

1. **立即执行**: 安装新前端依赖
2. **立即执行**: 创建 API 服务层
3. **立即执行**: 实现登录页面
4. **后续**: 逐步迁移功能页面

---

## 注意事项

1. **保留旧前端**: 在新前端完全可用之前，保留 `frontend/` 目录
2. **渐进式迁移**: 一次迁移一个功能模块
3. **测试优先**: 每个功能实现后立即测试
4. **文档更新**: 及时更新 README 和文档

---

**创建日期**: 2026-03-06
**最后更新**: 2026-03-06
