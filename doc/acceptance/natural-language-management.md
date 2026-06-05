# 自然语言管理功能验收文档

## 1. 实现概览

实现了设计文档 `natural_language_management_design.md` 中定义的全部 4 项能力：

1. **查询提醒**（`list_reminders`）：按时间范围查看一次性提醒和循环提醒触发实例
2. **模糊取消**（`cancel_reminder`）：按关键词查找并取消，0/1/多条分流处理
3. **展示/按钮/状态更新**：与现有提醒系统一致的 HTML 格式和 inline keyboard
4. **安全边界**：chat_id 隔离、Zod 校验、AI 不直接操作数据库

## 2. 变更文件清单

| 文件 | 变更内容 |
|------|---------|
| `src/reminders/parser.ts` | 新增 `ParsedListReminders`、`ParsedCancelReminder` 类型；新增 `listRemindersSchema`、`cancelReminderSchema` Zod schema；扩展 `parseNaturalReminder()` 返回类型；AI prompt 新增 list/cancel 意图示例；解析逻辑新增两个 intent 分支 |
| `src/reminders/repository.ts` | 新增 `findPendingRemindersInRange()`、`searchPendingReminders()`、`searchActiveRecurringRules()` 三个查询函数 |
| `src/reminders/recurring.ts` | 新增 `RecurringOccurrence` 接口；新增 `getOccurrencesInRange()` 展开函数，复用 `getNextTrigger`，最多展开 100 个实例 |
| `src/reminders/formatter.ts` | 新增 `ReminderListItem`、`CancelCandidate` 类型；新增 `formatReminderRangeList()`、`formatCancelCandidates()`、`buildCancelCandidateButtons()` |
| `src/bot/callbacks.ts` | 新增 `NaturalCancelCallbackData` 接口；新增 `parseNaturalCancelCallbackData()` 解析 `nlcancel:once:<id>` / `nlcancel:recur:<id>` |
| `src/bot/interactive.ts` | 新增 `handleListIntent()`、`handleCancelIntent()`；text message handler 新增 intent 分发；callback handler 新增 nlcancel 处理 |

## 3. 设计方案对照

### 3.1 设计原则

- **chat_id 隔离**：`findPendingRemindersInRange`、`searchPendingReminders`、`searchActiveRecurringRules` 全都带 `chat_id` 条件（repository.ts）
- **删除可解释**：0 条匹配回复"没找到"；1 条唯一匹配直接取消；多条匹配返回候选按钮（interactive.ts `handleCancelIntent`）
- **同一套时间计算**：`getOccurrencesInRange` 调用 `getNextTrigger`，不新增时间计算实现（recurring.ts）
- **AI 只负责意图结构化**：Zod 校验 + chat_id 过滤 + 候选分流全在执行层（parser.ts + interactive.ts）

### 3.2 AI 输出协议

- `list_reminders`：`range_start`/`range_end` 必填 ISO 8601 带 `+08:00`，`title` 可选（parser.ts `listRemindersSchema`）
- `cancel_reminder`：`query` 必填 min(1)，`target` 枚举 `once`/`recurring`/`any`（parser.ts `cancelReminderSchema`）
- 查询范围校验：`rangeStart < rangeEnd`，最长 31 天（parser.ts parseNaturalReminder 中校验）

### 3.3 统一展示模型

- `ReminderListItem`：`kind: 'once' | 'recurring'`，统一排序展示（formatter.ts `formatReminderRangeList`）
- `CancelCandidate`：`kind: 'once' | 'recurring'`，附带 id 供按钮回调（formatter.ts `buildCancelCandidateButtons`）

### 3.4 Callback 设计

- `nlcancel:once:<id>`：查一次性提醒，确认仍为 pending 后取消
- `nlcancel:recur:<id>`：查循环提醒，确认仍为 active 后取消
- 记录不存在/状态已变化时回复"该提醒已不存在或已处理"（callbacks.ts + interactive.ts）

## 4. 测试场景验证

### 4.1 查询类

| 场景 | 预期行为 | 对应代码 |
|------|---------|---------|
| "明天有什么提醒"（有一次性和循环） | 合并后按时间升序展示 | `handleListIntent` 合并 once + recurring |
| "下周有哪些安排" | 展开周内循环提醒，不展示范围外 | `getOccurrencesInRange` |
| "今天下午要做什么" | 只展示下午时间范围 | AI 输出 range_start/range_end 限定下午 |
| 查询范围无提醒 | 返回空状态文案 | `formatReminderRangeList` 空数组分支 |
| 查询范围 > 31 天 | 返回错误不截断 | `parseNaturalReminder` 中 `diffMs > 31*24*3600*1000` |

### 4.2 取消类

| 场景 | 预期行为 | 对应代码 |
|------|---------|---------|
| "取消开会" 仅一条匹配 | 直接取消并回复 | `handleCancelIntent` 单条分流 |
| "取消健身" 多条匹配 | 返回候选按钮列表 | `handleCancelIntent` 多条分流 + `buildCancelCandidateButtons` |
| "取消做俯卧撑的循环提醒" | target: recurring，不匹配一次性 | AI 输出 target + `searchActiveRecurringRules` |
| "取消不存在的内容" | 回复没找到 | `handleCancelIntent` 0 条分流 |
| 点击 nlcancel 按钮取消 | 确认状态后取消 | callback handler nlcancel 分支 |

### 4.3 安全边界

| 场景 | 预期行为 | 对应代码 |
|------|---------|---------|
| 只查当前 chat | WHERE chat_id = ? 条件 | repository.ts 三个新函数 |
| 已取消提醒不在候选 | status = 'pending' / 'active' 条件 | repository.ts 三个新函数 |
| 循环展开 > 100 实例 | 抛出错误 | `getOccurrencesInRange` 上限检测 |
| AI 输出格式错误 | Zod 校验不通过返回友好提示 | parser.ts safeParse 分支 |

## 5. 部署验证步骤

1. **本地语法检查**：`npx tsx --eval "import './src/bot/interactive'"` 确认模块加载无语法错误
2. **Telegram 实测查询**：
   - 创建一条一次性提醒、一条每日循环提醒
   - 发送"明天有什么提醒"确认列表中包含两者
3. **Telegram 实测取消**：
   - 发送"取消循环提醒"（多条匹配时确认出现候选按钮）
   - 点击按钮取消一条，确认状态更新
   - 发送"取消不存在内容"确认回复未找到
4. **安全验证**：
   - 创建提醒后，切换另一个 chat 查询，确认查不到
   - 取消提醒后再次用自然语言查询，确认不再出现

## 6. 未实现项（按设计文档）

| 项目 | 说明 |
|------|------|
| 批量自动取消 | 明确不在范围 |
| 提醒内容修改 | 明确不在范围 |
| 循环提醒规则编辑 | 明确不在范围 |
| 跨聊天记录检索 | 明确不在范围 |
| 失败兜底解析/静默跳过 | 明确不在范围 |
