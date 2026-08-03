# 交互式 Telegram Bot 架构开发文档

## 1. Review 结论

原方案的目标方向是对的：如果未来要把 NotiNewsForXiaoming 从“定时推送脚本”升级为“可交互式个人 bot”，核心变化确实是让进程常驻、接收 Telegram update、把动态提醒持久化，并用 Telegraf 的 inline keyboard 承载简单操作。

但原方案有三个需要修正的点：

1. 不建议第一步就把现有所有系统 Cron 任务迁入 Node 内部调度。当前主路径已经能稳定推送，迁移应先增加交互入口，再逐步接管固定任务。
2. 不应使用 Telegraf 内存 session 保存任何重要业务状态。Telegraf 默认 session 是进程内存，重启即丢；提醒、按钮动作、待确认上下文都必须以 SQLite 为准。
3. 不能增加发送兜底、重试、替代通道或静默吞错。交互 bot 仍必须保持 Telegraf 主链路，并复用当前已验证的 IPv4 `https.Agent`。

因此本文档不是简单完善原方案，而是给出一份可落地的开发步骤：先拆出稳定的 bot 实例，再引入常驻交互入口，然后增加 SQLite 提醒中枢，最后再决定是否把固定推送任务迁入常驻进程。

## 2. 设计原则

- 继续使用 `Telegraf`，不改成 `fetch`、`curl` 或多通道发送。
- Telegram 网络路径继续使用 IPv4 agent：

```ts
const telegramAgent = new https.Agent({
  family: 4,
  keepAlive: false
});
```

- 主路径出错直接抛出，让 `systemd` 看到进程失败并重启或报警。
- 不做重试、不做 fallback、不吞错、不返回默认成功。
- 所有业务状态写入 SQLite；内存调度器只保存“下一次要执行什么”。
- 个人 bot 初期只支持 `.env` 中的 `TG_CHAT_ID`，不做多用户系统。
- 交互能力优先走明确命令和按钮，自然语言解析放在主路径跑通后再接入。

## 3. 技术选型

### 3.1 Telegram 框架

使用当前项目已有的 `telegraf`。

截至 2026-05，npm `telegraf` 的 latest 仍是 `4.16.3`，项目也已经依赖该版本。Telegraf v4 支持 TypeScript、long polling、webhook、middleware、inline keyboard，并且文档明确提供 `bot.launch()` 和 `bot.stop()` 的常驻进程写法。

本项目先使用 long polling：

- 部署简单，不需要公网 HTTPS webhook。
- 个人 bot update 量很低，long polling 成本可忽略。
- 与当前服务器形态更贴近。

不在第一版引入 webhook。

### 3.2 调度器

使用 `node-schedule`。

原因：

- 动态提醒需要按某个绝对 `Date` 触发，`node-schedule` 直接支持一次性时间点。
- 固定任务也可用 RecurrenceRule，并支持 `tz`。
- 项目需要的是单进程个人 bot，不需要 BullMQ、Redis、Temporal、Inngest 这类分布式任务系统。

固定任务迁入常驻进程时，统一使用 `Asia/Shanghai` 时区。

### 3.3 数据库

使用 `better-sqlite3`。

原因：

- 单文件数据库，部署成本低。
- 同步 API 简单，符合个人 bot 的低并发场景。
- 支持事务，提醒写入和状态变更可以保持直接清晰。
- 官方建议可开启 WAL，本项目可以在数据库初始化时执行 `PRAGMA journal_mode = WAL`。

### 3.4 AI 解析

继续复用当前 `src/ai/deepseek.ts` 的 OpenAI SDK + DeepSeek baseURL 方式。

动态提醒第一版不要从自由闲聊开始，应先实现确定性命令入口：

- `/remind 2026-05-08 15:30 开会`

自然语言输入，例如“提醒我 10 分钟后收衣服”，作为第二阶段接入。这样可以先验证 Telegram 交互、SQLite 持久化和内存调度主路径，再引入 AI 解析的不确定性。

## 4. 目标架构

```text
src/
  bot/
    createBot.ts              # 创建唯一 Telegraf 实例，配置 IPv4 agent
    interactive.ts            # 注册消息、命令、callback_query
    auth.ts                   # TG_CHAT_ID 权限检查
    callbacks.ts              # 解析 callback_data
  reminders/
    repository.ts             # SQLite CRUD
    scheduler.ts              # node-schedule 注册和取消
    parser.ts                 # 命令解析 + 自然语言解析
    formatter.ts              # 提醒创建/触发/按钮文案
  scheduled/
    jobs.ts                   # 未来承接固定推送任务
  publishers/
    telegram.ts               # 保留 sendTelegramMessage，改为复用 bot.telegram
  index.ts                    # 现有一次性任务入口，保持测试模式可用
  resident.ts                 # 新增常驻 bot 入口
```

