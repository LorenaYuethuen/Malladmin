# 实施计划: Mall Admin Frontend Integration

## 概述

本任务清单按 Phase A-G 组织，涵盖 OMS 订单管理、PMS 产品管理、SMS 营销管理、UMS 用户管理、Dashboard 统计面板、导航集成、测试优化等全部模块。前端基于 React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Radix UI，后端基于 Node.js + Express + TypeScript + PostgreSQL + Redis。

---

## Phase A: OMS 订单管理系统 (优先级：🔴 高)

- [x] A1. 后端 - 完善 OMS API
  - [x] A1.1 实现退货管理 API 完善
    - 完善 `backend/src/controllers/returnController.ts` 中的退货审批、退款计算逻辑
    - 完善 `backend/src/services/returnService.ts` 中的退货状态流转（pending → approved → refunding → completed / rejected）
    - 完善 `backend/src/validation/returnSchemas.ts` 中的退货申请验证（reason 非空、amount > 0）
    - 确保 `backend/src/routes/returnRoutes.ts` 包含: GET /returns, GET /returns/:id, POST /returns, PUT /returns/:id/status
    - _Requirements: 10.6, 2.5, 2.6_

  - [x] A1.2 实现库存集成 API 完善
    - 完善 `backend/src/controllers/inventoryController.ts` 中的库存预留、确认、释放逻辑
    - 完善 `backend/src/services/inventoryService.ts` 中的 Redis 分布式锁库存预留机制
    - 添加库存预留超时清理定时任务（15 分钟过期，每分钟执行清理）
    - 完善 `backend/src/validation/inventorySchemas.ts` 中的库存操作验证
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] A1.3 实现订单分析 API
    - 在 `backend/src/controllers/orderController.ts` 中添加 getOrderAnalytics 方法
    - 实现订单统计（总数、销售额、平均金额）、状态分布、趋势数据查询
    - 添加路由 GET /orders/analytics 到 `backend/src/routes/orderRoutes.ts`
    - 添加 Redis 缓存（TTL 5 分钟）
    - _Requirements: 10.5, 13.1, 13.2_

- [x] A2. 前端 - 实现 OMS 界面
  - [x] A2.1 创建订单类型定义 `frontend2/src/types/order.ts`
    - 定义 Order, OrderItem, OrderAddress, Return 接口
    - 定义 OrderStatus, PaymentStatus 枚举（pending → confirmed → paid → processing → shipped → delivered）
    - 定义 OrderQuery, OrderFilters, ReturnQuery 类型
    - 定义 OrderAnalytics, SalesTrend 类型
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] A2.2 创建订单服务层 `frontend2/src/services/order.ts`
    - 实现 getOrders(query), getOrder(id), updateOrderStatus(id, status)
    - 实现 addShippingInfo(id, data), getOrderAnalytics(params)
    - 实现 getReturns(query), getReturn(id), createReturn(data), updateReturnStatus(id, status)
    - 集成幂等性 Key（订单创建、状态更新）
    - 集成统一错误处理和响应解析
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 5.1, 5.5_

  - [x] A2.3 创建订单状态管理 Hooks
    - 创建 `frontend2/src/hooks/useOrders.ts`：订单列表管理（分页、筛选、搜索）
    - 创建 `frontend2/src/hooks/useOrderDetail.ts`：订单详情、状态更新
    - 创建 `frontend2/src/hooks/useReturns.ts`：退货列表管理
    - 使用 SWR 实现数据缓存和自动刷新
    - _Requirements: 10.1, 10.5, 10.6, 6.6_

  - [x] A2.4 实现订单列表页面 `frontend2/src/app/pages/Orders.tsx`
    - 使用 shadcn/ui Table 组件展示订单列表（订单号、客户、金额、状态、时间）
    - 实现 SearchBar 组件：订单号搜索、客户搜索、防抖处理
    - 实现高级筛选：状态筛选（Select）、日期范围（Calendar）、支付方式筛选
    - 实现 StatusBadge 组件显示订单状态（不同颜色映射）
    - 使用 shadcn/ui Pagination 实现分页
    - 实现批量操作：批量导出、批量发货（使用 Checkbox + DropdownMenu）
    - _Requirements: 10.1, 10.5, 20.1, 20.2, 20.4, 20.5_

  - [x] A2.5 实现订单详情页面 `frontend2/src/app/pages/OrderDetail.tsx`
    - 使用 Card 组件分区展示：订单基本信息、客户信息、收货地址
    - 使用 Table 展示订单商品列表（商品名、SKU、数量、单价、小计）
    - 实现订单状态时间线（使用自定义 Timeline 组件）
    - 实现支付信息展示（支付方式、支付状态、金额明细）
    - 实现状态更新功能（Select + Button + AlertDialog 确认）
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] A2.6 实现物流管理功能
    - 在 OrderDetail 页面中添加物流信息区域
    - 实现添加物流信息表单（Dialog + Form：物流公司、跟踪号）
    - 实现物流状态展示和物流轨迹时间线
    - 使用 React Hook Form + Zod 验证物流表单
    - _Requirements: 10.4, 15.1_

  - [x] A2.7 实现退货管理页面
    - 创建 `frontend2/src/app/pages/Returns.tsx`：退货列表页面
    - 使用 Table 展示退货列表（退货号、订单号、原因、金额、状态）
    - 实现退货筛选（状态、日期范围）
    - 创建 `frontend2/src/app/pages/ReturnDetail.tsx`：退货详情页面
    - 实现退货审批流程（审批表单、退款金额计算、AlertDialog 确认）
    - _Requirements: 10.6, 20.1, 20.4_

