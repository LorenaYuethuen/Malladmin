# Mall Admin System - Quick Start Guide

## 🚀 快速开始

本指南帮助你快速启动 Mall Admin System 的开发。

## 📋 前置条件

### 必需软件
- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- Redis >= 6.0
- npm 或 pnpm

### 可选软件
- Docker (用于运行数据库)
- VS Code (推荐的 IDE)

## 🛠️ 环境设置

### 1. 克隆项目
```bash
cd mall-admin-system
```

### 2. 启动数据库 (使用 Docker)
```bash
# 启动 PostgreSQL 和 Redis
docker compose up -d

# 验证数据库运行
docker compose ps
```

### 3. 后端设置
```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接

# 运行数据库迁移
npm run migrate

# (可选) 填充测试数据
npm run seed

# 启动开发服务器
npm run dev
```

后端将运行在: `http://localhost:3000`

### 4. 前端设置
```bash
cd ../frontend2

# 安装依赖
npm install

# 配置环境变量
# .env 文件已创建，包含:
# VITE_API_BASE_URL=http://localhost:3000/api/v1

# 启动开发服务器
npm run dev
```

前端将运行在: `http://localhost:5173`

## 🧪 验证安装

### 1. 测试后端
```bash
# 健康检查
curl http://localhost:3000/health

# 预期响应:
# {"status":"ok","timestamp":"...","uptime":...}
```

### 2. 测试前端
打开浏览器访问: `http://localhost:5173`

应该看到登录页面。

### 3. 测试登录
由于后端在开发环境下使用模拟用户，你可以：
- 直接访问任何页面（自动使用模拟用户）
- 或创建真实用户进行测试

## 📚 项目结构

```
mall-admin-system/
├── backend/                 # 后端 API
│   ├── src/
│   │   ├── controllers/    # 控制器
│   │   ├── services/       # 服务层
│   │   ├── middleware/     # 中间件
│   │   ├── routes/         # 路由
│   │   ├── database/       # 数据库
│   │   └── types/          # 类型定义
│   ├── .env                # 环境变量
│   └── package.json
├── frontend2/              # 前端应用
│   ├── src/
│   │   ├── app/           # 应用代码
│   │   │   ├── components/ # 组件
│   │   │   ├── pages/     # 页面
│   │   │   └── routes.tsx # 路由配置
│   │   ├── services/      # API 服务
│   │   ├── types/         # 类型定义
│   │   ├── hooks/         # 自定义 Hooks
│   │   └── utils/         # 工具函数
│   ├── .env               # 环境变量
│   └── package.json
├── .kiro/
│   └── specs/
│       └── mall-admin-frontend-integration/
│           ├── requirements.md  # 需求文档
│           ├── design.md       # 设计文档
│           └── tasks.md        # 任务列表
└── docker-compose.yml      # Docker 配置
```

## 🎯 开始开发

### 查看 Spec
```bash
# 查看需求文档
cat .kiro/specs/mall-admin-frontend-integration/requirements.md

# 查看设计文档
cat .kiro/specs/mall-admin-frontend-integration/design.md

# 查看任务列表
cat .kiro/specs/mall-admin-frontend-integration/tasks.md
```

### 选择第一个任务
根据 `tasks.md`，建议从 Phase 1 开始：

**Phase 1.1.1**: 创建产品相关类型
```bash
cd frontend2/src
mkdir -p types
touch types/product.ts
```

在 `types/product.ts` 中定义：
```typescript
export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  brandId: string;
  price: number;
  stock: number;
  images: string[];
  status: 'active' | 'inactive' | 'draft';
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  imageUrl: string;
  isActive: boolean;
}

export interface Brand {
  id: string;
  name: string;
  logo: string;
  description: string;
  website: string;
  sortOrder: number;
  isActive: boolean;
}

// ... 更多类型定义
```

### 实现 API 服务
**Phase 1.2.1**: 创建产品服务
```bash
mkdir -p services
touch services/product.ts
```

