# start.gg 临时 Set 消失导致战报中断事故记录

## 事故摘要

2026 年 7 月 24 日，`Esports World Cup 2026: Street Fighter 6 - LCQ` 进行期间，start.gg 战报轮询因历史快照中的临时 `preview_*` Set ID 不再出现在 API 返回结果中而直接抛错。该错误中断整场赛事的处理和消息发送，并导致 resident bot 进程退出、被 systemd 重启。

用户确认最后一次收到战报推送的时间为北京时间 2026 年 7 月 24 日 20:04。服务器数据库中的最后一条 start.gg 消息记录时间为 `2026-07-24T12:04:12.174Z`，即北京时间 20:04，与用户侧记录一致。

截至北京时间 2026 年 7 月 24 日 23:20，故障仍可在当前部署版本和当前赛事数据下稳定复现。

## 当前订阅范围

线上数据库共有 7 名启用的关注选手：

- DCQ
- xiaohai
- Zhen
- Vxbao
- Punk
- gachikun
- XiaoXu

当前激活的订阅项目为：

- 赛事：`Esports World Cup 2026: Street Fighter 6 - LCQ`
- 项目：`Street Fighter 6 LCQ`
- event ID：`1640093`
- subscription source：`auto`

该项目实际建立 entrant 映射的关注选手为：

- DCQ
- Zhen
- Vxbao
- XiaoXu

xiaohai、Punk、gachikun 没有该项目的 entrant 映射，因此本届赛事不应产生他们的选手战报。

## 正常预期

系统应为已建立 entrant 映射的 4 名关注选手推送：

- 每场新增赛果
- 胜者组、败者组和淘汰状态变化
- 名次变化

项目进入最终阶段后，系统还应推送：

- 最终阶段开始及参赛名单
- 最终阶段的新增赛果
- 最终 Top 8 排名

故障发生前，数据库中的最后状态包括：

- Zhen：胜者组半决赛，`AG x 8BitDo | Zhen 2 - IBUSHIGIN | Yanai 1`
- XiaoXu：败者组第一轮，比分记录为 `DQ`
- DCQ：快照停留在临时 `preview_3392233_2_0`
- Vxbao：快照停留在临时 `preview_3392229_2_0`

北京时间 20:04 之后的新增赛果和状态变化存在漏推风险。

## 线上运行时证据

北京时间 20:20 起，固定轮询反复出现以下异常：

```text
Error: start.gg previous set missing from fetched sets: preview_3392229_2_0
```

后续错误中的临时 Set 变为：

```text
Error: start.gg previous set missing from fetched sets: preview_3392233_2_0
```

该错误在北京时间 20:20、20:40、21:00、21:20、21:40、22:00、22:20、22:40、23:00 和 23:20 的轮询中持续出现。每次错误都会令 `notinews-bot.service` 主进程退出，随后由 systemd 启动新进程。

北京时间 23:15 部署的 commit 为：

```text
abc2d1284625e91f86a03f933bb8c1379073db54
```

该部署未修改对应的 start.gg 处理逻辑，23:20 的轮询仍以相同错误失败。

## 源码行为

`src/services/startgg/tracker.ts` 中的 `selectSetsToPush()` 会在历史快照存在 `last_set_id` 时，要求该 ID 必须出现在本轮获取的 `playerSets` 中：

```ts
const previousSetIndex = sortedSets.findIndex((set) => set.id === previous.last_set_id);
if (previousSetIndex < 0) {
  throw new Error(`start.gg previous set missing from fetched sets: ${previous.last_set_id}`);
}
```

start.gg 在正式排阵前会返回形如 `preview_*` 的临时 Set。正式 Set 生成后，旧的 preview Set 可能不再出现在项目 Sets 返回结果中，因此上述前提不成立。

异常从 `selectSetsToPush()` 向上传递至 `processEvent()` 和 `runStartggWatchOnce()`。由于赛事处理结果没有正常返回，统一的 `sendStartggEventSummary()` 消息发送阶段不会执行。

固定调度中的异常继续向 `node-schedule` Job 传播，最终触发未处理的 Job error，使整个 resident bot 进程退出。该影响不局限于当前选手的一条战报，而是中断本轮整个 start.gg 项目的处理。

## 根因结论

根据源码行为和线上日志，可以确定直接根因是：

> 代码错误地把“上一次快照中的 Set 必须永久存在于后续 API 结果中”作为主路径不变量；start.gg 用正式 Set 替换临时 preview Set 后，该不变量被打破，轮询直接失败。

这不是一次偶发的 start.gg 请求失败。服务器在多轮请求中均能取得足够数据进入 Set 比对阶段，并稳定因同一业务判断抛错。

## 后续处理方向

后续应修正 `selectSetsToPush()` 对临时 preview Set 被正式 Set 替换的处理，使当前 API 返回的正式 Set 能继续按既有去重记录生成新增战报。

修复范围应保持在 Set 演进和推送游标主路径，不应通过重试、吞错、跳过整个选手或继续假装成功来掩盖问题。

