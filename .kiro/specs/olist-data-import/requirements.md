# 需求文档

## 简介

本功能为商城管理系统提供一个独立的 ETL（Extract-Transform-Load）数据导入工具，用于将 Kaggle Olist 巴西电商数据集（约10万订单，2016-2018年）导入系统数据库作为种子/演示数据。该工具需要解析9个CSV文件，进行数据清洗、字段映射和格式转换，最终写入系统现有的 PostgreSQL 数据库表中。

## 术语表

- **ETL_Tool**: 数据导入工具，负责从CSV文件中提取（Extract）、转换（Transform）和加载（Load）Olist数据集到系统数据库
- **CSV_Parser**: CSV文件解析模块，负责读取和解析Olist数据集的CSV文件
- **Data_Transformer**: 数据转换模块，负责将Olist数据格式映射为系统数据库格式
- **Data_Loader**: 数据加载模块，负责将转换后的数据批量写入PostgreSQL数据库
- **ID_Mapper**: ID映射模块，负责维护Olist原始ID与系统UUID之间的映射关系
- **Olist_Dataset**: Kaggle Olist巴西电商数据集，包含9个CSV文件
- **Mall_Database**: 商城管理系统的PostgreSQL数据库，包含用户、商品、订单等表

## 需求

### 需求 1: CSV 文件解析

**用户故事:** 作为开发者，我希望能够解析Olist数据集的所有CSV文件，以便提取原始数据进行后续转换。

#### 验收标准

1. WHEN 指定数据目录路径时，THE CSV_Parser SHALL 扫描并识别全部9个Olist CSV文件（olist_orders_dataset.csv、olist_order_items_dataset.csv、olist_order_payments_dataset.csv、olist_order_reviews_dataset.csv、olist_products_dataset.csv、olist_customers_dataset.csv、olist_sellers_dataset.csv、olist_geolocation_dataset.csv、product_category_name_translation.csv）
2. WHEN 解析CSV文件时，THE CSV_Parser SHALL 正确处理包含逗号、引号和换行符的字段值
3. WHEN 解析CSV文件时，THE CSV_Parser SHALL 以流式方式读取文件，避免将整个文件加载到内存中
4. IF CSV文件不存在或格式损坏，THEN THE CSV_Parser SHALL 记录错误日志并跳过该文件，继续处理其余文件
5. IF CSV文件的表头列名与预期不匹配，THEN THE CSV_Parser SHALL 报告具体的列名差异并终止该文件的解析
6. THE CSV_Parser SHALL 将解析后的每行数据输出为类型安全的 TypeScript 对象

### 需求 2: 客户数据转换

**用户故事:** 作为开发者，我希望将Olist客户数据转换为系统用户数据，以便在系统中展示真实的客户信息。

#### 验收标准

1. WHEN 处理 olist_customers_dataset.csv 时，THE Data_Transformer SHALL 按 customer_unique_id 对客户进行去重，每个唯一客户只创建一条用户记录
2. WHEN 创建用户记录时，THE Data_Transformer SHALL 生成格式为 "customer_{customer_unique_id前8位}" 的用户名
3. WHEN 创建用户记录时，THE Data_Transformer SHALL 生成格式为 "customer_{customer_unique_id前8位}@olist.demo" 的邮箱地址
4. THE Data_Transformer SHALL 为所有导入的客户用户设置状态为 "active"
5. THE Data_Transformer SHALL 为所有导入的客户用户分配 "consumer" 角色
6. THE ID_Mapper SHALL 维护 customer_unique_id 到系统 user UUID 的映射表，供订单导入时引用
7. WHEN 客户记录中包含 customer_city 和 customer_state 时，THE Data_Transformer SHALL 保留地理位置信息用于订单地址生成

### 需求 3: 商品分类与品牌转换

**用户故事:** 作为开发者，我希望将Olist商品分类转换为系统分类和品牌数据，以便建立完整的商品目录结构。

#### 验收标准

1. WHEN 处理 product_category_name_translation.csv 时，THE Data_Transformer SHALL 使用英文分类名创建系统 categories 记录
2. THE Data_Transformer SHALL 为每个分类生成符合 URL 规范的 slug（小写、连字符分隔）
3. THE Data_Transformer SHALL 将所有Olist分类创建为顶级分类（level=0），因为Olist数据集不包含分类层级关系
4. WHEN 处理 olist_sellers_dataset.csv 时，THE Data_Transformer SHALL 将每个卖家映射为系统 brands 记录
5. WHEN 创建品牌记录时，THE Data_Transformer SHALL 生成格式为 "Seller_{seller_id前8位}" 的品牌名称和对应的 slug
6. THE ID_Mapper SHALL 维护 product_category_name 到系统 category UUID 的映射表
7. THE ID_Mapper SHALL 维护 seller_id 到系统 brand UUID 的映射表

### 需求 4: 商品数据转换

**用户故事:** 作为开发者，我希望将Olist商品数据转换为系统商品数据，以便在系统中展示丰富的商品信息。

#### 验收标准

