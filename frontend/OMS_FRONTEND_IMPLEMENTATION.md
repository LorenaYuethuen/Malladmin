# OMS Frontend Implementation Guide

## 概述

本文档说明了 OMS（订单管理系统）前端的完整实现，包括订单列表、退货管理和订单分析功能。

---

## 已实现的功能

### 1. API 服务层

**文件结构：**
```
src/app/services/
├── api.ts              # API 客户端基础配置
├── orderService.ts     # 订单服务
└── returnService.ts    # 退货服务
```

**核心功能：**
- ✅ 统一的 API 客户端配置
- ✅ JWT Token 管理
- ✅ 请求/响应拦截
- ✅ 错误处理
- ✅ 订单 CRUD 操作
- ✅ 订单分析数据获取
- ✅ 退货管理操作

### 2. 类型定义

**文件结构：**
```
src/app/types/
├── order.ts    # 订单相关类型
└── return.ts   # 退货相关类型
```

**定义的类型：**
- Order, OrderItem, OrderStatus, PaymentStatus
- OrderListResponse, OrderAnalytics
- ReturnRequest, ReturnItem, ReturnStatus
- ReturnListResponse
- 查询参数类型

### 3. Orders 页面组件

**文件：** `src/app/pages/Orders.tsx`

**功能模块：**

#### 3.1 订单列表视图
- ✅ 订单列表展示（分页）
- ✅ 搜索功能（订单号、客户名）
- ✅ 状态筛选
- ✅ 订单详情查看
- ✅ 实时数据加载
- ✅ 分页导航

#### 3.2 退货管理视图
- ✅ 退货申请列表
- ✅ 退货状态展示
- ✅ 退款金额显示
- ✅ 退货详情查看

#### 3.3 订单分析视图
- ✅ KPI 卡片展示
  - 总订单数
  - 总收入
  - 平均订单金额
- ✅ 热销商品排行
- ✅ 订单状态分布
- ✅ 支付状态分布

---

## 技术栈

- **框架：** React 18.3.1
- **路由：** React Router 7.13.0
- **UI 组件：** Radix UI + Tailwind CSS
- **图标：** Lucide React
- **类型检查：** TypeScript
- **构建工具：** Vite 6.3.5

---

## 安装和配置

### 1. 安装依赖

```bash
cd frontend/mall-admin
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### 3. 启动开发服务器

```bash
npm run dev
```

前端将运行在 `http://localhost:5173`

---

## API 集成说明

### 后端 API 端点

所有 API 调用都通过 `apiClient` 进行，自动添加认证 Token。

#### 订单相关 API

```typescript
// 获取订单列表
GET /orders?page=1&limit=10&status=pending

// 获取订单详情
GET /orders/:id

// 获取订单分析
GET /orders/analytics?startDate=...&endDate=...&groupBy=day

// 更新订单状态
PUT /orders/:id/status

// 取消订单
POST /orders/:id/cancel
```

#### 退货相关 API

```typescript
// 获取退货列表
GET /returns?page=1&limit=10&status=pending

// 获取退货详情
GET /returns/:id

// 处理退货（审批/拒绝/完成）
PUT /returns/:id/process

// 取消退货
DELETE /returns/:id
```

### 使用示例

```typescript
import { orderService } from '../services/orderService';
import { returnService } from '../services/returnService';

// 获取订单列表
const orders = await orderService.getOrders({
  page: 1,
  limit: 10,
  status: 'pending',
});

// 获取订单分析
const analytics = await orderService.getAnalytics({
  groupBy: 'day',
});

// 获取退货列表
const returns = await returnService.getReturns({
  page: 1,
  limit: 10,
});
```

---

## 组件使用说明

### Orders 组件

**路由：** `/orders`

**视图模式：**
1. **Orders（订单列表）** - 默认视图
2. **Returns（退货管理）** - 退货申请列表
3. **Analytics（订单分析）** - 数据分析仪表板

**状态管理：**
```typescript
const [viewMode, setViewMode] = useState<'list' | 'analytics' | 'returns'>('list');
const [orders, setOrders] = useState<Order[]>([]);
const [returns, setReturns] = useState<ReturnRequest[]>([]);
const [analytics, setAnalytics] = useState<OrderAnalytics | null>(null);
```

**筛选功能：**
- 搜索：订单号、客户名
- 状态筛选：所有状态、待处理、已确认、已支付等
- 分页：每页 10 条记录

---

## UI 组件说明

### 状态徽章

订单和退货状态使用彩色徽章展示：

- **Delivered（已送达）** - 绿色
- **Shipped（已发货）** - 蓝色
- **Processing（处理中）** - 橙色
- **Pending（待处理）** - 灰色
- **Cancelled（已取消）** - 红色
- **Refunded（已退款）** - 紫色

### KPI 卡片

分析视图中的 KPI 卡片展示关键指标：
- 图标 + 标题 + 数值
- 响应式布局（移动端单列，桌面端三列）

