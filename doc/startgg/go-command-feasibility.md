# start.gg `/startgg go` 一步订阅可行性评估

评估日期：2026-06-27

## 1. 目标

当前 start.gg 功能的主要体验问题是使用前置动作过多：

1. 固定选手清单已经存在，但用户仍需要手动 `/watch <event_url>` 添加赛事。
2. 添加赛事后还需要手动 `/fetchstartgg` 或 `/startggpoll on` 才能进入持续监控。
3. 用户在比赛期间已经知道“现在有比赛”，但系统没有把这个上下文转化为动作。

目标交互应收敛为：

```text
/startgg go
```

执行后直接：

1. 同步 `data/startgg_preset_players.json` 中的固定选手。
2. 根据这些选手在 start.gg 上的当前/近期 set 记录发现他们参与的 event。
3. 激活发现到的 event。
4. 立即执行一次检查。
5. 开启 start.gg 轮询。

## 2. 结论

可实现，推荐实现。

但需要明确一个边界：**只靠 player 的 set 历史，适合“比赛已经开始或 bracket 已生成”的场景；如果选手只是报名但尚未生成任何 set，无法稳定从 player sets 反推出 event。**

这个边界符合用户描述的“比赛期间我自己知道什么时候有比赛，直接输入 `/startgg go`”。也就是说，`go` 的语义不应是“全网预测报名赛事”，而应是“现在进入比赛监控模式，基于固定选手清单发现已经可追踪的赛事并订阅”。

不建议优先做复杂的自然语言赛事窗口、全站 tournament 扫描或网页抓取。它们会显著增加不确定性和维护成本，不符合本项目主路径优先的原则。

## 3. 现有能力盘点

### 3.1 已经具备

1. 固定选手配置：`data/startgg_preset_players.json`
2. 固定选手同步：`syncStartggPresetPlayers()`
3. 手动检查主路径：`runStartggWatchNow()`
4. 状态抓取与推送：`runStartggWatchOnce()`
5. 轮询开关：`enableStartggPolling()` / `disableStartggPolling()`
6. 加速轮询：`updateStartggFastWatch()`
7. start.gg GraphQL 客户端：`graphql-request`
8. 当前 watch 表结构支持多个 active event

### 3.2 当前阻塞点

1. `/startgg` 只支持引导和 `status`，没有 `go` 分支。
2. `/watch <event_url>` 使用 `replaceActiveStartggWatchEvent()`，会把其它 active event 关闭，交互层实际是单 event。
3. 现有查询只有：
   - event -> entrants
   - event -> sets
   - event -> standings
   - user -> player
4. 缺少 player -> sets -> event 的发现查询。
5. 缺少“批量替换 active events”的仓储函数。

## 4. start.gg API 可行性

官方 GraphQL schema 支持从 `player(id)` 查询该选手的 set history：

```graphql
player(id: ID!) {
  sets(page: Int, perPage: Int, filters: SetFilters): SetConnection
}
```

官方示例也展示了 `player(id).sets` 可以返回 set 所属的 `event` 和 `tournament`。

同时：

1. `SetFilters` 支持 `playerIds`、`eventIds`、`tournamentIds`、`updatedAfter` 等过滤字段。
2. `Event` 有 `id`、`name`、`slug`、`sets`、`entrants` 等追踪所需字段。
3. `Tournament` 有 `id`、`name`、`slug`、`startAt`、`endAt`、`timezone`。
4. start.gg 当前限制是平均 80 requests / 60 seconds，单次请求最多 1000 objects。

因此，发现链路可以成立：

```text
preset players
-> player_id
-> player(id).sets
-> set.event
-> event.slug
-> startgg_watch_events
-> runStartggWatchOnce()
```

官方参考：

1. GraphQL endpoint 与请求方式：https://developer.start.gg/docs/sending-requests/
2. API 鉴权：https://developer.start.gg/docs/authentication/
3. API 限流：https://developer.start.gg/docs/rate-limits/
4. Sets by Player：https://developer.start.gg/docs/examples/queries/sets-by-player/
5. Player schema：https://smashgg-schema.netlify.app/reference/player.doc
6. SetFilters schema：https://smashgg-schema.netlify.app/reference/setfilters.doc
7. Event schema：https://smashgg-schema.netlify.app/reference/event.doc
8. Tournament schema：https://smashgg-schema.netlify.app/reference/tournament.doc

## 5. 推荐方案

### 5.1 交互

新增：

```text
/startgg go
```

返回信息建议包含：

1. 同步到的固定选手数量。
2. 自动发现并激活的 event 数量。
3. 本次立即检查的项目数、选手数、状态变化数、进行中 set 数。
4. 自动轮询状态。

示例：

```text
start.gg go 已启动
固定选手：4 位
自动订阅项目：2 个
立即检查：项目 2 个，选手 4 位，状态变化 1 条，进行中 1 条
自动轮询：已开启
```

如果未发现 event，直接报错，不修改当前 active event：

```text
start.gg go 失败：没有从固定选手近期 set 中发现当前赛事。
```

这里不要静默保留旧 event 后继续轮询，否则用户会以为已经订阅新赛事。

### 5.2 自动发现规则

推荐主规则：

1. 先执行 `syncStartggPresetPlayers()`。
2. 读取 enabled watch players。
3. 对每个 `player_id` 查询近期 sets。
4. 从 set 中提取 event。
5. 保留 tournament 时间覆盖当前时刻的 event。
6. 去重后按 tournament/event 激活。

时间判断建议使用 tournament 的 `startAt/endAt`，因为当前项目文档已经说明 start.gg 监控按 tournament 活跃时段判断更合理。

