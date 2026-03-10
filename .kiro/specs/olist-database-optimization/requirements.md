# 需求文档

## 简介

本功能旨在将商城管理系统的数据库从当前约 29 张表扩展到约 60 张表规模，使系统从 Demo 级别升级到接近 SaaS 产品级别。扩展涵盖 CRM 客户管理、BI 分析、搜索系统、推荐系统增强、评论系统、物流系统增强、库存系统增强、审计日志系统和菜单/导航系统等模块。所有新增表均以 PostgreSQL 迁移脚本形式交付，与现有表结构保持一致的设计风格（UUID 主键、时间戳字段、外键约束、索引优化）。

## 术语表

- **Mall_Database**: 商城管理系统的 PostgreSQL 数据库，当前包含 UMS、PMS、OMS、SMS 等模块共约 29 张表
- **Migration_Script**: 数据库迁移 SQL 脚本，存放于 backend/src/database/migrations/ 目录
- **CRM_Module**: 客户关系管理模块，负责客户画像、分群、标签和生命周期价值分析
- **BI_Module**: 商业智能分析模块，负责存储和计算 GMV、复购率、转化率等核心指标
- **Search_Module**: 搜索系统模块，负责记录搜索行为和关键词分析
- **Recommendation_Module**: 推荐系统增强模块，负责用户行为追踪和协同过滤推荐
- **Review_Module**: 评论系统模块，负责商品评论、图片、投票和评分聚合
- **Logistics_Module**: 物流系统增强模块，负责发货单、承运商和物流时效管理
- **Warehouse_Module**: 库存系统增强模块，负责多仓库管理和库存流水记录
- **Audit_Module**: 审计日志系统模块，负责记录系统操作审计信息
- **Menu_Module**: 菜单/导航系统模块，负责后台菜单的层级管理
- **RFM_Analysis**: 基于最近消费时间（Recency）、消费频率（Frequency）、消费金额（Monetary）的客户价值分析模型
- **Dashboard_Snapshot**: BI 仪表盘的定期快照数据，用于历史趋势对比

## 需求

### 需求 1: CRM 客户管理系统表结构

**用户故事:** 作为运营人员，我希望系统具备客户画像和分群能力，以便进行精细化客户运营和 RFM 分析。

#### 验收标准

1. THE Migration_Script SHALL 创建 customer_profiles 表，包含 user_id（外键关联 users）、gender、birth_date、income_level、education、marital_status、registration_source、first_order_at、last_order_at、total_orders、total_spent 字段
2. THE Migration_Script SHALL 在 customer_profiles 表的 user_id 字段上创建唯一约束，确保每个用户只有一条客户画像记录
3. THE Migration_Script SHALL 创建 customer_segments 表，包含 name（唯一）、slug（唯一）、description、rules（JSONB 类型，存储分群规则）、customer_count、is_active 字段
4. THE Migration_Script SHALL 创建 customer_segment_members 表，包含 segment_id（外键关联 customer_segments）、user_id（外键关联 users）字段，并在 (segment_id, user_id) 上创建联合唯一约束
5. THE Migration_Script SHALL 创建 customer_tags 表，包含 name（唯一）、color、description 字段
6. THE Migration_Script SHALL 创建 customer_tag_assignments 表，包含 tag_id（外键关联 customer_tags）、user_id（外键关联 users）字段，并在 (tag_id, user_id) 上创建联合唯一约束
7. THE Migration_Script SHALL 创建 customer_lifetime_values 表，包含 user_id（外键关联 users，唯一）、rfm_recency_score、rfm_frequency_score、rfm_monetary_score、rfm_segment、ltv_predicted、ltv_actual、churn_probability、last_calculated_at 字段
8. THE Migration_Script SHALL 为所有 CRM 表创建 created_at 和 updated_at 时间戳字段，并配置 updated_at 自动更新触发器

### 需求 2: BI 分析系统表结构