### 数据表格

- 响应式设计
- 悬停高亮
- 排序功能
- 分页导航

---

## 数据格式化

### 货币格式化

```typescript
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};
```

### 日期格式化

```typescript
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
```

---

## 错误处理

API 客户端自动处理以下错误：

1. **网络错误** - 显示连接失败提示
2. **401 未授权** - 清除 Token，跳转登录
3. **403 禁止访问** - 显示权限不足提示
4. **404 未找到** - 显示资源不存在提示
5. **500 服务器错误** - 显示服务器错误提示

---

## 性能优化

### 1. 数据缓存
- 使用 React state 缓存已加载的数据
- 避免重复请求

### 2. 分页加载
- 每页限制 10 条记录
- 减少单次数据传输量

### 3. 条件渲染
- 根据 viewMode 只渲染当前视图
- 减少 DOM 节点数量

### 4. 防抖搜索
- 搜索输入使用 useEffect 监听
- 避免频繁 API 调用

---

## 待实现功能

### 1. 订单详情页面
- [ ] 订单完整信息展示
- [ ] 订单商品列表
- [ ] 物流跟踪信息
- [ ] 订单状态更新操作

### 2. 退货详情页面
- [ ] 退货申请详情
- [ ] 退货商品明细
- [ ] 审批操作（批准/拒绝/完成）
- [ ] 管理员备注

### 3. 高级筛选
- [ ] 日期范围筛选
- [ ] 金额范围筛选
- [ ] 支付方式筛选
- [ ] 多条件组合筛选

### 4. 批量操作
- [ ] 批量导出订单
- [ ] 批量更新状态
- [ ] 批量打印发货单

### 5. 实时通知
- [ ] WebSocket 连接
- [ ] 新订单通知
- [ ] 退货申请通知
- [ ] 状态变更通知

---

## 测试指南

### 1. 启动后端服务

```bash
cd backend
npm run dev
```

后端运行在 `http://localhost:3000`

### 2. 启动前端服务

```bash
cd frontend/mall-admin
npm run dev
```

前端运行在 `http://localhost:5173`

### 3. 测试流程

#### 测试订单列表
1. 访问 `http://localhost:5173/orders`
2. 查看订单列表是否正常加载
3. 测试搜索功能
4. 测试状态筛选
5. 测试分页导航

#### 测试退货管理
1. 点击 "Returns" 标签
2. 查看退货列表是否正常加载
3. 验证退货状态显示
4. 验证退款金额显示

#### 测试订单分析
1. 点击 "Analytics" 标签
2. 查看 KPI 卡片数据
3. 查看热销商品列表
4. 验证数据准确性

---

## 故障排查

### 问题 1: API 请求失败

**症状：** 页面显示 "Loading..." 但没有数据

**解决方案：**
1. 检查后端服务是否运行
2. 检查 `.env` 文件中的 API_BASE_URL 配置
3. 打开浏览器开发者工具查看网络请求
4. 检查后端日志

### 问题 2: CORS 错误

**症状：** 浏览器控制台显示 CORS 错误

**解决方案：**
1. 确保后端配置了正确的 CORS 设置
2. 检查后端 `app.ts` 中的 CORS 中间件配置

### 问题 3: 认证失败

**症状：** 所有请求返回 401 错误

**解决方案：**
1. 检查 localStorage 中是否有 `auth_token`
2. 使用 Postman 测试后端登录接口
3. 确认 Token 格式正确

---

## 代码规范

### 1. 命名规范
- 组件名：PascalCase（如 `Orders`, `OrderList`）
- 函数名：camelCase（如 `fetchOrders`, `formatCurrency`）
- 常量名：UPPER_SNAKE_CASE（如 `API_BASE_URL`）

### 2. 文件组织
```
src/app/
├── components/     # 可复用组件
├── pages/          # 页面组件
├── services/       # API 服务
├── types/          # TypeScript 类型定义
└── utils/          # 工具函数
```

### 3. TypeScript 使用
- 所有组件和函数都应有类型定义
- 避免使用 `any` 类型
- 使用接口定义复杂对象

---

## 相关文档

- [后端 API 文档](../../backend/docs/OMS_COMPLETION_SUMMARY.md)
- [退货 API 测试指南](../../backend/docs/RETURN_API_TESTING.md)
- [库存 API 测试指南](../../backend/docs/INVENTORY_API_TESTING.md)
- [订单分析 API 测试指南](../../backend/docs/ORDER_ANALYTICS_API_TESTING.md)

---

## 更新日志

### v1.0.0 (2024-01-15)
- ✅ 初始实现
- ✅ 订单列表功能
- ✅ 退货管理功能
- ✅ 订单分析功能
- ✅ API 服务层
- ✅ 类型定义

---

**文档版本：** 1.0  
**最后更新：** 2024-01-15  
**维护者：** Frontend Team
