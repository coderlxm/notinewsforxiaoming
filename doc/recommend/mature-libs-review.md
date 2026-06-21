# 成熟库替代手写实现专项 Review

<!-- Review date: 2026-06-21 -->

主题：在 2026 年 6 月当下的 Node.js 生态里，存在成熟、维护良好的 npm 库可以直接使用，但项目里用了手写实现或不规范写法的地方。本文只聚焦这一点，不重复 `project-review.md` 里已经覆盖的架构/拆分/兜底问题。

参考约束：`AGENTS.md` 明确「优先使用成熟 npm 库」清单里包含「日期、时区、调度、cron 解析」「Telegram bot 交互」「数据库访问和迁移」「HTML/Markdown 转义或解析」「RSS、HTTP、表单、URL、JSON schema 等通用协议处理」。

---

## 一、高优先级：有成熟库且手写实现有明显短板

### 1.1 HTML 标签剥离 `stripHtml` 用正则

位置：`src/fetchers/english.ts:68`

```ts
function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
```

问题：正则剥 HTML 对嵌套标签、`<script>`/`<style>` 内容、HTML 注释、CDATA、`&amp;` 实体都不处理，RSS 内容里任意一个都会污染英文学习素材。

成熟库选项：
- `he` + `cheerio`：项目已经依赖 `cheerio`，直接 `cheerio.load(input).text()` 就能正确处理实体和标签嵌套，零新增依赖。
- `html-to-text`：专门做 HTML→纯文本，可保留段落换行，对文章类内容更友好。

建议：用已有的 `cheerio.load(input).text()` 替换，或引入 `html-to-text`。

### 1.2 手写"类 Markdown"渲染器 `renderMarkdownLikeAsHtml`

位置：`src/formatters/index.ts:37`

```ts
export function renderMarkdownLikeAsHtml(input: string): string {
  let html = escapeHtml(input);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, ...);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html;
}
```

问题：只覆盖 `[label](url)`、`**bold**`、`` `code` `` 三种语法。AI prompt 里要求输出 Markdown，但遇到列表、标题、斜体、嵌套加粗、`> 引用`、链接标题、`***` 时要么原样显示星号，要么被前面的 `escapeHtml` 转成实体后无法匹配。维护时还要持续加正则。

成熟库选项：
- `marked`：主流 Markdown 解析器，可自定义 renderer 只输出 Telegram HTML 支持的 `<b><i><u><s><a><code><pre>` 子集，其余标签丢弃。
- `markdown-it`：可配置规则，更适合做白名单渲染。
- `telegram-format` / `node-telegram-markdown`：专门处理 Telegram MarkdownV2/HTML 互转，但偏向"把字符串安全塞进 Telegram"，不是"把任意 Markdown 渲染成 Telegram HTML"。

建议：用 `marked` + 自定义 renderer 限制为 Telegram 支持的标签子集。这是当前手写实现真正想做的事，且能覆盖 AI 输出的全部 Markdown 语法。

注意：`summarizeGithubWithAI` 的 prompt 要求"Telegram Markdown"，`summarizeV2exWithAI` 要求"不要输出 HTML 标签"，但最终都走 `renderMarkdownLikeAsHtml` 再以 `parse_mode: 'HTML'` 发送。统一改成"AI 输出标准 Markdown → marked 渲染为 Telegram HTML 子集"可以同时解决 prompt 不一致问题。

### 1.3 手写 GraphQL 客户端 `queryStartgg`

位置：`src/services/startggTracker.ts:486`

```ts
export async function queryStartgg<TData>(query: string, variables: Record<string, unknown>): Promise<TData> {
  const response = await axios.post<GraphqlResponse<TData>>(
    STARTGG_GRAPHQL_ENDPOINT,
    { query, variables },
    { headers: { Authorization: `Bearer ${config.startggApiToken}`, ... }, timeout: 15000 }
  );
  if (response.data.errors && response.data.errors.length > 0) {
    throw new Error(`start.gg GraphQL error: ${response.data.errors[0].message}`);
  }
  if (!response.data.data) {
    throw new Error('start.gg GraphQL returned empty data.');
  }
  return response.data.data;
}
```

