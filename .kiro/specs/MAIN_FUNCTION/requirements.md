# Mall Admin Frontend Integration - Requirements Document

## 介绍

本需求文档定义了 Mall Admin System 前端集成项目的完整功能需求和非功能需求。该项目旨在将完整的电商管理功能集成到新的 React 前端（frontend2），实现一个统一、高效、安全的电商管理平台。

## 术语表

- **System**: Mall Admin System，电商管理系统
- **API_Client**: 前端 API 客户端，负责与后端通信
- **Auth_Service**: 认证服务，处理用户登录、登出和 Token 管理
- **Cache_Service**: 缓存服务，管理 Redis 缓存
- **Database**: PostgreSQL 数据库
- **Redis**: 内存数据库，用于缓存和会话管理
- **JWT**: JSON Web Token，用于身份认证
- **RBAC**: 基于角色的访问控制
- **Idempotency_Key**: 幂等性密钥，防止重复操作
- **Flash_Sale**: 秒杀活动
- **Stock_Reservation**: 库存预留

## 需求

### 需求 1: API 响应格式标准化

**用户故事**: 作为前端开发者，我需要统一的 API 响应格式，以便简化数据处理和错误处理逻辑。

#### 验收标准

1. WHEN API 请求成功 THEN THE System SHALL 返回包含 success、data 和 meta 字段的响应对象
2. WHEN API 请求失败 THEN THE System SHALL 返回包含 success、error 和 meta 字段的响应对象
3. WHEN API 返回分页数据 THEN THE System SHALL 在 data 中包含 items 和 pagination 字段
4. THE System SHALL 在所有响应的 meta 字段中包含 timestamp、requestId 和 version 信息
5. WHEN 响应包含错误信息 THEN THE System SHALL 使用标准错误码（ERR_XXXX 格式）

### 需求 2: 标准错误码体系

**用户故事**: 作为开发者，我需要标准化的错误码体系，以便准确识别和处理不同类型的错误。

#### 验收标准

1. THE System SHALL 为通用错误使用 1000-1999 范围的错误码
2. THE System SHALL 为产品相关错误使用 2000-2999 范围的错误码
3. THE System SHALL 为订单相关错误使用 3000-3999 范围的错误码
4. THE System SHALL 为用户相关错误使用 4000-4999 范围的错误码
5. THE System SHALL 为营销相关错误使用 5000-5999 范围的错误码
6. WHEN 返回错误响应 THEN THE System SHALL 包含错误码、用户友好的错误消息和可选的详细信息

### 需求 3: JWT 双 Token 认证

**用户故事**: 作为系统管理员，我需要安全的认证机制，以保护系统免受未授权访问。

#### 验收标准

1. WHEN 用户登录成功 THEN THE Auth_Service SHALL 生成 Access Token（有效期 15 分钟）和 Refresh Token（有效期 7 天）
2. THE Auth_Service SHALL 在 Access Token 中包含 userId、username、roles 和 permissions 信息
3. THE Auth_Service SHALL 将 Refresh Token 存储在 httpOnly cookie 中
4. WHEN Access Token 过期 THEN THE API_Client SHALL 自动使用 Refresh Token 获取新的 Access Token
5. WHEN Refresh Token 过期或无效 THEN THE System SHALL 要求用户重新登录
6. WHEN 用户登出 THEN THE Auth_Service SHALL 将 Refresh Token 加入黑名单
7. THE Auth_Service SHALL 在 Redis 中存储用户会话信息，TTL 为 7 天

### 需求 4: RBAC 权限控制

**用户故事**: 作为系统管理员，我需要基于角色的权限控制，以管理不同用户的访问权限。

#### 验收标准

