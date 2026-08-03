# 自然语言按时间范围取消提醒设计方案

## 1. 背景

当前自然语言管理已经支持两类能力：

- 按时间范围查询提醒，例如“明天有什么提醒”。
- 按内容关键词取消提醒，例如“取消开会提醒”。

但取消协议只允许 DeepSeek 返回内容关键词：

```json
{
  "intent": "cancel_reminder",
  "query": "开会",
  "target": "any"
}
```

执行层随后通过 `text LIKE query` 搜索待处理的一次性提醒和生效中的循环提醒。因此下面的表达没有可执行的时间条件：

- “取消今晚的提醒”
- “取消下周的提醒”
- “把明天下午的提醒取消掉”
- “取消这周末关于买菜的提醒”

问题不在创建提醒链路，而在 `cancel_reminder` 的结构化协议和候选搜索只支持内容维度。

## 2. 目标

扩展现有 `cancel_reminder` 意图，使取消候选可以由以下条件确定：

1. 只按内容，例如“取消开会提醒”。
2. 只按时间范围，例如“取消今晚的提醒”。
3. 同时按时间和内容，例如“取消下周的健身提醒”。
4. 继续区分一次性提醒、循环提醒或两者。

本期不做：

- 不让 DeepSeek 返回或决定数据库 ID。
- 不让时间范围语句直接批量修改数据库。
- 不新增重试、二次 AI 解析或规则解析兜底。
- 不支持只跳过循环提醒的某个未来实例。
- 不新增取消请求表或临时会话状态。

## 3. 核心决策

### 3.1 DeepSeek 只解析条件

DeepSeek 负责把自然语言转换为内容、时间范围和提醒类型，不读取数据库，也不决定最终取消对象。

数据库候选必须由本地代码根据当前 `chat_id` 和提醒状态重新查询。

### 3.2 带时间范围时始终先确认

只要取消意图包含时间范围，即使只匹配到一条提醒，也不直接取消，而是展示候选按钮。

原因是“今晚”“下周”属于集合条件，且循环提醒的取消效果可能超出该时间范围。确认按钮能让用户看到实际命中的时间、内容和提醒类型。

原有的纯关键词取消行为保持不变：

- 0 条匹配：回复未找到。
- 1 条匹配：直接取消。
- 多条匹配：展示候选按钮。

### 3.3 不提供隐式批量取消

“取消下周的提醒”可能命中多条记录。本期只展示逐条取消按钮，不提供“一键取消全部”。

这样可以直接复用现有 `nlcancel:once:<id>` 和 `nlcancel:recur:<id>` callback，不需要保存候选快照，也不会在用户点击按钮时把后来新建、但恰好落入同一范围的提醒一起取消。

### 3.4 循环提醒按规则取消

数据库保存的是循环规则，不是尚未发生的独立实例。时间范围命中循环提醒时，候选时间取该规则在范围内的第一次触发时间，但按钮执行的是取消整个循环规则。

界面必须明确展示：

```text
[循环规则] 每天 22:00 做俯卧撑
取消后：以后都不再提醒
```

本期不把“取消今晚的循环提醒”解释为只跳过今晚。若后续需要该语义，应单独设计循环规则的未来排除日期，而不是在本功能里隐式实现。

## 4. DeepSeek 输出协议

继续使用现有 `cancel_reminder` 意图，扩展为统一筛选结构：

```json
{
  "intent": "cancel_reminder",
  "query": null,
  "target": "any",
  "range_start": "2026-07-10T18:00:00+08:00",
  "range_end": "2026-07-10T23:59:59+08:00",
  "range_title": "今晚"
}
```

字段语义：

- `query`：内容关键词；没有内容条件时为 `null`，不能把“今晚”“下周”填入该字段。
- `target`：`once`、`recurring`、`any`。
- `range_start`：取消范围开始时间；没有时间条件时为 `null`。
- `range_end`：取消范围结束时间；没有时间条件时为 `null`。
- `range_title`：用户时间表达的简短标题；没有时间条件时为 `null`。

三个合法组合：

### 4.1 只按关键词

```json
{
  "intent": "cancel_reminder",
  "query": "开会",
  "target": "any",
  "range_start": null,
  "range_end": null,
  "range_title": null
}
```

### 4.2 只按时间