迁移完成后的运行形态：

```text
systemd
  └── pnpm start:bot
        ├── Telegraf long polling 接收消息
        ├── node-schedule 执行动态提醒
        ├── SQLite 保存提醒状态
        └── 可选：内部固定任务调度
```

## 5. 数据库设计

数据库文件建议放在：

```text
data/notinews.sqlite
```

新增 `reminders` 表：

```sql
CREATE TABLE reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  text TEXT NOT NULL,
  trigger_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'cancelled')),
  created_at TEXT NOT NULL,
  done_at TEXT,
  cancelled_at TEXT,
  source_message_id INTEGER,
  sent_message_id INTEGER
);

CREATE INDEX idx_reminders_pending_trigger_at
ON reminders(status, trigger_at);
```

字段说明：

- `trigger_at` 使用 ISO 字符串，统一保存北京时间解析后的绝对时间。
- `status` 初期只保留 `pending`、`done`、`cancelled`。
- `source_message_id` 记录用户创建提醒的 Telegram 消息。
- `sent_message_id` 记录提醒触发后发送出的消息，方便后续编辑按钮状态。

不要先加复杂字段：

- 不加重复规则。
- 不加多用户 profile。
- 不加执行日志表。
- 不加失败次数。
- 不加死信队列。

这些都不是第一版主路径必需。

## 6. Telegram Bot 主路径

### 6.1 创建唯一 Telegraf 实例

当前 `sendTelegramMessage()` 每次发送都会 new 一个 `Telegraf`。改成交互式 bot 后，应创建唯一实例：

```ts
// src/bot/createBot.ts
import https from 'https';
import { Telegraf } from 'telegraf';
import { config } from '../config';

const telegramAgent = new https.Agent({
  family: 4,
  keepAlive: false
});

export function createBot(): Telegraf {
  if (!config.tgToken) {
    throw new Error('TG_TOKEN is not set.');
  }

  return new Telegraf(config.tgToken, {
    telegram: {
      agent: telegramAgent
    }
  });
}
```

`src/publishers/telegram.ts` 后续改为接收 bot 实例或导出基于共享实例的发送函数。目标是所有发送都走同一个 Telegraf 配置。

### 6.2 权限检查

只允许 `.env` 中的 `TG_CHAT_ID` 与 bot 交互：

```ts
if (String(ctx.chat?.id) !== config.tgChatId) {
  return;
}
```

这里的 `return` 是授权分支，不是业务失败兜底。未授权消息不进入业务主路径。

### 6.3 启动入口

新增 `src/resident.ts`：

```ts
import { createBot } from './bot/createBot';
import { registerInteractiveHandlers } from './bot/interactive';
import { schedulePendingReminders } from './reminders/scheduler';

async function main() {
  const bot = createBot();
  registerInteractiveHandlers(bot);
  schedulePendingReminders(bot);

  bot.launch({
    allowedUpdates: ['message', 'callback_query'],
    dropPendingUpdates: false
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch(error => {
  console.error('Resident bot encountered an error:', error);
  process.exit(1);
});
```

说明：

- `allowedUpdates` 只开当前需要的 update 类型。
- `dropPendingUpdates: false` 保持 Telegram update 主路径完整，不主动丢弃积压消息。
- 不加 `bot.catch()` 吞错。Telegraf 默认错误处理会重新抛出，符合本项目原则。

### 6.4 package scripts

保留现有一次性任务入口：

```json
{
  "scripts": {
    "start": "tsx src/index.ts",
    "start:bot": "tsx src/resident.ts"
  }
}
```

`TEST_MODE_ENABLED=1 TEST_FORCE_MODE=<mode> pnpm start` 继续用于验证现有推送任务。

## 7. 提醒创建链路

### 7.1 第一版命令格式

先实现确定性命令：

```text
/remind 2026-05-08 15:30 开会
/remind 10m 收衣服
/remind 2h 看日志
```

解析规则：

- `YYYY-MM-DD HH:mm`：按北京时间解析。
- `10m`：当前时间加 10 分钟。
- `2h`：当前时间加 2 小时。

解析失败直接回复明确错误：

```text
格式不正确。示例：/remind 2026-05-08 15:30 开会
```

这是用户输入校验，不是系统失败兜底。

### 7.2 入库与调度

创建提醒的主路径：

1. 校验 `chat_id`。
2. 解析提醒时间和内容。
3. 写入 `reminders`。
4. 用 `node-schedule.scheduleJob(new Date(triggerAt), handler)` 注册一次性任务。
5. 回复创建成功消息，并带取消按钮。

成功回执：

