# start.gg 种子选手临时关注实施报告与风险记录

日期：2026-07-25  
对应设计：`doc/design/startgg-featured-seed-watch.md`  
实施方式：本机 Claude Code 完成首轮实现，主审查流程完成代码 review 和问题修正  
当前阶段：本地实现完成，等待部署

## 1. 实施结论

本次在现有“固定关注选手”和“最终阶段全量赛果”之间增加了赛事级 Top 16/32 种子选手临时关注。

完成后的主要体验为：

- 用户点击 Telegram 常驻键盘中的 `👊 比赛了`，系统自动沿用已经保存的 Top 16、Top 32 或关闭设置。
- 首次部署后的默认档位为 Top 16。
- 当前 active event 会保存对应的种子 entrant 清单，但不会把临时种子选手写入长期固定关注名单。
- 种子选手的新完成 Set 进入赛事摘要中的独立区块。
- 种子选手存在 active Set 时，会参与现有 2 分钟 Fast Watch。
- 固定关注选手、种子选手和最终阶段共用 Set 级去重，同一 Set 只展示一次。
- 中途开启或从 Top 16 扩大到 Top 32 时，当前已完成 Set 会建立为已读基线，不补发启用前的历史赛果。
- 启动提示会被直接编辑为状态卡片，档位切换和查看清单继续编辑同一条消息。

本功能没有增加新的调度系统、长期选手身份库、重试、备用接口或失败降级通道。

## 2. 实际改动范围

### 2.1 数据库

`src/reminders/migrations.ts` 增加 migration v15：

- 在 `startgg_runtime_settings` 增加 `featured_seed_count`。
- 默认值为 `16`。
- 数据库约束只允许 `0`、`16`、`32`。
- migration 会确保单例运行设置行存在。
- 新增 `startgg_watch_event_featured_entrants`，按 event 保存临时种子 entrant。

新表关键字段：

- `watch_event_id`
- `phase_id`
- `entrant_id`
- `entrant_name`
- `seed_num`
- `created_at`
- `updated_at`

唯一约束：

- 同一 event 下不能重复保存同一 entrant。
- 同一 event 下不能重复保存同一 seed number。

### 2.2 Repository

`src/services/startggRepository.ts` 增加：

- `StartggFeaturedSeedCount`
- 读取和设置种子档位
- 替换 event 种子 entrant 清单
- 查询 event 种子 entrant 清单
- 清空 event 状态时同步清理种子 entrant
- 全量清空 start.gg 状态时同步清理种子 entrant

档位设置缺失或出现非法值时会直接抛错，不返回默认值假装成功。

### 2.3 start.gg API

`src/services/startgg/client.ts` 增加初始种子 Phase 选择：

1. 排除 `numSeeds` 为空或不大于零的 Phase。
2. 选择 `numSeeds` 最大的 Phase。
3. 同规模时选择 `phaseOrder` 最小的 Phase。

`src/services/startgg/queries.ts` 为按 entrant 查询 Sets 的 slots 增加 entrant name。该字段是形成种子赛果中的双方名称和胜者名称所必需的。

### 2.4 种子名单同步

`src/services/startggPresetSync.ts` 增加：

- 为没有名单的新 active event 建立种子清单。
- 档位变化时重新同步所有 active event。
- 在写入名单前读取当前已完成的正式 Set，并建立赛事级已读基线。
- 多个 active event 会先全部完成远端数据读取，再开始保存，避免其中一个 event 请求失败后只更新部分 event。

名单同步使用 event entrant，不创建 `startgg_watch_players` 记录。

### 2.5 Tracker

`src/services/startgg/tracker.ts` 的 event 查询 entrant 范围变为：

```text
固定关注选手 entrant IDs
  ∪
赛事种子 entrant IDs
```

处理顺序为：

1. 固定关注选手更新。
2. 种子选手新完成 Set。
3. 最终阶段新完成 Set。
4. 发送 event 摘要。
5. Telegram 成功后写入去重记录。

展示优先级为：

```text
固定关注选手
  > 种子选手
  > 最终阶段
```

种子 Set 的规则：

- 只有正式数字 Set ID 才能形成赛果和去重记录。
- `completedAt !== null` 才形成推送。
- `startedAt !== null && completedAt === null` 只用于启动 Fast Watch。
- Set 涉及固定关注选手时，不在种子区块重复展示。
- 已进入本轮种子区块的 Set，不再进入最终阶段区块。

### 2.6 Telegram 交互

`src/bot/interactive.ts`、`src/bot/callbacks.ts` 和 `src/formatters/startggFormatter.ts` 增加：

