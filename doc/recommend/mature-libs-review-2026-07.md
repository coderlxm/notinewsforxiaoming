# 成熟库 / 最新实现替代手写实现复查报告

<!-- Review date: 2026-07-05 -->

主题：复查当前项目里，是否还存在适合用成熟 npm 库或现有更标准实现替代的手写代码。

说明：

- 这份报告只看“当前状态”。
- 2026-06-21 那份 [mature-libs-review.md](./mature-libs-review.md) 里提到的部分问题已经落地，本报告不重复把已修复项当成问题。
- 结论优先按“收益 / 风险 / 与 `AGENTS.md` 的契合度”排序。

---

## 一、结论

当前项目里，之前最明显的三类“已有成熟库但仍手写”的问题已经基本收敛：

- Markdown 渲染：已经从手写正则切到 `marked`，见 `src/utils/telegramMarkdown.ts`
- Promise 超时包装：已经从手写 `Promise + setTimeout` 切到 `p-timeout`，见 `src/fetchers/english.ts`
- start.gg GraphQL 客户端：已经切到 `graphql-request`，见 `src/services/startgg/client.ts`

所以当前剩下的替代机会，主要集中在下面 4 类：

1. 日期 / 时区处理仍有多处手写重复，应该统一收敛到已引入的 `dayjs + timezone`
2. SQLite schema 迁移仍然是 ad-hoc 运行时探测，应该升级到显式迁移机制
3. URL 归一逻辑在多个 formatter 里重复，应该提成共用 util
4. HTML entity 转义仍然是手写实现，可选地换成成熟库 `he`

其中前两项值得优先处理；后两项属于中低优先级整理项。

---

## 二、高优先级

### 2.1 日期 / 时区仍有多处手写，项目里其实已经有现成 `dayjs` 工具

当前项目已经有：

- `src/utils/time.ts`
  - `bj(input?)`
  - `bjFormat(input, format)`
  - `getChinaDayOfWeek()`

但下面这些位置仍在手写“北京时间 YYYY-MM-DD”或手写日期算术：

- `src/calendar/chinaWorkday.ts:11`
- `src/calendar/countdown.ts:29`
- `src/calendar/countdown.ts:44`
- `src/calendar/countdown.ts:52`
- `src/calendar/countdown.ts:62`
- `src/services/vitaminReminder.ts:9`
- `src/services/fitness.ts:39`
- `src/services/v2exBufferedPush.ts:13`

典型问题：

```ts
const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).formatToParts(date);
```

以及：

```ts
const [fy, fm, fd] = from.split('-').map(Number);
const fromDate = new Date(Date.UTC(fy!, (fm ?? 1) - 1, fd!));
```

问题不在“对不对”，而在：

- 重复实现太多
- 同类逻辑已经有统一工具却没复用
- `countdown.ts` 这种日期加减 / diff 已经超出“简单格式化”，继续手写可维护性明显变差

更合适的替代：

- 统一用已有 `bjFormat(date, 'YYYY-MM-DD')`
- `daysBetween` 改成 `dayjs(to).diff(dayjs(from), 'day')`
- `nextDate` / `prevDate` 改成 `dayjs(date).add(1, 'day')` / `subtract(1, 'day')`
- `isWeekend` 改成 `dayjs(date).day()`

结论：这不是“要不要再引库”的问题，而是“项目已经有成熟实现却还没统一收口”。这一项是当前最值得收敛的手写重复。

### 2.2 SQLite schema 迁移仍然是 ad-hoc 运行时探测

相关位置：

- `src/reminders/db.ts:201`
- `src/reminders/db.ts:207`
- `src/services/vitaminReminder.ts:25`

当前做法是：

- `PRAGMA table_info(...)`
- 看列在不在
- 不在就 `ALTER TABLE ... ADD COLUMN`
- 特殊表结构变更则直接在启动时跑一段 SQL 迁移

典型代码：

```ts
const pushHistoryColumns = db.prepare(`PRAGMA table_info(push_history)`).all();
if (!hasCoverSent) {
  db.exec(`ALTER TABLE push_history ADD COLUMN cover_sent INTEGER NOT NULL DEFAULT 0;`);
}
```

以及：