问题：手写 axios POST + 手写 `GraphqlResponse<T>` 包装 + 手写 errors 检查 + 手写分页 while 循环（`fetchEventSetsByEntrants`、`fetchEventStandings`、`listEventEntrantPlayers` 等多处复制分页模板）。文件 993 行里很大一部分是这种模板代码。

成熟库选项：
- `graphql-request`：轻量级 GraphQL 客户端，专门做这件事。自带 `Client`、错误聚合（`ClientError`）、超时、自定义 `requestMiddleware`（注入 Bearer token）、TypeScript 泛型。引入后 `queryStartgg` 可以缩成几行，分页可以用 `graphql-request` 的 `fetch` 中间件或直接在调用层写 `while`，但至少错误处理和 headers 不用再手写。

建议：用 `graphql-request` 替换 `queryStartgg` 和 `GraphqlResponse<T>` 包装。Authorization header 用 `Client` 的 `requestMiddleware` 统一注入。

### 1.4 手写 Promise 超时包装 `parseWithTimeout`

位置：`src/fetchers/english.ts:87`

```ts
async function parseWithTimeout(url: string, timeoutMs: number): Promise<Parser.Output<unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms: ${url}`)), timeoutMs);
    parser.parseURL(url)
      .then((parsed) => { clearTimeout(timer); resolve(parsed); })
      .catch((error) => { clearTimeout(timer); reject(error); });
  });
}
```

问题：手写 `Promise + setTimeout + clearTimeout` 竞速，要自己保证两条分支都 clear timer，容易漏。

成熟库选项：
- `p-timeout`：专门做 Promise 超时包装，支持自定义错误类、`clearAndCancel`、AbortSignal。
- Node.js 24 原生 `AbortSignal.timeout(ms)` + `fetch`，但 `rss-parser` 的 `parseURL` 不直接吃 AbortSignal，所以 `p-timeout` 更顺。

建议：用 `pTimeout(parser.parseURL(url), { milliseconds: 10000, message: ... })`。

---

## 二、中优先级：手写实现正确，但成熟库更标准

### 2.1 HTML 转义 `escapeHtml` / `escapeHtmlAttr`

位置：`src/utils/html.ts`

手写 5 字符替换（`& < > " '`），实现正确，覆盖了 Telegram HTML 模式需要的全部转义。被 5 个 formatter 文件、20+ 处调用。

成熟库选项：
- `he`：最成熟的 HTML entity 编解码库，处理命名实体、数字实体、边界情况更全。

判断：borderline。当前实现满足 Telegram HTML 的转义需求（Telegram 只解析 `<b><i><u><s><a><code><pre>`，不需要命名实体）。但 `AGENTS.md` 把「HTML/Markdown 转义或解析」明确列入"优先成熟库"清单。如果未来要处理更复杂的 HTML（比如 AV RSS 里的实体标题），`he` 更稳妥。

建议：低风险可保留；如果要严格遵循 AGENTS.md，换 `he.escape`。

### 2.2 手写 Fisher-Yates 洗牌 `shuffle`

位置：`src/fetchers/english.ts:76`

实现是教科书式 Fisher-Yates，正确性没问题。

成熟库选项：`lodash/shuffle`、`fast-shuffle`。

判断：borderline。引入 `lodash` 整包较重，`lodash/shuffle` 单独引入可以接受。当前实现 10 行，换库收益不大。

建议：保留，或换 `lodash/shuffle` 单入口。

### 2.3 SQLite ad-hoc 迁移

位置：`src/reminders/db.ts:201`（`PRAGMA table_info` 检查列 + `ALTER TABLE`）、`src/services/vitaminReminder.ts:25`（`ensureVitaminColumns` 重复同样的运行时检查）

