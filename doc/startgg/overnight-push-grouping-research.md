# start.gg 凌晨赛况推送归类优化研究报告

研究日期：2026-07-19（Asia/Shanghai）  
研究对象：凌晨 start.gg 赛况消息过多、消息流连续被打断的问题

## 1. 结论摘要

当前 Telegram Bot 可以通过应用层把多条 start.gg 文本通知整理成一条或少量摘要消息，但标准 Telegram `sendMediaGroup` 不能把这些 HTML 文本消息直接组成消息组。

昨夜的体验问题不是推送错误，而是当前通知粒度过细：同一赛事中，选手状态更新和赛事级决赛阶段赛果分别逐条发送；每条消息还会重复赛事名称、项目名称和链接。更适合的主路径是：

```text
一次轮询产生的通知
  -> 按赛事归类
  -> 按“关注选手更新 / 决赛阶段赛果”分组
  -> 发送一条赛事摘要消息，必要时拆成两条
```

这样可以保留每条赛况的内容和链接，同时把消息流从“逐场刷屏”改成“按轮询批次阅读”。

Telegram 目前还提供了新的 Rich Messages 能力，可以在一条消息中表达列表、表格和可折叠内容；但当前项目使用 `telegraf@4.16.3`，代码没有接入这条 API。第一阶段没有必要为了归类通知切换到新的消息协议，应用层生成普通 HTML 摘要更直接。

## 2. 昨夜实际推送情况

### 2.1 统计范围

服务器 SQLite 中的 UTC 记录按北京时间换算，统计窗口为：

```text
2026-07-19 00:00–08:00（Asia/Shanghai）
```

数据库中的 `startgg_sent_messages` 记录显示，该时间段实际发送了：

```text
19 条 Telegram 消息
```

消息时间从北京时间约 02:20 持续到 07:40。较密集的时段包括：

- 05:40：3 条
- 06:00：2 条
- 06:40：2 条
- 07:40：2 条

### 2.2 推送内容来源

这些消息主要来自：

```text
World Warrior 2026 - US/Canada East 3 / Street Fighter 6
```

该赛事当时只有一名被监控选手 `FLY | Punk` 产生了选手级更新，但同一赛事还进入了决赛阶段跟踪。

数据库记录显示：

- `startgg_pushed_sets` 在该时段记录了 13 条关注选手 Set 推送标记。
- `startgg_event_pushed_sets` 记录了 10 条决赛阶段 Set 推送标记。
- 两条链路之间存在部分 Set 重叠，且首条状态消息会一次性建立历史 Set 基线，所以最终实际发送数是 19 条，而不是两个记录数量直接相加。

因此，用户看到的消息并不只是“我关注的选手刚打完一场”，还包含了同一赛事决赛阶段内其他选手的逐场赛果。

### 2.3 为什么阅读体验不佳

当前消息流有几个叠加问题：

1. **通知粒度是单条 Set**：一场赛事连续完成多场比赛时，每场都会成为独立消息。
2. **选手级和赛事级消息混在一起**：关注选手的状态变化与 Top 8 阶段其他选手的赛果没有视觉分组。
3. **公共信息重复**：每条消息都会重复完整赛事名、项目名和项目页链接。
4. **消息按发送完成顺序进入聊天**：多个 active event 由 `Promise.all` 并行处理，多个赛事的通知没有一个明确的轮询批次边界。
5. **凌晨集中出现**：轮询本身每 20 分钟执行一次，比赛结果可能在一轮检查中集中出现，逐条发送会形成连续消息流。

所以问题不是信息太多，而是缺少“本轮发生了什么”的汇总层。

## 3. 当前源码行为

### 3.1 选手状态通知

在 [`src/services/startgg/tracker.ts`](../../src/services/startgg/tracker.ts) 的 `processEvent()` 中：

- 每名选手先计算最新状态和新增 Set。
- 每个新增 Set 都调用一次 `formatStartggStatusChangedMessage()`。
- 然后立即调用 `sendTelegramMessageWithId()`。
- 首次建立基线时虽然会标记多条历史 Set，但只发送一条最新状态消息。