- `比赛了` 启动结果卡片。
- Top 16、Top 32、关闭和查看清单按钮。
- 当前选中档位的按钮高亮。
- `/startgg seeds`
- `/startgg seeds 16`
- `/startgg seeds 32`
- `/startgg seeds off`
- 多个 active event 同时存在时，在状态卡片和清单中合并展示。
- 档位变化后立即执行一次当前赛事检查并重新计算 Fast Watch，不等待下一次 15 分钟轮询。

按钮编辑失败不会改走新消息发送通道，错误会直接暴露。

## 3. 首轮实现后发现并修复的问题

### 3.1 Set 查询没有 entrant name

首轮按 entrant 查询 Sets 时只请求了 entrant ID，但 formatter 需要双方名称和胜者名称。

实际后果会是首条种子赛果进入处理时找不到 winner entrant，并直接抛出：

```text
start.gg completed featured set missing winner entrant
```

主审查流程已在对应 GraphQL 查询中增加 entrant name。

### 3.2 种子 Set 与最终阶段同轮重复

首轮种子区块只把 Set ID 放入待写入数组，最终阶段计算发生在 Telegram 发送前，因此数据库中还看不到该 Set。

同一 Set 可能同时进入种子区块和最终阶段区块。

主审查流程已让最终阶段同时检查本轮待写入的赛事级 Set ID。

### 3.3 新链路未过滤 preview Set

首轮种子历史基线和新增完成 Set 没有过滤 `preview_*` 临时 Set。

这会重新引入 2026-07-24 事故中已经发生过的临时 Set 消失风险。

主审查流程已在以下位置限定正式数字 Set ID：

- 种子历史基线
- 种子完成赛果
- 最终阶段历史基线
- 最终阶段完成赛果
- 固定选手首次基线

### 3.4 档位切换先保存设置再请求远端

首轮先持久化 Top 16/32，再同步 event 名单。如果远端请求失败，设置已经变化，但名单可能仍是旧内容。

主审查流程已改为：

1. 完成所有 active event 的 Phase、seeds 和基线读取。
2. 保存 event 名单。
3. 保存新档位。
4. 立即执行一次 tracker。

### 3.5 Telegram 编辑失败后另发消息

首轮 callback 捕获编辑失败后会发送一条新消息，属于明确的 fallback，也会污染消息流。

该逻辑已移除。点击当前已经选中的档位时只返回 Telegram callback 提示，不重复同步或编辑。

### 3.6 `比赛了` 留下启动过程消息

首轮先发送“开始同步”，完成后再新增一条状态卡片。

主审查流程已改为编辑原启动消息，候选列表和失败信息也复用该消息。

### 3.7 档位变化后 Fast Watch 生效延迟

首轮切换 Top 32 只同步名单，不立即执行 tracker。新增的 seed 17–32 即使正在比赛，也要等下一次 15 分钟轮询才能进入 Fast Watch。

主审查流程已在档位变化后立即执行当前 active event 检查，并用结果更新 2 分钟 Fast Watch。

## 4. 对原有固定关注选手功能的影响

### 4.1 不会改变的部分

根据当前源码行为：

- 固定关注选手仍来自 `startgg_watch_players`。
- 固定选手与 event entrant 的映射仍来自 `startgg_watch_event_entrants`。
- 固定选手 Set 去重仍使用 `startgg_pushed_sets`。
- 种子历史基线只写 `startgg_event_pushed_sets`，不会把固定选手 Set 写成该选手已经推送。
- Set 同时涉及固定选手和种子选手时，固定选手区块优先。
- 固定选手 standings 仍只按固定选手 entrant IDs 查询。

因此，正常取得 start.gg 数据时，原有关注选手的状态判断、比分和赛果推送语义没有被替换。

### 4.2 已确认的耦合风险

当前固定轮询的执行顺序仍是：

```text
发现 active event
  -> 同步尚未建立的种子名单
  -> 执行统一 tracker
  -> 发送固定选手、种子选手和最终阶段摘要
```

如果种子 Phase 或 seeds 请求失败，`runStartggWatchNow()` 会在进入统一 tracker 前失败。

直接影响：

- 本轮种子战报不会产生。
- 本轮原有固定关注选手战报也不会产生。
- 多个 active event 中任意一个 event 的种子同步失败，都可能阻断这一轮统一检查。

这是当前最重要的已知风险，也是后续优先级最高的结构调整项。

推荐调整方向：

```text
原固定关注选手主路径
  -> 明确完成固定选手状态和赛果处理
  -> 再进入种子名单和种子赛果链路
```

目标是种子错误仍然明确暴露，但不能阻止原固定关注选手战报完成。该调整尚未实施。

## 5. 其他潜在风险

