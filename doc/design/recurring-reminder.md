# 循环提醒功能设计方案

补充实现：循环规则可通过 `calendar_filter=china_workday` 表达中国法定工作日。RRULE 生成每日候选时间，严格工作日日历负责过滤法定节假日和周末调休补班；缺少年份日历时直接报错。

## 1. 目标

将当前“一次性提醒”扩展为“支持循环提醒”，覆盖典型场景：

- 每天 22:00 提醒我做俯卧撑
- 每周一/三/五 20:30 提醒我训练
- 每月 1 号 09:00 提醒我交房租

要求同时支持两种输入路径：

1. 固定输入（命令格式，确定性解析）
2. AI 解析（自然语言输入）

## 2. 约束与原则

- Telegram 发送继续使用 `Telegraf`，不改 `curl`/`fetch`。
- 继续复用已验证的 IPv4 agent 发送链路。
- 不引入重试、fallback、多通道发送、吞错。
- 主路径错误直接暴露，交给日志和进程监管处理。
- 优先使用成熟 npm 库，不手写循环时间计算：
  - 循环规则：`rrule`
  - 时间处理：`dayjs` + `utc` + `timezone`
  - AI 输出校验：`zod`

## 3. 当前状态（基线）

当前代码特点：

- 一次性提醒表：`reminders`
- 调度器：`src/reminders/scheduler.ts`（按 `trigger_at` 单次调度）
- 命令解析：`src/reminders/parser.ts`
- 交互入口：`src/bot/interactive.ts`

现状不具备：

- 循环规则持久化
- 下次触发时间推进
- 循环提醒的暂停/恢复/终止

## 4. 输入设计

## 4.1 固定输入（命令格式）

在现有 `/remind` 下扩展 deterministic 语法（原一次性语法保留）：

1. 每天：
`/remind every day 22:00 做俯卧撑`

2. 每周：
`/remind every week mon,wed,fri 20:30 上肢训练`

3. 每月：
`/remind every month 1 09:00 交房租`

可选中文别名（语义映射到同一结构）：

- `每天` -> `every day`
- `每周` -> `every week`
- `每月` -> `every month`

解析优先级建议：

1. `/remind` 无参数：继续走提醒列表
2. 命中循环 deterministic 语法：创建循环提醒
3. 命中现有一次性 deterministic 语法：创建一次性提醒
4. 其余返回格式错误

## 4.2 AI 解析（自然语言）

自然语言示例：

- `每天晚上10点提醒我做俯卧撑`
- `每周一三五晚上八点半提醒我训练`

AI 只负责输出结构化 JSON，禁止直接决定入库：

```json
{
  "intent": "create_recurring_reminder",
  "recurrence": {
    "freq": "DAILY",
    "byweekday": [],
    "bymonthday": [],
    "time": "22:00",
    "timezone": "Asia/Shanghai"
  },
  "text": "做俯卧撑"
}
```

周频示例：

```json
{
  "intent": "create_recurring_reminder",
  "recurrence": {
    "freq": "WEEKLY",
    "byweekday": ["MO", "WE", "FR"],
    "bymonthday": [],
    "time": "20:30",
    "timezone": "Asia/Shanghai"
  },
  "text": "上肢训练"
}
```

本地必须用 `zod` 做严格校验：

- `intent` 必须是 `create_recurring_reminder`
- `freq` 只允许 `DAILY|WEEKLY|MONTHLY`
- `time` 必须 `HH:mm`
- `WEEKLY` 必须有 `byweekday`
- `MONTHLY` 必须有 `bymonthday(1-31)`
- `text` 非空

校验不通过直接回复：`没有识别到有效的循环提醒格式。`

## 5. 数据模型设计

保留现有 `reminders`（一次性提醒）不动；新增循环规则表和执行记录表。

## 5.1 表：`recurring_reminder_rules`

```sql
CREATE TABLE IF NOT EXISTS recurring_reminder_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  text TEXT NOT NULL,
  timezone TEXT NOT NULL,
  rrule_text TEXT NOT NULL,
  next_trigger_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'cancelled')),
  source TEXT NOT NULL CHECK (source IN ('deterministic', 'ai')),
  source_message_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_triggered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_recur_active_next
ON recurring_reminder_rules(status, next_trigger_at);
```

说明：

- `rrule_text` 存 RFC 规则字符串（`rrule` 库生成）
- `next_trigger_at` 存下次触发绝对时间（ISO）
- `status` 控制生命周期，不删除历史记录

## 5.2 表：`recurring_reminder_runs`

```sql
CREATE TABLE IF NOT EXISTS recurring_reminder_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  trigger_at TEXT NOT NULL,
  sent_message_id INTEGER,
  action TEXT CHECK (action IN ('done', 'skip', 'none')),
  acted_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(rule_id) REFERENCES recurring_reminder_rules(id)
);

CREATE INDEX IF NOT EXISTS idx_recur_runs_rule
ON recurring_reminder_runs(rule_id, trigger_at);
```

说明：

- 用于记录每次触发和用户动作，不影响主调度状态机。

## 6. 调度设计

## 6.1 核心思路

循环提醒不直接注册“无限循环任务”，而是始终只注册“下一次触发”的单次任务：

