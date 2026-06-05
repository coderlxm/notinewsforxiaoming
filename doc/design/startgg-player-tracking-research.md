# start.gg 选手比赛进度监控技术预研（2026-05-24）

## 1. 目标与问题定义

你要解决的是同一个痛点：
- 我关注的选手是否参赛
- 当前打到哪一轮
- 是否掉入败者组
- 是否已淘汰或晋级

目标是把这套信息自动推送到当前 Telegram bot，而不是每次手动进网站查。

## 2. 联网调研结论（最新）

### 2.1 官方 API 是存在的，且是 GraphQL

start.gg 官方开发文档当前明确提供 GraphQL API：
- Endpoint：`https://api.start.gg/gql/alpha`
- 鉴权：`Authorization: Bearer <token>`
- 限流：`80 requests / 60s`，单次请求最多 `1000 objects`

官方示例已覆盖我们要用到的能力：
- 通过 `event(slug: ...)` 拿 event id
- 查 `event.standings(...)`（名次）
- 查 `event.sets(...)`、`phaseGroup.sets(...)`（对局）
- 查 `player(id).sets(...)`（选手近期对局）

结论：官方 API 可直接支持“选手参赛状态+轮次+胜败走向”的主需求。

### 2.2 合规点

start.gg API Terms 中对自动化使用有明确约束（含请求最小化、不可绕过限制、不可滥用/转售等）。  
如果做长期服务，优先走官方 token + 合理轮询频率，风险最低。

## 3. 对当前项目的适配判断

当前项目已经具备完整主路径：
- 定时执行：`node-schedule`
- 推送渠道：`telegraf` + `sendTelegramMessage`
- 本地持久化：`better-sqlite3`
- 多业务 mode 分发：`runMode`

因此这个功能不需要新系统，直接新增一个 `startgg_watch` 业务分支即可。

## 4. 推荐落地方案（主推）

## 4.1 数据来源

只用官方 GraphQL API（token 鉴权），不依赖网页抓取。

## 4.2 最小数据模型

建议新增三张表（延续当前 sqlite 风格）：

1. `startgg_watch_players`
- `id`
- `player_name`
- `player_id`（start.gg player id）
- `enabled`
- `created_at`

2. `startgg_watch_events`
- `id`
- `tournament_slug`
- `event_slug`
- `event_id`（首次解析后缓存）
- `active`
- `created_at`

3. `startgg_watch_snapshots`
- `id`
- `watch_player_id`
- `watch_event_id`
- `status`（`not_entered | in_winners | in_losers | eliminated | completed`）
- `placement`（可空）
- `last_set_id`（可空）
- `last_set_round`（可空）
- `last_set_score_text`（可空）
- `captured_at`

## 4.3 状态计算规则（主路径）

每次轮询按“事件 -> 关注选手”计算：

1. 先判断是否参赛
- 在 event entrants / standings / sets 中找不到该选手 entrant，记 `not_entered`

2. 找最近一场已完成或进行中的 set
- 通过 `winnerId`、`round`、`state`、`displayScore` 等字段判读

3. 规则化状态
- `round > 0` 且仍有后续对局：`in_winners`
- 出现败者侧轮次（常见为负轮次）且未出局：`in_losers`
- standings 已有最终名次且无后续对局：`eliminated` 或 `completed`

4. 只在状态变化时推送
- 例如：`in_winners -> in_losers`、`in_losers -> eliminated`

## 4.4 Telegram 推送形态（建议）

单条简报固定结构：
- 赛事：`COMBO BREAKER 2026 / Street Fighter 6`
- 选手：`XXX`
- 当前状态：`败者组进行中`
- 最近结果：`2-1 vs YYY`
- 当前轮次：`Top 24 Losers R2`
- 链接：对应 bracket / set 页面

这样可以在一眼内回答“在不在打、打到哪、生死状态”。

## 5. 建议实施顺序（MVP）

1. 配置 start.gg API token（官方） 补充token：2b8c340d748a0c212844e34e501c1a2a
2. 先接单赛事单项目（你给的 Combo Breaker 2026 SF6）
3. 先支持 3-5 个关注选手
4. 只做“状态变化推送”，不做全量刷屏
5. 稳定后再加 bot 命令管理关注名单

## 6. 结论

这个需求可以做，而且和当前项目非常匹配。  
工程上最稳的路线是：**官方 GraphQL API + 本地状态快照去重 + Telegram 状态变更推送**。

## 7. 参考资料（2026-05-24 检索）

- start.gg GraphQL 请求方式  
  https://developer.start.gg/docs/sending-requests/
- start.gg API 鉴权  
  https://developer.start.gg/docs/authentication/
- start.gg API 限流  
  https://developer.start.gg/docs/rate-limits/
- start.gg Query 示例（Get Event / Event Standings / Sets）  
  https://developer.start.gg/docs/examples/queries/get-event/  
  https://developer.start.gg/docs/examples/queries/event-standings/  
  https://developer.start.gg/docs/examples/queries/sets-in-event/  
  https://developer.start.gg/docs/examples/queries/sets-by-player/
- start.gg GraphQL Schema（Set）  
  https://developer.start.gg/reference/set.doc
- start.gg API Terms  
  https://www.start.gg/about/apitos
