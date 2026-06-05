# start.gg 监控耗时分析与改进建议

## 结论

当前 `/fetchstartgg` 在赛事进行中需要约一分钟才返回，主要不是 Telegram 回复慢，也不是 start.gg API 单次请求天然必须这么久，而是当前实现的数据获取粒度过大。

现有实现是一个 MVP 风格的“event 全量快照”方案：对每个活跃 event 先分页拉完整 `sets`、完整 `entrants`、完整 `standings`，再在本地按关注选手过滤。这个思路能保证逻辑简单，但赛事进行中 set 数量持续增长后，请求数量和响应体都会快速放大。

所以判断是：外部 API 延迟和分页是客观存在的正常耗时，但一分钟级别的主因是实现方式不适合 live 监控主路径。

## 当前链路

入口：

- `src/bot/interactive.ts:143` 的 `/fetchstartgg`
- 先回复“开始手动检查 start.gg 选手状态...”
- 然后同步等待 `runStartggWatchByApiWindow(bot)` 完成后才回复最终结果

执行链路：

- `src/services/startggPresetSync.ts:57` `syncStartggApiActiveEvents`
- 对所有 active event 顺序请求 `fetchEventMeta`
- `src/services/startggPresetSync.ts:100` 调用 `runStartggWatchOnce`
- `src/services/startggTracker.ts:714` 对每个 target event 顺序处理
- `src/services/startggTracker.ts:716` 调用 `fetchEventTrackingSnapshot`
- `src/services/startggTracker.ts:456` 开始拉 event 全量快照

`fetchEventTrackingSnapshot` 里面的关键耗时点：

- `src/services/startggTracker.ts:457` 请求 event header
- `src/services/startggTracker.ts:471` 起，分页拉完整 `event.sets`，每页 120
- `src/services/startggTracker.ts:487` 起，分页拉完整 `event.entrants`，每页 300
- `src/services/startggTracker.ts:503` 起，分页拉完整 `event.standings`，每页 350

之后才进入：

- `src/services/startggTracker.ts:727` 遍历所有关注选手
- `src/services/startggTracker.ts:728` 调用 `computePlayerSnapshot`
- `src/services/startggTracker.ts:627` 从全量 entrants 中找该 player 的 entrant
- `src/services/startggTracker.ts:644` 从全量 sets 中过滤该 entrant 的对局
- `src/services/startggTracker.ts:655` 从全量 standings 中找该 entrant 的排名

这意味着如果只关注 4 个选手，但 event 有数千场 set，系统仍然会先拉完整 event。

## 为什么赛事进行中会变慢

start.gg 官方 API 文档明确说明：

- GraphQL 可以只请求业务需要的数据，避免多余字段和多余对象。
- `event.sets` 是分页查询，需要按页取。
- `player(id).sets(...)` 可以按选手查询相关 set。
- API 限制是平均每 60 秒不超过 80 个请求，单请求最多 1000 objects。

参考：

- https://developer.start.gg/docs/benefits-of-gql
- https://developer.start.gg/docs/examples/queries/sets-in-event/
- https://developer.start.gg/docs/examples/queries/sets-by-player/
- https://developer.start.gg/docs/rate-limits/

当前实现的问题是没有利用“只请求业务需要的数据”这个 GraphQL 优势，而是按 event 把大部分不相关数据都拉回来。

估算一个常见 live event：

- 3000 个 sets，按每页 120，需要 25 个 sets 请求
- 1000 个 entrants，按每页 300，需要 4 个 entrants 请求
- 1000 个 standings，按每页 350，需要 3 个 standings 请求
- 再加 header、event meta

单个 event 就可能需要 30 多次顺序 GraphQL 请求。如果同时有多个活跃 event，或者 start.gg 单页响应较慢，一分钟级别就很容易出现。

这不是“代码 CPU 算得慢”。本地过滤和 SQLite upsert 都不是主要矛盾。主要矛盾是网络请求数量和数据面过大。

## 不建议作为主改法的方向

1. 不建议先做重试、降级、兜底。
   这不能减少主路径数据量，只会让慢请求更难暴露根因。

2. 不建议把全量分页并发化作为主改法。
   并发可以缩短墙钟时间，但会更快撞上 start.gg 的请求限制，也没有减少 API 压力。

3. 不建议用短缓存作为核心方案。
   缓存只能改善短时间内重复手动触发，不能改善第一次拉取，也会削弱 live 监控的实时性。

4. 不建议把 `/fetchstartgg` 改成异步后台跑、先返回“已提交”。
   这只是改变用户感知，不解决状态更新实际变慢的问题。

## 最合理、提升最大的改进建议

把 start.gg 监控从“event 全量快照模式”改为“关注选手优先模式”。

核心目标：

- 每次活跃检查只拉关注选手相关的小集合 set。
- 不再每 20 分钟或每次手动触发都拉完整 event 的所有 sets、entrants、standings。
- 保持状态判断仍然围绕当前业务：胜者组、败者组、淘汰、完赛、最近一场 set、比分、set 链接。

建议实现：

1. 新增或复用一张映射关系，保存 `watch_player_id + watch_event_id -> event_id + entrant_id + entrant_name`。
   这个映射只需要在添加 event、添加 player、首次活跃检查时建立。建立映射时可以分页扫 event entrants，因为这是低频动作，不应该每次监控都重复做。

2. 每次监控时，对每个关注选手请求 `player(id).sets(perPage: N, page: 1)`。
   查询字段包含 set id、state、round、fullRoundText、displayScore、winnerId、completedAt、event id 或 slug、slots entrant id。

3. 在本地用 `event_id` 和 `entrant_id` 过滤出目标 event 内该选手的 set。
   当前关注清单只有少量选手，这会把请求规模从“event 总 set 数”改成“关注选手数 × 活跃 event 数”。

4. 只在状态变化需要展示最终名次时，再取与名次相关的最小数据。
   主监控路径先保证“最近 set + 状态变化”快速返回。名次不是每次判断都必须全量 standings。

5. 删除或旁路 `fetchEventTrackingSnapshot` 在监控主路径中的全量 `sets / entrants / standings` 拉取。
   这个函数可以保留给人工排查或后续独立管理命令，但不应该继续作为 live 监控主路径。

## 预期收益

以当前固定选手配置看，`data/startgg_preset_players.json` 里只有 4 个选手。

如果当前只有 1 个活跃 event：

- 现状：约 `1 + setsTotalPages + entrantsTotalPages + standingsTotalPages` 次请求。
- 改后：约 `4` 次 player sets 请求，加少量 event meta 或映射初始化请求。

如果 event 已经有数千场 set，现状可能是 30 次以上顺序请求；改后主路径请求数基本与 event 总 set 数脱钩。

这是对一分钟等待最直接的改善。

## 建议优先级

优先级：高。

原因：

- 直接影响手动 `/fetchstartgg` 的反馈时间。
- 直接影响 resident 每 20 分钟任务的 API 压力。
- 当前问题会随着赛事规模增大而变严重。
- 改动集中在 start.gg 数据获取层，不需要改 Telegram 交互模型。

## 推荐落地边界

第一版只做主路径：

- 建立 watched player 在 watched event 中的 entrant 映射。
- 新增 player-centric set 查询。
- `runStartggWatchOnce` 改用 player-centric 数据计算 snapshot。
- 不引入重试、缓存、后台队列或替代发送通道。

不在第一版处理：

- 多账号限流策略。
- 复杂任务队列。
- 对 start.gg API 失败后的兜底通知。
- 大规模历史 set 归档。

