# start.gg 轮询自动停止方案

状态：已实施

## 目标

比赛结束后自动关闭 start.gg 固定轮询，避免依赖手动执行 `/startggpoll off`，同时避免因为比赛间歇或暂时没有新对局而提前停止。

## 建议方案

以 start.gg 返回的 tournament `endAt` 作为唯一自动停止依据。

每次 `runStartggWatchNow()` 完成赛事发现和状态检查后：

1. 查询当前 active event 所属 tournament 的 `endAt`。
2. 将 `tournament_end_at` 保存到 `startgg_watch_events`。
3. 如果仍存在尚未到达 `endAt` 的 active event，保持轮询。
4. 如果所有 active event 的 `endAt` 都已到达，关闭 20 分钟固定轮询和 2 分钟加速轮询，并将持久化开关写为关闭。

自动发现和手动订阅的 event 使用同一规则。用户再次执行 `/startgg go`、`/startggpoll on` 或指定新的 event 后，可以重新开启。

## 不采用的判断

- 不根据连续多轮没有状态变化停止。比赛间歇可能很长，没有变化不代表赛事结束。
- 不根据 `pendingSetCount = 0` 停止固定轮询。尚未生成下一轮 set 时也会是 0。
- 不根据关注选手全部淘汰停止。轮询监控的是当前订阅赛事，而且选手状态和 standings 可能存在延迟。
- 不使用本地猜测的超时时间代替 start.gg 的赛事结束时间。

## 数据调整

在 `startgg_watch_events` 增加：

```text
tournament_end_at TEXT
```

解析 event header 或自动发现 event 时写入 start.gg 返回的 tournament `endAt`。

## 执行位置

在一次完整 start.gg 检查成功结束后执行自动停止判断。只有外部查询和本地状态更新全部成功，才根据明确的赛事结束时间关闭轮询；任何错误直接暴露，不改变轮询状态。

## 用户可见行为

- `/startgg status` 展示赛事结束时间和轮询是否因赛事结束自动关闭。
- 自动关闭时发送一条 Telegram 通知：`start.gg 当前订阅赛事已结束，自动轮询已关闭。`
- `/startggpoll off` 和 `/startgg deleteall` 的现有手动停止行为保持不变。

## 最小实现范围

1. 数据库迁移增加 `tournament_end_at`。
2. start.gg event 查询结果增加 tournament `endAt`。
3. repository 保存结束时间。
4. 每轮成功检查后判断全部 active event 是否已结束。
5. 自动关闭轮询并发送一次通知。
6. 更新 `/startgg status` 和当前实现文档。
