# start.gg 当前实现业务逻辑

本文只描述当前代码已经落地的事实，不描述早期设计文档里曾经规划、但现在没有注册的命令或功能。

## 1. 一句话概览

start.gg 功能的主链路是：

```text
预设/手动添加选手
  -> 查询最近更新的 Street Fighter 6 tournament 目录
  -> 筛选当前活动 tournament 并定向解析选手身份
  -> 自动发现 event 并直接得到 entrant 映射
  -> 建立 active event 订阅
  -> 查询参赛关系、对局、排名
  -> 计算每个“选手 × 项目”的状态
  -> 只推送新状态或新对局
  -> SQLite 保存快照、去重记录和 Telegram message_id
```

在选手跟踪之外，active event 还会自动发现`numSeeds<=8`的明确决赛Phase，进入赛事级跟踪并推送后续全部完赛set和最终排名。

它不是全网赛事搜索器，也不是把 start.gg 上所有历史对局搬到 Telegram，而是围绕已经关注的选手做赛事状态监控。

## 2. 监控对象从哪里来

### 2.1 预设选手

文件：`data/startgg_preset_players.json`

当前预设清单包括：

- DCQ
- XiaoHai
- Zhen
- Vxbao
- gachikun
- XiaoXu

每项通常只需要维护：

```json
{
  "alias": "gachikun",
  "user_url": "https://www.start.gg/user/7fc0306f"
}
```

运行时 `syncStartggPresetPlayers()` 会：

1. 读取预设文件。
2. 通过 `user_url` 查询 start.gg 用户对应的 `user_id`、`player_id`、战队前缀和原始 gamerTag。
3. 将身份和显示名写入 SQLite 的 `startgg_watch_players`；旧记录缺少身份字段时会在本次同步补齐。
4. 如果文件里还没有 `player_id` / `player_name`，解析后会回写预设文件。
5. 数据库已有该选手时，更新显示名和已解析的身份字段。

预设同步只负责“确保预设选手存在”，不会删除手动添加的选手。

### 2.2 手动添加选手

手动添加的选手也写入同一张 `startgg_watch_players` 表，因此后续自动发现和监控时，预设选手与手动选手没有业务区别。

支持三种输入：

- `/watch https://www.start.gg/user/xxx`
  - 直接解析用户链接，最可靠。
- `/watch user/xxx`
  - 解析用户 slug。
- `/watch Tokido`
  - 只在当前 active event 的参赛名单中搜索。
  - 唯一匹配时直接添加。
  - 多个匹配时展示最多 10 个候选按钮。

如果当前没有 active event，普通选手名无法搜索，但用户链接仍然可以直接添加。

当前没有单独的“删除单个选手”命令。`/startgg deleteall` 会清空赛事和状态，但会保留选手记录，包括手动选手。

## 3. 当前命令入口

### `/startgg`

显示引导、已启用选手数量、当前 active event 数量和轮询状态，同时同步预设选手。

它只展示配置，不执行一次 start.gg 抓取。

### `/startgg go`

主入口，执行以下流程：

1. 同步预设选手。
2. 读取全部启用的 `startgg_watch_players`，包括预设和手动选手。
3. 查询最近 48 小时有数据变化的 Street Fighter 6 tournament 目录，并保留当前处于 `startAt/endAt` 范围内的 tournament。
4. 在候选 tournament 中组合 User 精确 Entrant 与 Participant gamerTag 查询，确认固定选手参加的 event。
5. 不带关键词时，将发现到的所有 event 设为 active。
6. 立即执行一次状态检查。
7. 开启进程内每 20 分钟一次的 start.gg 轮询。

`/startgg go <关键词>` 的区别是：

1. 仍然先发现所有候选赛事。
2. 按 tournament 名称或 tournament slug 匹配关键词。
3. 没有匹配或匹配多个 tournament 时，只返回候选，不修改当前 active event。
4. 唯一匹配时，订阅该 tournament 下的全部 event。
5. 立即检查并开启 20 分钟轮询。

