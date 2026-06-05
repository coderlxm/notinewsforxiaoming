# 提醒功能自然语言管理设计方案

## 1. 背景

当前 Bot 已支持：

- 创建一次性提醒：`reminders`
- 创建循环提醒：`recurring_reminder_rules`
- 通过按钮取消、完成、推迟一次性提醒
- 通过按钮暂停、取消、完成本次、跳过本次循环提醒

缺口是：用户无法用自然语言管理已有提醒。例如：

- “取消下午开会的提醒”
- “把做俯卧撑那个循环提醒取消掉”
- “明天有什么提醒”
- “下周有哪些安排”

本方案只覆盖“管理已有提醒”，不改变现有创建提醒主路径。

## 2. 目标

实现自然语言管理能力：

1. 查询提醒：按时间范围查看一次性提醒和循环提醒的触发实例。
2. 模糊取消：按关键词查找一次性提醒或循环提醒，并通过明确规则取消。
3. 保持展示、按钮、状态更新与现有提醒系统一致。

不做的事：

- 不做批量自动取消。
- 不做提醒内容修改。
- 不做循环提醒规则编辑。
- 不做跨聊天记录检索。
- 不做失败后的兜底解析或静默跳过。

## 3. 设计原则

### 3.1 chat_id 隔离

所有查询、搜索、取消都必须带 `chat_id` 条件。  
即使当前 Bot 是个人使用，也不允许查询或修改其他 chat 的数据。

### 3.2 删除类操作必须可解释

取消是破坏性操作：

- 0 条匹配：直接说明没找到。
- 1 条唯一匹配：可以直接取消，并明确回复取消对象。
- 多条匹配：必须返回候选列表，让用户点按钮确认。

不允许 AI 直接决定删除哪一条数据库记录。

### 3.3 使用同一套时间计算语义

一次性提醒查询使用 `trigger_at`。  
循环提醒查询使用 `getNextTrigger(rrule_text, timezone, after, inclusive)` 逐次计算范围内触发点。

查询结果展示、循环实例展开、循环触发后下一次计算必须使用同一个 `getNextTrigger` 实现。  
不允许为了查询列表再实现一套循环时间计算。

### 3.4 AI 只负责意图结构化

AI 输出只能作为结构化指令输入，不能直接执行数据库修改。  
执行层必须再做 Zod 校验、chat_id 过滤和候选分流。

## 4. 用户语义

### 4.1 查询类

示例输入：

- “明天有什么提醒”
- “今天下午要做什么”
- “下周有哪些安排”
- “最近三天有什么待办”

结果：

- 返回范围内的一次性提醒。
- 返回范围内的循环提醒触发实例。
- 按北京时间升序展示。

### 4.2 取消类

示例输入：

- “取消开会的提醒”
- “帮我取消做俯卧撑”
- “把回公司的循环提醒取消掉”

结果：

- 只匹配当前 chat 的 pending 一次性提醒和 active 循环提醒。
- 单条明确匹配时取消。
- 多条匹配时展示候选按钮。

### 4.3 不支持语义

以下输入不在本期范围：

- “把开会改到下午三点”
- “以后每天改成 23 点”
- “删除所有健身提醒”
- “暂停一周循环提醒”

这些应返回明确不支持的提示，不进入部分执行。

## 5. AI 输出协议

扩展 `parseNaturalReminder()` 的 AI JSON 协议，新增管理意图。

### 5.1 查询意图：`list_reminders`

```json
{
  "intent": "list_reminders",
  "range_start": "2026-05-12T00:00:00+08:00",
  "range_end": "2026-05-12T23:59:59+08:00",
  "title": "明天"
}
```

字段规则：

- `range_start`：必填，ISO 8601，必须带 `+08:00`。
- `range_end`：必填，ISO 8601，必须带 `+08:00`。
- `title`：可选，用于展示标题，如“明天”“下周”。

### 5.2 取消意图：`cancel_reminder`

```json
{
  "intent": "cancel_reminder",
  "query": "开会",
  "target": "any"
}
```

字段规则：

- `query`：必填，用户想取消的内容关键词。
- `target`：必填，枚举值：
  - `once`：只查一次性提醒
  - `recurring`：只查循环提醒
  - `any`：两类都查

### 5.3 创建意图保持不变

现有：

- `create_reminder`
- `create_recurring_reminder`

继续走现有创建链路，不与管理意图共享执行函数。

## 6. Parser 设计

### 6.1 类型定义

在 `src/reminders/parser.ts` 增加：

```ts
export interface ParsedListReminders {
  intent: 'list_reminders';
  rangeStart: Date;
  rangeEnd: Date;
  title: string;
  source: 'ai';
}

export interface ParsedCancelReminder {
  intent: 'cancel_reminder';
  query: string;
  target: 'once' | 'recurring' | 'any';
  source: 'ai';
}
```

`parseNaturalReminder()` 返回类型扩展为：

