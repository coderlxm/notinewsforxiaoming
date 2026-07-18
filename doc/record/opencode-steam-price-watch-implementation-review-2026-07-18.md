# OpenCode 实施 Steam 低价监控复盘报告

日期：2026-07-18  
报告类型：实施记录与代码 review 复盘  
对应方案：`doc/design/steam-price-watch.md`  
对应实现提交：`07b6fc9 feat: add Steam game price watch with target price alerts`

## 1. 总体结论

本次工作由本机 OpenCode 完成首轮代码实施和第二轮指定问题修正，再由主审查流程完成最终边界收口与验收。

完成度判断：

- OpenCode 首轮产出：约 80%。主体架构和主要功能已经完成，但存在输入校验、响应校验、HTML 输出和变更范围方面的问题。
- OpenCode 第二轮修正后：约 95%。已修复 review 指出的主要功能与方案偏差。
- 当前最终实现：方案范围内 100%。设计中的数据源、存储、命令、提醒规则、调度和文档项均已落地，已发现的问题均已收口。

这里的百分比是基于方案功能项和 review findings 的工程判断，不代表整个仓库的全局健康度。仓库仍有与本功能无关的既有语法、类型和 lint 问题，详见第 8 节。

## 2. OpenCode 首轮完成的工作

OpenCode 使用本地 `build` agent（运行时显示模型为 `deepseek-v4-flash`），先读取了根目录 `AGENTS.md` 和设计文档，然后直接修改工作区。

### 2.1 新增 Steam Store 客户端

新增 `src/services/steamPriceClient.ts`：

- 使用现有 Axios 请求 Steam Store `appdetails`。
- 固定请求中国区和简体中文：`cc=CN`、`l=schinese`。
- 使用 Zod 校验名称、币种、原价、现价和折扣字段。
- 强制要求返回币种为 `CNY`。
- 不添加重试、备用接口或网页抓取。

### 2.2 新增 SQLite Repository

新增 `src/services/steamPriceRepository.ts`：

- 查询全部订阅。
- 按 AppID 或本地 ID 查询。
- 创建订阅。
- 修改目标价。
- 更新价格快照和监控期最低价。
- 删除订阅。

同时修改：

- `src/reminders/db.ts`：增加 `steam_price_watches` 初始化表。
- `src/reminders/migrations.ts`：增加数据库 migration v12。

表结构按设计使用人民币分整数保存价格，没有引入价格历史表、多用户字段或额外状态机。

### 2.3 新增价格追踪主流程

新增 `src/services/steamPriceTracker.ts`：

- 解析 Steam App URL 或 AppID。
- 解析用户目标价。
- 添加订阅时立即读取 Steam 当前价。
- 串行检查全部订阅。
- 根据上次价格、当前价格和目标价判断是否提醒。
- 维护“自添加以来最低价”。
- Telegram 发送成功后再更新命中提醒的快照。

“先发送、后写快照”是首轮实现中做得正确的一点：Telegram 发送失败会直接终止，不会先把本地状态标记成已处理。

### 2.4 新增 Telegram 展示和命令

新增 `src/formatters/steamPriceFormatter.ts`，并在 `src/bot/interactive.ts` 注册：

- `/steam`
- `/steam add`
- `/steam list`
- `/steam set`
- `/steam remove`
- `/steam check`

交互继续复用项目现有 `isAuthorized(ctx)`，没有增加账号体系或多用户逻辑。

### 2.5 新增固定调度

在 `src/scheduled/jobs.ts` 注册北京时间四个检查时点：

- 02:15
- 08:15
- 14:15
- 20:15

最终调度只进入当前线上使用的 resident 固定任务，不经过一次性入口。

### 2.6 更新说明文档

OpenCode 更新了：

- `README.md`
- `src/reminders/formatter.ts` 中的 `/help`
- `doc/reference/server-schedule.md`

设计文档也已由“待实施”更新为“已实施”。

## 3. OpenCode 首轮做得好的部分

### 3.1 主体架构与项目现状匹配

实现复用了项目已有技术栈：Telegraf、Axios、Zod、`better-sqlite3` 和 `node-schedule`。没有新装依赖，也没有增加服务、队列、缓存或管理后台。

### 3.2 数据模型保持克制

只增加一张订阅快照表，通过 `final_price_minor`、`target_price_minor` 和 `lowest_price_minor` 完成业务判断，没有设计完整价格历史、推送历史或复杂状态枚举。

### 3.3 严格保持单数据源

没有接入 SteamDB、IsThereAnyDeal、GG.deals 或 Steam HTML 页面，也没有实现数据源切换。

### 3.4 错误主路径基本正确