```json
{
  "intent": "cancel_reminder",
  "query": null,
  "target": "any",
  "range_start": "2026-07-13T00:00:00+08:00",
  "range_end": "2026-07-19T23:59:59+08:00",
  "range_title": "下周"
}
```

### 4.3 时间与关键词取交集

```json
{
  "intent": "cancel_reminder",
  "query": "健身",
  "target": "any",
  "range_start": "2026-07-13T00:00:00+08:00",
  "range_end": "2026-07-19T23:59:59+08:00",
  "range_title": "下周"
}
```

协议约束：

- `query` 和完整时间范围至少存在一项。
- `range_start` 与 `range_end` 必须同时为时间字符串或同时为 `null`。
- 时间必须是带偏移量的 ISO 8601，当前业务统一要求 `+08:00`。
- `range_start < range_end`。
- 范围结束时间必须晚于当前时间。
- 时间范围最长 31 天，超过时直接返回明确错误。
- `target` 缺省语义仍是 `any`。

## 5. 时间表达约定

DeepSeek prompt 必须带当前北京时间，并明确常用表达：

- “今晚”：当天 `18:00:00` 至 `23:59:59`。
- “今天”：当天 `00:00:00` 至 `23:59:59`。
- “明天下午”：次日 `12:00:00` 至 `17:59:59`。
- “明晚”：次日 `18:00:00` 至 `23:59:59`。
- “下周”：下一个自然周，周一 `00:00:00` 至周日 `23:59:59`。
- “这周末”：本周六 `00:00:00` 至周日 `23:59:59`。
- “未来七天”：当前时刻至当前时刻加七天，不等同于自然周。

这些约定只写入 DeepSeek 的结构化提示词，不在本地再手写一套自然语言日期解析器。

示例必须覆盖纯时间取消，避免模型继续把时间词塞入 `query`：

```text
输入：取消今晚的提醒
输出：query=null，range_title=今晚，并给出今晚的北京时间范围

输入：取消下周的健身提醒
输出：query=健身，并给出下周的北京时间范围
```

## 6. Parser 调整

### 6.1 类型

将 `ParsedCancelReminder` 扩展为：

```ts
export interface ParsedCancelReminder {
  intent: 'cancel_reminder';
  query: string | null;
  target: 'once' | 'recurring' | 'any';
  rangeStart: Date | null;
  rangeEnd: Date | null;
  rangeTitle: string | null;
  source: 'ai';
}
```

### 6.2 Zod schema

`cancelReminderSchema` 使用 nullable 字段描述固定 JSON 结构，并通过 `superRefine` 保证：

- 关键词与时间范围至少有一个。
- 开始和结束时间必须成对出现。
- `range_title` 只在存在时间范围时使用。

Zod 完成结构校验后，再转换为 `Date` 并执行时间先后、结束时间和 31 天范围校验。

解析失败直接返回取消语义对应的明确错误，不进入创建提醒分支，也不进行第二次解析。

## 7. 候选搜索

### 7.1 一次性提醒

一次性候选必须满足：

- `chat_id` 等于当前聊天。
- `status = 'pending'`。
- 存在范围时，`trigger_at` 位于闭区间内。
- 存在关键词时，`text` 包含关键词。

repository 增加一个组合查询入口：

```ts
export function findPendingReminderCandidates(
  chatId: string,
  filter: {
    query: string | null;
    rangeStart: Date | null;
    rangeEnd: Date | null;
  },
): Reminder[]
```

函数只根据明确传入的条件拼接 SQL，不使用默认时间或默认关键词。

### 7.2 循环提醒

循环候选处理顺序：

1. 按 `chat_id`、`status = 'active'` 和可选关键词取得规则。
2. 没有时间范围时，保持当前关键词搜索行为。
3. 有时间范围时，复用 `getOccurrencesInRange()` 展开规则。
4. 范围内没有触发实例的规则不进入候选。
5. 同一规则即使范围内触发多次，也只生成一个候选。
6. 候选的 `triggerAt` 使用范围内第一次触发时间。

这里不修改 `src/reminders/recurring.ts` 的 `rrule` 导入及加载方式。

### 7.3 排序

一次性提醒和循环规则合并后，统一按候选 `triggerAt` 升序排列。

## 8. Interactive 流程

`handleCancelIntent()` 调整为：