```ts
ParsedReminder
| ParsedRecurringReminder
| ParsedListReminders
| ParsedCancelReminder
| ParseError
```

### 6.2 Zod Schema

新增两个 schema：

```ts
const listRemindersSchema = z.object({
  intent: z.literal('list_reminders'),
  range_start: z.string().datetime({ offset: true }),
  range_end: z.string().datetime({ offset: true }),
  title: z.string().optional(),
});

const cancelReminderSchema = z.object({
  intent: z.literal('cancel_reminder'),
  query: z.string().min(1),
  target: z.enum(['once', 'recurring', 'any']).default('any'),
});
```

校验规则：

- `range_start < range_end`。
- 查询范围最长 31 天；超过则返回错误，不截断。
- `query.trim()` 后不能为空。

## 7. Repository 设计

在 `src/reminders/repository.ts` 新增只读查询函数和现有状态修改函数复用。

### 7.1 一次性提醒范围查询

```ts
export function findPendingRemindersInRange(
  chatId: string,
  start: Date,
  end: Date
): Reminder[]
```

SQL：

```sql
SELECT *
FROM reminders
WHERE chat_id = ?
  AND status = 'pending'
  AND trigger_at >= ?
  AND trigger_at <= ?
ORDER BY trigger_at ASC
```

### 7.2 一次性提醒关键词搜索

```ts
export function searchPendingReminders(
  chatId: string,
  query: string
): Reminder[]
```

SQL：

```sql
SELECT *
FROM reminders
WHERE chat_id = ?
  AND status = 'pending'
  AND text LIKE ?
ORDER BY trigger_at ASC
```

### 7.3 循环提醒关键词搜索

```ts
export function searchActiveRecurringRules(
  chatId: string,
  query: string
): RecurringRule[]
```

SQL：

```sql
SELECT *
FROM recurring_reminder_rules
WHERE chat_id = ?
  AND status = 'active'
  AND text LIKE ?
ORDER BY next_trigger_at ASC
```

### 7.4 循环提醒查询

复用现有：

```ts
findActiveRecurringByChatId(chatId)
```

不新增专门 SQL 范围过滤，因为循环提醒需要根据规则展开时间范围。

## 8. 循环提醒范围展开

新增工具函数，建议放在 `src/reminders/recurring.ts`：

```ts
export interface RecurringOccurrence {
  rule: RecurringRule;
  triggerAt: Date;
}

export function getOccurrencesInRange(
  rule: RecurringRule,
  start: Date,
  end: Date
): RecurringOccurrence[]
```

计算方式：

1. 从 `start` 开始调用 `getNextTrigger(rule.rrule_text, rule.timezone, start, true)`。
2. 如果结果大于 `end`，返回空。
3. 每次得到一个触发点后，继续调用 `getNextTrigger(rule.rrule_text, rule.timezone, triggerAt, false)`。
4. 直到触发点超过 `end`。

约束：

- 单条循环规则在一次查询中最多展开 100 个实例；超过直接报错。
- 查询总范围最长 31 天，避免大范围展开。
- 展开结果只用于展示，不写库。

## 9. Interactive 处理流程

在 `src/bot/interactive.ts` 的自然语言文本处理里扩展分发。

### 9.1 分发顺序

当前顺序建议调整为：

1. 授权校验。
2. 空文本和 `/` 命令直接返回。
3. 记录 `receivedAt = new Date()`。
4. 调用 `parseNaturalReminder(text, receivedAt)`。
5. 根据解析结果分发：
   - `triggerAt` -> 创建一次性提醒
   - `spec` -> 创建循环提醒
   - `intent === 'list_reminders'` -> 查询
   - `intent === 'cancel_reminder'` -> 取消
   - `error` -> 回复错误

### 9.2 查询处理器

```ts
async function handleListIntent(
  ctx: Context,
  intent: ParsedListReminders
): Promise<void>
```

流程：

1. 获取 `chatId`。
2. 查询一次性提醒范围。
3. 查询当前 chat 的 active 循环规则。
4. 对每条循环规则展开范围内实例。
5. 合并成统一展示模型。
6. 按 `triggerAt` 升序排序。
7. 调用 formatter 输出。

统一展示模型：

```ts
type ReminderListItem =
  | { kind: 'once'; reminder: Reminder; triggerAt: Date }
  | { kind: 'recurring'; rule: RecurringRule; triggerAt: Date };
```

### 9.3 取消处理器

```ts
async function handleCancelIntent(
  ctx: Context,
  intent: ParsedCancelReminder
): Promise<void>
```

流程：

1. 获取 `chatId`。
2. 根据 `target` 搜索一次性提醒和/或循环提醒。
3. 合并候选并排序。
4. 分流：
   - 0 条：回复没找到。
   - 1 条：直接执行取消。
   - 多条：回复候选列表和按钮。

候选模型：

