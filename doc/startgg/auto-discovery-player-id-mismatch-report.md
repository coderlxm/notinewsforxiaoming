# start.gg 自动发现未命中赛事的 API 关联诊断报告

诊断日期：2026-07-18（Asia/Shanghai）  
诊断对象：[FightClub Championship - World Warrior 2026 Asia 3 / Street Fighter 6](https://www.start.gg/tournament/fightclub-championship-world-warrior-2026-asia-3/event/street-fighter-6)

## 1. 结论摘要

这次自动发现失败的根因已经确认：

> 赛事 API 中参赛者记录使用的 `player.id`，与预设选手配置中的全局 `player.id` 不一致；当前自动发现只从预设全局 Player 的 `sets` 反查赛事，因此无法命中这场赛事。

赛事本身并非没有开始，也不是赛事页面显示与 API 状态不一致：

- `event.state` 返回 `ACTIVE`。
- 赛事 Entrant API 返回 199 名参赛者。
- 5 名预设选手出现在该赛事的 Entrant 列表中。
- 使用赛事 Entrant 记录中的 Player ID 查询，能够返回这些选手在本场赛事中的已完成和未完成 Set。
- 使用预设文件中的全局 Player ID 查询，即使去掉 `updatedAfter`，也找不到本场赛事。

因此，单纯扩大近期 Set 时间窗口、延长赛事活动窗口或放宽赛事状态判断，都不能解决这次问题。

## 2. 当前源码路径

自动发现入口位于 [`src/services/startggDiscovery.ts`](../../src/services/startggDiscovery.ts)。当前流程是：

1. 读取启用选手，包括预设选手和手动添加选手。
2. 对每名选手调用 `fetchPlayerRecentSets()`。
3. 从 `player(id).sets()` 返回的 Set 中读取 event 和 tournament。
4. 要求 tournament 当前处于 `startAt/endAt` 范围内。
5. 要求 Set 在最近两天完成，或赛事在最近两天开始且 Set 尚未完成。
6. 按 event slug 去重后返回发现结果。

实际 GraphQL 查询定义在 [`src/services/startgg/queries.ts`](../../src/services/startgg/queries.ts) 的 `PLAYER_RECENT_SETS_QUERY`：

```graphql
player(id: $playerId) {
  sets(
    filters: {
      playerIds: $playerIds
      updatedAfter: $updatedAfter
    }
  )
}
```

也就是说，自动发现的第一步依赖的是“全局 Player ID 能够反查到该赛事 Set”。它不是先扫描所有进行中的赛事，再从赛事 Entrant 列表匹配选手。

## 3. 线上 API 核对结果

本次使用 `bwgdc01` 部署环境中的 `STARTGG_API_TOKEN` 直接请求 start.gg GraphQL API。Token 只用于请求，没有写入报告或输出。

### 3.1 赛事本身状态正常

```text
event.id       = 1621883
event.slug     = tournament/fightclub-championship-world-warrior-2026-asia-3/event/street-fighter-6
event.state    = ACTIVE
event.startAt  = 1784354400
entrant total  = 199
```

赛事级 API 的 Set 数据中已经存在本场比赛结果，因此“页面已经开始但 API 完全没有结果”这一假设不成立。

### 3.2 它是 World Warrior 长周期赛制中的分站赛事

从赛事命名和业务语义看，这场比赛属于 `World Warrior 2026 - Asia 3`，其中 `Street Fighter 6` 是该站的一个具体 Event。它不是把整个 World Warrior 长周期赛制作为一个持续中的单一 Event，而是以分站 Tournament 下的具体 Event 形式组织。

进一步查询这场赛事的层级关联，API 返回如下：

```text
event.id              = 1621883
event.name            = Street Fighter 6
event.league          = null
event.tournament.id   = 910133
event.tournament.name = FightClub Championship - World Warrior 2026 - Asia 3
```

因此，就 start.gg 当前 API 数据而言，确认的层级是：

```text
FightClub Championship - World Warrior 2026 - Asia 3 (Tournament)
  -> Street Fighter 6 (Event)
```

不能把它写成已经确认的 `League -> Event` 关系，因为本场 Event 的 `league` 字段实际返回为空。World Warrior 的长周期归属目前主要体现在 Tournament 的命名和赛事组织方式中，而不是本次 API 响应中的正式 League 关联。

这个分站结构可以解释为什么本场赛事需要单独看待，但它不是已确认的 Player ID 失配原因。已确认的直接原因仍然是：赛事 Entrant 使用了与预设全局 Player 不同的 Player ID，且当前 API 响应没有把两者关联起来。至于分站赛事的参赛者记录是否因此被主办方按站点重新创建，现有 API 证据不足以进一步证明。

### 3.3 预设 Player ID 与赛事 Entrant Player ID 不一致

| 选手 | 预设文件中的 Player ID | 赛事 Entrant 中的名称 | 赛事 Entrant 中的 Player ID |
| --- | ---: | --- | ---: |
| XiaoHai | 4004146 | `Falcons丨Xiaohai` | 5479000 |
| Vxbao | 1212885 | `AG 8BitDo丨Vxbao` | 5479008 |
| Zhen | 1455289 | `AG 8BitDo丨Zhen` | 5478986 |
| XiaoXu | 4637229 | `GTW丨XiaoXu` | 5478982 |
| DCQ | 2056200 | `NMS PWS丨DCQ` | 5478978 |

这 5 名选手都确实出现在赛事 Entrant 列表中，但赛事返回的 Player ID 与预设配置的 Player ID 没有一个相同。

`gachikun` 没有出现在本次 Entrant 名称匹配结果中，这不影响上述 ID 关联结论。

### 3.4 对 XiaoHai 的分拆查询

对预设 Player ID `4004146` 分别执行了以下查询：

| 查询方式 | 返回总数 | 是否包含本场赛事 |
| --- | ---: | --- |
| `player(id:4004146).sets()`，分页读取全部 403 条 | 403 | 否 |
| 仅增加 `playerIds:[4004146]` | 403 | 否 |
| 仅增加最近 7 天 `updatedAfter` | 0 | 否 |
| 同时使用 `playerIds` 和 `updatedAfter`（当前代码） | 0 | 否 |

随后对赛事 Entrant 中 XiaoHai 对应的 Player ID `5479000` 使用当前代码的同样过滤条件，返回了 3 个本场 Set：

```text
105417162  completedAt = 1784357952
105417160  completedAt = 1784356416
105417156  completedAt = 1784355409
```

对其他 4 名赛事 Entrant Player ID 的同样查询结果如下：

| 赛事 Entrant Player ID | 本场 Set 数量 | 结果 |
| ---: | ---: | --- |
| 5479008（Vxbao） | 3 | 能返回本场赛事 Set |
| 5478986（Zhen） | 3 | 能返回本场赛事 Set |
| 5478982（XiaoXu） | 4 | 能返回本场赛事 Set，其中包含 1 个未完成 Set |
| 5478978（DCQ） | 3 | 能返回本场赛事 Set，其中包含 1 个未完成 Set |

这说明 `updatedAfter`、Set 完成状态以及 start.gg API 的 Set 索引本身都能够正常工作；失败发生在使用哪一个 Player ID 作为查询入口这一步。

## 4. 根因判断与排除项

### 已确认根因

当前发现链路使用预设文件同步得到的全局 Player ID，例如 XiaoHai 的 `4004146`。但本场赛事的 Entrant 记录返回了另一组 Player ID，例如 `5479000`。start.gg API 没有在当前查询响应中把这两组 ID 关联起来，因此：

```text
预设全局 Player ID
  -> player(id).sets()
  -> 找不到本场赛事
```

而赛事侧记录可以正常查询：

```text
赛事 Entrant Player ID
  -> player(id).sets()
  -> 找到本场赛事 Set
```

### 已排除因素

1. **不是赛事尚未开始**：`event.state = ACTIVE`。
2. **不是赛事页面和 API 状态不同**：赛事级 API 返回 199 名 Entrant 及 397 个 Set，且包含当前结果。
3. **不是 API 还没有写入比赛结果**：赛事侧 Player 查询已返回多个带 `completedAt` 的 Set。
4. **不是最近 7 天窗口过短**：对预设全局 Player 去掉 `updatedAfter` 后，遍历全部 403 条历史 Set 仍没有本场赛事。
5. **不是最近 2 天活动判断过严**：赛事侧返回的 Set 完成时间就在当前诊断时间附近。
6. **不是 `playerIds` 过滤额外造成的**：对 XiaoHai 仅保留 `playerIds:[4004146]` 时仍然找不到本场赛事。

## 5. 对当前功能边界的影响

当前自动发现实际上依赖以下前提：

```text
预设/启用选手的全局 Player ID
  必须能够通过 player(id).sets()
  反向包含其赛事 Entrant 对应的 Set
```

本场赛事不满足这个前提，所以即使所有预设选手都已经报名并且已经产生比赛结果，自动发现仍然会返回“没有从固定选手近期 set 中发现当前赛事”。

直接把预设 ID 替换成 `5479000` 等赛事侧 ID 只能针对本场赛事生效，不能作为预设配置方案，因为这些 ID 是随着赛事 Entrant 记录出现的另一组 ID，并不等同于稳定的用户配置 ID。

因此，后续若要覆盖此类赛事，需要单独设计“全局 Player 与赛事 Entrant 之间的关联/发现路径”。仅调整 `updatedAfter`、活动时间窗口或增加关键词匹配，不能修复这个根因。

## 6. 参考资料

- 当前自动发现实现：[`src/services/startggDiscovery.ts`](../../src/services/startggDiscovery.ts)
- 当前 Player Set 查询：[`src/services/startgg/queries.ts`](../../src/services/startgg/queries.ts)
- [start.gg：Sets by Player](https://developer.start.gg/docs/examples/queries/sets-by-player/)
- [start.gg：Entrants within a Tournament](https://developer.start.gg/docs/examples/queries/entrants-by-tournament/)
- [start.gg：Events in a Tournament](https://developer.start.gg/docs/examples/queries/events-by-tournament/)
- [start.gg：Glossary](https://developer.start.gg/docs/glossary/)
- [start.gg Schema：Event](https://smashgg-schema.netlify.app/reference/event.doc)
- [start.gg Schema：League](https://smashgg-schema.netlify.app/reference/league.doc)
- [start.gg Schema：SetFilters](https://smashgg-schema.netlify.app/reference/setfilters.doc)