```ts
if (needsTrackedTargetsMigration) {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS tracked_targets_new;
    BEGIN;
    ...
  `);
}
```

问题：

- schema 演进分散在多个文件里
- 没有版本号，也没有迁移历史
- 运行时探测式迁移很难回溯
- 这类逻辑前不久已经实打实出现过线上迁移问题，说明风险不是理论上的

更合适的替代：

- 首选：`better-sqlite3-migrations`
- 次选：基于 `better-sqlite3` 自带 `PRAGMA user_version` 做一个极小的迁移 runner

对这个项目来说，`knex` 这类重型 ORM migration 不划算；但继续维持 ad-hoc 迁移，也已经不够稳。

结论：这是当前最符合 `AGENTS.md` “数据库访问和迁移优先成熟方案”这条约束的整改点。

---

## 三、中优先级

### 3.1 URL 归一逻辑在多个 formatter 里重复，应该提成共用 util

当前至少有三份几乎同类的实现：

- `src/formatters/index.ts:26`
- `src/formatters/avFormatter.ts:4`
- `src/formatters/startggFormatter.ts:5`

差异只在于：

- 一个失败后返回 `'#'`
- 一个空值返回 `'#'`
- 一个失败后直接抛错

它们都在做同一件事：

- 只允许 `http:` / `https:`
- 非法 URL 不透传

更合适的替代：

- 提取到 `src/utils/url.ts`
- 用现有平台 API `URL.canParse` + `new URL(...)`
- 暴露两种统一语义：
  - `normalizeHttpUrlOrNull`
  - `normalizeHttpUrlOrThrow`

这项不一定要引新库，直接用现有平台 API 就够了；重点是别继续在 formatter 层散落重复逻辑。

### 3.2 HTML entity 转义仍然是手写实现，可选换成 `he`

位置：

- `src/utils/html.ts`

当前实现：

```ts
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

判断：

- 以 Telegram HTML 发送为主的当前场景下，这个实现是够用的
- 所以它不是高优先级问题

但如果严格对齐 `AGENTS.md` 里“HTML/Markdown 转义或解析优先成熟库”的原则，更标准的替代是：

- `he`

收益：

- 统一交给成熟 entity 库处理
- 后续如果出现更复杂的实体编码，不需要再自己补边界

结论：可做，但优先级低于日期收敛和迁移机制。

---

## 四、已收敛，不建议重复改动

以下几类此前存在“可以用成熟库替代手写”的问题，当前已经基本到位，不建议再把它们列为整改项：

### 4.1 Markdown 渲染

当前：

- `src/utils/telegramMarkdown.ts`
- 已使用 `marked`

判断：

- 已经比早期手写正则方案更合理
- 这块当前不需要再换库

### 4.2 Promise 超时包装

当前：

- `src/fetchers/english.ts:91`
- 已使用 `p-timeout`

判断：

- 已经是成熟方案

### 4.3 start.gg GraphQL 客户端

当前：

- `src/services/startgg/client.ts`
- 已使用 `graphql-request`
- 超时也已经走 `AbortSignal.timeout(...)`

判断：

- 这块已经从手写 `axios + GraphQL envelope` 升级到了更标准实现

### 4.4 HTML 内容剥离

当前：

- `src/fetchers/english.ts:70`
- 已从正则剥离升级为 `cheerio`

判断：

- 这是正确方向，不需要回头改

---

## 五、建议落地顺序

1. 统一时间处理：把 `YYYY-MM-DD`、日期加减、日期 diff 全部收拢到 `src/utils/time.ts`
2. 给 SQLite 建显式迁移机制：优先 `better-sqlite3-migrations`，次选 `user_version` 方案
3. 提取 `src/utils/url.ts`，删掉 3 处 formatter 层 `normalizeUrl`
4. 如果后面还有精力，再评估是否把 `src/utils/html.ts` 切到 `he`

---

## 六、最终判断

如果只问“当前项目里还有没有明显适合用成熟库或更标准实现替换手写的地方”，答案是：

- 有，但已经不像 2026-06 那次那么多
- 现在最值得动的，不再是 Markdown / GraphQL / Promise timeout
- 而是“时间处理统一化”和“SQLite 迁移机制显式化”

这两项改完之后，这个项目在“优先使用成熟库 / 标准实现”这条上的主要短板就会明显收敛。