```text
已创建提醒
时间：2026-05-08 15:30
内容：开会
```

按钮：

```text
[取消提醒]
```

`callback_data`：

```text
reminder:cancel:<id>
```

### 7.3 触发提醒

调度器到点后：

1. 根据 `id` 查询数据库。
2. 要求状态必须是 `pending`。
3. 用 `bot.telegram.sendMessage(chatId, message, extra)` 发送提醒。
4. 写入 `sent_message_id`。

提醒消息：

```text
提醒时间到

开会
```

按钮：

```text
[已完成] [推迟 5 分钟]
```

`callback_data`：

```text
reminder:done:<id>
reminder:snooze5:<id>
```

### 7.4 按钮动作

`已完成` 主路径：

1. 校验 `chat_id`。
2. 解析 callback data。
3. 将提醒状态从 `pending` 更新为 `done`。
4. 编辑原消息按钮或回复一条完成确认。

`推迟 5 分钟` 主路径：

1. 校验 `chat_id`。
2. 解析 callback data。
3. 将原提醒的 `trigger_at` 更新为当前时间 + 5 分钟，状态保持 `pending`。
4. 取消旧内存 job，并注册新的内存 job。
5. 回复新的提醒时间。

这里的“推迟”是用户显式交互，不属于失败兜底。

## 8. 启动恢复策略

进程启动时执行：

```sql
SELECT * FROM reminders
WHERE status = 'pending'
ORDER BY trigger_at ASC;
```

处理规则：

- `trigger_at` 在未来：注册内存调度任务。
- `trigger_at` 已经过期：直接抛出错误并退出。

不做静默跳过，也不自动补发过期提醒。过期 pending 提醒说明进程停机、部署或系统时间存在问题，应回到根因排查。

## 9. 固定推送任务迁移

固定推送任务不要在第一阶段迁移。推荐阶段如下：

### Phase 1：新增交互入口，不动现有定时任务

目标：

- `pnpm start` 仍是现有一次性任务入口。
- 新增 `pnpm start:bot` 常驻入口。
- bot 能响应 `/start`、`/help`、`/remind`。
- 动态提醒可以创建、触发、完成、推迟。

验证：

```bash
pnpm start:bot
```

Telegram 内发送：

```text
/remind 2m 测试提醒
```

预期：

- 立即收到创建成功。
- 2 分钟后收到提醒。
- 点击 `已完成` 后数据库状态变为 `done`。

### Phase 2：接入自然语言提醒解析

目标：

- 支持“10 分钟后提醒我收衣服”。
- 支持“明天下午 3 点提醒我开会”。
- AI 只负责输出结构化 JSON，不直接决定数据库写入。

Prompt 要求：

```text
你是提醒解析器。当前北京时间：2026-05-07 21:10:00。
只输出 JSON，不输出解释。

输入：10 分钟后提醒我收衣服

输出格式：
{
  "intent": "create_reminder",
  "trigger_at": "2026-05-07T21:20:00+08:00",
  "text": "收衣服"
}
```

AI 输出必须经过本地 JSON parse 和字段校验：

- `intent` 必须是 `create_reminder`。
- `trigger_at` 必须能解析成未来时间。
- `text` 必须非空。

校验不通过时向用户回复“没有识别到有效提醒时间”，不入库。

### Phase 3：迁移固定任务到常驻进程

只有 Phase 1 和 Phase 2 稳定后，再考虑迁移当前 `src/index.ts` 中的固定任务。

迁移方式：

1. 从 `src/index.ts` 中抽出 `runMode(mode, chinaDayOfWeek)` 到独立模块，例如 `src/scheduled/runMode.ts`。
2. `src/index.ts` 继续调用该模块，保持 `TEST_MODE_ENABLED` 测试入口不变。
3. `src/resident.ts` 使用 `node-schedule` 注册固定任务。
4. 每个固定任务仍然调用同一套 `runMode`。

固定任务建议规则：

```text
00:10 sleep
08:30 wakeup
09:10 server_health
09:55 news
12:30 vitamin
15:00 github
18:30 vitamin
20:00 v2ex
20:30 fitness 周一/周三
14:00 fitness 周六
```

所有规则必须指定：

```ts
tz: 'Asia/Shanghai'
```

迁移完成后再停用系统 Cron。不要同时保留系统 Cron 和内部定时器执行同一任务。

## 10. 文件级实施步骤

### Step 1：安装依赖

```bash
pnpm add node-schedule better-sqlite3
pnpm add -D @types/node-schedule @types/better-sqlite3
```

### Step 2：新增数据库模块

新增：

```text
src/reminders/db.ts
src/reminders/repository.ts
```

`db.ts` 负责：

- 打开 `data/notinews.sqlite`。
- 执行 `PRAGMA journal_mode = WAL`。
- 创建 `reminders` 表。

