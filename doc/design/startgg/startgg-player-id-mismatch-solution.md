# start.gg Player ID 关联问题解决方案

状态：已被 Review 方案取代，不再作为实施依据  
原确定日期：2026-07-18  
当前实施依据：[`auto-discovery-player-id-mismatch-solution-review.md`](../../startgg/auto-discovery-player-id-mismatch-solution-review.md)

## 1. 要解决的实际问题

部分赛事的 `Entrant/Participant` 记录没有关联到选手的全局 User/Player。

这类赛事会同时出现两种 ID：

```text
预设选手的全局 Player ID
  -> player(id).sets()
  -> 找不到本场赛事

赛事 Entrant 中的 Player ID
  -> event.sets() / player(id).sets()
  -> 能找到本场赛事 Set
```

因此需要分别处理两个问题：

1. 已经知道 event 的情况下，必须能把启用选手映射到赛事 Entrant，正常读取赛况。
2. 在不知道 event URL 的情况下，自动发现不能假定赛事 Entrant 一定能反向关联到全局 Player。

本方案只解决实际可稳定解决的部分，不把自动发现改造成全网赛事扫描。

## 2. 方案结论

采用“全局 ID 保留 + 赛事内多级身份映射”的方案：

### 2.1 全局 Player ID 继续作为发现主键

保留当前低请求量的主路径：

```text
启用选手的全局 Player ID
  -> player(id).sets(updatedAfter)
  -> 发现当前进行中的赛事
```

原因：

- 这是当前自动发现的主要有效数据源。
- 不增加正常轮询的请求数量。
- 仍然能够覆盖绝大多数具有正常全局关联的赛事。
- 不能把赛事内临时/孤立 Player ID 写回预设文件，否则下一场赛事会失效。

### 2.2 赛事监控改用赛事内 Entrant 作为最终身份

一旦 event 已经被发现或通过 URL 手动添加，启用选手与 Entrant 的映射按以下顺序执行：

1. 赛事 Entrant 的 Player ID 等于启用选手的全局 Player ID。
2. 赛事 Participant 或其 Player 关联的 User slug 等于启用选手的 User slug。
3. User 关联为空时，使用全局 gamerTag 与赛事 Participant/Player 的赛事名称做唯一匹配。

匹配成功后只保存该 event 的 `entrant_id`，后续 sets、standing 和状态计算全部使用 `entrant_id`。全局 Player ID 仍然只代表启用选手，不再被当作赛事内身份的唯一键。

这可以修复本次赛事：该赛事的 5 名预设选手虽然没有全局 ID 关联，但其赛事名称都包含唯一的 gamerTag，例如：

```text
Falcons丨Xiaohai
AG 8BitDo丨Vxbao
AG 8BitDo丨Zhen
GTW丨XiaoXu
NMS PWS丨DCQ
```

### 2.3 完全孤立 Entrant 不承诺自动发现

本次赛事的 `participant.user` 和 `participant.player.user` 均为 `null`。在这种情况下，公开 GraphQL API 没有提供“根据全局 User 找到该赛事”的可用反向关联。

因此：

- 不新增全网当前赛事扫描。
- 不把时间窗口扩大到更长。
- 不把赛事 Player ID 写入预设配置。
- 不用模糊名称匹配伪装成自动发现成功。

对于用户已经知道 URL 的孤立赛事，继续使用现有的：

```text
/watch https://www.start.gg/tournament/xxx/event/yyy
```

该路径在完成 2.2 的赛事内映射后，可以进入与自动发现相同的正常监控流程。

如果未来仍要覆盖“完全不知道 URL、且 API 没有 User 关联”的赛事，只能另行设计按游戏和日期扫描候选赛事的方案；这会显著增加请求量，不纳入本次修复。

## 3. 需要实施的代码变更

### 3.1 启用选手保存稳定的 gamerTag 身份信息

当前 `startgg_watch_players` 只有：

- `player_id`
- `player_name`
- `enabled`

增加一个 `gamer_tag` 字段，用于赛事内身份匹配。

数据来源：

- 预设选手同步时，从已有的 `user_url -> user.player` 响应写入。
- `/watch <user_url>` 添加选手时，从同一个响应写入。
- 通过赛事候选按钮添加的赛事内选手没有全局 User 信息，不能当作预设选手的稳定身份；这类记录仍按当前实际 Player ID 管理。

数据库通过新增 migration 增加字段，既有记录保留原值。预设同步和用户链接同步时更新 gamerTag。

`StartggWatchPlayer`、`StartggUserResolvedPlayer` 和相关 repository 写入接口同步增加该字段。

### 3.2 扩展赛事 Entrant 查询字段

现有 `EVENT_ENTRANTS_QUERY` 已经是建立赛事映射的请求，不增加新的查询轮次，只扩展返回字段：

- Participant 的 `gamerTag`
- Participant 的 `user.slug`
- Participant 的 `player.id`
- Participant 的 `player.gamerTag`
- Participant 的 `player.user.slug`