- [x] A3. Checkpoint - OMS 模块验证
  - 确保所有订单管理相关测试通过，ask the user if questions arise.

---

## Phase B: PMS 产品管理系统 (优先级：🔴 高)

- [x] B1. 前端 - 实现 PMS 界面
  - [x] B1.1 创建产品类型定义 `frontend2/src/types/product.ts`
    - 定义 Product, Category, Brand, ProductAttribute 接口
    - 定义 ProductStatus 枚举（draft, active, inactive, archived）
    - 定义 ProductQuery, ProductInput, CategoryInput, BrandInput 类型
    - 定义 ProductFilters, ProductSort 类型
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] B1.2 创建产品服务层 `frontend2/src/services/product.ts`
    - 实现 getProducts(query), getProduct(id), createProduct(data), updateProduct(id, data), deleteProduct(id)
    - 实现 getCategories(), getCategory(id), createCategory(data), updateCategory(id, data), deleteCategory(id)
    - 实现 getBrands(), getBrand(id), createBrand(data), updateBrand(id, data), deleteBrand(id)
    - 实现 getAttributes(productId), bulkUpdateProducts(ids, action)
    - 集成统一错误处理（ERR_2000-2013 错误码映射）
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 2.2, 2.3_

  - [x] B1.3 创建产品状态管理 Hooks
    - 创建 `frontend2/src/hooks/useProducts.ts`：产品列表管理（SWR + 分页 + 筛选 + 搜索）
    - 创建 `frontend2/src/hooks/useProductDetail.ts`：产品详情、创建、编辑
    - 创建 `frontend2/src/hooks/useCategories.ts`：分类数据管理
    - 创建 `frontend2/src/hooks/useBrands.ts`：品牌数据管理
    - _Requirements: 9.1, 9.3, 9.4, 6.6_

  - [x] B1.4 实现产品列表页面 `frontend2/src/app/pages/Products.tsx`
    - 使用 shadcn/ui Table 展示产品列表（图片缩略图、名称、SKU、价格、库存、状态）
    - 实现 SearchBar：关键词搜索（防抖 300ms）
    - 实现筛选功能：分类筛选（Select）、品牌筛选（Select）、状态筛选（Select）、价格范围（Input）
    - 实现排序功能：按价格、销量、创建时间排序
    - 实现批量操作：批量上架、下架、删除（Checkbox + DropdownMenu + AlertDialog）
    - 使用 Pagination 组件实现分页
    - 实现 StatusBadge 显示产品状态
    - _Requirements: 9.1, 9.4, 9.5, 20.1, 20.2, 20.4, 20.5_

  - [x] B1.5 实现产品表单页面 `frontend2/src/app/pages/ProductDetail.tsx`
    - 使用 React Hook Form + Zod 实现表单验证
    - 基本信息表单：名称（必填）、描述（Textarea）、SKU（唯一）、价格（> 0）、原价、库存（≥ 0）
    - 实现图片上传组件 `frontend2/src/app/components/common/ImageUpload.tsx`
      - 支持多图上传（最多 10 张）、拖拽上传、预览、删除、排序
    - 实现分类选择器：树形分类选择（使用 Command + Popover）
    - 实现品牌选择器：品牌下拉选择（Select + 搜索）
    - 实现属性管理：动态添加/编辑/删除属性键值对
    - 实现保存功能：创建/更新产品、草稿保存、发布
    - _Requirements: 9.1, 9.2, 9.3, 15.1, 15.2, 15.3_

  - [x] B1.6 实现分类管理页面 `frontend2/src/app/pages/Categories.tsx`
    - 使用树形结构展示分类层级（Accordion 或自定义 Tree 组件）
    - 实现分类 CRUD 操作（Dialog + Form）
    - 实现分类拖拽排序
    - 实现分类图片上传
    - _Requirements: 9.3_

  - [x] B1.7 实现品牌管理页面 `frontend2/src/app/pages/Brands.tsx`
    - 使用 Table 展示品牌列表（Logo、名称、网站、状态）
    - 实现品牌 CRUD 操作（Dialog + Form）
    - 实现 Logo 上传
    - 实现品牌启用/禁用
    - _Requirements: 9.3_

  - [x] B1.8 实现属性管理页面 `frontend2/src/app/pages/Attributes.tsx`
    - 使用 Table 展示属性列表
    - 实现属性分类管理
    - 实现属性值管理（动态添加/编辑/删除）
    - _Requirements: 9.3_

- [x] B2. Checkpoint - PMS 模块验证
  - 确保所有产品管理相关测试通过，ask the user if questions arise.

---

## Phase C: SMS 营销管理系统 (优先级：🟡 中)