1. THE System SHALL 实现用户-角色-权限三层模型
2. WHEN 用户请求受保护资源 THEN THE System SHALL 验证用户是否具有相应的权限
3. THE System SHALL 支持资源级和操作级权限控制（如 products:read、products:write、products:delete）
4. WHEN 用户权限不足 THEN THE System SHALL 返回 403 错误和错误码 ERR_1015
5. THE System SHALL 在前端根据用户权限动态过滤菜单和按钮
6. THE System SHALL 将用户权限缓存在 Redis 中，TTL 为 1 小时

### 需求 5: 幂等性实现

**用户故事**: 作为开发者，我需要幂等性机制，以防止重复提交导致的数据不一致。

#### 验收标准

1. WHEN 客户端发起需要幂等性的请求 THEN THE API_Client SHALL 生成唯一的 Idempotency-Key 并附加到请求头
2. WHEN 服务器收到带有 Idempotency-Key 的请求 THEN THE System SHALL 检查 Redis 缓存中是否存在该 Key
3. IF Idempotency-Key 已存在 THEN THE System SHALL 返回缓存的响应
4. IF Idempotency-Key 不存在 THEN THE System SHALL 处理请求并缓存响应（TTL 24 小时）
5. THE System SHALL 对订单创建、支付等关键操作应用幂等性机制

### 需求 6: 多层缓存策略

**用户故事**: 作为系统架构师，我需要多层缓存策略，以提高系统性能和响应速度。

#### 验收标准

1. THE System SHALL 实现浏览器缓存层（LocalStorage、SessionStorage、Memory Cache）
2. THE System SHALL 实现 CDN 缓存层用于静态资源（Cache-Control: public, max-age=31536000）
3. THE System SHALL 实现 Redis 缓存层用于热点数据、Session 数据和分布式锁
4. THE System SHALL 为不同类型的数据设置不同的 TTL（SHORT: 60s, MEDIUM: 300s, LONG: 3600s, VERY_LONG: 86400s）
5. WHEN 数据更新 THEN THE Cache_Service SHALL 失效相关缓存
6. THE System SHALL 使用 SWR 在前端实现客户端缓存，支持自动重新验证

### 需求 7: 库存预留与扣减

**用户故事**: 作为订单管理员，我需要可靠的库存管理机制，以防止超卖和库存不一致。

#### 验收标准

1. WHEN 用户创建订单 THEN THE System SHALL 使用 Redis 分布式锁预留库存
2. THE System SHALL 记录库存预留信息，包含 productId、quantity、status 和 expiresAt（15 分钟）
3. WHEN 订单支付成功 THEN THE System SHALL 确认库存扣减，将预留状态更新为 confirmed
4. WHEN 订单取消或超时 THEN THE System SHALL 释放预留库存，恢复产品库存数量
5. THE System SHALL 运行定时任务清理过期的库存预留（每分钟执行一次）
6. WHEN 库存不足 THEN THE System SHALL 返回错误码 ERR_2003 并回滚已预留的库存

### 需求 8: 秒杀场景优化

**用户故事**: 作为营销管理员，我需要高性能的秒杀功能，以支持大量并发用户抢购。

#### 验收标准

1. WHEN 秒杀活动开始前 THEN THE System SHALL 将秒杀商品库存预热到 Redis
2. WHEN 用户参与秒杀 THEN THE System SHALL 使用 Lua 脚本原子性扣减 Redis 库存
3. THE System SHALL 检查用户是否已参与该秒杀活动，防止重复购买
4. WHEN Redis 库存扣减成功 THEN THE System SHALL 异步创建订单（使用消息队列）
5. WHEN 订单创建失败 THEN THE System SHALL 恢复 Redis 库存并通知用户
6. THE System SHALL 记录用户购买标记，TTL 为 24 小时

### 需求 9: 产品管理

**用户故事**: 作为产品管理员，我需要完整的产品管理功能，以维护电商产品目录。

#### 验收标准

