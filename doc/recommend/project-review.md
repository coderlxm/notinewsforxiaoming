# NotiNewsForXiaoming 项目 Review

<!-- Review date: 2026-06-02 -->

---

## 一、架构与模块组织

### 1.1 大文件拆分

| 文件 | 行数 | 问题 | 建议 |
|------|------|------|------|
| `src/bot/interactive.ts` | 991 | 所有 bot 命令、消息、回调处理挤在一个文件 | 按功能域拆：`interactive/remind.ts`、`interactive/startgg.ts`、`interactive/vitamin.ts`、`interactive/common.ts` |
| `src/services/startggTracker.ts` | 767 | GraphQL 查询定义 + 响应类型 + 数据获取 + 状态计算 + 变更检测混在一起 | 拆为 `startgg/api.ts`（GraphQL 层）、`startgg/status.ts`（状态计算）、`startgg/player.ts`（选手相关），`tracker.ts` 保留编排逻辑 |
| `src/ai/deepseek.ts` | 391 | 8 个 AI 函数全部在一个文件，每个函数独立创建 OpenAI 实例 | 共用 OpenAI client 实例；按场景拆分（可选） |

### 1.2 `runMode.ts` 的 if/else-if 链

`src/scheduled/runMode.ts:57-181` 用 11 个 `if` 分支 + 1 个隐式 fallthrough 处理 12 种推送模式。

- `english` 模式没有 `if (mode === 'english')` 显式分支，靠代码末尾 fallthrough 实现，新增模式容易破坏。
- 建议改为 strategy map 或函数查找表：

```ts
const modeHandlers: Record<PushMode, (dayOfWeek: number, bot?: Telegraf) => Promise<void>> = {
  sleep: handleSleep,
  wakeup: handleWakeup,
  // ...
};

export async function runMode(mode: PushMode, dayOfWeek: number, bot?: Telegraf) {
  const handler = modeHandlers[mode];
  if (!handler) throw new Error(`Unknown mode: ${mode}`);
  await handler(dayOfWeek, bot);
}
```

### 1.3 定时调度分散在两处

`src/index.ts:10-27` 的 `SPECIAL_SCHEDULE` 和 `src/scheduled/jobs.ts` 的 `registerFixedJobs` 定义了两份相同的调度时间表，修改时容易遗漏。

建议：抽象出一份统一的 schedule 配置，两个入口共享。

---

## 二、代码质量与 DRY

### 2.1 重复代码

| 位置 | 重复内容 |
|------|----------|
| `interactive.ts:451-466` `startggwatchlist` / `interactive.ts:468-483` `watchlist` | 两个命令实现完全相同 |
| `interactive.ts` 中 20+ 处 | `replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')` HTML 转义模式重复出现 |
| `interactive.ts` 中所有 bot 命令 | `try { ... } catch (e) { if (e instanceof Error) { await ctx.reply(...); return; } throw e; }` 模式重复 |
| `src/ai/deepseek.ts` 中 9 个函数 | `model: 'deepseek-v4-flash'` 硬编码 |
| `src/ai/deepseek.ts` 中 8 个函数 | `new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: config.deepseekApiKey })` 重复创建实例 |

### 2.2 建议改动

**提取公共 HTML 转义函数：**

```ts
// src/utils/html.ts
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

**提取 bot 命令错误处理包装器：**

```ts
// src/bot/helpers.ts
export function withErrorReply(ctx: Context, label: string, fn: () => Promise<void>): Promise<void> {
  return fn().catch(e => {
    if (e instanceof Error) {
      ctx.reply(`${label}失败：${e.message}`, { parse_mode: 'HTML' });
      return;
    }
    throw e;
  });
}
```

**提取 OpenAI 实例工厂：**

```ts
// src/ai/client.ts
import OpenAI from 'openai';
import { config } from '../config';

let client: OpenAI | null = null;

export function getDeepSeekClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: config.deepseekApiKey,
    });
  }
  return client;
}