问题：schema 演进靠"启动时检查列是否存在 → 缺了就 ALTER"，没有版本号、没有可追溯的迁移记录。`vitamin_reminders` 表的 `eaten`/`loop_active`/`next_trigger_at` 三个列都是后加的，靠运行时探测补上。

成熟库选项：
- `better-sqlite3-migrations`：专门为 `better-sqlite3` 设计的迁移库，按 `migrations/*.sql` 文件顺序执行，用 `user_version` pragma 跟踪版本。
- 手写 `user_version` + 迁移数组：`better-sqlite3` 自带 `db.pragma('user_version', { simple: true })`，10 行就能做一个最小迁移器，比当前 ad-hoc 方案更可追溯。
- `knex` migration：重型，不适合这个项目。

判断：borderline。当前表结构已稳定，运行时探测"能跑"。但 AGENTS.md 把「数据库访问和迁移」列入"优先成熟库"清单。

建议：至少改成 `user_version` + 迁移数组，把现有 `ALTER TABLE` 沉淀成可追溯的 v1/v2/v3 迁移；或上 `better-sqlite3-migrations`。

---

## 三、低优先级 / DRY：项目已有成熟库但没统一用

这部分不是"没有成熟库"，而是项目已经引入了 `dayjs`（`src/utils/time.ts`），但多处仍然手写 `Intl.DateTimeFormat.formatToParts` 拼日期，属于"有成熟库却不用"。

### 3.1 多处手写"北京时区 YYYY-MM-DD"

5 处重复实现同一件事：

| 位置 | 函数名 |
|------|--------|
| `src/calendar/chinaWorkday.ts:11` | `chinaDateString(date)` |
| `src/calendar/countdown.ts:29` | `chinaToday()` |
| `src/services/fitness.ts:39` | `chinaDateString()` |
| `src/services/vitaminReminder.ts:9` | `todayKey()` |
| `src/services/v2exBufferedPush.ts:14` | `chinaDateKey(date)` |

都是 `new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', ... }).formatToParts(date)` + 手动拼 `y-m-d`。

项目已有 `src/utils/time.ts` 的 `bjFormat(date, 'YYYY-MM-DD')`（基于 dayjs + timezone 插件），CLAUDE.md 也明确"never hand-write time formatting"。

建议：5 处全部替换为 `bjFormat(date, 'YYYY-MM-DD')`，删除手写函数。`fitness.ts` 里还有 `chinaDateString` 用 `Intl.DateTimeFormat('en-CA')` 拼 `YYYY-MM-DD`，逻辑完全相同。

### 3.2 手写日期算术 `daysBetween` / `nextDate` / `prevDate`

位置：`src/calendar/countdown.ts:44-70`

```ts
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromDate = new Date(Date.UTC(fy!, (fm ?? 1) - 1, fd!));
  const toDate = new Date(Date.UTC(ty!, (tm ?? 1) - 1, td!));
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}
```

手写 `split('-').map(Number)` + `Date.UTC` + `86_400_000` 除法。`nextDate`/`prevDate` 也是手写 UTC 日期加减。

项目已依赖 `dayjs`，应该用：
- `dayjs(to).diff(dayjs(from), 'day')` 替代 `daysBetween`
- `dayjs(date).add(1, 'day').format('YYYY-MM-DD')` 替代 `nextDate`
- `dayjs(date).subtract(1, 'day').format('YYYY-MM-DD')` 替代 `prevDate`
- `dayjs(date).day()` 替代手写 `isWeekend`（`new Date(Date.UTC(...)).getUTCDay()`）

建议：`countdown.ts` 全部日期算术改用 dayjs。

### 3.3 多处重复的 `normalizeUrl`

3 处几乎相同的手写实现：

| 位置 | 行为 |
|------|------|
| `src/formatters/index.ts:25` | `new URL` + 白名单 http/https，失败返回 `'#'` |
| `src/formatters/avFormatter.ts:3` | 同上 |
| `src/formatters/startggFormatter.ts:5` | 同上但失败抛错 |