### 5.1 初始 Phase 选择仍属于设计判断

“最大 `numSeeds`，同规模取最小 `phaseOrder`”来自当前字段语义和已有 API 能力。

目前没有本功能部署后的大型赛事线上运行证据可以证明所有赛事组织方式都符合该规则。

需要特别关注：

- 多个 Phase 拥有相同 `numSeeds`，但业务语义不同。
- Phase seeds 在比赛开始后被主办方重新生成。
- doubles、分赛区或特殊赛制的 seed number 不是单一连续序列。

### 5.2 新增 start.gg API 调用

新 event 首次同步或档位变化时，每个 event 会增加：

- event phases 请求
- phase seeds 分页请求
- 按种子 entrant IDs 查询 Sets 的分页请求

普通 15 分钟轮询不会反复重建已经存在的名单，但新 event 较多时，首次同步的请求量会明显增加。

### 5.3 档位按钮会立即触发完整 event 检查

用户切换 Top 16、Top 32 或关闭时，会立即运行一次统一 tracker。

因此，如果此时固定关注选手恰好有尚未发送的新状态，点击种子按钮也可能立即收到原固定选手战报。这属于提前触发正常检查，不是重复推送。

### 5.4 Fast Watch 不跨进程重启保存

固定 15 分钟轮询通过 `polling_enabled` 恢复。

2 分钟 Fast Watch 使用内存 timer，部署或进程重启后不会立即恢复。需要等下一次固定轮询发现 active Set 后重新启动。

因此部署后不强制要求再次点击 `比赛了`，但点击一次可以让种子名单和 Fast Watch 立即生效。

### 5.5 多 event 清单可能接近 Telegram 长度限制

当前清单会合并展示所有 active event。

单个 event 的 Top 16/32 通常不会超过 Telegram 单条消息限制；多个 event 同时为 Top 32 时，清单文本可能过长。当前清单页面没有实现超长拆分。

赛事摘要已经实现按区块和行拆分，清单页面仍是已知缺口。

### 5.6 档位已保存但立即检查失败

档位和名单保存完成后会立即执行 tracker。

如果 tracker 或 Telegram 发送在此阶段失败：

- 新档位已经保存。
- 新名单已经保存。
- 原状态卡片可能仍显示旧档位。
- 下一次读取清单或状态卡片时会显示数据库中的新档位。

该情况不是静默成功，错误会直接暴露，但线上排查时需要区分“配置保存失败”和“保存后立即检查失败”。

## 6. 部署后的预期行为

### 6.1 数据迁移

首次启动新版本时：

- migration v15 增加种子档位和 event 种子表。
- 已存在的 `polling_enabled` 不会被重置。
- 现有 active event、固定选手、entrant 映射和历史去重记录不会被清空。
- 默认种子档位为 Top 16。

### 6.2 已有赛事正在 watch

如果部署前自动轮询已经开启：

- resident bot 重启后会恢复 15 分钟轮询。
- 下一个北京时间 `00/15/30/45` 分钟节点会为尚无名单的 active event 建立 Top 16。
- 已经完成的种子 Set 会建立为基线。
- 后续新完成 Set 才会形成种子战报。

不要求重新点击 `比赛了`。

如果希望部署后立即建立名单和恢复 Fast Watch，可以主动点击一次 `比赛了`。

### 6.3 自动轮询未开启

数据库中存在 active event 不等于自动轮询一定开启。

如果 `polling_enabled` 为关闭状态，部署重启不会自动开始 15 分钟轮询，需要用户重新启动监控。

## 7. 线上排查观察点

后续出现问题时，应先区分以下四层：

1. 调度是否触发。
2. 种子名单是否建立。
3. tracker 是否选出应推送 Set。
4. Telegram 是否发送成功并写入去重。

### 7.1 调度日志

固定轮询开始：

```text
Mode: start.gg Watch
```

固定轮询完成：

```text
start.gg watch finished. events=... players=... changed=... active=...
```

Fast Watch 开始：

```text
Mode: start.gg Fast Watch (...)
```

Fast Watch 完成：

```text
start.gg fast watch finished. events=... players=... changed=... active=...
```

如果只有开始日志，没有完成日志，应继续查看同一时间点之后的异常和 systemd 重启记录。

### 7.2 种子同步错误文本

没有可用种子 Phase：

```text
start.gg event has no featured seed phase
```

Phase 没有可用 entrant：

```text
start.gg featured seed phase has no entrants
```

设置缺失或非法：

```text
start.gg featured seed setting is missing or invalid
```

种子完成 Set 缺少胜者 entrant：

```text
start.gg completed featured set missing winner entrant
```

以上错误均会直接中断当前调用，不会静默跳过。