export const DEEPSEEK_MODEL = 'deepseek-v4-flash';
```

### 2.3 无测试代码

`package.json` 中 `test` 脚本是空壳。个人 bot 项目不需要完整的测试套件，但关键路径——reminder 解析器（`parser.ts` 的确定性匹配函数）、时间计算（`recurring.ts`）——值得加上断言式的单元测试，避免回归。

---

## 三、AI 集成

### 3.1 错误处理策略不一致

绝大多数 AI 函数静默捕获错误并返回降级数据（如 `summarizeNewsWithAI` 返回原始新闻列表，`generateLifeTipWithAI` 返回一段预设文字）。这种策略对用户体验友好但违反 AGENTS.md 的「不主动兜底」原则。

建议：评估每个 AI 调用的重要性，决定直接抛错 vs 静默降级，并给出一致策略。

### 3.2 缺少用量监控

每天数十次 AI 调用（news、github、v2ex、english × 3、fitness × 2-3、reminder 解析），没有任何 token 用量统计或费用监控。建议在 `getDeepSeekClient()` 中加一层 wrapping，统计每日 token 用量，作为 bot 定期健康汇报的一部分（如汇总在 `server_health` 里）。

### 3.3 部分 Prompt 中要求 Markdown 但实际发送用 HTML

`summarizeGithubWithAI` (deepseek.ts:84) prompt 要求输出 Telegram Markdown，但 `sendTelegramMessage` 实际使用 `parse_mode: 'HTML'`。`summarizeV2exWithAI` 要求「不要输出任何 HTML 标签」但最终也会被 HTML 模式渲染。考虑统一为一种格式或做转换。

---

## 四、数据库与存储

### 4.1 无迁移机制

所有表通过 `CREATE TABLE IF NOT EXISTS` 创建，后续新增列通过 `ALTER TABLE ... ADD COLUMN` 在运行时处理（`vitaminReminder.ts:25-41`、`db.ts:171-175`）。这在个人项目中可以跑，但缺乏可追溯性。

建议：使用 `better-sqlite3` 自带的 `user_version` pragma 做一个简单的版本号迁移：

```ts
const currentVersion = db.pragma('user_version', { simple: true }) as number;
const migrations: Record<number, string[]> = {
  0: [`CREATE TABLE reminders ...`, ...],
  1: [`ALTER TABLE push_history ADD COLUMN cover_sent ...`],
  // ...
};
```

### 4.2 混合存储策略

部分数据用 SQLite（提醒、追踪目标），部分用 JSON 文件（fitness 状态、server health targets、startgg tournament windows）。这不是原则性错误，但 JSON 文件没有并发安全，且 schema 改动没有类型安全。如果数据量不大，统一到 SQLite 可能更简洁。

### 4.3 历史数据无清理

`push_history`、`push_batch_history`、`startgg_watch_snapshots` 等表会持续增长。建议加入简单的清理逻辑（如保留最近 30 天的记录），避免 SQLite 文件无限膨胀。

---

## 五、提醒系统

### 5.1 `/remind` 指令路径与自然语言路径重复

`interactive.ts:485-560` 的 `/remind` 命令和 `interactive.ts:562-638` 的 text message handler 各自独立处理提醒创建，逻辑有重叠（创建 reminder + schedule + reply + set source message id）。可提取为 `createAndScheduleReminder()` 共用函数。

### 5.2 DeepSeek 自然语言解析成本

`parseNaturalReminder`（`parser.ts:204`）在确定性正则匹配失败后会调用 DeepSeek AI。对于简单的「20分钟后提醒我喝水」这种表达，本可以通过更丰富的正则处理，但每次都走 AI。建议：

- 扩充 `parseChineseRelative` 的正则覆盖
- 仅对无法匹配的输入调用 AI

### 5.3 预设提醒扩展

`presets.ts` 目前有 6 个预设，格式固定为 emoji+label。建议允许用户通过 bot 命令 `/preset add <label> <minutes> <text>` 自定义预设，写入 SQLite 而非硬编码。

---

## 六、错误处理与 resilience

### 6.1 serverHealth 的重试

`serverHealth.ts:117` 的 `probeServerWithRetry` 对 SSH 探测做了一次重试。AGENTS.md 明确规定「严禁任何兜底，包括重试」。该功能可能已获用户明确同意，但应加注释说明。

### 6.2 AV 源站健康监控存在兜底逻辑

`avTracker.ts:379-398` 在双路失败时发送全局告警，但使用 `AV_SOURCE_ALERT_INTERVAL_MS`（6 小时）的速率限制来避免刷屏。这本身合理，但 `maybeSendGlobalFailureAlert` 的 `failures.length < 2` 早返回 + 间隔检查算防御逻辑，建议加入注释说明业务意图。

### 6.3 无 Bot 进程健康检查

resident bot 是一个长驻进程，目前没有任何自检手段。如果 bot 静默退出（不被 systemd 捕获的异常），用户会丢失所有提醒。建议：

- 定时（如每 30 分钟）给自己发一条心跳消息（可设为 `server_health` 模式的一部分）。
- 或利用 Telegram 的 `setMyCommands` / webhook 健康端点。

---

## 七、配置与环境

### 7.1 硬编码路径

| 位置 | 硬编码值 |
|------|----------|
| `serverHealth.ts:25` | `/root/.ssh/notinews_health_ed25519` |
| `serverHealth.ts:69` | `-l root` |
| `serverHealth.ts:71` | `hostname && uptime -p` |
| `avTracker.ts:206` | `http://localhost:1200/${route}` |

