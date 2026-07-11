# start.gg 加速轮询请求范围优化方案

状态：已实施

## 问题

当前 2 分钟加速轮询调用完整的 `runStartggWatchNow()`，每次都会执行：

```text
同步预设选手
→ 为全部选手查询近期 sets
→ 自动发现赛事
→ 检查全部 active event
```

加速轮询真正需要关注的只是已经发现存在进行中 set 的 event。重复执行选手级赛事发现和无关 event 检查，会显著增加 start.gg GraphQL 请求。

## 目标语义

- 20 分钟固定轮询负责完整发现和全量检查。
- 2 分钟加速轮询只负责追踪存在进行中 set 的 event。
- 加速轮询不会自动发现新赛事；新赛事仍由下一次固定轮询发现。
- 某个 event 不再存在进行中 set 后，立即从加速轮询范围移除。
- 所有加速 event 都没有进行中 set 后，停止 2 分钟计时器。

## 实现方案

### 1. 返回进行中 event

将 `StartggWatchSummary` 从只返回：

```text
pendingSetCount
```

扩展为同时返回：

```text
pendingEventSlugs
```

`processEvent()` 已经能计算该 event 的 `pendingSetCount`。当计数大于 0 时，将该 event slug 加入结果。

### 2. 加速计时器保存 event 范围

将：

```text
updateStartggFastWatch(bot, pendingSetCount)
```

调整为：

```text
updateStartggFastWatch(bot, pendingEventSlugs)
```

计时器只保存下一轮需要检查的 event slug：

- 数组非空：2 分钟后执行加速检查。
- 数组为空：取消加速计时器。

### 3. 拆分固定轮询与加速轮询

固定轮询继续执行：

```text
runStartggWatchNow(bot)
```

它负责同步选手、自动发现赛事和检查全部 active event。

加速轮询改为直接执行：

```text
runStartggWatchOnce(bot, { eventSlugs: pendingEventSlugs })
```

它不调用 `syncStartggPresetPlayers()`、`discoverStartggActiveEventsForPlayers()` 或 `syncAutoDiscoveredStartggWatchEvents()`。

加速检查结束后，使用本轮返回的 `pendingEventSlugs` 安排下一次加速检查，因此已经结束的 event 会自然退出加速范围。

### 4. 与固定轮询协调

固定轮询完成后，以最新的 `pendingEventSlugs` 重设加速计时器。这样固定轮询发现新 pending event 时，可以加入加速范围；不需要额外状态表。

## 请求量变化

以 6 位选手、2 个 active event、其中 1 个 event 有进行中 set 为例：

- 优化前每次加速轮询：至少约 12 次 GraphQL 请求。
- 优化后每次加速轮询：只查询目标 event 的 header、sets 和 standings，通常至少约 3 次请求。
- 每小时 30 次加速轮询时，约从 360 次降到 90 次，实际数量仍受分页影响。

固定轮询仍为每小时 3 次，负责保持赛事发现完整性。

## 自动停止兼容

赛事完赛自动停止判断保留在完整固定轮询主路径。加速轮询发现所有 pending set 消失时只停止加速计时器，不关闭固定轮询。

## 修改范围

1. `src/services/startgg/tracker.ts`：汇总 `pendingEventSlugs`。
2. `src/services/startggPresetSync.ts`：透传 `pendingEventSlugs`。
3. `src/scheduled/jobs.ts`：拆分完整轮询和加速 event 轮询。
4. `src/bot/interactive.ts`：手动检查和 `/startgg go` 按 event slug 启动加速轮询。
5. `doc/startgg/current-implementation.md`：更新加速轮询事实描述。
