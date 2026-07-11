# start.gg API 与当前实现 Review

Review 日期：2026-07-11

实施状态：P0、P1 和可由当前 schema 明确支持的请求优化已处理；赛事格式差异仍需真实赛事数据支持，未加入猜测分支。

## 结论

当前实现的核心方向正确：使用 GraphQL、按 event/entrant 查询 sets、分页读取、SQLite 去重、20 分钟发现与 2 分钟赛况轮询分离，已经适合个人提醒 bot。

Review 最初发现两个高优先级业务问题：

1. 自动发现可能在跨日休赛期停用仍未结束的 event，并进一步触发“全部赛事已结束”的自动停轮询。
2. 加速轮询用 `completedAt === null` 判断进行中 set，会把尚未开始的未来 set 一并视为进行中。

这两个问题及后续可明确落地的优化现已按推荐顺序处理，下面保留发现依据和修复记录。

## 官方 API 约束

start.gg 官方文档明确：

- GraphQL endpoint 是 `https://api.start.gg/gql/alpha`，推荐使用 POST。
- API token 通过 Bearer Authorization header 发送，个人 token 一年过期。
- 请求速率不得平均超过每 60 秒 80 次。
- 单个请求最多返回 1000 个对象，嵌套对象也计数。
- event 的 entrants、sets、standings 都是分页数据，应按 page/pageInfo 读取。
- User/Player 是全局当前实体；Participant/Entrant 是报名时的赛事上下文实体，两者名称和前缀可能不同。

官方依据：