```ts
type CancelCandidate =
  | { kind: 'once'; id: number; text: string; triggerAt: Date }
  | { kind: 'recurring'; id: number; text: string; nextTriggerAt: Date };
```

直接取消规则：

- 一次性提醒：`repo.cancelReminder(id)` + `cancelScheduledReminder(id)`。
- 循环提醒：`repo.updateRecurringStatus(id, 'cancelled')` + `cancelRecurringJob(id)`。

## 10. Callback 设计

新增自然语言取消候选 callback，不复用现有 `reminder:cancel:<id>`，避免一次性和循环提醒 id 冲突。

格式：

```text
nlcancel:once:<id>
nlcancel:recur:<id>
```

扩展点：

- `src/bot/callbacks.ts` 增加 `parseNaturalCancelCallbackData()`。
- `src/bot/interactive.ts` 在现有 callback handler 里优先解析该类型。

执行规则：

- `nlcancel:once:<id>`：查一次性提醒，确认仍为 `pending` 后取消。
- `nlcancel:recur:<id>`：查循环提醒，确认仍为 `active` 后取消。
- 记录不存在或状态已变化时，直接回复“该提醒已不存在或已处理”。

## 11. Formatter 设计

在 `src/reminders/formatter.ts` 新增：

```ts
export function formatReminderRangeList(
  title: string,
  items: ReminderListItem[]
): string

export function formatCancelCandidates(
  query: string,
  candidates: CancelCandidate[]
): string

export function buildCancelCandidateButtons(
  candidates: CancelCandidate[]
): { reply_markup: InlineKeyboardMarkup }
```

展示要求：

- 一次性提醒显示时间和内容。
- 循环提醒显示本次触发时间、规则内容，并标记“循环”。
- 列表为空时返回明确空状态，如“这个时间段没有提醒”。
- HTML 内容必须转义。

## 12. AI Prompt 要点

Prompt 需明确：

- 当前北京时间。
- 所有时间都输出 ISO 8601，必须带 `+08:00`。
- 查询范围必须是闭区间。
- `工作日` 必须转为 `MO,TU,WE,TH,FR`（创建循环提醒场景）。
- 取消意图只输出关键词，不输出数据库 id。
- 不要输出解释文字。

新增示例：

```json
{
  "intent": "list_reminders",
  "range_start": "2026-05-12T00:00:00+08:00",
  "range_end": "2026-05-12T23:59:59+08:00",
  "title": "明天"
}
```

```json
{
  "intent": "cancel_reminder",
  "query": "回公司",
  "target": "any"
}
```

## 13. 测试场景

### 13.1 查询

1. “明天有什么提醒”
   - 有一次性提醒：列出一次性提醒。
   - 有每日循环提醒：列出明天触发实例。
   - 两者都有：合并后按时间排序。

2. “下周有哪些安排”
   - 展开周范围内的循环提醒。
   - 不展示范围外提醒。

3. “今天下午要做什么”
   - 只展示北京时间今天下午范围内的提醒。

### 13.2 取消

1. “取消开会”
   - 只有一条 pending 一次性提醒匹配：直接取消。

2. “取消健身”
   - 多条一次性/循环提醒匹配：返回候选按钮。

3. “取消做俯卧撑的循环提醒”
   - 只取消 active 循环规则。
   - 不影响一次性提醒。

4. “取消不存在的提醒”
   - 回复没找到。

### 13.3 安全边界

1. 其他 chat 的提醒不能被查到。
2. 已取消提醒不能再次出现在候选里。
3. 查询超过 31 天直接返回错误。
4. 循环展开超过 100 个实例直接返回错误。

## 14. 实施步骤

### Phase 1：Parser

- 扩展返回类型。
- 增加 `list_reminders` / `cancel_reminder` schema。
- 更新 prompt 示例。

### Phase 2：Repository

- 增加一次性提醒范围查询。
- 增加一次性提醒关键词搜索。
- 增加循环提醒关键词搜索。

### Phase 3：Formatter

- 增加查询结果展示。
- 增加取消候选展示和按钮。

### Phase 4：Interactive

- 增加 `handleListIntent()`。
- 增加 `handleCancelIntent()`。
- 扩展 callback handler。

### Phase 5：验证

- 本地用测试入口验证自然语言解析。
- 线上只通过 push 自动部署。
- 使用 Telegram 实测查询和取消主路径。

## 15. 风险与决策

### 风险 1：AI 输出格式不稳定

决策：严格 Zod 校验，不做隐式修正。格式不合格时直接提示用户使用更明确说法。

### 风险 2：模糊取消误删

决策：只有唯一候选才直接取消，多候选必须按钮确认。

### 风险 3：循环提醒查询时间不一致

决策：查询展开必须使用现有 `getNextTrigger(rrule_text, timezone, after, inclusive)`，不新增第二套时间计算。

### 风险 4：callback_data 过长

决策：callback 只放类型和 id，不放 query、时间范围或文本。