1. WHEN 处理 olist_products_dataset.csv 时，THE Data_Transformer SHALL 为每个商品生成格式为 "{英文分类名}-{product_id前8位}" 的商品名称
2. THE Data_Transformer SHALL 为每个商品生成唯一的 SKU，格式为 "OLIST-{product_id前8位大写}"
3. THE Data_Transformer SHALL 为每个商品生成符合 URL 规范的 slug
4. WHEN 商品包含 product_weight_g 时，THE Data_Transformer SHALL 将重量从克转换为千克（除以1000）
5. WHEN 商品包含 product_length_cm、product_height_cm、product_width_cm 时，THE Data_Transformer SHALL 直接映射到系统的 length、height、width 字段（单位均为厘米）
6. THE Data_Transformer SHALL 通过 product_category_name_translation.csv 将葡萄牙语分类名翻译为英文后关联到系统 category_id
7. THE Data_Transformer SHALL 通过 olist_order_items_dataset.csv 中的 seller_id 关联商品到对应的系统 brand_id
8. THE Data_Transformer SHALL 将所有导入商品的状态设置为 "active"，可见性设置为 "public"
9. WHEN 商品在 olist_order_items_dataset.csv 中有价格记录时，THE Data_Transformer SHALL 使用该商品所有订单项的中位数价格作为系统商品价格
10. THE Data_Transformer SHALL 基于 olist_order_items_dataset.csv 中的销售记录计算每个商品的 sales_count

### 需求 5: 商品库存生成

**用户故事:** 作为开发者，我希望为导入的商品生成合理的库存数据，以便系统库存管理功能正常运作。

#### 验收标准

1. THE Data_Transformer SHALL 为每个导入的商品创建 product_inventory 记录
2. WHEN 生成库存数量时，THE Data_Transformer SHALL 基于商品的历史销售数量（sales_count）乘以系数2加上基础库存50来计算初始库存量
3. THE Data_Transformer SHALL 将所有导入商品的 reserved_quantity 设置为 0
4. THE Data_Transformer SHALL 将所有导入商品的 low_stock_threshold 设置为 10

### 需求 6: 订单数据转换

**用户故事:** 作为开发者，我希望将Olist订单数据转换为系统订单数据，以便在系统中展示真实的订单流程。

#### 验收标准

1. WHEN 处理 olist_orders_dataset.csv 时，THE Data_Transformer SHALL 为每个订单生成格式为 "ORD-{原始购买日期YYYYMMDD}-{order_id前6位}" 的订单编号
2. THE Data_Transformer SHALL 按以下规则映射订单状态：Olist "delivered" 映射为 "delivered"，"shipped" 映射为 "shipped"，"canceled" 映射为 "cancelled"，"created" 映射为 "pending"，"approved" 映射为 "confirmed"，"invoiced" 映射为 "paid"，"processing" 映射为 "processing"，"unavailable" 映射为 "cancelled"
3. WHEN 订单包含 order_approved_at 时间戳时，THE Data_Transformer SHALL 将该时间映射为系统的 paid_at 字段
4. WHEN 订单包含 order_delivered_customer_date 时间戳时，THE Data_Transformer SHALL 将该时间映射为系统的 delivered_at 字段
5. WHEN 订单包含 order_estimated_delivery_date 时间戳时，THE Data_Transformer SHALL 将该日期映射为系统的 estimated_delivery_date 字段
6. THE Data_Transformer SHALL 通过 ID_Mapper 将 Olist customer_id 关联到对应的系统 user_id
7. THE Data_Transformer SHALL 使用 order_purchase_timestamp 作为系统订单的 created_at 时间

### 需求 7: 订单项数据转换

**用户故事:** 作为开发者，我希望将Olist订单项数据转换为系统订单项数据，以便完整展示每个订单的商品明细。

#### 验收标准

1. WHEN 处理 olist_order_items_dataset.csv 时，THE Data_Transformer SHALL 将每条记录映射为系统 order_items 记录
2. THE Data_Transformer SHALL 通过 ID_Mapper 将 product_id 关联到系统商品，并填充 product_name、product_sku 快照字段
3. THE Data_Transformer SHALL 将 Olist 的 price 字段映射为系统的 price 字段
4. THE Data_Transformer SHALL 将 Olist 的 freight_value 映射为订单级别的 shipping_cost（同一订单的运费求和）
5. THE Data_Transformer SHALL 将每个订单项的 quantity 设置为 1（Olist数据集中每条记录代表一个商品项）
6. THE Data_Transformer SHALL 计算每个订单项的 subtotal 和 total（subtotal = price × quantity，total = subtotal）

### 需求 8: 支付数据转换

**用户故事:** 作为开发者，我希望将Olist支付数据转换为系统支付信息，以便在订单中展示支付详情。

#### 验收标准