**用户故事:** 作为管理员，我希望系统能存储和展示 GMV、复购率、转化率等核心业务指标的历史数据，以便进行趋势分析和决策支持。

#### 验收标准

1. THE Migration_Script SHALL 创建 dashboard_snapshots 表，包含 snapshot_date（DATE 类型）、period_type（枚举：daily、weekly、monthly）、gmv、order_count、avg_order_value、new_user_count、active_user_count、repurchase_rate、conversion_rate、refund_rate 字段
2. THE Migration_Script SHALL 在 dashboard_snapshots 表的 (snapshot_date, period_type) 上创建联合唯一约束，防止同一日期同一周期类型的重复快照
3. THE Migration_Script SHALL 创建 traffic_funnels 表，包含 snapshot_date、period_type、stage（枚举：visit、search、product_view、add_to_cart、checkout、payment、completed）、user_count、conversion_rate_to_next 字段
4. THE Migration_Script SHALL 在 traffic_funnels 表的 (snapshot_date, period_type, stage) 上创建联合唯一约束
5. THE Migration_Script SHALL 创建 user_retention_reports 表，包含 cohort_date（DATE 类型，用户注册日期所在周期）、period_type、period_offset（INTEGER，表示第 N 个周期）、cohort_size、retained_count、retention_rate 字段
6. THE Migration_Script SHALL 在 user_retention_reports 表的 (cohort_date, period_type, period_offset) 上创建联合唯一约束
7. THE Migration_Script SHALL 创建 category_sales_stats 表，包含 category_id（外键关联 categories）、snapshot_date、period_type、sales_amount、order_count、product_count、avg_price 字段
8. THE Migration_Script SHALL 在 category_sales_stats 表的 (category_id, snapshot_date, period_type) 上创建联合唯一约束
9. THE Migration_Script SHALL 为所有 BI 表的 snapshot_date 字段创建索引，以优化按日期范围查询的性能

### 需求 3: 搜索系统表结构

**用户故事:** 作为运营人员，我希望系统能记录用户搜索行为和关键词数据，以便分析搜索转化率和优化搜索体验。

#### 验收标准

1. THE Migration_Script SHALL 创建 search_logs 表，包含 user_id（可为空，外键关联 users）、keyword、result_count、clicked_product_id（可为空，外键关联 products）、session_id、ip_address、user_agent、searched_at 字段
2. THE Migration_Script SHALL 在 search_logs 表的 keyword 字段上创建索引，以优化关键词查询性能
3. THE Migration_Script SHALL 在 search_logs 表的 searched_at 字段上创建索引，以优化按时间范围查询的性能
4. THE Migration_Script SHALL 创建 search_keywords 表，包含 keyword（唯一）、search_count、click_count、conversion_count、avg_result_count、last_searched_at 字段，用于聚合关键词统计
5. THE Migration_Script SHALL 在 search_keywords 表的 search_count 字段上创建降序索引，以优化热门关键词排序查询
6. THE Migration_Script SHALL 创建 search_synonyms 表，包含 keyword、synonym、is_active 字段，用于搜索同义词管理
7. THE Migration_Script SHALL 在 search_synonyms 表的 (keyword, synonym) 上创建联合唯一约束

### 需求 4: 推荐系统增强表结构

**用户故事:** 作为运营人员，我希望系统能追踪用户行为数据并支持协同过滤推荐，以便提升商品推荐的精准度和转化率。

#### 验收标准