1. 创建规则后计算 `next_trigger_at`
2. `node-schedule` 仅调度 `next_trigger_at` 这一条
3. 触发后立即计算并持久化下一次时间
4. 再注册下一次单次任务

这样重启恢复、暂停恢复、状态一致性更简单。

## 6.2 触发流程

`onRecurringTrigger(ruleId)`：

1. 读规则，要求 `status='active'`
2. 校验 `next_trigger_at` 与当前触发窗口一致
3. 发送提醒消息（含按钮）
4. 写入 `recurring_reminder_runs`
5. 基于 `rrule_text` 计算下一次触发时间
6. 更新 `next_trigger_at`、`last_triggered_at`
7. 注册下一个单次 job

任一步失败直接抛错，不做吞错继续。

## 6.3 启动恢复

`resident.ts` 启动时新增：

- `schedulePendingRecurringRules(bot)`

流程：

1. 查询 `status='active'` 的规则
2. 对每条规则重新计算 `next_trigger_at`
3. 若计算结果与库中不一致，直接更新为计算值
4. 注册单次 job

规则无法解析（`rrule_text` 非法）时直接报错退出，暴露数据问题。

## 7. 交互设计

## 7.1 创建成功回执

示例：

```text
已创建循环提醒 [固定]
规则：每天 22:00
内容：做俯卧撑
下次：2026-05-09 22:00
```

按钮：

- `暂停循环` -> `recur:pause:<ruleId>`
- `取消循环` -> `recur:cancel:<ruleId>`

## 7.2 到点提醒消息

示例：

```text
循环提醒时间到
做俯卧撑
```

按钮：

- `已完成` -> `recur:done:<runId>`
- `跳过本次` -> `recur:skip:<runId>`
- `停止循环` -> `recur:cancel:<ruleId>`

说明：

- `已完成/跳过本次` 只更新 `runs`，不改变规则激活状态
- `停止循环` 才会把规则置为 `cancelled`

## 8. 模块改造清单

1. `src/reminders/db.ts`
- 新建两张循环表

2. `src/reminders/repository.ts`
- 新增循环规则 CRUD 和 run 记录 API

3. 新增 `src/reminders/recurring.ts`
- `rrule` 构建、下一次触发计算、规则文本化

4. `src/reminders/scheduler.ts`
- 增加循环规则的 schedule map
- 增加 `scheduleRecurringRule` / `cancelRecurringRule`

5. `src/reminders/parser.ts`
- 新增 deterministic 循环语法解析
- 新增 `parseNaturalRecurringReminder()`

6. `src/reminders/formatter.ts`
- 新增循环提醒文案与按钮构建

7. `src/bot/callbacks.ts`
- 扩展 callback_data：`recur:pause|cancel|done|skip`

8. `src/bot/interactive.ts`
- `/remind` 分流到循环/一次性创建
- `message('text')` 对自然语言做循环解析分支
- callback 处理循环动作

## 9. AI Prompt 与协议

建议拆分两个 intent，避免一次性与循环提醒混淆：

- `create_once_reminder`
- `create_recurring_reminder`

循环 intent prompt（示例）：

```text
你是提醒解析器。当前北京时间：2026-05-08 21:00:00。
只输出 JSON，不输出解释。

输入：每天晚上10点提醒我做俯卧撑

输出格式：
{
  "intent": "create_recurring_reminder",
  "recurrence": {
    "freq": "DAILY",
    "byweekday": [],
    "bymonthday": [],
    "time": "22:00",
    "timezone": "Asia/Shanghai"
  },
  "text": "做俯卧撑"
}
```

解析流程建议：

1. deterministic 先尝试
2. deterministic 不命中时再调用 AI
3. AI 输出必须过 `zod`
4. 校验失败直接返回错误文案，不入库

## 10. 实施阶段

## Phase 1：数据层与调度层

- 增加循环表
- 增加 `rrule` 计算工具
- 增加循环 job 注册与重启恢复

验收：

- 手工插入一条 daily 规则可按时触发
- 触发后 `next_trigger_at` 自动推进

## Phase 2：固定输入

- `/remind every day|week|month ...` 创建循环提醒
- 支持暂停/取消

验收：

- `/remind every day 22:00 做俯卧撑` 成功创建并触发
- 暂停后不再触发；恢复后继续触发

## Phase 3：AI 解析

- 文本输入支持循环语义
- 增加 `zod` 校验

验收：

- `每天晚上10点提醒我做俯卧撑` 可创建 daily 规则
- 非法 AI JSON 不入库

## 11. 测试清单

1. 创建 daily 规则：`22:00` 触发正确
2. 创建 weekly 规则：`mon,wed,fri` 仅在对应星期触发
3. 创建 monthly 规则：`1号` 触发正确
4. 重启后规则恢复正常
5. 按钮 `暂停/取消/已完成/跳过本次` 行为正确
6. 同时存在一次性提醒与循环提醒时互不影响
7. 非法输入返回明确错误

## 12. 风险与决策

1. 风险：规则解析与时区偏差
- 决策：统一 `Asia/Shanghai`，使用 `rrule` + `dayjs`，不手写时间推进

2. 风险：AI 输出漂移
- 决策：强约束 JSON + `zod` 校验，不通过就拒绝入库

3. 风险：callback_data 复杂度升高
- 决策：保持短格式（`recur:<action>:<id>`），不把大 payload 放进 callback_data