1. WHEN 处理 olist_order_payments_dataset.csv 时，THE Data_Transformer SHALL 按以下规则映射支付方式：Olist "credit_card" 映射为 "credit_card"，"boleto" 映射为 "bank_transfer"，"debit_card" 映射为 "credit_card"，"voucher" 映射为 "cash"，"not_defined" 映射为 "bank_transfer"
2. WHEN 同一订单有多条支付记录时，THE Data_Transformer SHALL 使用 payment_sequential 最小的记录的支付方式作为订单的 payment_method
3. THE Data_Transformer SHALL 将同一订单所有支付记录的 payment_value 求和作为订单的 total 金额
4. WHEN 订单状态为 "delivered"、"shipped" 或 "processing" 时，THE Data_Transformer SHALL 将 payment_status 设置为 "completed"
5. WHEN 订单状态为 "cancelled" 时，THE Data_Transformer SHALL 将 payment_status 设置为 "failed"

### 需求 9: 订单地址生成

**用户故事:** 作为开发者，我希望为导入的订单生成配送地址信息，以便在系统中展示完整的订单物流信息。

#### 验收标准

1. THE Data_Transformer SHALL 为每个订单创建一条 shipping 类型的 order_addresses 记录
2. WHEN 生成地址时，THE Data_Transformer SHALL 使用订单关联客户的 customer_city 和 customer_state 填充 city 和 state 字段
3. THE Data_Transformer SHALL 使用客户的 customer_zip_code_prefix 填充 postal_code 字段
4. THE Data_Transformer SHALL 将 country 设置为 "Brazil"
5. THE Data_Transformer SHALL 生成格式为 "Rua {zip_code_prefix}, {city}" 的 address_line1
6. THE Data_Transformer SHALL 使用客户用户名作为 recipient_name
7. THE Data_Transformer SHALL 生成格式为 "55{zip_code_prefix}0000" 的 phone 号码

### 需求 10: 商品评分聚合

**用户故事:** 作为开发者，我希望将Olist评价数据聚合到商品评分中，以便在系统中展示商品的用户评价信息。

#### 验收标准

1. WHEN 处理 olist_order_reviews_dataset.csv 时，THE Data_Transformer SHALL 通过订单项关联将评价分数聚合到对应商品
2. THE Data_Transformer SHALL 计算每个商品的 rating_average（所有关联评价 review_score 的算术平均值，保留两位小数）
3. THE Data_Transformer SHALL 计算每个商品的 rating_count（关联评价的总数）
4. THE Data_Transformer SHALL 将 review_count 设置为与 rating_count 相同的值
5. IF 某商品没有关联的评价记录，THEN THE Data_Transformer SHALL 将 rating_average 设置为 0，rating_count 和 review_count 设置为 0

### 需求 11: 数据加载与事务管理

**用户故事:** 作为开发者，我希望数据加载过程具有事务保障和错误恢复能力，以便确保数据一致性。

#### 验收标准

1. THE Data_Loader SHALL 按以下顺序加载数据：用户 → 分类 → 品牌 → 商品 → 商品库存 → 订单 → 订单项 → 订单地址
2. THE Data_Loader SHALL 使用数据库事务确保每个实体类型的批量插入具有原子性
3. WHEN 批量插入数据时，THE Data_Loader SHALL 使用每批次1000条记录的批量插入策略以优化性能
4. IF 某个实体类型的数据加载失败，THEN THE Data_Loader SHALL 回滚该实体类型的事务，记录错误详情，并继续加载后续实体类型
5. THE Data_Loader SHALL 在插入前使用 ON CONFLICT 策略处理重复数据，避免因重复执行导入而产生错误
6. THE Data_Loader SHALL 在导入完成后输出每个实体类型的导入统计（成功数、跳过数、失败数）

### 需求 12: 导入工具运行配置

**用户故事:** 作为开发者，我希望导入工具可以独立运行并支持配置，以便灵活控制导入过程。

#### 验收标准

1. THE ETL_Tool SHALL 作为独立的 TypeScript 脚本运行，不依赖 Express 应用服务器
2. THE ETL_Tool SHALL 通过命令行参数或环境变量接收数据目录路径
3. THE ETL_Tool SHALL 复用系统现有的数据库连接配置（DATABASE_URL 环境变量）
4. THE ETL_Tool SHALL 在 package.json 中注册为 "db:import-olist" 脚本命令
5. WHEN 导入开始时，THE ETL_Tool SHALL 输出数据集文件检测结果和预计导入记录数
6. WHEN 导入完成时，THE ETL_Tool SHALL 输出总耗时和各实体类型的导入汇总
7. THE ETL_Tool SHALL 在导入过程中通过控制台输出进度信息，包括当前处理的实体类型和完成百分比

### 需求 13: CSV 解析往返一致性

**用户故事:** 作为开发者，我希望CSV解析器能够正确处理各种边界情况，确保数据解析的准确性。

#### 验收标准

1. FOR ALL 包含特殊字符（逗号、引号、换行符）的CSV字段值，THE CSV_Parser SHALL 解析后得到与原始值完全一致的字符串（往返一致性）
2. FOR ALL Olist数据集中的数值字段（price、freight_value、payment_value），THE CSV_Parser SHALL 将其解析为精确的数值类型，不产生浮点精度损失
3. FOR ALL Olist数据集中的时间戳字段，THE CSV_Parser SHALL 将其解析为有效的 Date 对象，保留原始时区信息
