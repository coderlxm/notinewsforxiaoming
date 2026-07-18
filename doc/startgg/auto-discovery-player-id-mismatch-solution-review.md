# start.gg 自动发现 Player ID 失配方案 Review 与研究报告

Review 日期：2026-07-18（Asia/Shanghai）  
问题报告：[`auto-discovery-player-id-mismatch-report.md`](./auto-discovery-player-id-mismatch-report.md)  
被评审方案：[`startgg-player-id-mismatch-solution.md`](../design/startgg-player-id-mismatch-solution.md)

## 范围更正

用户随后明确：自动发现功能面向关注选手在 start.gg 中参加的所有游戏赛事，不是 SF6 专用功能。因此，本报告中“用 SF6 tournament 候选目录替换 Player Sets 发现入口”的产品级结论无效。

本报告对目标事故的 API 证据、身份断链结论和确定性 entrant 匹配规则仍然有效。正确实施关系是：

1. 保留 Player Sets 作为跨游戏的正常关联发现来源。
2. 将本报告验证过的 SF6 tournament 候选查询作为本次断链事故的补充发现来源。
3. 两类结果统一去重并进入同一 entrant 映射和监控流程。

在没有新的 API 证据和范围设计前，不应宣称其他游戏的完全断链赛事已获得与 SF6 相同的候选扫描覆盖。

## 1. 结论

当前方案不是“自动发现赛事最便利、最智能”目标下的最佳方案，不应按现状直接实施。

它正确解决了“event 已知以后，如何把全局选手映射到赛事 Entrant”的问题，但没有解决全局 Player ID 与赛事记录断链时的自动发现。另一方面，本报告最初建议用 SF6 tournament 候选目录完全替换 Player Sets，也会错误丢失其他游戏的正常发现能力。

最终方案必须同时保留两种互补来源：

```text
跨游戏正常关联
  -> player(id).sets()
  -> 发现任意游戏 event

本次已证实的 SF6 身份断链
  -> 当前活动 SF6 tournament 候选
  -> User / gamerTag 身份确认
  -> 补充发现 event 和 entrant_id

两类结果按 event slug 合并
  -> 自动订阅并进入现有监控
```

SF6 候选查询不是全网赛事扫描，也不是 Player Sets 失败后才启动的 fallback；它是每轮固定执行、范围受控的补充来源。当前证据只足以支持 SF6 断链候选扫描，不能据此限制整个产品的游戏范围，也不能宣称其他游戏的断链场景已被同样覆盖。

当前方案中“保留全局身份、监控使用 event 内 entrant_id、不把赛事侧 Player ID 写回预设、歧义时不猜”的部分应继续保留；需要重写的是发现入口和身份数据模型。

## 2. 证据与确定程度

本报告区分四类证据：

| 类型 | 本报告中的用途 | 确定程度 |
| --- | --- | --- |
| 当前源码 | 判断现有发现、同步和映射实际如何执行 | 已确认 |
| start.gg 官方文档及公开 schema | 判断 API 提供哪些查询字段和实体关系 | 已确认当前 schema 支持 |
| 目标赛事真实 API 响应 | 判断候选发现和身份查询能否命中本次事故 | 已确认当前运行时行为 |
| 设计推断 | 决定如何组合查询、处理歧义和控制请求量 | 推荐方案，不冒充平台保证 |

“当前全局 Player 发现覆盖绝大多数赛事”没有统计数据支持，不能量化其覆盖率。但用户已明确产品要发现所有游戏，而该链路的源码行为不限制 videogame；因此保留它是维持既有跨游戏能力的直接要求，不依赖“绝大多数”这一未经证实的判断。

## 3. 修复前源码事实

### 3.1 自动发现只依赖全局 Player Sets

修复前的 [`src/services/startggDiscovery.ts`](../../src/services/startggDiscovery.ts) 对每名启用选手调用 `fetchPlayerRecentSets(player.player_id, updatedAfter)`，再从 Set 反查 event 和 tournament。

