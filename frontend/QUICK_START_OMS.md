# OMS 模块快速启动指南

## 🚀 快速开始

### 前置条件

1. Node.js 18+ 已安装
2. 后端服务已启动（端口 3000）
3. PostgreSQL 数据库已配置
4. Redis 已启动

---

## 📦 安装步骤

### 1. 安装前端依赖

```bash
cd frontend/mall-admin
npm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### 3. 启动前端开发服务器

```bash
npm run dev
```

前端将运行在：`http://localhost:5173`

---

## 🔧 后端配置

### 1. 启动后端服务

```bash
cd backend
npm run dev
```

后端将运行在：`http://localhost:3000`

### 2. 运行数据库迁移

```bash
cd backend
npm run migrate
```

### 3. （可选）填充测试数据

```bash
cd backend
npm run seed
```

---

## 🧪 测试 OMS 功能

### 1. 访问订单管理页面

打开浏览器访问：`http://localhost:5173/orders`

### 2. 测试功能模块

#### 订单列表
- ✅ 查看订单列表
- ✅ 搜索订单（订单号、客户名）
- ✅ 筛选订单状态
- ✅ 分页浏览

#### 退货管理
- ✅ 点击 "Returns" 标签
- ✅ 查看退货申请列表
- ✅ 查看退货状态和金额

#### 订单分析
- ✅ 点击 "Analytics" 标签
- ✅ 查看 KPI 指标
- ✅ 查看热销商品

---

## 📝 API 测试

### 使用 curl 测试后端 API

#### 1. 获取 JWT Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

保存返回的 token。

#### 2. 测试订单列表 API

```bash
curl -X GET "http://localhost:3000/api/v1/orders?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 3. 测试订单分析 API

```bash
curl -X GET "http://localhost:3000/api/v1/orders/analytics?groupBy=day" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 4. 测试退货列表 API

```bash
curl -X GET "http://localhost:3000/api/v1/returns?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🐛 常见问题

### 问题 1: 前端无法连接后端

**症状：** 页面一直显示 "Loading..."

**解决方案：**
1. 确认后端服务正在运行：`curl http://localhost:3000/health`
2. 检查 `.env` 文件中的 `VITE_API_BASE_URL` 配置
3. 检查浏览器控制台的网络请求

### 问题 2: CORS 错误

**症状：** 浏览器控制台显示 CORS 错误

**解决方案：**
1. 确认后端 `app.ts` 中已配置 CORS 中间件
2. 重启后端服务

### 问题 3: 数据库连接失败

**症状：** 后端启动失败，提示数据库连接错误

**解决方案：**
1. 确认 PostgreSQL 正在运行
2. 检查 `backend/.env` 中的数据库配置
3. 运行数据库迁移：`npm run migrate`

### 问题 4: 没有数据显示

**症状：** 页面正常加载但没有订单数据

**解决方案：**
1. 运行数据库种子脚本：`npm run seed`
2. 或使用 Postman 手动创建测试订单

---

## 📊 功能清单

### ✅ 已实现

- [x] 订单列表展示
- [x] 订单搜索和筛选
- [x] 订单分页
- [x] 退货列表展示
- [x] 订单分析仪表板
- [x] KPI 指标展示
- [x] 热销商品排行
- [x] API 服务层
- [x] 类型定义

### 🚧 待实现

- [ ] 订单详情页面
- [ ] 退货详情页面
- [ ] 订单状态更新
- [ ] 退货审批操作
- [ ] 批量操作
- [ ] 导出功能
- [ ] 实时通知

---

## 🔗 相关链接

- **后端 API 文档：** `backend/docs/OMS_COMPLETION_SUMMARY.md`
- **前端实现文档：** `frontend/mall-admin/OMS_FRONTEND_IMPLEMENTATION.md`
- **退货 API 测试：** `backend/docs/RETURN_API_TESTING.md`
- **库存 API 测试：** `backend/docs/INVENTORY_API_TESTING.md`
- **订单分析 API 测试：** `backend/docs/ORDER_ANALYTICS_API_TESTING.md`

---

## 📞 技术支持

如遇到问题，请检查：
1. 浏览器开发者工具的控制台
2. 后端服务日志
3. 数据库连接状态
4. Redis 连接状态

---

**祝你使用愉快！** 🎉