返回的内部对象需要同时保留：

```text
entrantId
participantPlayerId
participantUserSlug
participantGamerTag
entrantName
```

### 3.3 重写 `ensureEventEntrantMappings()` 的匹配顺序

当前实现只执行：

```text
watch_player.player_id === entrant.playerId
```

改为：

```text
全局 Player ID 精确匹配
  -> User slug 精确匹配
  -> gamerTag 规范化后的唯一匹配
```

gamerTag 匹配规则：

- 统一大小写。
- 去除空格、竖线、斜线及其他战队名称分隔符。
- 赛事名称可以包含战队前缀，但必须以启用选手的规范化 gamerTag 作为明确的玩家部分。
- 同一个 event 出现多个候选时不做选择，保留未映射状态并暴露实际问题。
- 不把赛事侧 Player ID 更新回 `startgg_watch_players.player_id`。

匹配成功后写入已有的 `startgg_watch_event_entrants.entrant_id` 和 `entrant_name`。不需要新增赛事 Set 查询逻辑；后续已经使用：

```text
event.sets(filters: { entrantIds })
```

因此本次改动只修复身份映射，不改变赛况、决赛阶段和去重流程。

### 3.4 保留手动 event URL 的正常入口

`/watch <event_url>` 已经能够创建/切换 active event。本次修复后，它会：

1. 建立 event 订阅。
2. 读取赛事 Entrant。
3. 用新的多级身份映射找到启用选手。
4. 使用 Entrant ID 查询 sets 和 standings。

这为 start.gg API 没有提供全局身份关联的赛事保留一个确定可用的主路径。

## 4. 不采用的方案

| 方案 | 不采用原因 |
| --- | --- |
| 把预设 Player ID 替换为赛事 Entrant Player ID | ID 随赛事变化，无法作为预设身份；下一场赛事会失效 |
| 只扩大 `updatedAfter` | 全局 Player 的无过滤历史 Set 也没有本场赛事，不能解决 ID 断链 |
| 只用赛事显示名称做全局发现 | 未知 event 时没有候选赛事范围；同时可能产生重名误匹配 |
| 每轮扫描所有当前赛事和所有 Entrant | API 没有按全局选手直接过滤的入口，请求量和实现复杂度都不适合当前个人 bot |
| 只增加 `participant.user` 查询 | 本次真实赛事中该字段为空，不能作为唯一方案 |
| 通过 `User.events`/`User.tournaments` 代替当前发现 | 对正常关联赛事有价值，但本次孤立 Entrant 不会出现在用户赛事列表中，不能覆盖根因 |

## 5. 请求量影响

正常自动发现的请求量保持不变：

- 仍按启用选手查询近期 sets。
- 不增加全局赛事目录查询。
- 赛事 Entrant 查询只增加字段，不增加请求次数。
- 事件跟踪继续按已映射 Entrant 查询 sets 和 standings。

只有用户通过 event URL 添加赛事时，才会走现有的赛事 Entrant 查询；这属于已经存在的监控主路径。

## 6. 验收标准

实施完成后应满足：

1. 正常全局 Player ID 关联的赛事，自动发现和现有行为一致。
2. 本次 FightClub Championship 赛事通过 event URL 添加后，XiaoHai、Vxbao、Zhen、XiaoXu、DCQ 能分别映射到正确的 entrant。
3. 映射使用赛事 Entrant ID 查询本场 Set，不再因全局 Player ID 不一致而显示 `not_entered`。
4. 预设文件中的全局 `player_id` 不被赛事侧 ID 覆盖。
5. 赛事侧 Player ID、User slug 为空时，唯一 gamerTag 仍可完成映射。
6. gamerTag 存在多个候选时不误选。
7. 自动发现请求数量不因本次修复增加。
8. 完全没有 URL 且没有 User 关联的孤立赛事，仍明确属于当前自动发现能力边界，不返回伪成功结果。

## 7. 依据

- 当前自动发现：[`src/services/startggDiscovery.ts`](../../src/services/startggDiscovery.ts)
- 当前 start.gg 查询：[`src/services/startgg/queries.ts`](../../src/services/startgg/queries.ts)
- 当前赛事映射：[`src/services/startgg/tracker.ts`](../../src/services/startgg/tracker.ts)
- 当前 start.gg repository：[`src/services/startggRepository.ts`](../../src/services/startggRepository.ts)
- [start.gg：Sets by Player](https://developer.start.gg/docs/examples/queries/sets-by-player/)
- [start.gg：Event Entrants](https://developer.start.gg/docs/examples/queries/event-entrants/)
- [start.gg：Entrants within a Tournament](https://developer.start.gg/docs/examples/queries/entrants-by-tournament/)
- [start.gg Schema：User](https://smashgg-schema.netlify.app/reference/user.doc)
- [start.gg Schema：ParticipantPageFilter](https://smashgg-schema.netlify.app/reference/participantpagefilter.doc)
- [start.gg Schema：Player](https://smashgg-schema.netlify.app/reference/player.doc)