- [x] C1. 后端 - 完善 SMS API
  - [x] C1.1 完善营销数据库 Schema
    - 检查 `backend/src/database/migrations/005_create_sms_tables.sql` 确保包含: flash_sales, flash_sale_products, coupons, recommendations, advertisements 表
    - 确保索引完整（flash_sales.status, coupons.code, advertisements.position）
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] C1.2 完善秒杀管理 API
    - 完善 `backend/src/controllers/flashSaleController.ts`：CRUD + 状态管理 + 商品关联
    - 实现秒杀库存预热到 Redis 逻辑
    - 实现 Lua 脚本原子性扣减 Redis 库存
    - 实现用户购买标记检查（防止重复购买，TTL 24h）
    - 完善 `backend/src/routes/flashSaleRoutes.ts`：GET/POST/PUT/DELETE /flash-sales, PUT /flash-sales/:id/status
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 11.1_

  - [x] C1.3 完善优惠券管理 API
    - 完善 `backend/src/controllers/couponController.ts`：CRUD + 使用统计 + 状态管理
    - 实现优惠券使用条件验证（最低金额、有效期、使用次数限制）
    - 完善 `backend/src/routes/couponRoutes.ts`：GET/POST/PUT/DELETE /coupons, GET /coupons/:id/stats
    - _Requirements: 11.2, 5.8_

  - [x] C1.4 完善推荐管理 API
    - 完善 `backend/src/controllers/recommendationController.ts`：CRUD + 排序 + 类型管理
    - 完善 `backend/src/routes/recommendationRoutes.ts`：GET/POST/PUT/DELETE /recommendations
    - _Requirements: 11.3_

  - [x] C1.5 完善广告管理 API
    - 完善 `backend/src/controllers/advertisementController.ts`：CRUD + 点击统计 + 位置管理
    - 完善 `backend/src/routes/advertisementRoutes.ts`：GET/POST/PUT/DELETE /advertisements, POST /advertisements/:id/click
    - _Requirements: 11.4_

- [x] C2. 前端 - 实现 SMS 界面
  - [x] C2.1 创建营销类型定义 `frontend2/src/types/marketing.ts`
    - 定义 FlashSale, FlashSaleProduct 接口
    - 定义 Coupon, CouponType 枚举（fixed, percentage）
    - 定义 Recommendation, RecommendationType 枚举（brand, new, popular, topic）
    - 定义 Advertisement, AdPosition 类型
    - 定义各模块的 Query 和 Input 类型
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] C2.2 创建营销服务层 `frontend2/src/services/marketing.ts`
    - 实现 getFlashSales(query), getFlashSale(id), createFlashSale(data), updateFlashSale(id, data), deleteFlashSale(id)
    - 实现 getCoupons(query), getCoupon(id), createCoupon(data), updateCoupon(id, data), deleteCoupon(id), getCouponStats(id)
    - 实现 getRecommendations(query), createRecommendation(data), updateRecommendation(id, data), deleteRecommendation(id)
    - 实现 getAdvertisements(query), createAdvertisement(data), updateAdvertisement(id, data), deleteAdvertisement(id)
    - 集成统一错误处理（ERR_5000-5011 错误码映射）
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 2.5_

  - [x] C2.3 创建营销 Hooks
    - 创建 `frontend2/src/hooks/useFlashSales.ts`：秒杀活动列表管理
    - 创建 `frontend2/src/hooks/useCoupons.ts`：优惠券列表管理
    - 创建 `frontend2/src/hooks/useRecommendations.ts`：推荐位管理
    - 创建 `frontend2/src/hooks/useAdvertisements.ts`：广告管理
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] C2.4 实现秒杀管理页面
    - 创建 `frontend2/src/app/pages/FlashSales.tsx`：秒杀活动列表
    - 使用 Table 展示活动列表（名称、时间、状态、商品数）
    - 实现状态筛选（pending, active, ended）
    - 创建 `frontend2/src/app/pages/FlashSaleDetail.tsx`：秒杀活动表单
    - 实现活动信息表单（名称、描述、开始/结束时间 - Calendar + TimePicker）
    - 实现商品选择器（Dialog + Table + Checkbox 批量选择商品）
    - 实现秒杀价格和库存限制设置
    - 使用 React Hook Form + Zod 验证
    - _Requirements: 11.1, 8.1, 15.1_

  - [x] C2.5 实现优惠券管理页面
    - 创建 `frontend2/src/app/pages/Coupons.tsx`：优惠券列表
    - 使用 Table 展示优惠券列表（名称、类型、面值、使用量/总量、状态）
    - 实现使用统计展示（Progress 组件显示使用率）
    - 创建 `frontend2/src/app/pages/CouponDetail.tsx`：优惠券表单
    - 实现优惠券信息表单（名称、编码、类型 fixed/percentage、面值、最低金额、最大折扣、有效期、使用限制）
    - 使用 React Hook Form + Zod 验证
    - _Requirements: 11.2, 15.1_

  - [x] C2.6 实现推荐管理页面
    - 创建 `frontend2/src/app/pages/Recommendations.tsx`：推荐位列表
    - 使用 Tabs 按类型分类展示（品牌推荐、新品推荐、热门推荐、专题推荐）
    - 实现商品选择和优先级设置
    - 实现拖拽排序功能
    - _Requirements: 11.3_

  - [x] C2.7 实现广告管理页面
    - 创建 `frontend2/src/app/pages/Advertisements.tsx`：广告列表
    - 使用 Table 展示广告列表（名称、图片预览、位置、点击量、状态）
    - 创建 `frontend2/src/app/pages/AdvertisementDetail.tsx`：广告表单
    - 实现广告信息表单（名称、图片上传、链接 URL、位置选择、开始/结束时间）
    - 实现点击统计展示
    - _Requirements: 11.4_