`repository.ts` 负责：

- `createReminder(input)`
- `findPendingReminders()`
- `findReminderById(id)`
- `markReminderDone(id)`
- `cancelReminder(id)`
- `updateReminderTriggerAt(id, triggerAt)`
- `setSentMessageId(id, messageId)`

每个函数只做一件事；数据库错误直接抛出。

### Step 3：新增调度模块

新增：

```text
src/reminders/scheduler.ts
```

职责：

- 维护 `Map<number, schedule.Job>`。
- `scheduleReminder(bot, reminder)` 注册单个提醒。
- `cancelScheduledReminder(id)` 取消内存任务。
- `schedulePendingReminders(bot)` 启动时加载所有 pending 提醒。

注意：

- Map 只是内存索引，不是状态来源。
- 状态来源永远是 SQLite。
- 到点后必须重新查库确认状态。

### Step 4：新增解析模块

新增：

```text
src/reminders/parser.ts
```

第一版只实现确定性解析：

- `/remind YYYY-MM-DD HH:mm text`
- `/remind <number>m text`
- `/remind <number>h text`

第二版再加入：

- `parseNaturalReminder(text, now)`
- DeepSeek 结构化 JSON 输出

### Step 5：新增格式化模块

新增：

```text
src/reminders/formatter.ts
```

职责：

- 创建成功消息。
- 到点提醒消息。
- 取消确认消息。
- 推迟确认消息。
- inline keyboard 构造。

保持 HTML parse_mode。如果文案包含用户输入，必须做 HTML escape；这是主路径格式正确性要求，不是发送失败兜底。

### Step 6：新增 bot 模块

新增：

```text
src/bot/createBot.ts
src/bot/auth.ts
src/bot/callbacks.ts
src/bot/interactive.ts
```

`interactive.ts` 注册：

- `/start`
- `/help`
- `/remind`
- `bot.on(message('text'))`
- `bot.on('callback_query')`

文本消息第一阶段只处理 `/remind`，不要做闲聊。

### Step 7：新增常驻入口

新增：

```text
src/resident.ts
```

并在 `package.json` 添加：

```json
"start:bot": "tsx src/resident.ts"
```

### Step 8：本地验证

先验证现有主路径没坏：

```bash
TEST_MODE_ENABLED=1 TEST_FORCE_MODE=server_health pnpm start
```

再验证交互 bot：

```bash
pnpm start:bot
```

Telegram 中执行：

```text
/start
/help
/remind 2m 测试提醒
```

检查数据库：

```bash
sqlite3 data/notinews.sqlite 'select id, text, trigger_at, status from reminders order by id desc limit 5;'
```

### Step 9：服务器部署

新增 systemd service：

```ini
[Unit]
Description=NotiNews Interactive Telegram Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/path/to/NotiNewsForXiaoming
Environment=NODE_ENV=production
ExecStart=/path/to/pnpm start:bot
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

说明：

- `Restart=on-failure` 是进程监管，不是代码内重试。
- 不在代码里捕获错误后继续跑。
- systemd 负责让主路径失败显性化。

## 11. 开发验收清单

Phase 1 完成标准：

- `pnpm start` 原有测试模式可用。
- `pnpm start:bot` 能启动 long polling。
- 未授权 chat 不进入业务逻辑。
- `/remind 2m 测试` 能创建 SQLite 记录。
- 到点后 Telegram 收到提醒。
- 点击 `已完成` 后记录变为 `done`。
- 点击 `推迟 5 分钟` 后 `trigger_at` 更新，并能再次触发。
- 进程重启后，未来 pending 提醒会重新注册。
- 过期 pending 提醒不会静默跳过或自动补发。

Phase 2 完成标准：

- 自然语言提醒能解析成结构化 JSON。
- AI 输出不合法时不入库。
- `/remind` 确定性命令仍可用。
- 不引入闲聊主路径。

Phase 3 完成标准：

- 固定任务迁入 `src/scheduled`。
- `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=<mode> pnpm start` 仍可验证每个业务模式。
- 系统 Cron 与内部定时器不会重复执行同一任务。
- `server_health` 仍按北京时间 09:10 执行。
- Telegram 发送仍走 Telegraf IPv4 agent。

## 12. 参考依据

- Telegraf v4 文档与 README：`bot.launch()`、long polling、graceful stop、TypeScript 支持、inline keyboard。
- Telegraf session 文档：默认 session 只保存在内存中，进程终止会丢失。
- `node-schedule` 文档：支持一次性 `Date` 调度、recurrence rule、timezone 和 graceful shutdown。
- `better-sqlite3` 文档：同步 API、事务、WAL、适合轻量 SQLite 使用场景。