1. THE System SHALL 支持产品的创建、编辑、删除和查看操作
2. WHEN 创建产品 THEN THE System SHALL 验证产品名称不为空、价格大于 0、库存为非负整数
3. THE System SHALL 支持产品分类、品牌、图片（最多 10 张）和属性管理
4. THE System SHALL 支持产品列表的分页、搜索、筛选和排序
5. THE System SHALL 支持批量操作（批量上架、下架、删除）
6. WHEN 产品 SKU 重复 THEN THE System SHALL 返回错误码 ERR_2006
7. THE System SHALL 缓存产品列表（TTL 5 分钟）和产品详情（TTL 5 分钟）

### 需求 10: 订单管理

**用户故事**: 作为订单管理员，我需要完整的订单管理功能，以处理客户订单和物流。

#### 验收标准

1. THE System SHALL 支持订单的创建、查看、更新状态和取消操作
2. WHEN 创建订单 THEN THE System SHALL 预留库存、计算订单金额并生成唯一订单号
3. THE System SHALL 支持订单状态流转（pending → confirmed → paid → processing → shipped → delivered）
4. THE System SHALL 支持添加物流跟踪号和查询物流信息
5. THE System SHALL 支持订单列表的高级筛选（按状态、日期范围、客户等）
6. THE System SHALL 支持退货申请的创建和处理
7. WHEN 订单金额计算错误 THEN THE System SHALL 返回错误码 ERR_3005

### 需求 11: 营销管理

**用户故事**: 作为营销管理员，我需要营销工具，以促进销售和提高用户参与度。

#### 验收标准

1. THE System SHALL 支持秒杀活动的创建、配置和管理
2. THE System SHALL 支持优惠券的创建、配置和使用统计
3. THE System SHALL 支持推荐位的配置和排序
4. THE System SHALL 支持广告的创建、位置配置和点击统计
5. WHEN 秒杀活动未开始或已结束 THEN THE System SHALL 返回相应错误码（ERR_5002 或 ERR_5003）
6. WHEN 优惠券使用条件不满足 THEN THE System SHALL 返回错误码 ERR_5008

### 需求 12: 用户管理

**用户故事**: 作为系统管理员，我需要用户管理功能，以管理系统用户和权限。

#### 验收标准

1. THE System SHALL 支持用户的创建、编辑、删除和查看操作
2. THE System SHALL 支持用户角色的分配和管理
3. THE System SHALL 支持角色权限的配置
4. THE System SHALL 验证用户名格式、邮箱格式和密码强度
5. WHEN 用户名或邮箱已存在 THEN THE System SHALL 返回错误码 ERR_4003
6. THE System SHALL 记录用户最后登录时间和 IP 地址

### 需求 13: 仪表板统计

**用户故事**: 作为管理员，我需要查看业务统计数据，以监控运营状况和做出决策。

#### 验收标准

1. THE System SHALL 显示关键指标（总销售额、订单数、用户数）
2. THE System SHALL 显示销售趋势图表（按日、周、月）
3. THE System SHALL 显示订单状态分布饼图
4. THE System SHALL 显示热销商品排行榜（Top 10）
5. THE System SHALL 缓存仪表板数据（TTL 5 分钟）

### 需求 14: 评论管理

**用户故事**: 作为内容管理员，我需要管理用户评论，以维护内容质量和用户体验。

#### 验收标准

1. THE System SHALL 支持评论的查看、审核、回复和删除操作
2. THE System SHALL 支持评论列表的筛选（按产品、状态、评分）
3. WHEN 评论状态更新 THEN THE System SHALL 记录操作日志
4. THE System SHALL 显示产品的平均评分和评论数量
5. THE System SHALL 支持用户对评论的投票（有帮助/无帮助）

### 需求 15: 输入验证

**用户故事**: 作为开发者，我需要严格的输入验证，以防止无效数据和安全漏洞。

#### 验收标准

1. THE System SHALL 在前端使用 React Hook Form + Zod 进行表单验证
2. THE System SHALL 在后端使用 Zod 进行请求参数验证
3. WHEN 输入验证失败 THEN THE System SHALL 返回错误码 ERR_1001 和详细的验证错误信息
4. THE System SHALL 验证所有 UUID 格式的 ID
5. THE System SHALL 验证所有 URL 格式的图片地址
6. THE System SHALL 限制字符串长度、数字范围和数组大小