- [x] C3. Checkpoint - SMS 模块验证
  - 确保所有营销管理相关测试通过，ask the user if questions arise.

---

## Phase D: UMS 用户管理系统 (优先级：🟡 中)

- [x] D1. 后端 - 实现 UMS API
  - [x] D1.1 创建 UMS 数据库 Schema
    - 创建 `backend/src/database/migrations/006_create_ums_tables.sql`
    - 确保 users, roles, permissions, user_roles, role_permissions 表存在（参考 001_create_users_tables.sql）
    - 添加 menus 表（id, name, path, icon, parent_id, sort_order, permission_key, is_active）
    - 添加 audit_logs 表（id, user_id, action, resource, resource_id, details, ip_address, created_at）
    - 添加必要索引（audit_logs.user_id, audit_logs.created_at, menus.parent_id）
    - _Requirements: 4.1, 12.1, 12.2, 12.3_

  - [x] D1.2 实现用户管理 API
    - 创建 `backend/src/controllers/userController.ts`：getUsers, getUser, createUser, updateUser, deleteUser
    - 创建 `backend/src/services/userService.ts`：用户 CRUD、密码哈希（bcrypt）、角色分配
    - 创建 `backend/src/validation/userSchemas.ts`：用户名格式、邮箱格式、密码强度验证
    - 创建 `backend/src/routes/userRoutes.ts`：GET/POST/PUT/DELETE /users
    - 在 `backend/src/routes/index.ts` 中注册 userRoutes
    - _Requirements: 12.1, 12.4, 12.5, 15.2, 15.4_

  - [x] D1.3 实现角色管理 API
    - 创建 `backend/src/controllers/roleController.ts`：getRoles, getRole, createRole, updateRole, deleteRole, assignPermissions
    - 创建 `backend/src/services/roleService.ts`：角色 CRUD、权限分配
    - 创建 `backend/src/validation/roleSchemas.ts`：角色名称验证
    - 创建 `backend/src/routes/roleRoutes.ts`：GET/POST/PUT/DELETE /roles, PUT /roles/:id/permissions
    - 在 `backend/src/routes/index.ts` 中注册 roleRoutes
    - _Requirements: 4.1, 12.2, 12.3_

  - [x] D1.4 实现权限管理 API
    - 创建 `backend/src/controllers/permissionController.ts`：getPermissions, getPermission
    - 创建 `backend/src/services/permissionService.ts`：权限查询、缓存（Redis TTL 1h）
    - 创建 `backend/src/routes/permissionRoutes.ts`：GET /permissions
    - 在 `backend/src/routes/index.ts` 中注册 permissionRoutes
    - _Requirements: 4.1, 4.3, 4.6_

  - [x] D1.5 实现菜单管理 API
    - 创建 `backend/src/controllers/menuController.ts`：getMenus, getMenu, createMenu, updateMenu, deleteMenu, getMenuTree
    - 创建 `backend/src/services/menuService.ts`：菜单 CRUD、树形结构构建
    - 创建 `backend/src/validation/menuSchemas.ts`：菜单数据验证
    - 创建 `backend/src/routes/menuRoutes.ts`：GET/POST/PUT/DELETE /menus, GET /menus/tree
    - 在 `backend/src/routes/index.ts` 中注册 menuRoutes
    - _Requirements: 4.5_

  - [x] D1.6 实现审计日志 API
    - 创建 `backend/src/controllers/auditLogController.ts`：getAuditLogs, getAuditLog
    - 创建 `backend/src/services/auditLogService.ts`：日志查询、日志记录中间件
    - 创建 `backend/src/middleware/auditLog.ts`：自动记录用户操作日志
    - 创建 `backend/src/routes/auditLogRoutes.ts`：GET /audit-logs
    - 在 `backend/src/routes/index.ts` 中注册 auditLogRoutes
    - _Requirements: 12.6, 18.5_