[`PLAYER_RECENT_SETS_QUERY`](../../src/services/startgg/queries.ts) 的根节点是 `player(id)`，并再次用同一个全局 Player ID 过滤 sets。本次赛事的孤立赛事 Player ID 不属于这个全局 Player，所以该链路没有机会看到 event。

### 3.2 已知 event 后仍只按 Player ID 映射

修复前的 [`ensureEventEntrantMappings()`](../../src/services/startgg/tracker.ts) 把 event 全部 Entrant 转成 `playerId -> entrant`，然后只执行：

```text
watch_player.player_id === participant.player.id
```

因此，手动添加本次 event 后也会把 5 名真实参赛选手显示为 `not_entered`。现有方案提出的赛事内多级映射是必要修改。

### 3.3 现有数据模型无法实施方案声明的 User slug 匹配

修复前 `resolveUserToPlayer()` 已返回 `userSlug`，但 `syncStartggPresetPlayers()` 没有把它写入数据库。`startgg_watch_players` 也只有 `player_id`、`player_name` 和 `enabled`。

被评审方案的匹配顺序包含“User slug 精确匹配”，但其 migration 只计划增加 `gamer_tag`，没有增加 `user_slug` 或 `user_id`。所以该方案即使按文档实施，第二级匹配也缺少持久化数据来源。

## 4. 被现有方案遗漏的官方 API 能力

### 4.1 可以按游戏和时间信号查询 tournament 候选

公开 schema 中的 `TournamentPageFilter` 当前包含：

- `videogameIds`
- `computedUpdatedAt`
- `afterDate`
- `beforeDate`
- `published`
- `publiclySearchable`

官方也给出了按 `videogameIds` 查询赛事目录的示例。这说明候选赛事发现不必在“已知 URL”和“无条件扫描所有赛事”之间二选一。

### 4.2 Tournament Participant 可以直接按 gamerTag 查询

`Tournament.participants` 接收 `ParticipantPaginationQuery`，其中 `ParticipantPageFilter` 包含 `gamerTag`。Participant 又直接提供：

- `gamerTag`
- `user`
- `player`
- `entrants`
- `events`

所以在 candidate tournament 已知后，可以只查询 6 名关注选手，而不必下载每个 event 的完整 Entrant 列表。

### 4.3 Event 可以按全局 User 直接取 Entrant

公开 schema 还提供：

```text
Event.userEntrant(userId)
```

它适合处理身份关联正常、但报名 gamerTag 与当前全局 gamerTag 不同的赛事。名称匹配不应取代精确身份；两种信号可以在同一次候选身份查询中并列返回：

1. `userEntrant(userId)` 负责正常关联。
2. `participants(filter: { gamerTag })` 负责本次这类 User 断链记录。

这构成一条统一的候选身份解析路径。它应与 Player Sets 一起固定执行并合并结果，不需要先判断 Player Sets 是否失败，也不是异常后的 fallback。

## 5. 目标赛事运行时研究结果

本节使用 `bwgdc01` 当前部署环境的 start.gg token 请求公开 GraphQL API。Token 未进入输出或文档。

### 5.1 全局身份数据完整

6 名预设选手的 User 和全局 Player 均可正常解析；例如 XiaoHai 的全局身份是：

```text
user.id          = 2572673
player.id        = 4004146
player.gamerTag  = xiaohai
player.prefix    = FALCONS
```

因此，推荐在 watch player 中保存 `user_id` 和不带展示拼接的 `gamer_tag`。`player_name` 继续只负责显示。

### 5.2 全局 User 精确入口在本场全部为空

对 event `1621883` 分别调用 6 名预设用户的 `userEntrant(userId)`，结果全部为 `null`。这与问题报告中 `participant.user = null` 的结论一致，证明本场必须使用赛事上下文名称关联。

### 5.3 Tournament Participant 定向查询直接找到 5 名选手和 event

对 tournament `910133` 使用每名选手的全局 gamerTag 查询 Participant：