关键词匹配会转小写、去除非字母数字字符，同时支持紧凑字符串匹配，所以 `evo us 2026` 和 slug 形式都可以工作。

### `/startgg status`

只读取本地状态并展示：

- 当前状态：未配置、待命或监控中。
- active event 概览。
- 启用选手数量和名称。
- 固定轮询是否开启、下次时间。
- 加速轮询是否开启、下次时间。
- 最近生成的快照。
- 当前订阅赛事的最晚结束时间。

它不会主动请求 start.gg。

### `/startggpoll on` / `/startggpoll off`

`/startggpoll on`：

- 开启 Asia/Shanghai 时区下每小时第 0、20、40 分钟执行的轮询。
- 默认会先清空当前 active event 的 entrants、snapshots 和 pushed sets 状态。
- 因此下一轮检查会重新建立首条状态基线，并对有对局的选手推送一条最新状态。
- 不会立即执行检查。

`/startggpoll off`：

- 取消 20 分钟轮询。
- 同时取消加速轮询计时器。

轮询开关会保存在 SQLite。bot 进程重启后，如果此前轮询处于开启状态，会自动重新注册轮询任务；数据库里的快照和去重数据也会保留。

### `/fetchstartgg`

立即执行一次完整的 `runStartggWatchNow()`：

1. 同步预设选手。
2. 自动发现当前活跃 event。
3. 更新自动订阅的 active event。
4. 检查所有 active event，包括手动订阅的 event。
5. 如果有订阅选手正在比赛，或决赛 Phase 已经开打且赛事尚未完赛，开启 2 分钟加速轮询。

它不会自动开启 20 分钟固定轮询。

### `/watch <内容>`

这是手动管理入口：

- 发送 event URL：切换到这个手动 event，并停用其他 active event。
- 发送用户 URL：添加选手。
- 发送普通选手名：在 active event 的 entrants 中搜索并添加。

发送 event URL 时，会清空该 event 的 entrants、snapshots 和 pushed sets，让下一次检查从该项目重新建立基线。

### `/watchlist` / `/startggwatchlist`

两个命令使用同一处理函数，展示：

- 全部选手及 player_id、启用状态。
- 全部 event 及 slug、启用状态。
- 最近 10 条选手状态快照。

执行前会同步预设选手。

### `/startgg deleteall`

这是 start.gg 消息和历史状态清理入口：

1. 关闭固定轮询和加速轮询。
2. 从 `startgg_sent_messages` 读取已记录的 Telegram `message_id`。
3. 使用当前 `TG_CHAT_ID` 逐条删除这些 start.gg 推送消息。
4. 删除成功后清空：
   - `startgg_sent_messages`
   - `startgg_pushed_sets`
   - `startgg_event_pushed_sets`
   - `startgg_watch_event_entrants`
   - `startgg_watch_snapshots`
   - `startgg_watch_events`
5. 保留 `startgg_watch_players`，所以预设和手动选手仍然存在。

旧版本没有保存 `message_id` 的历史消息无法定位删除。删除 Telegram 消息时如果外部 API 直接报错，命令会直接失败，不会静默吞掉错误。

## 4. 自动发现赛事的规则

代码位于 `src/services/startggDiscovery.ts`。

### 4.1 候选 tournament

目录查询固定使用 Street Fighter 6 的 `videogame.id = 43868`，并要求：

1. `computedUpdatedAt >= now - 48 hours`。
2. tournament 已发布且可公开搜索。
3. tournament 有 `startAt`、`endAt` 和 slug。
4. 当前时间处于 tournament 的 `[startAt, endAt]` 内。

目录分页只读取 tournament 标量字段；当前活动候选再按固定小批次查询身份。

### 4.2 候选中的身份确认

每名启用选手按以下顺序匹配：

1. `Event.userEntrant(user_id)` 精确命中。
2. Participant 的 `user.id` 或 `player.id` 与关注选手精确一致。
3. Participant gamerTag 等于全局 gamerTag，或以明确的战队分隔边界加完整 gamerTag 结尾。