- [Rate Limits](https://developer.start.gg/docs/rate-limits/)
- [Sending Requests](https://developer.start.gg/docs/sending-requests/)
- [Authentication](https://developer.start.gg/docs/authentication/)
- [Sets in Event](https://developer.start.gg/docs/examples/queries/sets-in-event/)
- [Event Entrants](https://developer.start.gg/docs/examples/queries/event-entrants/)
- [Event Standings](https://developer.start.gg/docs/examples/queries/event-standings/)
- [Entrants within a Tournament](https://developer.start.gg/docs/examples/queries/entrants-by-tournament/)
- [Glossary](https://developer.start.gg/docs/glossary/)

## P0：休赛期可能误停整个自动监控

修复状态：已修复。未到 `tournament_end_at` 的 auto event 会保持 active，空 active 列表不再触发完赛停止。

### 当前行为

`discoverStartggActiveEventsForPlayers()` 除了要求 tournament 当前处于 `startAt/endAt` 内，还要求 event 最近两天有活动。

自动同步会将本轮未发现的 auto event 设为 inactive。随后固定轮询中的自动停止判断把以下两种情况都认定为完赛：

```text
activeEvents.length === 0
或
所有 active event 的 tournament_end_at 已到达
```

### 问题

跨多日赛事如果中间休赛超过两天，或者 start.gg 长时间没有生成/完成关注选手的 set，本轮发现结果可能为空。系统会：

```text
停用 auto event
→ active event 变为 0
→ 关闭轮询并发送“赛事已结束”通知
```

但 tournament 的 `endAt` 实际尚未到达。关闭后也不会再有下一轮自动发现，因此后续比赛会被永久错过。

### 最小修复

- `activeEvents.length === 0` 不得解释为“赛事全部结束”。
- 自动停止只能依据已订阅赛事明确保存的 `tournament_end_at`。
- 自动发现本轮为空时，尚未到达 `tournament_end_at` 的 auto event 应继续保持 active。
- 到达 `tournament_end_at` 后再停用 event 并关闭轮询。

这比调整“两天窗口”为更长时间可靠；扩大窗口仍然只是延后同一个问题。

## P0：未来 set 被错误识别为进行中

修复状态：已修复。当前 schema 将 `state` 暴露为 Int，因此实现改用明确的 `startedAt != null && completedAt == null`，没有猜测状态数字。

### 当前行为

`computePlayerSnapshot()` 使用：

```text
set.completedAt === null
```

判断 `pendingSetExists`，进而决定是否开启 2 分钟加速轮询。

### 问题

`completedAt` 为空只表示 set 尚未完成，不等同于正在进行。已经创建但尚未开始的 future/queued set 也会满足这个条件。

结果是：只要 bracket 已提前生成后续 set，加速轮询就可能在数小时休息期持续每 2 分钟请求。

此外，代码已经查询了 set `state`，但没有用它判断进行中状态。start.gg 官方的 in-progress set 示例也直接读取 `state`，说明 set 状态才是应使用的生命周期字段：[Set Score](https://developer.start.gg/docs/examples/queries/set-score/)。

### 最小修复

- 根据 start.gg schema 中 SetState 的 active/in-progress 值判断加速轮询。
- `completedAt` 只用于完成时间和排序，不再作为“正在进行”的唯一依据。
- 将业务字段从 `pendingSetCount`/`pendingSetExists` 改名为 `activeSetCount`/`activeSetExists`，避免语义继续混淆。

实施前应通过官方 API Explorer 确认当前 schema 的 SetState 枚举和值，不应在代码中猜数字。

## P1：选手未参赛映射会被永久缓存

修复状态：已修复。固定轮询会重新解析 NULL 映射，加速轮询不刷新 entrants。

### 当前行为

首次扫描 entrants 时，如果关注选手尚未出现在 event entrants 中，会保存一条 `entrant_id = NULL` 的映射。

后续 `ensureEventEntrantMappings()` 看到数据库已有记录就不再查询 entrants。

### 问题

如果选手晚报名、主办方晚导入 entrant、替换报名信息或 start.gg 数据稍后才完整，该选手会在整个 event 生命周期内一直保持 `not_entered`。

### 最小修复

只缓存成功的 entrant 映射。`entrant_id = NULL` 不写入长期缓存；固定轮询继续重新查询未映射选手。加速轮询只处理已映射 event，不额外刷新 entrants。

这属于主路径数据刷新，不应通过重试或吞错处理。

## P1：状态计算把“暂未生成下一场”当作淘汰

修复状态：已修复。只有 entrant standing 的 `isFinal` 明确为真时才确认淘汰或冠军完成状态。

### 当前行为

如果最新完成 set 是失利，并且当前查询结果中没有未完成 set，状态会直接变为 `eliminated`。

### 问题

双败赛中，胜者组失利后，败者组下一场 set 可能尚未生成。此时“没有下一场 set”不代表已经淘汰，可能短暂推送错误的淘汰状态，下一轮又改回败者组。

`standing` 是否存在也没有解决该问题，因为进行中的 standings 可以包含尚未淘汰的 entrant。官方将 Standing 定义为 entrant 在 phase group 或 event 中的当前或最终名次，不保证它本身代表最终淘汰状态。

### 建议

状态机应以 set `state`、胜负次数和 bracket/round 信息组合判断。对双败赛事，只有能够确认第二次失利或明确最终 placement 时才标记淘汰。当前代码没有保存累计败场，建议从该 entrant 的全部已完成 sets 计算 loss count，而不是只看最新一场。

## P1：分页大小接近官方 1000 对象上限

修复状态：已修复。entrants 降为 200；整场 standings 查询已由 entrant standing 定点查询取代。

### 当前配置

- entrants：每页 300。
- standings：每页 350。
- sets：每页 120。

官方限制按嵌套对象总数计数，而不是只按顶层 nodes 数量。entrants 查询每个 node 还包含 participants 和 player；单打赛事每个 entrant 通常至少形成 entrant、participant、player 三层对象，300 条已接近 900 个对象，另有 event、connection、pageInfo 等对象。团队项目一个 entrant 有多个 participant，更容易超过 1000。

### 最小修复

- entrants 每页从 300 调整为 200。
- standings 350 可以保留，但 250 更统一稳妥。
- sets 120 基本合理，因为每个 set 含 slots 和 entrants，继续增大风险更高。

这不是失败后的 fallback，而是直接遵守官方单请求复杂度限制。

## P1：固定轮询和加速轮询可能同一时刻并发

修复状态：已修复。固定轮询开始前取消加速计时器，完成后按最新结果重新安排。

固定任务在每小时 0/20/40 分触发，加速任务使用相对 2 分钟 setTimeout。两者可能在同一时刻进入 `runStartggWatchOnce()`。

并发检查会造成重复 GraphQL 请求；更严重的是，两轮都可能在 `hasStartggPushedSet()` 为 false 时发送同一条 set 消息，然后才分别写去重记录。

### 最小修复

固定轮询开始前取消当前加速计时器；固定轮询完成后根据最新 active set 重新安排加速计时器。这样由固定轮询接管重合时刻，不需要重试、排队或复杂锁。

## P2：每个 event 每轮额外查询 header

修复状态：已修复。固定轮询刷新并缓存元数据，加速轮询直接使用缓存。

当前每轮对每个 event 分别请求：

1. header/tournament endAt。
2. filtered sets。
3. 全量 standings。

header 和 tournament `endAt` 在赛事期间变化频率很低。对于 2 分钟加速轮询，没有必要每轮更新 event 名称和 tournament endAt。

### 建议

- 固定轮询保留 header 查询，负责刷新元数据和结束时间。
- 加速轮询直接使用数据库已有 event 名称和 tournament endAt，只查询赛况数据。

这样每个加速 event 每轮可再减少 1 个请求。

## P2：每轮读取完整 standings 成本偏高

修复状态：已修复。官方 schema 确认 `Query.entrant(id)` 和 `Entrant.standing` 可用，当前通过单次 GraphQL 请求定点读取关注 entrants 的 standing。

代码只需要关注 entrant 的 placement，却分页读取 event 全部 standings。大型赛事会产生多页请求和大量无关对象。

官方公开示例只展示 event standings 分页，没有展示 entrantIds 过滤参数，因此不能直接假设 API 支持过滤。建议先在官方 API Explorer 检查当前 schema：

- Entrant 是否可直接读取 event standing/standing。
- standings query 是否有 entrant 过滤字段。

如果 schema 支持，改为只取关注 entrant；如果不支持，当前实现保持不变，不手写或猜测非官方参数。

## P2：自动发现按选手逐个查询，存在重复 event 数据

每个关注选手分别查询近期 sets，同一个 event 会在多个响应中重复出现。这部分是固定轮询请求量的主要来源。

短期不建议为了减少 6 个请求而拼装 GraphQL aliases 或复杂批处理：当前每 20 分钟执行一次，远低于官方每分钟 80 请求限制，顺序查询也让突发速率较低。相比之下，先修复错误停轮询和 active set 判断更有价值。

## P2：名称来源语义不一致

修复状态：已修复。赛况推送优先使用 event entrant 名称，关注列表继续使用全局 Player 名称。

关注选手显示名来自全局 Player，entrant_name 来自赛事上下文，但 Telegram 推送仍使用 `startgg_watch_players.player_name`。

官方说明全局 Player 与赛事 Participant/Entrant 的 gamerTag/prefix 可能不同。比赛期间展示赛事报名名通常更符合用户看到的 bracket。

建议推送优先使用已映射的 `entrant_name`，选手管理列表继续展示全局 Player 名称。

## 已经合理的实现

- 使用成熟的 `graphql-request` 和 POST GraphQL 请求，没有手写协议客户端。
- Authorization Bearer header 符合官方要求。
- 分页依据 `totalPages` 完整读取，没有假设单页足够。
- sets 使用 entrantIds 过滤，避免读取 event 全部对局。
- 最近 sets 发现和赛况检查已经拆成 20 分钟/2 分钟两条路径。
- 2 分钟加速轮询只检查 active event，不再重复执行选手级发现。
- entrant/player 映射使用 player id，而不是用易变 gamerTag 做身份键。
- 首次建立历史基线和 set 去重符合提醒 bot 的业务目标。
- API 错误直接暴露，没有重试、降级、吞错或假成功。

## 推荐实施顺序

1. 修复休赛期 auto event 被停用和空 active event 误判完赛。
2. 用官方 SetState 明确判断 active set，修正加速轮询触发条件。
3. 固定轮询启动前取消加速计时器，消除并发重复推送窗口。
4. 未映射 entrant 只在固定轮询重新解析，不永久缓存 NULL。
5. entrants 分页降到 200，降低超过 1000 对象限制的风险。
6. 固定轮询刷新 header；加速轮询不再请求 header。
7. 调整淘汰状态计算，基于累计败场而不是最新一场。
8. 使用 API Explorer 确认能否按 entrant 查询 standing，再决定 standings 优化。