| 查询 gamerTag | 返回数 | Participant gamerTag | Participant Player ID | Entrant ID | Event ID |
| --- | ---: | --- | ---: | ---: | ---: |
| `xiaohai` | 1 | `Falcons丨Xiaohai` | 5479000 | 24107725 | 1621883 |
| `Vxbao` | 1 | `AG 8BitDo丨Vxbao` | 5479008 | 24107733 | 1621883 |
| `Zhen` | 1 | `AG 8BitDo丨Zhen` | 5478986 | 24107678 | 1621883 |
| `XiaoXu` | 1 | `GTW丨XiaoXu` | 5478982 | 24107674 | 1621883 |
| `DCQ` | 1 | `NMS PWS丨DCQ` | 5478978 | 24107670 | 1621883 |
| `gachikun` | 0 | — | — | — | — |

每个命中结果都直接携带：

```text
Participant
  -> Entrant
  -> Event(id, slug, state, videogame.id)
```

所以自动发现和 event 内映射可以在同一次身份查询中完成，不需要发现 event 后再分页读取 199 名 Entrant。

### 5.4 候选范围是可控的

以 Street Fighter 6 的 `videogame.id = 43868` 和 `computedUpdatedAt = 当前时间 - 48 小时` 查询：

| 阶段 | 数量 |
| --- | ---: |
| 最近两天有数据变化的 SF6 tournaments | 167 |
| 本地应用 `startAt <= now <= endAt` 后 | 18 |
| 通过关注选手身份确认的 tournament | 1 |
| 最终确认的 event | 1 |

167 个 tournament 只读取少量标量字段，当前响应可在一页返回。18 个活动候选与 6 名选手的精确 User/名称查询也可在一个批量请求中返回。此次取样的完整发现过程共 2 个 GraphQL 请求，而当前实现至少需要 6 个逐选手 Player Sets 请求，并且仍然漏掉目标赛事。

这只是本次数据规模的运行时事实，不应被写成所有日期都恒定为 2 个请求。实现仍应分页，并把活动候选按固定小批次查询，以遵守官方单请求 1000 对象限制。

### 5.5 gamerTag 过滤是候选搜索，不是身份结论

48 小时候选中还出现了一个重要反例：

```text
查询：Zhen
返回：Zheng ze
赛事：AubyCup - World Warrior 2026 - Asia East 3
```

这证明当前 API 的 `gamerTag` filter 至少会做大小写不敏感的子串搜索。不能因为 `pageInfo.total = 1` 就认定身份唯一。

本场正确结果 `AG 8BitDo丨Zhen` 以完整 `Zhen` 作为最后一个玩家名称段；`Zheng ze` 则不是。名称查询结果必须再经过本地确定性规则确认：

- 忽略大小写和首尾空白。
- 全串等于全局 gamerTag，或以明确的战队分隔边界加完整 gamerTag 结尾。
- 禁止普通 `contains`。
- 同一选手在全部活动候选中出现多个名称级有效结果时，不自动选择。

这会保留 `Falcons丨Xiaohai`、`AG 8BitDo丨Zhen`，同时拒绝 `Zheng ze`。

### 5.6 不应直接使用的目录过滤方式

当前 API 运行时还表现出以下边界：

- `upcoming: true` 不包含已经开始的目标 tournament。
- `past: false` 在目录查询中没有形成可靠的“非历史赛事”限制；本次响应仍包含大量已完成旧赛事。
- 目标 tournament 的 `endAt` 晚于当前时间约 30 小时，`beforeDate = 当前时间 + 24 小时` 会把它排除。

因此推荐使用近期 `computedUpdatedAt` 缩小目录，再依据返回的 `startAt/endAt` 在本地判断当前活动状态；不要用上述布尔值或过窄 `beforeDate` 猜测“当前赛事”。

`computedUpdatedAt` 的公开 schema 没有解释内部计算公式。本次目标 tournament 自身的 `updatedAt` 早于 24 小时 cutoff，但仍被 `computedUpdatedAt` 查询命中。由此只能推断该过滤信号包含 tournament 下属数据变化，不能把具体计算规则写成平台承诺。