### 需求 16: CSRF 防护

**用户故事**: 作为安全工程师，我需要 CSRF 防护，以防止跨站请求伪造攻击。

#### 验收标准

1. THE System SHALL 为每个会话生成唯一的 CSRF Token
2. THE System SHALL 将 CSRF Token 存储在 httpOnly cookie 中
3. WHEN 客户端发起状态变更请求（POST、PUT、DELETE、PATCH）THEN THE API_Client SHALL 在请求头中附加 CSRF Token
4. WHEN CSRF Token 无效或缺失 THEN THE System SHALL 返回 403 错误
5. THE System SHALL 设置 cookie 的 sameSite 属性为 strict

### 需求 17: 性能要求

**用户故事**: 作为用户，我需要快速响应的系统，以提高工作效率。

#### 验收标准

1. THE System SHALL 确保页面加载时间小于 2 秒
2. THE System SHALL 确保 API 响应时间小于 500 毫秒（P95）
3. THE System SHALL 使用代码分割和懒加载优化前端性能
4. THE System SHALL 使用虚拟滚动处理大列表（超过 100 项）
5. THE System SHALL 使用图片懒加载和 CDN 优化图片加载
6. THE System SHALL 支持 1000 并发用户

### 需求 18: 监控和日志

**用户故事**: 作为运维工程师，我需要完善的监控和日志系统，以快速发现和解决问题。

#### 验收标准

1. THE System SHALL 使用 Prometheus 收集 HTTP 请求、数据库连接池、Redis 操作等指标
2. THE System SHALL 使用 Winston 记录结构化日志，按天轮转，保留 14 天
3. THE System SHALL 使用 Sentry 监控前端错误
4. THE System SHALL 使用 Jaeger 进行分布式追踪
5. THE System SHALL 记录所有 HTTP 请求的方法、URL、状态码、响应时间和用户 ID
6. WHEN 发生错误 THEN THE System SHALL 记录错误堆栈和上下文信息
7. THE System SHALL 暴露 /metrics 端点供 Prometheus 抓取

### 需求 19: Design Tokens 系统

**用户故事**: 作为前端开发者，我需要统一的设计系统，以保持 UI 一致性和可维护性。

#### 验收标准

1. THE System SHALL 定义标准的颜色系统（primary、secondary、success、warning、error、neutral）
2. THE System SHALL 定义标准的字体系统（fontFamily、fontSize、fontWeight、lineHeight）
3. THE System SHALL 定义标准的间距系统（0-20 的间距刻度）
4. THE System SHALL 定义标准的圆角系统（none、sm、base、md、lg、xl、2xl、full）
5. THE System SHALL 定义标准的阴影系统（sm、base、md、lg、xl）
6. THE System SHALL 定义标准的过渡动画系统（fast、base、slow）
7. THE System SHALL 定义标准的 z-index 系统（dropdown、sticky、fixed、modal、popover、tooltip）
8. THE System SHALL 将 Design Tokens 集成到 Tailwind CSS 配置中

### 需求 20: 通用组件库

**用户故事**: 作为前端开发者，我需要可复用的通用组件，以提高开发效率和保持 UI 一致性。

#### 验收标准

1. THE System SHALL 提供 DataTable 组件，支持分页、排序、行点击和自定义渲染
2. THE System SHALL 提供 SearchBar 组件，支持搜索和多种筛选器（select、date、dateRange）
3. THE System SHALL 提供 ImageUpload 组件，支持多图上传、预览、删除和大小限制
4. THE System SHALL 提供 StatusBadge 组件，支持不同状态的颜色和文本映射
5. THE System SHALL 提供 Pagination 组件，显示总数、当前页、总页数和翻页按钮
6. THE System SHALL 提供 LoadingSpinner 组件，用于加载状态展示
7. THE System SHALL 提供 Modal 组件，支持标题、内容、确认和取消按钮