1. THE Migration_Script SHALL 创建 user_behaviors 表，包含 user_id（外键关联 users）、product_id（外键关联 products）、behavior_type（枚举：view、click、add_to_cart、purchase、favorite、share）、session_id、referrer_url、duration_seconds、occurred_at 字段
2. THE Migration_Script SHALL 在 user_behaviors 表的 (user_id, behavior_type) 上创建复合索引，以优化按用户和行为类型查询的性能
3. THE Migration_Script SHALL 在 user_behaviors 表的 occurred_at 字段上创建索引，以支持按时间范围的行为分析查询
4. THE Migration_Script SHALL 创建 click_logs 表，包含 user_id（可为空，外键关联 users）、product_id（外键关联 products）、source_page、source_module、position、session_id、ip_address、clicked_at 字段
5. THE Migration_Script SHALL 在 click_logs 表的 (product_id, clicked_at) 上创建复合索引，以优化商品点击趋势分析
6. THE Migration_Script SHALL 创建 product_similarities 表，包含 product_id（外键关联 products）、similar_product_id（外键关联 products）、similarity_score（DECIMAL 类型，范围 0-1）、algorithm（VARCHAR，记录计算算法名称）、calculated_at 字段
7. THE Migration_Script SHALL 在 product_similarities 表的 (product_id, similar_product_id) 上创建联合唯一约束，防止重复的相似度记录
8. THE Migration_Script SHALL 在 product_similarities 表上添加 CHECK 约束，确保 product_id 不等于 similar_product_id
9. THE Migration_Script SHALL 创建 user_preferences 表，包含 user_id（外键关联 users，唯一）、preferred_categories（UUID 数组类型）、preferred_brands（UUID 数组类型）、price_range_min、price_range_max、updated_at 字段

### 需求 5: 评论系统表结构

**用户故事:** 作为管理员，我希望系统具备完整的评论管理能力，包括评论内容、图片、投票、评分聚合和审计日志，以便管理商品评价和维护社区质量。

#### 验收标准

1. THE Migration_Script SHALL 创建 reviews 表，包含 product_id（外键关联 products）、user_id（外键关联 users）、order_id（可为空，外键关联 orders）、rating（INTEGER，CHECK 约束 1-5）、title、content（TEXT）、status（枚举：pending、approved、rejected、hidden）、is_verified_purchase（BOOLEAN）、is_deleted（BOOLEAN，默认 false）字段
2. THE Migration_Script SHALL 在 reviews 表的 (user_id, product_id) 上创建联合唯一约束（部分索引，仅 is_deleted = false 的记录），确保每个用户对同一商品只有一条有效评论
3. THE Migration_Script SHALL 创建 review_images 表，包含 review_id（外键关联 reviews）、image_url、thumbnail_url、original_filename、file_size、mime_type、display_order 字段
4. THE Migration_Script SHALL 创建 review_votes 表，包含 review_id（外键关联 reviews）、user_id（外键关联 users）、vote_type（枚举：useful、not_useful）字段，并在 (user_id, review_id) 上创建联合唯一约束
5. THE Migration_Script SHALL 创建 product_ratings 表，包含 product_id（外键关联 products，唯一）、average_rating、total_reviews、rating_1_count 到 rating_5_count 字段，用于评分聚合缓存
6. THE Migration_Script SHALL 创建 review_audit_logs 表，包含 review_id（外键关联 reviews）、user_id（外键关联 users）、action（枚举：create、update、delete、approve、reject、vote）、old_data（JSONB）、new_data（JSONB）、ip_address 字段
7. THE Migration_Script SHALL 为 reviews 表的 (product_id, status) 创建复合索引，以优化按商品查询已审核评论的性能

### 需求 6: 物流系统增强表结构

**用户故事:** 作为运营人员，我希望系统能管理发货单、承运商信息和物流时效数据，以便优化物流配送效率和成本控制。

#### 验收标准