Steam 请求、Zod 结构错误、币种异常和 Telegram 发送错误都会向上抛出。循环使用串行处理，任一 App 失败即终止当前轮次，没有吞错后继续。

### 3.5 敏感代码未被修改

最终没有修改 `src/reminders/recurring.ts` 中的 `rrule` 导入和加载方式。

## 4. 首轮存在的功能问题

### 4.1 Steam URL 未校验域名

首轮只通过 pathname 提取 `/app/<id>/`，因此任意域名只要路径相同都会被接受，例如：

```text
https://example.com/app/413150/
```

这不符合“只接受 Steam App URL”的方案要求。

修正结果：

- 只接受 HTTPS。
- hostname 必须是 `store.steampowered.com`。
- 拒绝用户名、密码和自定义端口。
- 兼容 AppID 后有无尾部斜杠。

### 4.2 目标价使用 `parseFloat`

首轮实现会把 `25abc` 解析成 25，也会对三位以上小数进行四舍五入。这会把格式错误的用户输入当成有效金额。

修正结果：

- 只接受普通十进制格式。
- 最多两位小数。
- 拒绝指数、负数、零、混合字符和超过安全整数范围的金额。
- 通过整数和小数部分精确组合为人民币分，不依赖浮点金额比较。

### 4.3 纯数字 AppID 校验不够严格

首轮使用 `Number(trimmed)`，会把 `1e3` 当成 AppID 1000，也没有限制安全整数范围。

该问题没有在 OpenCode 第二轮中完全收口，最终由主审查流程补充修正为“仅数字字符串 + 正安全整数”。

### 4.4 未核对 Steam 返回的 AppID

首轮 Zod 结构没有读取 `data.steam_appid`，因此只确认了外层 key，没有确认 payload 内的 AppID 与请求一致。

修正结果：客户端现在同时校验 `steam_appid`，不一致直接报错。

### 4.5 `success=false` 结构处理不准确

首轮 schema 强制要求 `data` 存在，因此 Steam 返回 `{ success: false }` 时，会先产生通用 Zod 错误，无法进入代码准备的明确错误分支。

第二轮将 `data` 改为 optional，并明确处理 `success=false`。随后主审查流程又修正了“success=true 但缺少 data”时错误文案不准确的问题。

### 4.6 零折扣显示为 `-0%`

首轮到价消息无条件显示折扣括号，零折扣时会出现：

```text
现价：¥30.00（-0%）
```

修正后仅在折扣大于零时展示折扣括号。

### 4.7 HTML 错误文本未转义

`/steam` 的 catch 分支将外部错误信息直接嵌入 Telegram HTML 消息。错误内容包含 `<`、`>` 或 `&` 时可能导致 Telegram 拒绝解析整条回复。

修正后错误文本先经过现有 `escapeHtml()`。

### 4.8 首轮没有独立的提醒规则纯函数

提醒条件直接写在循环内部，逻辑本身正确，但不利于覆盖全部状态转换。

第二轮提取了 `shouldNotifySteamPrice(previous, current, target)`，tracker 继续使用同一规则，便于单独验收首次到价、继续降价、同价、涨价和再次跌破等场景。

## 5. 未按方案执行的地方

### 5.1 额外修改了 `src/scheduled/runMode.ts`

设计明确要求不修改一次性入口和 `runMode.ts`，因为当前线上主形态是 resident bot，手动检查已经由 `/steam check` 提供。

OpenCode 首轮仍然：

- 扩展了 `PushMode`。
- 扩展了 `parseForcedMode()`。
- 增加了 `steam_price_watch` 分支。

这属于明确的范围偏离。第二轮已完整撤销，最终提交中 `src/scheduled/runMode.ts` 没有本功能改动。

### 5.2 首轮验证结论表达过度

仓库原有 `src/index.ts` 语法错误会阻断全量 TypeScript 检查。OpenCode 尝试使用 grep 过滤输出，并出现过因为彩色输出导致错误计数为零的情况。

因此，首轮“新增代码无 TS 错误”的结论并不能由当时的全量命令直接证明。最终改用只覆盖 Steam 新模块的严格类型检查，才得到可靠的通过结果。

### 5.3 使用了 `npx` 而不是项目包管理器

项目声明使用 pnpm，OpenCode 首轮检查却调用了 `npx tsc` 和 `npx eslint`。这没有修改依赖或锁文件，但不是最贴合项目的执行方式。最终验收统一使用项目现有 pnpm 环境。

### 5.4 使用 `git stash --include-untracked` 做前后对比

OpenCode 为确认 `src/index.ts` 是既有错误，临时 stash 了包含未跟踪文件的整个工作区，再恢复 stash。

恢复过程成功，没有丢失改动，但这个动作对共享工作区没有必要，且比只读查看基线文件风险更高。后续同类排查应优先使用 `git show HEAD:<path>` 或其他只读比较方式。

