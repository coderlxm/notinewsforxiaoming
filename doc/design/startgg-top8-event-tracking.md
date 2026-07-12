# start.gg 八强赛事跟踪方案

状态：已实施

## 1. 目标

保留现有关注选手跟踪，并在赛事进入明确的决赛阶段后自动增加event级跟踪：

```text
发现不超过8人的决赛phase
→ 推送决赛阶段名单
→ 跟踪该phase全部后续set
→ event完赛后推送最终排名
```

整个过程由20分钟固定轮询自动发现，不要求用户在比赛期间执行命令。

## 2. 自动进入八强的依据

使用start.gg的Phase结构，不使用`Standing.isFinal`计数。

固定轮询查询active event的：

```text
event.state
event.phases {
  id
  name
  phaseOrder
  numSeeds
  state
  bracketType
}
```

选择`phaseOrder`最大的、满足以下条件的phase：

```text
2 <= numSeeds <= 8
并且
state属于READY、ACTIVE或COMPLETED
```

发现后自动启用该phase的赛事级跟踪。

这里的业务语义实际是“八强或更晚的明确决赛phase”。如果主办方直接创建Top 4 phase，也会自动进入；用户不会因为bot错过Top 8轮询时点而失去后续跟踪。

不依赖phase名称包含`Top 8`或`Finals`，名称只用于消息展示。

## 3. 为什么不用Standing.isFinal

`Standing.isFinal`来自GraphQL schema，但官方文档没有承诺它可用于计算当前存活人数。

真实BAM 2026数据进一步证明它不适合作为该判断：event已经是`COMPLETED`，但第3名和一位第9名的standing仍返回`isFinal=false`。如果按未final数量判断，会得到错误的存活人数和完赛状态。

因此：

- `Standing.placement`用于最终排名展示。
- `Standing.isFinal`不参与八强阶段识别。
- `Event.state=COMPLETED`用于确认event完赛。
- `Phase.state`和`Phase.numSeeds`用于确认决赛phase。

## 4. 真实赛事验证依据

BAM 2026 Street Fighter 6 event返回：

```text
Pools    phaseOrder=1 numSeeds=230 state=COMPLETED
Top 32   phaseOrder=2 numSeeds=32  state=COMPLETED
Top 8    phaseOrder=3 numSeeds=8   state=COMPLETED
```

这说明大型赛事的阶段结构可以直接表达从Pools到Top 32再到Top 8的推进，不需要从选手淘汰状态反推。

## 5. 能力边界

如果event没有拆分出`numSeeds<=8`的独立phase，例如从数百人到决赛始终使用一个phase，首期不猜测它何时进入八强，也不自动启用event级跟踪。

这是明确的不支持，不使用以下替代判断：

- round名称文本匹配
- 统计`isFinal=false`
- 根据set累计败场反推
- phase名称关键词

这些方法会因赛事格式和主办方配置不同产生误判。首期优先覆盖具有明确Top 8/Top 4 phase的大型赛事。

## 6. 首次进入决赛phase

第一次发现目标phase时：

1. 保存目标`phase_id`、名称和`numSeeds`。
2. 将该phase当时已经完成的sets写入赛事级已读基线。
3. 查询phase seeds作为阶段名单。
4. 推送一条阶段开始消息。

示例：

```text
🏆 BAM 2026 / Street Fighter 6 已进入 Top 8

1. Player A
2. Player B
...

查看赛事
```

名单顺序使用phase seed顺序，明确标注为阶段名单，不称为实时排名。

首次启用不补发phase启用前已完成的sets，避免历史消息洪水。

## 7. 后续set推送

启用后只查询目标phase的sets，而不是整个event的历史sets。

首期只推送新完成的set，消息包含：

- tournament和event名称
- phase与round名称
- 双方entrant名称
- 比分
- 胜者
- set链接

如果同一set已经通过关注选手路径推送，本轮不再发送一条赛事级重复消息。

赛事级去重键：

```text
watch_event_id + set_id
```

## 8. 轮询频率

### 固定轮询

每20分钟：

- 自动发现active event
- 检查phase结构
- 发现目标决赛phase
- 刷新关注选手状态
- 检查event是否完赛

### 决赛Phase连续轮询