## 6. 对现有方案的 Review

| 评审项 | 现有方案 | 结论 |
| --- | --- | --- |
| 修复已知 event 的身份映射 | Player ID、User、gamerTag 多级映射 | 方向正确，需补齐 User 数据 |
| 修复本次自动发现 | 保留 Player Sets，孤立赛事要求手动 URL | 未修复根因 |
| 用户便利性 | 用户必须先在别处发现赛事并复制 URL | 不符合目标 |
| API 能力利用 | 未评估按游戏筛 tournament 和按 gamerTag 筛 Participant | 关键遗漏 |
| 请求量 | 以“不增加请求”为主要理由拒绝候选发现 | SF6 补充路径会增加请求，但本次取样范围可控 |
| 名称安全性 | 只要求 event 内唯一，规则描述较宽泛 | 自动发现需跨全部活动候选去歧义 |
| 数据模型 | 只增加 `gamer_tag` | 无法实施文档声明的 User 精确匹配 |
| 监控身份 | 最终使用 `entrant_id` | 应保留 |
| 赛事侧 Player ID | 不写回全局预设 | 应保留 |

现有方案更准确的定位是：

> “手动指定 event 后的 Entrant 映射修复方案”，不是“Player ID 断链下的自动发现解决方案”。

## 7. 推荐方案

### 7.1 身份模型只增加直接需要的数据

`startgg_watch_players` 在现有字段上增加：

- `user_id`：全局 User 精确身份；无 User 的赛事内手动选手允许为空。
- `gamer_tag`：全局 Player 的原始 gamerTag，不拼接 prefix。

继续保留：

- `player_id`：全局 Player 身份和既有选手唯一键。
- `player_name`：Telegram 展示名。

不需要把赛事侧 Player ID 保存为新的全局身份，也不需要新增身份历史表、别名表或学习状态。

### 7.2 保留跨游戏发现，并增加 SF6 断链候选

固定轮询首先保留原有 Player Sets 来源：

1. 对每名启用选手查询近期 `player(id).sets()`。
2. 按 tournament 活动时间和 event 最近活动过滤。
3. 不限制 videogame，继续发现所有正常关联的游戏赛事。

同一轮发现再增加 SF6 断链候选：

1. 查询 `videogameIds: [43868]`。
2. 使用 `computedUpdatedAt = now - 48h`，与当前“两天内有赛事活动”的业务边界一致。
3. 要求 `published`、`publiclySearchable`。
4. 分页只读取 tournament 的 id、name、slug、startAt、endAt。
5. 本地只保留 `startAt <= now <= endAt` 的活动 tournament。

两类结果按规范化 event slug 取并集。候选路径只补充 Player ID 断链时缺失的 SF6 event，不得删除、过滤或覆盖 Player Sets 已发现的其他游戏 event。

### 7.3 在同一次候选身份查询中组合精确与名称信号

对活动 tournament 小批量查询：

```text
tournament.events(videogameId = 43868)
  -> event.userEntrant(userId) × 启用选手

tournament.participants(gamerTag) × 启用选手
  -> participant.user / player / entrants / event
```

每名选手的匹配顺序：

1. `event.userEntrant(user_id)` 精确命中。
2. Participant 的 `user.id` 或 `player.id` 与全局身份精确命中。
3. Participant gamerTag 通过“完整值或明确分隔边界后的完整后缀”确认。

第 3 级只能在该选手的全部当前候选中唯一时自动确认。原始 API 子串结果不直接进入数据库。

### 7.4 发现结果直接携带 Entrant 映射

`StartggDiscoveredEvent` 不应只返回 event 元数据，还应携带已确认的：

```text
watch_player_id
entrant_id
entrant_name
match_kind: user | player | gamer_tag
```

同步 auto event 时同时写入 `startgg_watch_event_entrants`。后续现有的 sets、standing、快照和推送全部继续使用 `entrant_id`，不需要改变赛况主路径。