- [x] D2. 前端 - 实现 UMS 界面
  - [x] D2.1 创建用户类型定义 `frontend2/src/types/user.ts`
    - 定义 User, Role, Permission, Menu 接口
    - 定义 UserStatus 枚举（active, inactive, banned）
    - 定义 UserQuery, UserInput, RoleInput, MenuInput 类型
    - 定义 AuditLog, AuditLogQuery 类型
    - _Requirements: 12.1, 12.2, 12.3, 4.1_

  - [x] D2.2 创建用户服务层 `frontend2/src/services/user.ts`
    - 实现 getUsers(query), getUser(id), createUser(data), updateUser(id, data), deleteUser(id)
    - 实现 getRoles(query), getRole(id), createRole(data), updateRole(id, data), deleteRole(id)
    - 实现 getPermissions(), getMenus(), getMenuTree()
    - 实现 getAuditLogs(query), getAuditLog(id)
    - 集成统一错误处理（ERR_4000-4012 错误码映射）
    - _Requirements: 12.1, 12.2, 12.3, 2.4_

  - [x] D2.3 创建用户管理 Hooks
    - 创建 `frontend2/src/hooks/useUsers.ts`：用户列表管理
    - 创建 `frontend2/src/hooks/useRoles.ts`：角色列表管理
    - 创建 `frontend2/src/hooks/useAuditLogs.ts`：审计日志管理
    - _Requirements: 12.1, 12.2_

  - [x] D2.4 实现用户管理页面
    - 创建 `frontend2/src/app/pages/Users.tsx`：用户列表页面
    - 使用 Table 展示用户列表（用户名、邮箱、角色、状态、最后登录时间）
    - 实现用户搜索和筛选（角色筛选、状态筛选）
    - 创建 `frontend2/src/app/pages/UserDetail.tsx`：用户表单页面
    - 实现用户信息表单（用户名、邮箱、手机号、密码、角色分配）
    - 使用 React Hook Form + Zod 验证（用户名格式、邮箱格式、密码强度）
    - 实现用户操作：创建、编辑、禁用/启用、重置密码（AlertDialog 确认）
    - _Requirements: 12.1, 12.4, 12.5, 15.1_

  - [x] D2.5 实现角色管理页面
    - 创建 `frontend2/src/app/pages/Roles.tsx`：角色列表页面
    - 使用 Table 展示角色列表（名称、描述、权限数、用户数）
    - 创建 `frontend2/src/app/pages/RoleDetail.tsx`：角色表单页面
    - 实现角色信息表单（名称、描述）
    - 实现权限树组件 `frontend2/src/app/components/users/PermissionTree.tsx`
      - 树形权限展示（Checkbox + Accordion）
      - 全选/反选、级联选择
      - 按资源分组（products, orders, users, marketing 等）
    - 实现菜单访问配置
    - _Requirements: 4.1, 4.3, 12.2, 12.3_

  - [x] D2.6 实现菜单管理页面
    - 创建 `frontend2/src/app/pages/Menus.tsx`：菜单管理页面
    - 使用树形结构展示菜单层级
    - 实现菜单 CRUD 操作（Dialog + Form：名称、路径、图标、父级、排序、权限标识）
    - 实现菜单拖拽排序
    - 使用 Lucide React 图标选择器
    - _Requirements: 4.5_

  - [x] D2.7 实现审计日志页面
    - 创建 `frontend2/src/app/pages/AuditLogs.tsx`：审计日志列表页面
    - 使用 Table 展示日志列表（时间、用户、操作、资源、IP 地址）
    - 实现日志筛选：用户筛选（Select）、操作类型筛选（Select）、日期范围（Calendar）
    - 实现日志详情查看（Dialog 展示详细信息）
    - _Requirements: 12.6, 18.5_

- [x] D3. Checkpoint - UMS 模块验证
  - 确保所有用户管理相关测试通过，ask the user if questions arise.

---

## Phase E: Dashboard 统计面板 (优先级：🟡 中)

- [x] E1. 后端 - Dashboard API
  - [x] E1.1 实现 Dashboard 统计 API
    - 创建 `backend/src/controllers/dashboardController.ts`
    - 实现 getStats()：总销售额、订单数、用户数、产品数、增长率计算
    - 实现 getSalesTrend(period)：按日/周/月的销售趋势数据
    - 实现 getOrderStatusDistribution()：订单状态分布统计
    - 实现 getTopProducts(limit)：热销商品排行榜（Top 10）
    - 实现 getRecentOrders(limit)：最近订单列表
    - 添加 Redis 缓存（TTL 5 分钟）
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] E1.2 创建 Dashboard 路由
    - 创建 `backend/src/routes/dashboardRoutes.ts`
    - 注册路由：GET /dashboard/stats, GET /dashboard/sales-trend, GET /dashboard/order-status, GET /dashboard/top-products, GET /dashboard/recent-orders
    - 在 `backend/src/routes/index.ts` 中注册 dashboardRoutes
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] E2. 前端 - Dashboard 界面
  - [x] E2.1 创建 Dashboard 类型定义 `frontend2/src/types/dashboard.ts`
    - 定义 DashboardStats, SalesTrend, OrderStatusDistribution, TopProduct 接口
    - 定义 TrendPeriod 枚举（day, week, month）
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] E2.2 创建 Dashboard 服务层 `frontend2/src/services/dashboard.ts`
    - 实现 getStats(), getSalesTrend(period), getOrderStatusDistribution(), getTopProducts(limit), getRecentOrders(limit)
    - 集成统一错误处理
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] E2.3 创建 Dashboard Hook `frontend2/src/hooks/useDashboard.ts`
    - 使用 SWR 管理 Dashboard 数据（自动刷新间隔 5 分钟）
    - 管理趋势周期切换状态
    - _Requirements: 13.5, 6.6_

  - [x] E2.4 实现 Dashboard 页面 `frontend2/src/app/pages/Dashboard.tsx`
    - 实现 KPI 统计卡片区域（使用 Card 组件）
      - 总销售额卡片（金额 + 增长率 + 趋势箭头图标）
      - 订单数卡片（数量 + 增长率）
      - 用户数卡片（数量 + 增长率）
      - 产品数卡片（数量）
      - 使用 Lucide React 图标（DollarSign, ShoppingCart, Users, Package）
    - 实现销售趋势图表（使用 Recharts LineChart）
      - 折线图展示销售趋势
      - 日期周期切换（日/周/月 - 使用 Tabs）
      - 自定义 Tooltip 展示详细数据
    - 实现订单状态分布饼图（使用 Recharts PieChart）
      - 饼图展示各状态占比
      - 自定义颜色映射（pending=yellow, paid=blue, shipped=purple, delivered=green, cancelled=red）
      - 交互 Tooltip
    - 实现热销商品排行榜（使用 Table）
      - 展示 Top 10 商品（排名、图片、名称、销量、销售额）
      - 点击跳转到商品详情
    - 实现快捷操作区域
      - 待处理订单数量提醒
      - 低库存商品提醒
      - 待审核评论提醒
      - 使用 Badge 组件显示数量
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 20.1_