目标Phase一旦出现第一场`startedAt`非空的set，即视为决赛直播阶段已经开始。从此每2分钟持续查询目标Phase，直到`Event.state=COMPLETED`，不因两场set之间暂时没有进行中对局而退出。

原因是格斗游戏Top 8通常全程直播并串行开打：当前一场结束后，下一场可能很快开始并结束。如果当前set结束就退回20分钟轮询，可能延迟整场比赛甚至错过连续赛果。

连续轮询只查询：

- 目标Phase的少量sets
- 该Phase所属Event.state

不重新执行选手级赛事发现、全event standings或完整entrant查询。Top 8通常只有十几场set，单次查询可在一页内完成，请求量很小。

目标Phase已经创建但尚未出现任何已开始set时，仍保持20分钟固定轮询，避免提前数小时进入加速。

## 9. 完赛行为

当`Event.state=COMPLETED`时：

1. 查询event standings前8名。
2. 按start.gg返回的placement展示最终排名。
3. 推送赛事最终结果。
4. 标记该event决赛阶段跟踪已完成。
5. 停止该Phase的2分钟连续轮询。

不要求所有`Standing.isFinal=true`。

并列名次保留start.gg原始placement，例如两个第5名、两个第7名。

## 10. 与选手消息去重

选手跟踪继续负责关注选手的状态变化。决赛phase跟踪负责全部后续完赛set。

同一个set只发一次：

- 已通过选手路径发送，则不再发送赛事级消息。
- 未通过选手路径发送，则发送赛事级赛果。

最终排名总结始终单独发送，不与单场set消息合并。

## 11. 数据模型

在`startgg_watch_events`增加：

```text
final_phase_id INTEGER
final_phase_name TEXT
final_phase_num_seeds INTEGER
final_phase_tracking_completed INTEGER NOT NULL DEFAULT 0
```

新增赛事级set去重表：

```text
startgg_event_pushed_sets
- watch_event_id
- set_id
- pushed_at
- UNIQUE(watch_event_id, set_id)
```

`final_phase_id`非空即表示决赛phase跟踪已启动，不额外增加started布尔字段。

## 12. 命令与状态

不新增启动命令。`/startgg go`默认包含自动决赛phase跟踪。

`/startgg status`展示：

- 决赛阶段：等待发现 / Top 8跟踪中 / Top 4跟踪中 / 已完成
- 当前目标phase名称

`/startgg deleteall`同时清理决赛phase状态和赛事级set去重记录。

## 13. 请求量

phase元数据只在20分钟固定轮询查询，数据量很小。

决赛Phase开打后，每2分钟使用一个GraphQL查询同时获取该Phase sets和Event.state，不读取整个event全部历史对局。phase seeds只在首次启用时读取一次，event standings只在event完赛时读取前8名。

## 14. 首期不包含

- 没有独立决赛phase的单phase event
- Race等非标准set推进格式
- 根据round文本猜测Top 8
- 手动`/startgg top8`命令
- 用户自定义Top 16或Top 32阈值
- 多用户偏好和开关

## 15. 实施顺序

1. 增加event phase元数据查询。
2. 固定轮询选择`numSeeds<=8`的最高phaseOrder阶段。
3. 保存目标phase并读取phase seeds和sets基线。
4. 推送决赛阶段名单。
5. 跟踪目标phase后续完成sets并与选手消息去重。
6. 目标phase首场开打后接入2分钟连续轮询，直到event完赛。
7. 使用`Event.state=COMPLETED`触发最终排名消息。
8. 更新status、deleteall和当前实现文档。

## 16. 官方API依据

- Phase提供`numSeeds`、`phaseOrder`、`state`、`bracketType`和sets，官方示例可按phase读取sets：[Sets in Phase](https://developer.start.gg/docs/examples/queries/sets-in-phase/)
- 官方Phase seeding示例使用`Phase.numSeeds`表达该phase的entrant数量：[Phase Seeds](https://developer.start.gg/docs/examples/queries/get-phase-seeding/)
- Standing表示当前或最终名次，但官方没有说明`isFinal`可作为存活人数计数：[Glossary](https://developer.start.gg/docs/glossary/)、[Event Standings](https://developer.start.gg/docs/examples/queries/event-standings/)