API 的 gamerTag 子串结果不会直接采用。名称级匹配必须在全部当前候选中只对应一个 Participant；同一 Participant 报名多个 event 时，会保留它的全部 entrant。发现结果会直接携带 `watch_player_id -> entrant_id` 映射。

### 4.3 自动 event 与手动 event 的优先级

`startgg_watch_events.subscription_source` 有两种值：

- `auto`：由当前活动 tournament 的身份查询自动发现。
- `manual`：由 `/watch <event_url>` 或带关键词的 `/startgg go` 产生。

自动同步时：

- 如果当前存在 active 的 manual event，自动发现不会改写 active event。
- 没有 active manual event 时，当前 active 的 auto event 会按本轮发现结果更新。
- 本轮暂时不再发现、但 tournament 尚未到 `endAt` 的 auto event 会继续保持 active，避免跨日休赛期丢失订阅。
- 已到 `endAt` 且本轮不再发现的 auto event 会被设为 inactive。
- inactive event 重新出现时，会清除它之前的状态，重新建立基线。

需要注意：手动 event 一旦 active，后续自动轮询不会自动替换它；需要再次执行 `/watch <event_url>`、`/startgg go` 或 `/startgg deleteall` 改变状态。

## 5. 一次状态检查如何执行

代码主入口是 `runStartggWatchOnce()`，对每个 active event 执行以下步骤。

### 5.1 解析 event

请求 event header，确认 event 存在、slug 存在、tournament 名称存在，并把真实 `event_id` 和名称更新到数据库。

### 5.2 建立选手与 entrant 的映射

自动发现已经确认的 entrant 会随 event 一起写入。尚未映射的选手会对当前 event 分页读取 entrants，并复用同一身份顺序：User 精确、Player 精确、唯一的 gamerTag 边界匹配。

映射结果保存为：

- `entrant_id`
- `entrant_name`

映射保存在 `startgg_watch_event_entrants`。

找不到 entrant 的选手会得到“未在该项目出战”状态，不会产生赛况推送。NULL 映射不会被永久视为最终结果；固定轮询会重新读取 entrants，以适配晚报名或主办方稍后补全数据。

### 5.3 查询对局和排名

只对已经找到 entrant 的选手查询：

- 该 event 中属于这些 entrant 的全部 sets。
- 已映射 entrant 的 standing。

sets 和 standings 是并行查询的。sets 会自动处理分页；standing 通过 GraphQL entrant 根字段只查询关注 entrant，不读取整场排名。

### 5.4 状态计算

状态枚举有：

- `not_entered`：未在该项目出战。
- `in_winners`：胜者组进行中。
- `in_losers`：败者组进行中。
- `eliminated`：已淘汰。
- `completed`：赛事已完赛。

计算依据包括：

- 最近一场 set 的 winner。
- set 的 `round` 和 `fullRoundText` 是否表示败者组。
- 是否存在尚未完成的 set。
- standings 中的当前名次。
- 冠军名次、最后一场胜负以及是否仍有未完成 set。

快照还会保存：

- placement
- last set id
- last round / round label
- last score
- last set state
- captured_at
- 是否已经发送过首条状态 `initial_message_sent`

### 5.5 首次状态与历史基线

这是当前防止历史污染的关键规则。

对于一个新的“选手 × 项目”组合，或者已有快照但 `initial_message_sent=0`：

1. 读取该选手在项目中的全部已知 sets。
2. 将这些 sets 全部写入 `startgg_pushed_sets` 作为已读基线。
3. 如果选手确实有对局，只推送一条最新状态消息。
4. 成功发送后记录 Telegram `message_id`，并把 `initial_message_sent` 更新为 1。

因此首次发现不会补发所有历史对局，但用户能看到该选手当前最新状态。

如果选手目前没有任何 set，不发送“未参赛”消息；快照会保留，等以后出现对局时再发送首条状态。

现有服务器中由旧版本生成、但没有发送过首条状态的基线，会通过数据库迁移自动视为 `initial_message_sent=0`，后续检查会补发一次最新状态。

### 5.6 后续状态变化

首条状态发送完成后，后续每轮检查按两类变化推送：