### 7.5 Telegram 只处理真正歧义

- 精确身份或全局唯一名称命中：直接自动订阅，不要求用户确认。
- 同一选手有多个有效名称候选：不猜测，不建立该选手的 entrant 映射；现有 `/startgg go` 只负责 tournament 关键词歧义，不应被描述成已经支持身份候选确认。
- `/watch <event_url>`：继续作为用户明确指定 event 的控制入口，不再承担正常自动发现的必需步骤。

## 8. 最小实施范围

推荐只改动以下直接相关位置：

1. [`src/services/startggPresetConfig.ts`](../../src/services/startggPresetConfig.ts)：预设同步继续从 user URL 解析身份，不改变用户配置方式。
2. [`src/services/startgg/queries.ts`](../../src/services/startgg/queries.ts)：增加 tournament 候选与候选身份查询字段；`USER_PLAYER_QUERY` 增加 `user.id`。
3. [`src/services/startgg/client.ts`](../../src/services/startgg/client.ts)：增加分页候选查询和小批量身份查询。
4. [`src/services/startggDiscovery.ts`](../../src/services/startggDiscovery.ts)：保留 Player Sets，并合并候选目录与统一身份解析结果。
5. [`src/services/startggPresetSync.ts`](../../src/services/startggPresetSync.ts)：保存 `user_id`、`gamer_tag`，并在发现 event 时一并落 entrant 映射。
6. [`src/services/startggRepository.ts`](../../src/services/startggRepository.ts) 与 migration：只增加两列及相应读写。
7. [`src/services/startgg/tracker.ts`](../../src/services/startgg/tracker.ts)：手动 event 路径复用同一确定性身份规则。

不需要：

- 新服务或外部赛事源。
- LLM、模糊匹配库或自学习别名系统。
- 扫描所有游戏的 tournament 目录或所有历史赛事。
- 新的失败重试、fallback、降级或静默跳过。
- 修改赛况查询、决赛 Phase、快照、去重和 Telegram 推送主逻辑。

## 9. 决策建议

1. 不按现有 `startgg-player-id-mismatch-solution.md` 原样实施。
2. 保留其中“赛事内 Entrant 是最终监控身份”的部分。
3. 保留跨游戏 Player Sets 发现，并用本报告的受限 SF6 候选发现补齐已证实的断链事故。
4. 将方案状态从“方案已确定”改为“需按 Review 修订”后再进入实施。

在本次真实事故上，推荐方案已经同时满足：

- 用户不需要知道或复制 event URL。
- 不依赖断裂的全局 Player -> Sets 关联。
- 不扫描无关游戏和历史 tournament 目录。
- 不损失既有的跨游戏正常关联发现能力。
- 不把赛事 Player ID 污染到全局预设。
- 自动发现时直接得到正确 Entrant ID。
- 能识别并拒绝 `Zhen -> Zheng ze` 这类 API 子串假阳性。

## 10. 参考资料

- [start.gg 官方：Tournaments by Videogame](https://developer.start.gg/docs/examples/queries/tournaments-by-videogame/)
- [start.gg 官方：Entrants within a Tournament](https://developer.start.gg/docs/examples/queries/entrants-by-tournament/)
- [start.gg 官方：Glossary](https://developer.start.gg/docs/glossary/)
- [start.gg 官方：Rate Limits](https://developer.start.gg/docs/rate-limits/)
- [start.gg 公开 schema：TournamentPageFilter](https://smashgg-schema.netlify.app/reference/tournamentpagefilter.doc)
- [start.gg 公开 schema：Tournament](https://smashgg-schema.netlify.app/reference/tournament.doc)
- [start.gg 公开 schema：ParticipantPageFilter](https://smashgg-schema.netlify.app/reference/participantpagefilter.doc)
- [start.gg 公开 schema：Participant](https://smashgg-schema.netlify.app/reference/participant.doc)
- [start.gg 公开 schema：Event](https://smashgg-schema.netlify.app/reference/event.doc)