### 7.3 数据库观察对象

运行设置：

- `startgg_runtime_settings.polling_enabled`
- `startgg_runtime_settings.featured_seed_count`

当前赛事：

- `startgg_watch_events.id`
- `startgg_watch_events.event_slug`
- `startgg_watch_events.active`
- `startgg_watch_events.subscription_source`
- `startgg_watch_events.tournament_end_at`

固定选手映射：

- `startgg_watch_event_entrants.watch_event_id`
- `startgg_watch_event_entrants.watch_player_id`
- `startgg_watch_event_entrants.entrant_id`

种子名单：

- `startgg_watch_event_featured_entrants.watch_event_id`
- `startgg_watch_event_featured_entrants.phase_id`
- `startgg_watch_event_featured_entrants.seed_num`
- `startgg_watch_event_featured_entrants.entrant_id`
- `startgg_watch_event_featured_entrants.updated_at`

固定选手 Set 去重：

- `startgg_pushed_sets.watch_player_id`
- `startgg_pushed_sets.watch_event_id`
- `startgg_pushed_sets.set_id`

种子和最终阶段赛事级去重：

- `startgg_event_pushed_sets.watch_event_id`
- `startgg_event_pushed_sets.set_id`
- `startgg_event_pushed_sets.pushed_at`

Telegram 消息记录：

- `startgg_sent_messages.message_id`
- `startgg_sent_messages.sent_at`

### 7.4 症状与优先排查方向

| 症状 | 优先排查 |
| --- | --- |
| 固定选手和种子选手同时停止推送 | 固定轮询日志、种子同步错误、服务重启记录 |
| 固定选手正常，种子选手无消息 | featured entrants 是否存在、seed count、赛事级 pushed sets |
| 点击 Top 32 后没有立即进入 Fast Watch | 档位操作错误、立即 tracker 是否完成、active Set 的 startedAt/completedAt |
| 部署后 15 分钟轮询恢复但没有 2 分钟轮询 | 尚未到第一次固定轮询，或当前没有 active Set |
| 同一 Set 在两个区块重复 | 本轮 pending event Set 去重和 event pushed set |
| 开启 Top 32 后大量补发旧比赛 | 基线是否在名单启用时写入 event pushed sets |
| 清单为空但档位显示 Top 16/32 | Phase 选择、phase seeds、active event 与 featured entrant 的 watch_event_id |
| 卡片仍显示旧档位但数据库已变化 | 档位保存后立即 tracker 或 Telegram 编辑失败 |
| 出现 `preview_*` 相关异常 | 正式 Set ID 过滤是否仍生效，异常来自哪个处理分支 |

## 8. 关键源码索引

- 设计：`doc/design/startgg-featured-seed-watch.md`
- migration：`src/reminders/migrations.ts`
- repository：`src/services/startggRepository.ts`
- Phase 与 seeds API：`src/services/startgg/client.ts`
- GraphQL 查询：`src/services/startgg/queries.ts`
- event 激活与名单同步：`src/services/startggPresetSync.ts`
- tracker 与去重：`src/services/startgg/tracker.ts`
- Telegram formatter：`src/formatters/startggFormatter.ts`
- callback parser：`src/bot/callbacks.ts`
- Telegram 主入口：`src/bot/interactive.ts`
- 15 分钟与 2 分钟调度：`src/scheduled/jobs.ts`
- resident 启动恢复：`src/resident.ts`

## 9. 后续线上事故记录要求

如部署后出现异常，新的事故记录至少应包含：

- 北京时间首次异常和最后一次正常推送时间。
- 部署 commit 和部署时间。
- 当前 active event、subscription source 和 tournament end time。
- `polling_enabled` 与 `featured_seed_count`。
- 固定 entrant 映射数量。
- featured entrant 数量、Phase ID 和 seed number 范围。
- 最后一条固定选手 pushed set。
- 最后一条 event pushed set。
- 最后一个 Telegram message ID 及时间。
- 同一轮固定 Watch 或 Fast Watch 的开始、完成或异常日志。
- 异常 Set ID 是否为正式数字 ID。
- 问题只影响种子链路，还是同时影响固定关注选手。

## 10. 当前风险结论

当前实现已经覆盖设计中的数据、交互、赛果、去重、Fast Watch 和历史基线主路径，并修复了首轮 review 发现的直接功能问题。

部署前仍应明确保留以下判断：

> 种子同步目前位于统一 tracker 之前，种子 Phase 或 seeds 请求失败可能阻断原固定关注选手的本轮战报。

该风险已经记录，但尚未进行结构调整。后续如果线上出现“固定选手与种子选手同时停更”，应首先沿此耦合点排查。