1. 发现新的 set：按每个新 set 推送一条消息。
2. 没有新 set，但以下快照字段变化：
   - status
   - placement
   - last set id
   - last score

第二类会发送一条状态变化消息。

如果上述字段都没有变化，则不推送。

同一 set 的去重键是：

```text
watch_player_id + watch_event_id + set_id
```

### 5.7 Telegram 消息内容

推送内容包含：

- 赛事名称。
- 项目名称。
- 选手名称。
- 当前状态。
- 当前名次（如果有）。
- 最新轮次（如果有）。
- 最新比分（如果有）。
- 项目页链接。
- 最近对局链接（如果有）。

每次 start.gg 推送成功后都会记录 Telegram 返回的 `message_id`，供 `/startgg deleteall` 使用。

## 6. 轮询和调度

### 6.1 `/startgg go` 后的轮询

`/startgg go` 本身会立即检查一次，然后开启当前进程内的 20 分钟轮询任务。

20 分钟轮询执行时会重新走：

```text
同步预设选手
  -> 自动发现当前 event
  -> 同步 auto event
  -> 检查所有 active event
```

已经 active 且仍然存在的 event 会保留快照，不会因为重复执行 `/startgg go` 而重复发送首条状态。

### 6.2 进行中对局的 2 分钟加速轮询

每次检查会返回用于维持加速轮询的 `activeSetCount`：

- 订阅选手存在 `startedAt` 非空且 `completedAt` 为空的 set：2 分钟后再次检查。
- 决赛Phase已有任意set开打且Event尚未完赛：即使正处于两场串行比赛之间，也在2分钟后再次检查。
- 两种条件都不满足：停止该event的加速轮询。

固定轮询会执行完整的 `runStartggWatchNow()`，负责同步选手、自动发现赛事并检查全部 active event。

加速轮询只检查上一轮确认需要加速的event，不再同步预设选手、查询全部选手近期sets、刷新未映射entrant或检查其他event。订阅选手的对局结束后可以退出加速；决赛Phase开打后则持续加速到`Event.state=COMPLETED`。所有event都不再满足条件后，加速轮询停止。下一次固定轮询仍会发现新的event或重新进入加速状态。

### 6.3 赛事完赛后自动停止

每次固定轮询开始前，会读取当前 active event 对应 tournament 的 `endAt`。只有存在 active event 且它们所属赛事都已到达结束时间时，系统才会关闭 20 分钟固定轮询和 2 分钟加速轮询，将关闭状态写入 SQLite，并发送一条 Telegram 通知。active event 为空不会被解释为赛事完赛。

选手淘汰、暂时没有新对局或 `activeSetCount=0` 都不会触发固定轮询停止。

### 6.4 决赛Phase赛事级跟踪

20分钟固定轮询会读取active event的Phase结构，选择`phaseOrder`最高且满足以下条件的Phase：

```text
2 <= numSeeds <= 8
state 为 READY、ACTIVE 或 COMPLETED
```

首次发现后：

1. 保存Phase id、名称和numSeeds。
2. 将该Phase已完成sets建立为赛事级已读基线。
3. 使用Phase seeds推送决赛阶段名单。
4. 后续推送该Phase全部新完成set。
5. 与选手维度已推送set去重，同一set只发送一次。

目标Phase第一场set出现`startedAt`后会加入2分钟连续轮询，直到`Event.state=COMPLETED`。两场串行比赛之间即使暂时没有进行中的set，也不会退出加速轮询。加速轮询使用一个GraphQL请求同时读取已保存Phase的sets和Event状态，不重新发现Phase，也不查询整个event的历史对局。

当`Event.state=COMPLETED`时，系统读取event standings前8名，推送最终排名并退出该event的加速轮询。最终排名不依赖`Standing.isFinal`。

没有独立`numSeeds<=8` Phase的event不会猜测八强阶段。

### 6.5 Resident 常驻进程和一次性入口

当前服务器通过 `src/resident.ts` 启动常驻 Telegram bot。

start.gg 的持续监控主要依赖：