1. THE Migration_Script SHALL 创建 carriers 表，包含 name（唯一）、code（唯一）、logo_url、tracking_url_template、contact_phone、contact_email、is_active、priority 字段
2. THE Migration_Script SHALL 创建 shipments 表，包含 order_id（外键关联 orders）、carrier_id（外键关联 carriers）、shipment_number（唯一）、status（枚举：pending、picked_up、in_transit、out_for_delivery、delivered、failed、returned）、weight、shipping_cost、estimated_delivery_at、actual_delivery_at、shipped_at 字段
3. THE Migration_Script SHALL 创建 shipment_items 表，包含 shipment_id（外键关联 shipments）、order_item_id（外键关联 order_items）、quantity 字段，并在 (shipment_id, order_item_id) 上创建联合唯一约束
4. THE Migration_Script SHALL 创建 shipping_rate_rules 表，包含 carrier_id（外键关联 carriers）、region、min_weight、max_weight、base_cost、per_kg_cost、estimated_days、is_active 字段，用于运费计算规则
5. THE Migration_Script SHALL 为 shipments 表的 (order_id, status) 创建复合索引，以优化按订单查询发货状态的性能
6. THE Migration_Script SHALL 为 shipments 表的 shipped_at 和 actual_delivery_at 字段创建索引，以支持物流时效分析查询

### 需求 7: 库存系统增强表结构

**用户故事:** 作为仓库管理员，我希望系统支持多仓库管理和库存流水记录，以便精确追踪每个仓库的库存变动和实现智能调拨。

#### 验收标准

1. THE Migration_Script SHALL 创建 warehouses 表，包含 name（唯一）、code（唯一）、address、city、state、postal_code、country、contact_name、contact_phone、is_active、priority 字段
2. THE Migration_Script SHALL 创建 warehouse_inventory 表，包含 warehouse_id（外键关联 warehouses）、product_id（外键关联 products）、quantity、reserved_quantity、low_stock_threshold 字段，并在 (warehouse_id, product_id) 上创建联合唯一约束
3. THE Migration_Script SHALL 在 warehouse_inventory 表上添加 CHECK 约束，确保 quantity >= 0 且 reserved_quantity >= 0
4. THE Migration_Script SHALL 创建 inventory_logs 表，包含 product_id（外键关联 products）、warehouse_id（可为空，外键关联 warehouses）、type（枚举：inbound、outbound、adjustment、transfer、reservation、release）、quantity_change（INTEGER，可为负数）、quantity_before、quantity_after、reference_type（VARCHAR，如 order、return、manual）、reference_id、operator_id（外键关联 users）、remark 字段
5. THE Migration_Script SHALL 在 inventory_logs 表的 (product_id, created_at) 上创建复合索引，以优化按商品查询库存流水的性能
6. THE Migration_Script SHALL 在 inventory_logs 表的 (warehouse_id, created_at) 上创建复合索引，以优化按仓库查询库存流水的性能
7. THE Migration_Script SHALL 在 inventory_logs 表上添加 CHECK 约束，确保 quantity_after >= 0

### 需求 8: 审计日志系统表结构

**用户故事:** 作为系统管理员，我希望系统能记录所有关键操作的审计日志，以便进行安全审计和问题追溯。

#### 验收标准

1. THE Migration_Script SHALL 创建 audit_logs 表，包含 user_id（可为空，外键关联 users）、action（VARCHAR，如 create、update、delete、login、logout）、resource（VARCHAR，如 product、order、user）、resource_id、details（JSONB，存储操作详情）、ip_address、user_agent、request_id 字段
2. THE Migration_Script SHALL 在 audit_logs 表的 (resource, resource_id) 上创建复合索引，以优化按资源查询审计记录的性能
3. THE Migration_Script SHALL 在 audit_logs 表的 (user_id, created_at) 上创建复合索引，以优化按用户查询操作历史的性能
4. THE Migration_Script SHALL 在 audit_logs 表的 created_at 字段上创建索引，以支持按时间范围查询
5. THE Migration_Script SHALL 在 audit_logs 表的 action 字段上创建索引，以支持按操作类型筛选

### 需求 9: 菜单/导航系统表结构

**用户故事:** 作为系统管理员，我希望系统能灵活管理后台菜单的层级结构和权限关联，以便根据角色动态展示导航菜单。

#### 验收标准