- [x] E3. Checkpoint - Dashboard 模块验证
  - 确保所有 Dashboard 相关测试通过，ask the user if questions arise.

---

## Phase F: 导航和集成 (优先级：🔴 高)

- [x] F1. 统一导航系统
  - [x] F1.1 实现主导航组件 `frontend2/src/app/components/Layout.tsx`
    - 使用 shadcn/ui Sidebar 组件实现侧边栏导航
    - 实现导航菜单数据结构（支持多级菜单、图标、权限标识）
    - 使用 Lucide React 图标：
      - Dashboard: LayoutDashboard
      - 产品管理: Package (子菜单: 产品列表, 分类管理, 品牌管理, 属性管理)
      - 订单管理: ShoppingCart (子菜单: 订单列表, 退货管理)
      - 营销管理: Megaphone (子菜单: 秒杀管理, 优惠券管理, 推荐管理, 广告管理)
      - 用户管理: Users (子菜单: 用户列表, 角色管理, 菜单管理, 审计日志)
    - 实现侧边栏折叠/展开功能
    - 实现顶部导航栏（用户头像、用户名、DropdownMenu 登出）
    - 实现面包屑导航（使用 shadcn/ui Breadcrumb，根据路由动态生成）
    - _Requirements: 4.5, 20.1_

  - [x] F1.2 更新路由配置 `frontend2/src/app/routes.tsx`
    - 配置所有模块路由（使用 React Router DOM）：
      - `/` → Dashboard
      - `/products` → 产品列表, `/products/new` → 新建产品, `/products/:id` → 产品详情
      - `/categories` → 分类管理
      - `/brands` → 品牌管理
      - `/attributes` → 属性管理
      - `/orders` → 订单列表, `/orders/:id` → 订单详情
      - `/returns` → 退货列表, `/returns/:id` → 退货详情
      - `/flash-sales` → 秒杀列表, `/flash-sales/new` → 新建秒杀, `/flash-sales/:id` → 秒杀详情
      - `/coupons` → 优惠券列表, `/coupons/new` → 新建优惠券, `/coupons/:id` → 优惠券详情
      - `/recommendations` → 推荐管理
      - `/advertisements` → 广告列表, `/advertisements/new` → 新建广告, `/advertisements/:id` → 广告详情
      - `/users` → 用户列表, `/users/new` → 新建用户, `/users/:id` → 用户详情
      - `/roles` → 角色列表, `/roles/new` → 新建角色, `/roles/:id` → 角色详情
      - `/menus` → 菜单管理
      - `/audit-logs` → 审计日志
      - `/login` → 登录页
      - `*` → 404 页面
    - 实现路由懒加载（React.lazy + Suspense）
    - 实现嵌套路由（Layout 包裹所有需要导航的页面）
    - _Requirements: 17.3_

  - [x] F1.3 实现权限控制集成
    - 完善 `frontend2/src/app/components/ProtectedRoute.tsx`：认证检查 + 权限检查
    - 创建 `frontend2/src/app/components/common/PermissionGate.tsx`：组件级权限控制
    - 实现菜单权限过滤函数（根据用户权限动态过滤导航菜单）
    - 实现按钮级权限控制（根据权限显示/隐藏操作按钮）
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [x] F2. 共享组件和工具
  - [x] F2.1 创建通用业务组件
    - 创建 `frontend2/src/app/components/common/DataTable.tsx`：通用数据表格
      - 基于 shadcn/ui Table 封装
      - 支持分页、排序、行点击、自定义列渲染、加载状态、空状态
    - 创建 `frontend2/src/app/components/common/SearchBar.tsx`：通用搜索栏
      - 搜索输入（防抖 300ms）+ 多种筛选器（Select, DatePicker, DateRangePicker）
    - 创建 `frontend2/src/app/components/common/StatusBadge.tsx`：状态徽章
      - 支持不同状态的颜色和文本映射
    - 创建 `frontend2/src/app/components/common/ImageUpload.tsx`：图片上传
      - 多图上传、预览、删除、拖拽、大小限制
    - 创建 `frontend2/src/app/components/common/ConfirmDialog.tsx`：确认对话框
      - 基于 shadcn/ui AlertDialog 封装
    - 创建 `frontend2/src/app/components/common/EmptyState.tsx`：空状态
    - 创建 `frontend2/src/app/components/common/LoadingSpinner.tsx`：加载动画
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7_

  - [x] F2.2 创建工具函数
    - 创建 `frontend2/src/utils/formatters.ts`：formatCurrency, formatDate, formatNumber, formatStatus, formatFileSize
    - 创建 `frontend2/src/utils/validators.ts`：Zod schemas（email, phone, url, price, stock, password）
    - 创建 `frontend2/src/utils/constants.ts`：状态常量、配置常量、错误消息映射
    - 创建 `frontend2/src/utils/error-codes.ts`：标准错误码常量（ERR_1000-5999）
    - 创建 `frontend2/src/utils/error-handler.ts`：错误解析、用户友好消息映射
    - 创建 `frontend2/src/utils/idempotency.ts`：幂等性 Key 生成（UUID v4）
    - 创建 `frontend2/src/utils/cache-keys.ts`：SWR 缓存 Key 管理
    - _Requirements: 1.1, 1.4, 1.5, 2.1, 2.6, 5.1, 15.1, 15.2_

  - [x] F2.3 完善 API 客户端 `frontend2/src/services/api.ts`
    - 完善请求拦截器：自动附加 Authorization Bearer Token
    - 完善响应拦截器：统一响应解析、Token 过期自动刷新（401 → refresh → retry）
    - 添加幂等性 Key 自动附加（POST/PUT 请求）
    - 添加 CSRF Token 处理
    - 添加请求/响应日志（开发环境）
    - _Requirements: 1.1, 1.4, 3.4, 5.1, 16.3_

  - [x] F2.4 完善认证服务 `frontend2/src/services/auth.ts`
    - 完善 login, logout, refreshToken, getCurrentUser 方法
    - 实现 Token 存储管理（Access Token 内存存储，Refresh Token httpOnly cookie）
    - 实现 AuthContext Provider 和 useAuth Hook
    - 实现 hasPermission, hasRole 权限检查函数
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] F3. Checkpoint - 导航和集成验证
  - 确保所有导航、路由、权限控制正常工作，ask the user if questions arise.