建议将这些值移入 environmental config 或至少放在文件顶部常量区。

### 7.2 时区字符串

项目中大量出现 `'Asia/Shanghai'` 字面量（`jobs.ts`、`index.ts`、`parser.ts`、`recurring.ts`）。`src/utils/time.ts` 已有 `TZ` 常量，但未统一引用。

### 7.3 `.env` 中的敏感信息

`.env` 文件包含真实 token，`.gitignore` 已有排除，但需确认库中没有历史提交包含这些值。

---

## 八、功能建议

### 8.1 健身训练的完成确认

当前 fitness 模式生成训练计划后仅更新 `markFitnessWorkoutGenerated`（记录已生成），但不知道用户是否实际完成训练。可加入「完成训练」inline 按钮，点击后更新 `data/fitness_status.json` 中的实际训练日期和完成次数。

### 8.2 V2EX 假期缓冲上限

如果一个长假期（如国庆 7 天）每天缓存 V2EX 话题，第一个工作日会推送大量累积内容。建议加一个简单上限（如每个节假日最多 3 天，或总条目数上限 100）。

### 8.3 个人打卡提醒

`remind` 命令支持一次性 + 循环提醒，再加一个「打卡型」提醒（如每天睡前总结）可以对标 `fitness` 和 `vitamin` 的完成追踪，但保持通用化。目前可以通过循环提醒 + done 按钮近似实现。

### 8.4 重启后提醒恢复的健壮性

`schedulePendingReminders` 和 `schedulePendingRecurringRules` 恢复 pending 提醒，但对于已经触发但 bot 已停止的提醒（触发时 bot 不在线），不会重发。建议在启动时检查 `trigger_at < now() AND status = 'pending'` 的提醒并立即触发（或标记为 missed，发通知给用户）。

---

## 九、小问题与修整

| 位置 | 问题 | 建议 |
|------|------|------|
| `runMode.ts:175` | english 模式依赖 if/else-if 链的 fallthrough | 显式检查 `mode === 'english'` |
| `index.ts:39-40` | 手动计算北京时间 (`+8*60*60*1000`) | 改用 `src/utils/time.ts` 的 `bj()` / `getChinaDayOfWeek()` |
| `index.ts:60` | `selectedMode` 默认值是 `'english'` | 这意味着不在任何 schedule 时间窗口时会执行 english 模式，这可能是「default」行为但容易误导 |
| `avTracker.ts:52` | `const parser = new Parser()` 是模块级单例 | 没问题，但模块加载时即创建 |
| `vitaminReminder.ts:32-41` | `ensureVitaminColumns()` 使用了 `ALTER TABLE` 但依赖运行时检查 | 已工作但属于 ad-hoc migration → 见 4.1 建议 |
| `telegram.ts:21` | 无 bot 实例时创建临时 `new Telegraf()` | 每次发送都创建新实例 + HTTPS agent，可复用 |
| `startggTracker.ts:714` | 双循环遍历所有 player × event 进行状态比对 | 每次 20 分钟检查都拉全量数据，考虑加短缓存（如 5 分钟内的快照不重复拉取） |
| `interactive.ts:709` | `ctx.deleteMessage()` 的 catch 块为空 | 吞错误属于兜底，注释说明什么情况下会失败即可 |

---

## 十、总结优先级

### 高优先级（影响正确性或大量重复劳动）

1. **提取 OpenAI client 共用实例**（省去 8 次重复创建）
2. **AI 模型名提取为常量**（避免未来改名时改 9 处）
3. **`startggwatchlist` / `watchlist` 去重**
4. **`interactive.ts` HTML 转义函数提取**
5. **`index.ts` 时间计算改用 `utils/time.ts`**

### 中优先级（改善可维护性）

6. **`interactive.ts` 按功能拆分文件**
7. **`runMode.ts` if/else-if 链改为 strategy map**
8. **统一 schedule 配置（`SPECIAL_SCHEDULE` 与 `jobs.ts` 合并）**
9. **bot 命令错误处理统一包装**
10. **添加简易 DB migration 机制**

### 低优先级（体验优化）

11. AI 调用 token 用量统计
12. 健身计划完成确认按钮
13. 历史数据定期清理
14. 预设提醒可自定义
15. Bot 进程自检/heartbeat