在 `services/product.ts` 中实现：
```typescript
import { apiClient } from './api';
import type { Product, ProductQuery } from '../types/product';

export class ProductService {
  static async getProducts(params?: ProductQuery) {
    return apiClient.get<{ items: Product[]; total: number }>(
      '/products',
      params
    );
  }

  static async getProduct(id: string) {
    return apiClient.get<Product>(`/products/${id}`);
  }

  static async createProduct(data: Partial<Product>) {
    return apiClient.post<Product>('/products', data);
  }

  static async updateProduct(id: string, data: Partial<Product>) {
    return apiClient.put<Product>(`/products/${id}`, data);
  }

  static async deleteProduct(id: string) {
    return apiClient.delete(`/products/${id}`);
  }
}
```

### 创建页面组件
**Phase 2.1.1**: 创建产品列表页面
```bash
cd src/app/pages
# Products.tsx 已存在，需要实现内容
```

编辑 `Products.tsx`：
```typescript
import { useState, useEffect } from 'react';
import { ProductService } from '../../services/product';
import type { Product } from '../../types/product';

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await ProductService.getProducts();
      setProducts(data.items);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Products</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="border p-4 rounded">
            <h3 className="font-semibold">{product.name}</h3>
            <p className="text-gray-600">${product.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 🔧 常用命令

### 后端
```bash
# 开发模式
npm run dev

# 构建
npm run build

# 生产模式
npm start

# 运行迁移
npm run migrate

# 填充数据
npm run seed

# 运行测试
npm test
```

### 前端
```bash
# 开发模式
npm run dev

# 构建
npm run build

# 预览构建
npm run preview

# 类型检查
npm run type-check

# Lint
npm run lint
```

### Docker
```bash
# 启动所有服务
docker compose up -d

# 停止所有服务
docker compose down

# 查看日志
docker compose logs -f

# 重启服务
docker compose restart
```

## 🐛 故障排查

### 后端无法启动
1. 检查 PostgreSQL 是否运行
2. 检查 Redis 是否运行
3. 检查 `.env` 配置是否正确
4. 检查端口 3000 是否被占用

### 前端无法连接后端
1. 检查后端是否运行
2. 检查 `.env` 中的 API 地址
3. 检查浏览器控制台的网络请求
4. 检查 CORS 配置

### 数据库连接失败
1. 检查 Docker 容器状态
2. 检查数据库凭据
3. 检查网络连接
4. 查看后端日志

## 📖 更多资源

### 文档
- [需求文档](./.kiro/specs/mall-admin-frontend-integration/requirements.md)
- [设计文档](./.kiro/specs/mall-admin-frontend-integration/design.md)
- [任务列表](./.kiro/specs/mall-admin-frontend-integration/tasks.md)
- [Spec 创建报告](./SPEC_CREATED.md)
- [前端设置完成](./FRONTEND2_SETUP_COMPLETE.md)
- [后端修复报告](./BACKEND_FIXES_V2.md)

### API 文档
- 后端 API: `http://localhost:3000/api/v1`
- 健康检查: `http://localhost:3000/health`

### 技术栈文档
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Express](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/)

## 💡 开发提示

### 1. 使用 TypeScript
确保所有代码都有完整的类型定义。

### 2. 遵循组件规范
- 使用函数组件
- 使用 Hooks 管理状态
- 保持组件小而专注

### 3. API 调用
- 使用 `apiClient` 进行所有 API 调用
- 处理加载状态和错误
- 使用 try-catch 捕获异常

### 4. 样式规范
- 使用 Tailwind CSS 类
- 保持一致的间距和颜色
- 使用 Radix UI 组件

### 5. 代码质量
- 编写清晰的注释
- 遵循命名规范
- 保持代码整洁

## 🎉 开始开发

现在你已经准备好开始开发了！

1. 查看 `tasks.md` 选择一个任务
2. 实现功能
3. 测试功能
4. 提交代码

祝开发顺利！🚀

---

**最后更新**: 2026-03-06
**版本**: 1.0.0