---

## Phase G: 测试和优化 (优先级：🟢 低)

- [x] G1. 测试
  - [x] G1.1 工具函数单元测试
    - 测试 `utils/formatters.ts`：货币格式化、日期格式化、数字格式化
    - 测试 `utils/validators.ts`：邮箱验证、手机号验证、密码强度验证
    - 测试 `utils/error-handler.ts`：错误解析、错误码映射
    - 测试 `utils/idempotency.ts`：Key 生成唯一性
    - _Requirements: 15.1, 15.2_

  - [x] G1.2 Hooks 单元测试
    - 测试 useAuth：登录、登出、Token 刷新、权限检查
    - 测试 useProducts：列表加载、分页、筛选
    - 测试 useOrders：列表加载、状态更新
    - 测试 usePagination：页码管理
    - _Requirements: 3.1, 9.1, 10.1_

  - [x] G1.3 组件单元测试
    - 测试 DataTable：渲染、排序、分页
    - 测试 SearchBar：搜索、筛选
    - 测试 StatusBadge：状态颜色映射
    - 测试 PermissionGate：权限控制
    - _Requirements: 20.1, 20.2, 20.4_

  - [x] G1.4 API 集成测试
    - 测试认证流程：登录 → Token 刷新 → 登出
    - 测试产品 CRUD 流程
    - 测试订单状态流转
    - 测试权限控制（无权限返回 403）
    - _Requirements: 3.1, 9.1, 10.1, 4.4_

- [x] G2. 性能优化
  - [x] G2.1 实现代码分割和懒加载
    - 所有页面组件使用 React.lazy + Suspense
    - 实现路由级代码分割
    - 配置 Vite 分包策略（vendor, ui, charts 分离）
    - _Requirements: 17.3_

  - [x] G2.2 实现图片优化
    - 图片懒加载（Intersection Observer）
    - 图片压缩和格式优化
    - 缩略图生成
    - _Requirements: 17.5_

  - [x] G2.3 实现虚拟滚动
    - 对超过 100 项的列表使用虚拟滚动（react-window 或 @tanstack/react-virtual）
    - 应用于产品列表、订单列表等大数据量场景
    - _Requirements: 17.4_

  - [x] G2.4 实现前端缓存优化
    - 配置 SWR 全局缓存策略（revalidateOnFocus, dedupingInterval）
    - 实现 LocalStorage 持久化缓存（用户偏好、筛选条件）
    - 实现 SessionStorage 临时缓存（表单草稿）
    - _Requirements: 6.1, 6.6_

  - [x] G2.5 优化打包体积
    - 分析打包体积（vite-plugin-visualizer）
    - Tree-shaking 优化
    - 按需引入 shadcn/ui 组件和 Lucide 图标
    - _Requirements: 17.1_

