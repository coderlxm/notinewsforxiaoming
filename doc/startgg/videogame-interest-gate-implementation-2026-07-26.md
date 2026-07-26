# start.gg 项目兴趣门控实施记录

## 实施结果

固定关注选手的跨游戏近期 Set 不再直接激活 event。系统先读取 start.gg `videogame.id`，再按项目兴趣执行：

- `follow`：允许 event 进入原 start.gg 监控、种子关注和快速轮询。
- `ignore`：不激活、不询问、不推送。
- 未知：停用同 slug 的既有 watch event，保存待确认 event，只发送一次 Telegram 确认卡。
- “仅关注本届”：按 event slug 建立有效期至赛事结束的临时许可。

确认卡提供：

- 关注这个项目
- 仅关注本届
- 忽略这个项目

选择前，未知项目不会生成固定选手战果、种子选手战果、最终阶段消息或两分钟快速轮询。

无关键词点击 `👊 比赛了` 同样经过兴趣门控，不会把同一时间发现的所有游戏自动标记为关注。带关键词明确选中的赛事和直接输入 event 链接属于明确意图，会记录对应 videogame 为关注。

## 数据变更

`startgg_watch_events` 新增：

- `videogame_id`
- `videogame_name`

新增表：

- `startgg_videogame_preferences`
- `startgg_pending_events`
- `startgg_event_interest_overrides`

数据库迁移版本为 16。

## 主要代码位置

- GraphQL videogame 字段：`src/services/startgg/queries.ts`
- 跨游戏发现结果：`src/services/startggDiscovery.ts`
- 兴趣数据访问：`src/services/startggInterestRepository.ts`
- 兴趣门控与确认消息发送：`src/services/startggPresetSync.ts`
- Telegram 回调解析：`src/bot/callbacks.ts`
- Telegram 回调处理：`src/bot/interactive.ts`
- 确认卡格式：`src/formatters/startggFormatter.ts`

## 部署后的首次交互

历史 watch event 没有可靠的 videogame 兴趣记录，不能把所有既有 `auto` event 自动视为关注，否则 Marvel Tokon 会污染兴趣画像。

因此部署后的第一次 15 分钟轮询会：

1. 从 start.gg 补齐当前发现 event 的 videogame。
2. 将没有兴趣记录的 event 暂停。
3. 分别发送未知项目确认卡。

本次线上状态预期出现：

- Street Fighter 6：点击“关注这个项目”后，EWC LCQ 恢复并继续监控。
- Marvel Tokon：点击“忽略这个项目”后，该项目不再询问或推送。

这是一次性兴趣初始化。之后同 videogame 直接复用已保存选择。

## 与既有链路的关系

- 已完成正式 Set 才触发关注选手战果的规则保持不变。
- Top 16/32 档位保持不变，但只会作用于通过兴趣门控的 event。
- 最终阶段赛事级跟踪保持不变，但未知 event 无法进入该路径。
- start.gg 固定轮询和两分钟快速轮询周期不变。
- 已发送 Set 的去重记录不需要清理。

## 线上排查字段

遇到兴趣误判时优先核对：

- `startgg_watch_events.videogame_id`
- `startgg_watch_events.active`
- `startgg_videogame_preferences`
- `startgg_pending_events`
- `startgg_event_interest_overrides`
