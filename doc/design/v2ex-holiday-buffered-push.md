# V2EX 节假日缓冲推送设计

## 1. 目标

调整 V2EX 推送为：

1. 中国工作日：保持当前实时推送逻辑不变。  
2. 中国节假日（含周末与法定节假日）：照常拉取 V2EX 热门，但**只入库不推送**。  
3. 下一次中国工作日早上 `08:41`：把节假日缓冲的数据交给 AI 总结后推送一次。

## 2. 当前现状（基线）

- 定时任务中已有 `v2ex` 固定时点（当前约 `20:00`）。
- `runMode('v2ex')` 当前行为是：拉取 -> AI 总结 -> 直接发消息。

## 3. 新行为定义

### 3.1 工作日实时推送（不变）

- 触发时为工作日：
  - 拉取 `fetchV2exHot()`
  - AI 总结 `summarizeV2exWithAI(...)`
  - `sendTelegramMessage(...)` 推送

### 3.2 节假日缓冲（新增）

- 触发时为非工作日：
  - 拉取 `fetchV2exHot()`
  - 将原始 topics 按批次入库
  - 不调用 AI，不推送

### 3.3 工作日 08:41 回放推送（新增）

- 新增定时点：每天 `08:41`（北京时间）
- 仅在工作日执行：
  1. 读取“未消费的节假日缓冲批次”
  2. 合并去重（按 topic id/url）
  3. AI 总结（复用现有 `summarizeV2exWithAI`，提示词可轻调为“节假日补充简报”语气）
  4. 推送 1 条汇总消息
  5. 将缓冲批次标记为已消费

## 4. 数据模型设计

新增两张表：

### 4.1 `v2ex_buffer_batches`
- `id` INTEGER PK
- `batch_date` TEXT（YYYY-MM-DD）
- `source` TEXT DEFAULT 'v2ex'
- `is_holiday` INTEGER（1/0）
- `consumed` INTEGER DEFAULT 0
- `created_at` TEXT

### 4.2 `v2ex_buffer_items`
- `id` INTEGER PK
- `batch_id` INTEGER FK
- `topic_id` TEXT
- `topic_url` TEXT
- `title` TEXT
- `author` TEXT
- `reply_count` INTEGER
- `created_at` TEXT

索引建议：
- `idx_v2ex_batch_consumed` on `(consumed, batch_date)`
- `idx_v2ex_item_topic` on `(topic_id)`

## 5. 模块拆分建议

### 5.1 Repository（新增）
`src/services/v2exBufferRepository.ts`
- `createHolidayBatch(...)`
- `insertBatchItems(...)`
- `findUnconsumedHolidayItems()`
- `markBatchesConsumed(batchIds: number[])`

### 5.2 Service（新增）
`src/services/v2exBufferedPush.ts`
- `bufferHolidayV2exTopics(topics)`
- `pushBufferedV2exIfNeeded(bot?)`

### 5.3 调度与路由（调整）
- `runMode('v2ex')`：
  - 判断 `isChinaWorkday(now)`
  - 工作日：走原实时推送
  - 非工作日：走缓冲存储
- 新增 `runMode('v2ex_buffered_push')`：
  - 每天 `08:41` 触发
  - 工作日才执行推送缓冲

## 6. 消息策略

### 6.1 节假日当天
- 不发任何 V2EX 消息（静默存储）

### 6.2 工作日 08:41
- 推送 1 条“节假日缓冲简报”
- 内容结构建议：
  - 标题：`V2EX 节假日补充简报`
  - 覆盖范围：`覆盖日期: yyyy-mm-dd ~ yyyy-mm-dd`
  - 话题摘要（AI）
  - 标签：`#V2EX #补充简报`

## 7. 边界与规则

1. 连续多个节假日会累计缓冲，直到下个工作日统一推送。  
2. 若节假日无数据，08:41 不推送。  
3. 若 08:41 推送失败，不标记 consumed，等待下次工作日重试。  
4. 去重优先按 `topic_id`，没有则按 `topic_url`。

## 8. 验收标准

1. 工作日 20:00（现有时点）仍按旧逻辑实时推送。  
2. 非工作日 20:00 不推送，但数据库有新增缓冲记录。  
3. 下一个工作日 08:41 推送 1 条汇总，并成功消费缓冲数据。  
4. 重复触发 08:41 不会重复推送同一批（已 consumed）。

## 9. 最小实施顺序

1. 先加表 + repository。  
2. 改 `runMode('v2ex')` 的工作日/节假日分支。  
3. 加 `v2ex_buffered_push` 模式与 `08:41` 定时。  
4. 接入消息模板并完成消费标记。
