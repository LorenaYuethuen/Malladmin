# 项目重组计划

## 当前问题
- 根目录有旧的 src/ 和 dist/ 文件夹
- 文档分散在多个位置
- 前端项目需要清晰分类
- admin-web 已被 Malladmin 替代，需要删除

## 新的项目结构

```
ecommerce-admin-platform/
├── frontend/                    # 前端项目集合
│   ├── review-system/          # 评论系统前端（Ecommercereviewsystemdesign）
│   │   ├── src/
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── mall-admin/             # 商城管理系统前端（Malladmin - 统一管理后台）
│       ├── src/
│       ├── package.json
│       └── README.md
│
├── backend/                     # 后端 API 服务
│   ├── src/
│   │   ├── controllers/        # 控制器
│   │   ├── services/           # 业务逻辑
│   │   ├── middleware/         # 中间件
│   │   ├── routes/             # 路由
│   │   ├── types/              # TypeScript 类型
│   │   ├── utils/              # 工具函数
│   │   ├── validation/         # 数据验证
│   │   ├── database/           # 数据库连接和迁移
│   │   ├── app.ts              # Express 应用
│   │   └── server.ts           # 服务器入口
│   ├── uploads/                # 上传文件存储
│   ├── logs/                   # 日志文件
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── README.md
│
├── database/                    # 数据库脚本
│   ├── migrations/             # 数据库迁移脚本
│   │   ├── 001_create_users_tables.sql
│   │   ├── 002_create_outbox_events_table.sql
│   │   ├── 003_create_pms_tables.sql
│   │   ├── 003_optimize_pms_indexes.sql
│   │   └── 004_create_oms_tables.sql
│   ├── seeds/                  # 种子数据
│   ├── setup/                  # 初始化脚本
│   └── README.md
│
├── docs/                        # 项目文档
│   ├── api/                    # API 文档
│   │   ├── products.md
│   │   ├── orders.md
│   │   ├── users.md
│   │   └── postman_collection.json
│   ├── architecture/           # 架构文档
│   │   ├── system-design.md
│   │   ├── database-schema.md
│   │   └── security.md
│   ├── deployment/             # 部署文档
│   │   ├── DEPLOYMENT.md
│   │   └── docker-compose.yml
│   └── guides/                 # 使用指南
│       ├── QUICK_START.md
│       ├── DEVELOPMENT.md
│       └── TESTING.md
│
├── scripts/                     # 脚本工具
│   ├── setup.sh               # 初始化脚本
│   ├── deploy.sh              # 部署脚本
│   ├── backup.sh              # 备份脚本
│   └── health-check.sh        # 健康检查
│
├── .kiro/                       # Kiro 规范文档
│   └── specs/
│       └── mall-admin-integration/
│
├── docker-compose.yml           # Docker 编排
├── .env.example                 # 环境变量示例
├── .gitignore                   # Git 忽略文件
├── package.json                 # 根项目配置（monorepo）
└── README.md                    # 项目说明

```

## 迁移步骤

### 第一步：创建新的目录结构
1. 创建 `frontend/` 目录
2. 保留 `backend/` 目录（已经很好）
3. 保留 `database/` 目录（已经很好）
4. 整理 `docs/` 目录

### 第二步：重组前端项目
- 创建 `frontend/` 目录
- 将 `Ecommercereviewsystemdesign/` 移动到 `frontend/review-system/`
- 将 `Malladmin/` 移动到 `frontend/mall-admin/`
- 删除 `admin-web/`（已被 Malladmin 替代）
- 在 `frontend/` 下创建统一的 README 说明两个项目的关系

### 第三步：清理根目录
- 删除 `admin-web/`（不再需要）
- 删除 `src/`（旧代码）
- 删除 `dist/`（编译输出）
- 删除 `mock/`（不再需要）
- 删除 `unified-frontend/`（文档已过时）
- 删除根目录的 `node_modules/`（每个子项目有自己的）

### 第四步：整理文档
- 将 `backend/docs/` 移到 `docs/api/`
- 将各种 README 和指南整合到 `docs/guides/`
- 创建统一的项目文档结构

### 第五步：更新配置文件
- 更新 `docker-compose.yml`
- 更新 `.gitignore`
- 创建根目录的 `package.json`（用于 monorepo 管理）
- 更新所有路径引用

## 要删除的文件/文件夹

### 完全删除
- `admin-web/` - 已被 Malladmin 替代
- `mock/` - 模拟数据
- `src/` - 根目录旧代码
- `dist/` - 根目录编译输出
- `unified-frontend/` - 过时文档
- `node_modules/` - 根目录依赖（每个子项目有自己的）

### 移动重组
- `Ecommercereviewsystemdesign/` → `frontend/review-system/`
- `Malladmin/` → `frontend/mall-admin/`
- `backend/` → 保持不变（已经很好）
- `database/` → 保持不变（已经很好）
- `.kiro/` → 保持不变

## 预期效果

### 清晰的职责分离
- **frontend/review-system/** - 评论系统前端（用户端）
- **frontend/mall-admin/** - 商城管理系统前端（统一管理后台）
- **backend/** - 所有后端 API 代码
- **database/** - 所有数据库脚本
- **docs/** - 所有文档
- **scripts/** - 所有工具脚本

### 简化的开发流程
```bash
# 启动后端
cd backend
npm install
npm run dev

# 启动评论系统前端
cd frontend/review-system
npm install
npm run dev

# 启动商城管理前端（统一管理后台）
cd frontend/mall-admin
npm install
npm run dev

# 运行数据库迁移
cd database
./setup/init_database.sh
```

### 更好的可维护性
- 每个目录都有自己的 README
- 清晰的依赖关系
- 统一的文档位置
- 标准的项目结构

## 执行确认

是否开始执行此重组计划？
- [ ] 是，开始重组
- [ ] 否，需要调整计划