## 非功能需求

### 安全性

1. THE System SHALL 使用 HTTPS 加密所有通信
2. THE System SHALL 对所有密码进行哈希存储（bcrypt）
3. THE System SHALL 实施速率限制，防止暴力破解（每 IP 每分钟最多 100 次请求）
4. THE System SHALL 防止 SQL 注入、XSS 和 CSRF 攻击
5. THE System SHALL 定期更新依赖包，修复安全漏洞

### 可用性

1. THE System SHALL 提供响应式设计，支持桌面和平板设备
2. THE System SHALL 提供友好的错误提示和操作反馈
3. THE System SHALL 支持键盘导航和无障碍访问（WCAG 2.1 AA 级）
4. THE System SHALL 提供在线帮助文档和操作指南

### 可维护性

1. THE System SHALL 使用 TypeScript 确保类型安全
2. THE System SHALL 遵循 ESLint 和 Prettier 代码规范
3. THE System SHALL 编写单元测试，覆盖率达到 80%
4. THE System SHALL 编写 API 文档和组件文档
5. THE System SHALL 使用 Git 进行版本控制，遵循 Git Flow 工作流

### 可扩展性

1. THE System SHALL 支持水平扩展（多实例部署）
2. THE System SHALL 使用 Redis 实现分布式会话和缓存
3. THE System SHALL 使用消息队列处理异步任务
4. THE System SHALL 支持数据库读写分离

### 兼容性

1. THE System SHALL 支持 Chrome、Firefox、Safari 和 Edge 最新两个版本
2. THE System SHALL 支持 Node.js 18+ 和 PostgreSQL 14+
3. THE System SHALL 支持 Redis 6+

## 验收标准总结

### 功能完整性
- 所有 20 个需求的验收标准均已满足
- 所有 API 端点已实现并通过测试
- 所有页面和组件已实现并可正常使用

### 代码质量
- TypeScript 类型覆盖率 100%
- ESLint 和 Prettier 检查通过
- 单元测试覆盖率 ≥ 80%
- 无严重的代码异味和技术债务

### 性能指标
- 页面加载时间 < 2 秒（P95）
- API 响应时间 < 500 毫秒（P95）
- 支持 1000 并发用户
- 无内存泄漏

### 安全性
- 所有安全扫描通过
- 无已知的高危和中危漏洞
- 通过渗透测试

### 用户体验
- 界面美观一致，符合 Design Tokens 规范
- 操作流畅，无明显卡顿
- 错误提示友好，帮助用户快速定位问题
- 通过可用性测试

## 项目里程碑

### Phase 1: 基础设施（已完成）
- JWT 双 Token 认证系统
- API 客户端和拦截器
- 路由配置和权限控制
- Design Tokens 和通用组件库

### Phase 2: 核心功能（进行中）
- 产品管理（PMS）
- 订单管理（OMS）
- 用户管理（UMS）

### Phase 3: 营销功能（待开始）
- 营销管理（SMS）
- 评论管理（RMS）
- 仪表板统计

### Phase 4: 优化完善（待开始）
- 性能优化（缓存、代码分割、虚拟滚动）
- 监控和日志系统
- 测试完善（单元测试、集成测试、E2E 测试）
- 文档编写

## 风险和依赖

### 技术风险
- 后端 API 可能需要调整以满足前端需求
- Redis 和 PostgreSQL 性能可能成为瓶颈
- 秒杀场景的高并发处理需要充分测试

### 依赖项
- 后端 API 必须稳定可用（当前完成度 70%）
- 数据库结构必须完整并支持所有业务需求
- Redis 必须正确配置并可用
- 设计规范必须明确并得到团队认可

## 参考资料

- [设计文档](./design.md)
- [任务清单](./tasks.md)
- [后端 API 文档](../../backend/README.md)
- [前端设计规范](../../frontend2/README.md)