- [x] G3. 文档
  - [x] G3.1 编写 API 文档
    - 使用 Swagger/OpenAPI 规范编写后端 API 文档
    - 包含所有端点的请求/响应示例
    - _Requirements: 可维护性 4_

  - [x] G3.2 编写组件文档
    - 编写通用组件使用文档（DataTable, SearchBar, ImageUpload 等）
    - 包含 Props 说明和使用示例
    - _Requirements: 可维护性 4_

- [x] G4. Checkpoint - 最终验证
  - 确保所有测试通过、性能指标达标，ask the user if questions arise.

---

## 项目现状

| 模块 | 后端完成度 | 前端完成度 | 说明 |
|------|-----------|-----------|------|
| 认证系统 (Auth) | ✅ 90% | 🟡 40% | 后端 JWT + CSRF 已实现，前端 api.ts/auth.ts 基础已有 |
| 产品管理 (PMS) | ✅ 85% | 🔴 15% | 后端 CRUD + 分类/品牌/属性 API 已有，前端仅有页面占位 |
| 订单管理 (OMS) | 🟡 60% | 🔴 15% | 后端订单/退货/库存/物流 API 部分实现，前端仅有页面占位 |
| 营销管理 (SMS) | 🟡 50% | 🔴 5% | 后端秒杀/优惠券/推荐/广告 Controller 已有但需完善，前端仅有 Marketing 占位页 |
| 用户管理 (UMS) | 🔴 20% | 🔴 10% | 后端仅有 users 表和 auth，缺少角色/权限/菜单/审计 API，前端有 Users 占位页 |
| Dashboard | 🔴 0% | 🔴 5% | 后端无 Dashboard API，前端仅有 Dashboard 占位页 |
| 导航集成 | - | 🟡 30% | Layout + ProtectedRoute 已有基础，需完善侧边栏和路由 |
| 通用组件 | - | 🟡 40% | shadcn/ui 组件库已安装（47 个组件），需封装业务通用组件 |

**总体进度**: 后端 ~70%, 前端 ~20%

---

## 任务优先级说明

| 优先级 | 标识 | Phase | 说明 |
|--------|------|-------|------|
| 🔴 高 | 立即开始 | Phase A (OMS), Phase B (PMS), Phase F (导航集成) | 核心业务功能，阻塞其他模块 |
| 🟡 中 | 后续实现 | Phase C (SMS), Phase D (UMS), Phase E (Dashboard) | 重要但不阻塞核心流程 |
| 🟢 低 | 可选 | Phase G (测试优化) | 质量保障，按需进行 |

---

## 预估工作量

| Phase | 模块 | 预估工时 | 说明 |
|-------|------|---------|------|
| Phase A | OMS 订单管理 | 5-6 天 | 后端 API 完善 2 天 + 前端界面 3-4 天 |
| Phase B | PMS 产品管理 | 5-6 天 | 前端界面为主（后端 API 已基本完成） |
| Phase C | SMS 营销管理 | 5-6 天 | 后端完善 2 天 + 前端界面 3-4 天 |
| Phase D | UMS 用户管理 | 6-7 天 | 后端 API 新建 3 天 + 前端界面 3-4 天 |
| Phase E | Dashboard | 3-4 天 | 后端 API 1 天 + 前端 Recharts 图表 2-3 天 |
| Phase F | 导航和集成 | 3-4 天 | 导航组件 + 路由 + 权限 + 通用组件 + 工具函数 |
| Phase G | 测试和优化 | 3-5 天 | 按需进行 |
| **总计** | | **30-38 工作日** | |

---

## 技术栈确认

### 前端 (frontend2/)
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **UI 组件库**: shadcn/ui (Radix UI) + Material UI
- **路由**: React Router DOM
- **图表**: Recharts
- **表单**: React Hook Form + Zod
- **图标**: Lucide React
- **数据请求**: Axios + SWR
- **状态管理**: React Context + Hooks

### 后端 (backend/)
- **运行时**: Node.js 18+
- **框架**: Express + TypeScript
- **数据库**: PostgreSQL 14+
- **缓存**: Redis 6+
- **认证**: JWT (jsonwebtoken)
- **验证**: Zod
- **日志**: Winston
- **监控**: Prometheus + Sentry

---

## 下一步行动

建议按以下顺序执行：

1. **Phase F (导航集成)** → 先搭建通用组件、工具函数、路由框架，为后续模块提供基础
2. **Phase A (OMS)** → 完善后端 API + 实现前端订单管理界面
3. **Phase B (PMS)** → 实现前端产品管理界面（后端 API 已基本就绪）
4. **Phase D (UMS)** → 新建后端 API + 实现前端用户管理界面
5. **Phase C (SMS)** → 完善后端 API + 实现前端营销管理界面
6. **Phase E (Dashboard)** → 新建后端 API + 实现前端统计面板
7. **Phase G (测试优化)** → 按需进行测试和性能优化

---

## Notes

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保可追溯性
- Checkpoint 任务确保增量验证
- 所有前端页面使用 React + TypeScript + shadcn/ui + Tailwind CSS
- 所有表单使用 React Hook Form + Zod 验证
- 所有数据请求使用 SWR 缓存管理