如果某些 event 没有 tournament `endAt`，应直接暴露错误，而不是猜默认结束时间。

### 5.3 状态写入

新增批量仓储函数：

```ts
replaceActiveStartggWatchEvents(events)
```

语义：

1. 在一个 SQLite transaction 内关闭当前 active events。
2. 批量 upsert 自动发现的 events，并设为 active。
3. 如果发现结果为空，直接抛错，不修改数据库。

保留现有 `replaceActiveStartggWatchEvent()` 给 `/watch <event_url>` 使用，避免扩大改动面。

### 5.4 立即检查与轮询

`/startgg go` 激活 event 后执行：

1. `runStartggWatchNow(bot)`
2. `updateStartggFastWatch(bot, summary.pendingSetCount)`
3. `enableStartggPolling(bot)`

`enableStartggPolling()` 已经是幂等语义：已开启时返回 `false`。这里可以把返回结果用于展示“已开启/已经开启”，不需要新增状态机。

## 6. 推荐新增代码点

### 6.1 `src/services/startgg/queries.ts`

新增 player sets 查询：

```graphql
query PlayerRecentSets($playerId: ID!, $page: Int!, $perPage: Int!) {
  player(id: $playerId) {
    id
    sets(page: $page, perPage: $perPage, filters: { playerIds: [$playerId] }) {
      pageInfo {
        totalPages
      }
      nodes {
        id
        state
        completedAt
        event {
          id
          name
          slug
          startAt
          tournament {
            id
            name
            slug
            startAt
            endAt
            timezone
          }
        }
      }
    }
  }
}
```

### 6.2 `src/services/startgg/client.ts`

新增：

```ts
fetchPlayerRecentSets(playerId)
```

保持现有分页风格即可。

### 6.3 `src/services/startgg/tracker.ts` 或新增 `src/services/startggDiscovery.ts`

建议新增独立服务：

```ts
discoverStartggActiveEventsForPlayers(players, now)
```

它只做发现，不写库、不发消息。

### 6.4 `src/services/startggRepository.ts`

新增：

```ts
replaceActiveStartggWatchEvents(events)
```

当前表结构无需迁移。

### 6.5 `src/services/startggPresetSync.ts`

新增：

```ts
runStartggGo(bot)
```

职责：

1. 同步 preset players。
2. 发现 active events。
3. 批量激活 events。
4. 执行一次检查。
5. 返回摘要。

### 6.6 `src/bot/interactive.ts`

在 `/startgg` 分支里新增：

```text
arg === 'go'
```

不要新增单独命令，避免命令面继续膨胀。

## 7. 不推荐方案

### 7.1 全站 tournament 扫描

做法是按日期查询当前 tournament，再扫描 participants/events/entrants，找固定选手。

不推荐原因：

1. 请求量不可控。
2. 需要引入 game、地区、规模、名称等过滤配置。
3. 很容易变成“全网搜索系统”，偏离个人 bot 主路径。
4. 在 start.gg 限流下不稳定。

### 7.2 自然语言赛事窗口

现有 `doc/startgg/auto-monitor-plan.md` 提过赛事窗口方案，但它仍要求提前维护窗口和 event 信息。

本次目标是“比赛期间输入一条命令直接开始”，赛事窗口不是最短路径。

### 7.3 网页抓取

不推荐。

项目已有官方 API token 和 GraphQL 客户端，网页抓取会增加页面结构变更风险，也不符合现有 start.gg 方案边界。

## 8. 风险与边界

### 8.1 尚未生成 set 的赛事

这是最大边界。

如果赛事已报名但 bracket/set 还没生成，`player(id).sets` 可能拿不到该 event。此时 `/startgg go` 应直接报“没有发现当前赛事”，不应猜测赛事。

### 8.2 多项目噪音

一个选手可能同时参加多个 event，例如 SF6、KOF、2XKO。

如果这些 event 都在当前 tournament 时间内，`go` 会全部激活。这个行为符合“根据跟踪选手名单获取他们参与的赛事然后订阅”，但推送量可能比单项目更高。

如果后续需要限制项目，应另行增加显式配置，例如只监控指定 videogame ids。不要在第一版里用事件名关键字硬猜。

### 8.3 历史赛事误命中

如果 tournament `endAt` 不准确，近期 sets 可能把旧 event 带出来。

处理方式应是依赖 start.gg 的 `startAt/endAt`，不做本地兜底时间。字段缺失或不可信时直接暴露错误。

### 8.4 请求量

当前固定清单只有 4 位选手，请求量可控。

当固定选手数量明显增加时，发现阶段请求量会线性增长。第一版不需要做复杂优化，但报告结果应展示检查了多少位选手、发现多少 event，方便判断是否过量。

## 9. 实施优先级

建议按以下顺序实现：

1. 新增 player recent sets 查询。
2. 新增 active event discovery 服务。
3. 新增批量替换 active events 仓储函数。
4. 新增 `runStartggGo()` 编排函数。
5. 在 `/startgg` 命令接入 `go` 分支。
6. 更新 `doc/startgg/mvp-usage.md`，把主入口改成 `/startgg go`。

## 10. 验收口径

1. 发送 `/startgg go` 后，无需手动 `/watch <event_url>`。
2. 发送 `/startgg go` 后，无需手动 `/startggpoll on`。
3. 固定选手清单会先同步到 watch players。
4. 自动发现到的 event 会成为 active events。
5. 发现结果为空时不修改 active events，并直接返回失败原因。
6. 发现成功后会立即执行一次 start.gg 检查。
7. 发现成功后会开启 20 分钟轮询。