1. 根据 `target` 决定查询一次性提醒、循环提醒或两者。
2. 应用 `query` 和可选时间范围。
3. 合并、去重并按触发时间排序。
4. 没有候选时，回复时间范围和关键词对应的未找到信息。
5. 存在时间范围时，无论候选数量多少，都展示确认按钮。
6. 不存在时间范围时，继续使用当前 0/1/多条分流。

时间范围候选示例：

```text
🔍 找到 2 个“今晚”的待处理提醒，请选择要取消的项目：

1. 20:30 取快递
2. 22:00 [循环规则] 做俯卧撑
   取消后以后都不再提醒
```

按钮：

```text
取消「20:30 取快递」
取消整个循环「做俯卧撑」
```

callback 继续复用：

```text
nlcancel:once:<id>
nlcancel:recur:<id>
```

callback 执行时继续检查：

- ID 对应记录仍然存在。
- 记录属于当前 `chat_id`。
- 一次性提醒仍是 `pending`，循环规则仍是 `active`。

按钮只携带候选 ID，不携带时间范围，也不在点击时重新执行范围搜索。

## 9. Formatter 调整

扩展 `formatCancelCandidates()` 的输入上下文：

```ts
interface CancelCandidateContext {
  query: string | null;
  rangeTitle: string | null;
  requiresConfirmation: boolean;
}
```

展示规则：

- 纯关键词取消继续显示“与「关键词」相关的提醒”。
- 纯时间取消显示“「今晚」的待处理提醒”。
- 组合条件显示“「下周」与「健身」相关的待处理提醒”。
- 一次性提醒显示实际触发时间。
- 循环提醒显示范围内第一次触发时间，并明确按钮会取消整个规则。
- HTML 内容继续统一转义。

`CancelCandidate` 结构无需新增数据库字段，只增加可用于展示的循环说明：

```ts
export interface CancelCandidate {
  kind: 'once' | 'recurring';
  id: number;
  text: string;
  triggerAt: Date;
}
```

## 10. 涉及文件

- `src/reminders/parser.ts`
  - 扩展取消意图类型、Zod schema 和 DeepSeek prompt。
- `src/reminders/repository.ts`
  - 增加一次性提醒组合条件查询。
- `src/bot/interactive.ts`
  - 按时间范围构造取消候选，并调整确认分流。
- `src/reminders/formatter.ts`
  - 展示时间范围、组合条件和循环规则影响。

不需要修改：

- SQLite 表结构。
- `src/bot/callbacks.ts` 的 callback 协议。
- 提醒调度器。
- 创建提醒主路径。
- `src/reminders/recurring.ts` 的 `rrule` 导入方式。

## 11. 预期交互

### 11.1 取消今晚的提醒

DeepSeek 输出今晚的北京时间范围，执行层查询该范围内的 pending 一次性提醒，并展开范围内会触发的 active 循环规则。Bot 展示候选按钮，不直接修改状态。

### 11.2 取消下周的提醒

DeepSeek 输出下一个自然周的完整范围。候选按触发时间排序；同一循环规则即使下周触发多次也只出现一次。

### 11.3 取消下周的健身提醒

时间范围与内容关键词取交集。不会命中本周的健身提醒，也不会命中下周内容不包含“健身”的提醒。

### 11.4 取消开会提醒

没有时间范围，完全保留当前行为：唯一候选直接取消，多候选通过按钮选择。

### 11.5 时间范围内没有提醒

回复：

```text
没有找到“今晚”的待处理提醒。
```

不会改用关键词搜索，也不会扩大时间范围。

## 12. 实施顺序

1. 扩展 `ParsedCancelReminder` 和取消意图 Zod schema。
2. 更新 DeepSeek prompt 与时间范围示例。
3. 增加一次性提醒组合条件查询。
4. 在 `handleCancelIntent()` 中加入循环规则范围展开和候选去重。
5. 调整候选文案与按钮标签，明确循环规则取消效果。

## 13. Review 重点

本方案建议 Review 时重点确认两个产品语义：

1. 时间范围取消是否接受“逐条按钮确认”，而不是直接批量取消。
2. 时间范围命中循环提醒时，是否接受“取消整个循环规则”；本期不支持只跳过范围内某一次。

这两个语义确认后，代码改动不涉及数据库迁移，能够沿用当前提醒管理主路径完成。