- `/startgg go` 自动开启 20 分钟轮询。
- `/startggpoll on` 手动开启 20 分钟轮询。
- 订阅选手正在比赛，或决赛Phase已经开打时的2分钟加速轮询。

仓库另有一次性入口 `src/index.ts`，在北京时间约 10:20 和 22:20 的调度窗口选择 `startgg_watch`，执行一次 `runStartggWatchNow()`。这个入口执行完就退出，不会建立常驻轮询任务。

轮询开启状态保存在 `startgg_runtime_settings`。常驻 bot 启动时会读取该状态；如果此前已开启轮询，会重新注册 20 分钟轮询任务，并保留已有快照和去重数据。2 分钟加速轮询不单独持久化，恢复后的下一次固定轮询发现订阅选手正在比赛，或决赛Phase已经开打后会重新开启。

## 7. SQLite 数据模型

当前 start.gg 相关表有 8 张：

| 表 | 作用 |
| --- | --- |
| `startgg_watch_players` | 预设和手动添加的选手，按 `player_id` 唯一 |
| `startgg_watch_events` | event 订阅、active 状态、auto/manual 来源、tournament 结束时间和加速轮询所需的赛事名称缓存 |
| `startgg_watch_event_entrants` | 选手在某个 event 中对应的 entrant |
| `startgg_watch_snapshots` | 每个选手 × event 的最新状态快照 |
| `startgg_pushed_sets` | 已处理 set 的去重记录 |
| `startgg_event_pushed_sets` | 决赛Phase赛事级set去重记录 |
| `startgg_sent_messages` | 已发送 start.gg Telegram 消息的 `message_id` |
| `startgg_runtime_settings` | 持久化自动轮询开启状态，供常驻进程重启后恢复 |

快照唯一键是：

```text
watch_player_id + watch_event_id
```

当前数据库迁移版本为 11：

- 版本 4：增加 auto/manual event 来源。
- 版本 5：增加 Telegram 消息 ID 表。
- 版本 6：增加首条状态发送标记。
- 版本 7：增加自动轮询持久化状态。
- 版本 8：增加 tournament 结束时间，用于完赛后自动停止轮询。
- 版本 9：增加 tournament/event 名称缓存，让加速轮询不再请求 event header。
- 版本 10：增加中国工作日循环提醒过滤字段。
- 版本 11：增加决赛Phase跟踪状态和赛事级set去重表。

## 8. 当前事实下的边界

1. 赛事尚未生成 set 时，自动发现不到 event。
2. 自动发现只看启用选手最近 7 天的 sets，并要求 event 最近两天有活动。
3. 自动发现要求 tournament 当前处于 startAt/endAt 时间段内。
4. 手动 active event 不受自动 event 替换影响，直到用户改变订阅。
5. 自动发现不是全局赛事搜索，不会仅凭选手报名信息猜测赛事。
6. `/startgg deleteall` 只能删除已经保存 `message_id` 的消息；旧消息无法定位。
7. `message_id` 只记录消息 ID 和发送时间，没有保存选手/event 反向关联。
8. 当前没有单个选手、单个 event 或单条消息的独立删除命令。
9. 早期文档中出现的 `/startggaddplayer`、`/startggaddevent`、赛事窗口等入口不是当前常驻 bot 的实际主入口；当前主入口是 `/watch`、`/startgg go` 和 `/fetchstartgg`。

## 9. 当前推荐使用顺序

### 比赛期间自动监控

```text
/startgg go
```

系统会使用预设和手动选手自动发现当前赛事、立即检查，并开启 20 分钟轮询。

### 限定某个 tournament

```text
/startgg go evo
```

命中唯一 tournament 后，会订阅该 tournament 的全部 event。

### 手动指定 event

```text
/watch https://www.start.gg/tournament/xxx/event/yyy
```

### 手动添加选手

```text
/watch https://www.start.gg/user/xxx
```

### 查看当前事实

```text
/startgg status
/watchlist
```

### 清理已发送的 start.gg 消息和本地历史

```text
/startgg deleteall
```

清理后固定/手动选手仍保留，下一次 `/startgg go` 会重新发现赛事并重新建立首条状态。