判断：用 `new URL` 是标准 API，不算"手写库"。但 3 处重复且行为不一致（一个返回 `'#'`、一个抛错）。

成熟库选项：`normalize-url`（但功能超出需求，会做 URL 规范化）。

建议：提取到 `src/utils/url.ts` 共用，统一行为。不一定要引入 `normalize-url`。

---

## 四、已经正确使用成熟库的部分（无需改动）

| 场景 | 库 | 位置 |
|------|----|------|
| RSS 解析 | `rss-parser` | `fetchers/games.ts`、`fetchers/english.ts`、`services/avTracker.ts` |
| Telegram Bot | `telegraf` | `bot/`、`publishers/` |
| 一次性/固定调度 | `node-schedule` | `scheduled/jobs.ts`、`reminders/scheduler.ts` |
| 循环调度规则 | `rrule` | `reminders/recurring.ts` |
| SQLite 访问 | `better-sqlite3` | `reminders/db.ts` 及各 repository |
| HTTP 客户端 | `axios` | `fetchers/`、`services/startggTracker.ts`、`publishers/avTelegram.ts` |
| HTML 解析（AV 内容） | `cheerio` | `services/avContentParser.ts` |
| AI 调用 | `openai` SDK | `ai/client.ts`、`ai/deepseek.ts` |
| 环境变量 | `dotenv` | `config/index.ts` |
| Schema 校验 | `zod` | `reminders/parser.ts`、`services/startggPresetConfig.ts` |
| 时区/格式化（已用库的部分） | `dayjs` + utc + timezone | `utils/time.ts`、`reminders/recurring.ts` |

注意 `src/reminders/recurring.ts` 的 `rrule` 导入写法是线上稳定性敏感点，`AGENTS.md` 明确禁止修改该行导入，本 review 不涉及。

---

## 五、建议落地顺序

1. `stripHtml` 改用已有 `cheerio.load(input).text()`（零新增依赖，立即消除正则剥 HTML 的风险）。
2. `parseWithTimeout` 改用 `p-timeout`（小范围、收益清晰）。
3. `queryStartgg` 改用 `graphql-request`（能显著缩短 `startggTracker.ts` 并统一分页/错误处理）。
4. `renderMarkdownLikeAsHtml` 改用 `marked` + Telegram HTML 白名单 renderer（解决 AI 输出 Markdown 语法覆盖不全的根因）。
5. 5 处 `chinaDateString`/`chinaToday`/`todayKey`/`chinaDateKey` 统一替换为 `bjFormat(date, 'YYYY-MM-DD')`。
6. `countdown.ts` 日期算术改用 dayjs。
7. `normalizeUrl` 提取到 `src/utils/url.ts` 共用。
8. 评估 `escapeHtml` 是否换 `he`、SQLite 迁移是否上 `better-sqlite3-migrations`（borderline，按 AGENTS.md 精神应该换，按风险可以缓）。

---

## 六、不纳入本次 review 的项

- 重复创建 `new OpenAI(...)` 实例（`parser.ts`、`avTracker.ts`、`avContentParser.ts` 没复用 `getDeepSeekClient`）：属于 DRY，已在 `project-review.md` 覆盖，且 `ai/client.ts` 已经提供了正确入口，只是调用方没改。
- `index.ts` 手动 `+8*60*60*1000` 之类的时间计算：已在上份 review 提过，且当前 `index.ts` 已经改用 `bj()`。
- `interactive.ts` 里 `try { ctx.editMessageText } catch { ctx.reply }` 重复模式、`startggwatchlist`/`watchlist` 命令重复：属于 DRY/架构，不是"手写库"问题。
- serverHealth 用 `spawnSync('ssh')`：系统 ssh 命令本身是成熟工具，`ssh2` 纯 Node 库是另一种选择但不是明确更优，不列为推荐替换。