### 3.2 决赛阶段通知

同一个 `processEvent()` 在决赛阶段跟踪中：

- 遍历每个新完成的决赛阶段 Set。
- 每个 Set 单独调用 `formatStartggFinalPhaseSetResult()`。
- 然后立即发送一条 Telegram 消息。
- 只有已经通过选手级链路推送过的同一个 Set，才会被事件级去重逻辑跳过。

### 3.3 当前没有批次概念

`runStartggWatchOnce()` 会并行处理多个 active event，但当前返回值只有统计数字：

```text
checkedEvents
checkedPlayers
changed
activeSetCount
```

通知在 `processEvent()` 内部已经发送完成，外层没有机会按“本轮、赛事、通知类型”重新组织消息。

SQLite 目前保存了已发送消息的 `message_id`，用于 `/startgg deleteall`，但没有保存消息所属赛事、通知类型或轮询批次。

## 4. Telegram 原生能力边界

### 4.1 `sendMediaGroup` 不适合当前文本通知

Telegram Bot API 的 [`sendMediaGroup`](https://core.telegram.org/bots/api#sendmediagroup) 用于把照片、视频、文件或音频作为媒体相册发送。当前 start.gg 通知是带 HTML、链接和比分的普通文本，不属于媒体消息，因此不能直接把这些消息传给 `sendMediaGroup` 形成文本消息组。

项目已经在 AV 推送中使用媒体组，但那是图片/媒体相册场景，与 start.gg 文本赛况不是同一种能力。

### 4.2 普通文本消息可以由应用层合并

当前使用的 [`sendMessage`](https://core.telegram.org/bots/api#sendmessage) 本身只发送一条文本消息，文本长度上限为实体解析后的 4096 个字符。

因此最直接的做法不是寻找 Telegram 的“文本消息组”接口，而是在 bot 内先把多条通知格式化为一条摘要，再调用一次 `sendMessage`。摘要需要控制在 4096 字符内，并保留每场对局的链接。

### 4.3 Rich Messages 是可选的后续能力

Telegram Bot API 10.1/10.2 新增了 [Rich Messages](https://core.telegram.org/bots/api#rich-messages) 和 [`sendRichMessage`](https://core.telegram.org/bots/api#sendrichmessage)：

- 支持列表、表格、标题、分隔线和可折叠 `details` 等结构。
- 一条 Rich Message 最多支持 32768 个 UTF-8 字符和 500 个 block。
- 它仍然是一条消息，只是消息内容内部具有结构化 block，不是多个普通消息的相册分组。

当前项目依赖 `telegraf@4.16.3`，源码中没有调用 `sendRichMessage`。若后续采用，需要单独确认 Telegraf 类型和 API 透传支持，或直接封装 Bot API 请求。这条路线能力更强，但改动面和兼容性评估都高于普通 HTML 摘要。

另外，Bot API 文档中的 ephemeral group messages 是“只对指定用户可见的临时消息”，不是把多条赛况合并成一个消息组，也不适合解决本问题。

## 5. 可行优化方向

### 5.1 推荐：按轮询批次和赛事发送摘要

这是当前最小且最符合需求的方向。

每次 `runStartggWatchOnce()` 不立即发送单条消息，而是先收集通知项：

```text
通知项
  - event
  - category: player_status | final_phase_result
  - player / round / score / winner
  - set_url
```

然后按赛事生成摘要：

```text
🥊 start.gg 赛事更新
🏆 World Warrior 2026 - US/Canada East 3 / Street Fighter 6

👤 关注选手更新（N 条）
• FLY | Punk：败者组进行中，Losers Round 2，比分……
• FLY | Punk：……

🏁 决赛阶段赛果（N 条）
• Winners Final：A vs B，胜者：A
• Losers Final：C vs D，胜者：C

🔗 查看赛事
```

推荐按“赛事”作为第一层分组、按“选手更新 / 决赛阶段赛果”作为第二层分组。这样既能看到关注选手的重点信息，也能知道赛事整体进展，而不会让两类消息互相打散。

如果单个赛事摘要接近 4096 字符，按固定类别拆成两条：

1. 关注选手状态摘要。
2. 决赛阶段赛果摘要。

这比按字符机械切断更容易阅读。

### 5.2 保留重要状态，压缩重复赛果

可以在摘要内部继续保留每个新增 Set 的轮次、比分和链接，但不再为每个 Set 重复完整赛事头部。

建议保留：

- 关注选手的新对局。
- 关注选手的淘汰、晋级、最终名次变化。
- 决赛阶段的轮次、双方、比分和胜者。

建议将公共字段移到摘要头部：

- 赛事名。
- 项目名。
- 项目页链接。
- 本轮发现的消息数量。

### 5.3 一个赛事一个可编辑状态面板

也可以为每个 active event 保留一条消息，后续使用 [`editMessageText`](https://core.telegram.org/bots/api#editmessagetext) 更新内容。

优点是消息流非常干净；缺点是编辑消息不等于新增通知，用户可能不会像收到新消息那样注意到变化，而且历史赛果会被后续内容覆盖。

因此它更适合作为 `/startgg status` 的持续状态面板，不建议直接替换当前的赛况提醒主路径。

### 5.4 先汇总再发送，而不是增加延迟窗口

当前 20 分钟轮询本身已经天然形成一个批次边界。优先利用这次轮询调用内已知的通知集合即可，不需要再引入额外等待时间。

额外等待几分钟虽然能收集同一时间段更多结果，但会让赛况通知变慢，并引入新的定时和状态处理，不是这次问题的最小解决路径。

## 6. 推荐方案与实施边界

推荐第一阶段只做应用层文本摘要：

1. 将 `processEvent()` 中的即时发送改为返回或收集结构化通知项。
2. 由 `runStartggWatchOnce()` 按 event 聚合本轮通知。
3. 每个 event 按通知类别生成一条摘要；内容过长时固定拆为两类摘要。
4. 每条摘要仍记录 Telegram `message_id`，保证 `/startgg deleteall` 可以继续清理。
5. 保留现有 `startgg_pushed_sets` 与 `startgg_event_pushed_sets` 去重逻辑，不改变“哪些 Set 应该被发现”的业务判断。
6. 保留现有选手级通知和决赛阶段通知的内容，只改变发送组织方式。

暂不建议第一阶段：

- 把文本通知改造成 `sendMediaGroup`。
- 为此引入 Rich Messages 或切换 Telegram 框架。
- 用一条持续编辑消息完全替代新消息提醒。
- 通过延迟数分钟等待更多赛果。
- 改变当前决赛阶段的跟踪范围。

## 7. 最终判断

当前 bot 没有可直接使用的“普通文本消息分组发送”接口；Telegram 的媒体组能力不适用，但应用层完全可以实现相同的阅读效果。

最合适的优化不是减少赛况采集，也不是关闭赛事级赛果，而是在 `runStartggWatchOnce()` 这一轮次边界上增加一个摘要层，把昨夜类似的 19 条消息压缩为每个赛事 1–2 条有明确分类的消息。

## 8. 参考资料

- 当前 start.gg 监控实现：[`src/services/startgg/tracker.ts`](../../src/services/startgg/tracker.ts)
- 当前 start.gg 运行说明：[`doc/startgg/current-implementation.md`](./current-implementation.md)
- Telegram Bot API：[`sendMessage`](https://core.telegram.org/bots/api#sendmessage)
- Telegram Bot API：[`sendMediaGroup`](https://core.telegram.org/bots/api#sendmediagroup)
- Telegram Bot API：[`Rich Messages`](https://core.telegram.org/bots/api#rich-messages)
- Telegram Bot API：[`sendRichMessage`](https://core.telegram.org/bots/api#sendrichmessage)
- Telegram Bot API：[`editMessageText`](https://core.telegram.org/bots/api#editmessagetext)