### 5.5 实施过程中出现短暂编辑错误

OpenCode 修改 migration v11 附近时一度重复插入了一行 `if`。它在同一轮中立即发现并修复，最终文件没有残留该问题。

### 5.6 出现新增未使用 import

首轮 `steamPriceTracker.ts` 曾导入未使用 formatter，OpenCode 自己通过 lint 发现并删除。最终 `interactive.ts` 还残留一个未使用的 `resolveSteamAppReference` import，由主审查流程删除。

## 6. 第二轮 OpenCode 纠错内容

在收到明确 review findings 后，OpenCode 完成了：

1. 撤销 `runMode.ts` 的超范围改动。
2. 限制 Steam URL 的协议、域名、凭据和端口。
3. 改为严格目标价解析。
4. 增加响应 `steam_appid` 校验。
5. 修复零折扣 `-0%`。
6. 对 Telegram HTML 错误文本做转义。
7. 提取 `shouldNotifySteamPrice()` 纯函数。
8. 再次确认未加入重试、fallback、备用数据源和 `rrule` 改动。

第二轮完成后，主体功能问题已经全部解决；剩余的安全整数 AppID、缺失 data 错误文案和 unused import 由主审查流程做了最终收口。

## 7. 最终验收结果

### 7.1 业务规则

已覆盖并通过：

- AppID 和标准 Steam App URL。
- 无尾部斜杠的 Steam App URL。
- 非 Steam 域名、HTTP、凭据、自定义端口、sub 链接和超大 AppID拒绝。
- 整数、一位小数和两位小数目标价精确转换。
- 混合字符、指数、三位小数、零、负数和超范围金额拒绝。
- 首次跌到目标价提醒。
- 已到价后继续降价提醒。
- 同价不提醒。
- 涨价不提醒。
- 涨回目标价以上后再次跌破可重新提醒。
- 零折扣消息不显示 `-0%`。
- 游戏名正确 HTML 转义。

### 7.2 真实 Steam 数据链路

真实 Steam 中国区请求成功返回：

```text
AppID: 413150
Name: Stardew Valley
Currency: CNY
Initial: 4800
Final: 4800
Discount: 0
```

无效 AppID 会直接暴露 `success=false`，没有切换数据源或伪造默认价格。

### 7.3 代码集成

最终验收覆盖：

- Steam 四个新增模块的严格 TypeScript 检查。
- 本功能相关文件的 ESLint。
- `interactive.ts` 与 `scheduled/jobs.ts` 的运行时 import。
- Git diff 格式检查。
- 最终变更范围检查。

### 7.4 方案约束

最终状态满足：

- 单用户 Telegram bot。
- 单 Steam Store 数据源。
- 中国区 CNY。
- SQLite 单表快照。
- 固定四次日常检查。
- 不重试。
- 不 fallback。
- 不吞错。
- 不抓 SteamDB 或商店 HTML。
- 不接 IsThereAnyDeal。
- 不修改 `runMode.ts`。
- 不修改 `src/index.ts`。
- 不修改 `recurring.ts` 的 `rrule` 导入。

## 8. 与本功能无关的既有项目问题

以下问题在本次实施前已经存在，没有归因给 OpenCode 的 Steam 功能，也没有扩大范围修复：

- `src/index.ts` 缺少闭合大括号，导致一次性入口的全量 TypeScript 解析失败。
- `src/ai/deepseek.ts` 存在既有类型引用问题。
- `src/services/startgg/client.ts` 存在多处既有泛型和返回值类型问题。
- `src/services/avSubscriptionService.ts` 存在既有联合类型不匹配。
- `src/reminders/formatter.ts` 等文件存在既有 lint 项。

这些问题会影响“整个仓库全量 typecheck/lint 全绿”这一指标，但不属于 Steam 低价监控方案的实现缺口。

## 9. 最终评价

OpenCode 对“按既有项目模式快速铺开一个完整业务子系统”表现较好：首轮就完成了客户端、持久化、tracker、formatter、Telegram 命令、调度和文档，代码整体短而直接。

主要短板集中在两类：

1. 边界校验不够严格，尤其是 URL、金额和 API payload 一致性。
2. 对明确范围约束执行不够稳定，仍主动扩展了 `runMode.ts`，并使用了不必要的工作区 stash 操作。

在有明确设计文档和独立 review 的前提下，OpenCode 很适合完成这类首轮实施；但它的首轮结果不能直接视为最终交付，仍需要对输入、外部响应、HTML 输出、变更范围和检查结论做人工或独立 agent 审查。

当前最终实现已经达到本次方案的验收标准，无剩余的 Steam 低价监控已知缺口。