1. THE Migration_Script SHALL 创建 menus 表，包含 name、path、icon、parent_id（自引用外键关联 menus）、sort_order、permission_key（VARCHAR，关联权限标识）、is_active（BOOLEAN，默认 true）、menu_type（枚举：directory、menu、button）字段
2. THE Migration_Script SHALL 在 menus 表的 parent_id 字段上创建索引，以优化层级查询性能
3. THE Migration_Script SHALL 在 menus 表的 (parent_id, sort_order) 上创建复合索引，以优化同级菜单排序查询
4. THE Migration_Script SHALL 在 menus 表的 permission_key 字段上创建索引，以支持按权限标识查询菜单

### 需求 10: 迁移脚本规范与一致性

**用户故事:** 作为开发者，我希望所有新增迁移脚本遵循现有项目的设计规范，以便保持数据库架构的一致性和可维护性。

#### 验收标准

1. THE Migration_Script SHALL 使用 UUID 作为所有新表的主键类型，默认值为 gen_random_uuid()
2. THE Migration_Script SHALL 为所有新表添加 created_at（TIMESTAMP WITH TIME ZONE，默认 CURRENT_TIMESTAMP）字段
3. WHEN 新表包含可修改数据时，THE Migration_Script SHALL 添加 updated_at 字段并配置 update_updated_at_column() 触发器
4. THE Migration_Script SHALL 使用 IF NOT EXISTS 子句创建所有表和索引，确保迁移脚本可重复执行
5. THE Migration_Script SHALL 为所有外键字段创建索引，以优化 JOIN 查询性能
6. THE Migration_Script SHALL 为所有新表和关键字段添加 COMMENT 注释，说明表和字段的用途
7. THE Migration_Script SHALL 按模块分为独立的迁移文件，文件命名遵循 {序号}_{描述}.sql 格式（如 007_create_crm_tables.sql）
8. THE Migration_Script SHALL 在每个迁移文件中按依赖顺序创建表，确保被引用的表先于引用表创建

### 需求 11: 数据集兼容性设计

**用户故事:** 作为开发者，我希望新增表结构能兼容 Kaggle 公开数据集的导入需求，以便后续通过 ETL 工具填充真实数据。

#### 验收标准

1. THE Migration_Script SHALL 确保 customer_profiles 表的字段设计兼容 Kaggle Customer Personality Analysis 数据集的字段映射（income_level、education、marital_status 等）
2. THE Migration_Script SHALL 确保 user_behaviors 和 click_logs 表的字段设计兼容 RetailRocket 数据集的事件类型（view、addtocart、transaction）
3. THE Migration_Script SHALL 确保 reviews 表的字段设计兼容 Amazon Reviews 数据集的字段映射（rating、review text）
4. THE Migration_Script SHALL 确保 product_similarities 表支持存储基于 Instacart 数据集计算的商品协同过滤结果
5. WHEN 设计字段类型时，THE Migration_Script SHALL 使用足够宽泛的类型（如 TEXT 而非固定长度 VARCHAR）来容纳不同数据集的数据格式差异

### 需求 12: 表数量与模块完整性验证

**用户故事:** 作为项目负责人，我希望扩展后的数据库达到约 60 张表的规模，覆盖所有规划的业务模块。

#### 验收标准

1. WHEN 所有迁移脚本执行完成后，THE Mall_Database SHALL 包含不少于 58 张业务表（含现有 29 张和新增约 31 张）
2. THE Mall_Database SHALL 包含以下模块的表：UMS 用户管理（5 张）、PMS 商品管理（8 张）、OMS 订单管理（7 张）、SMS 营销系统（7 张）、CRM 客户管理（6 张）、BI 分析系统（4 张）、搜索系统（3 张）、推荐系统增强（4 张）、评论系统（5 张）、物流系统增强（4 张）、库存系统增强（3 张）、审计日志（1 张）、菜单系统（1 张）、其他（2 张：outbox_events、stock_reservations）
3. THE Migration_Script SHALL 确保所有新增表与现有表之间的外键关系正确无误，不存在悬挂引用
