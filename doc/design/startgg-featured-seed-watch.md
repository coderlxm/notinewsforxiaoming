# start.gg 赛事种子选手临时关注需求与设计

## 1. 背景

当前 start.gg 监控以固定关注选手为入口。系统自动发现这些选手参加的 event，建立选手与 entrant 的映射，并持续推送他们的赛果。

这种方式适合持续关注少量固定选手，但在 Evo 等大型赛事中存在明显断层：

- event 可能有数百到两千名以上参赛者。
- 固定关注选手只覆盖整个签表中的很小一部分。
- 固定关注选手在 Day 1 淘汰或结束当日赛程后，后续比赛仍在继续，但普通阶段不再产生消息。
- 用户无法为每届赛事逐个添加大量知名选手。
- 当前赛事级跟踪只在系统发现 `2 <= numSeeds <= 8` 的最终 Phase 后覆盖全部比赛，无法覆盖大型赛事从 pools 到 Top 8 之间的大量精彩对局。

本需求需要在“固定关注选手”和“最终阶段全量赛果”之间增加一层赛事级临时关注能力。

## 2. 目标

为当前 active event 自动建立一份有限规模的种子选手清单，并推送这些选手在该 event 中的新完成对局。

目标体验：

1. 用户点击 Telegram 常驻键盘中的 `👊 比赛了` 后，不需要再输入命令或逐个录入选手。
2. `比赛了` 自动发现赛事时，同时应用已经保存的 Top 16/32 种子关注配置。
3. 清单只对当前 event 生效，不污染长期固定关注名单。
4. 固定关注选手结束比赛后，种子选手仍能维持赛事消息流。
5. 种子选手存在进行中对局时，复用现有 2 分钟 Fast Watch。
6. 同一场 Set 即使涉及两名种子选手，或同时涉及固定关注选手，也只推送一次。
7. 消息继续按 event 聚合，避免大型赛事形成逐场刷屏。
8. event 结束或失活后，临时清单自然停止参与监控。

## 3. 非目标

第一版不解决：

- 全量跟踪 event 中所有参赛者。
- 根据直播热度、社交媒体、赔率或 AI 判断“精彩程度”。
- 自动维护跨赛事的世界排名或知名选手数据库。
- 多用户分别保存不同推荐列表。
- 猜测 start.gg 没有提供的选手实力、国籍、战队或角色数据。
- 为失败请求增加重试、fallback、静默跳过或默认成功。

## 4. 术语

### 4.1 固定关注选手

现有 `startgg_watch_players` 中启用的长期关注对象。身份来自 start.gg User/Player，并通过 `startgg_watch_event_entrants` 映射到具体 event entrant。

### 4.2 赛事种子选手

从当前 event 的初始大规模 Phase seeds 中，按 seed number 取前 N 名得到的 entrant。它只在当前 event 中有效，不需要创建全局 watch player。

### 4.3 推荐关注选手

产品展示名称。第一版推荐依据只有 start.gg 的赛事种子顺序，因此“推荐关注”与“种子临时关注”使用同一份数据，不额外引入主观推荐算法。

## 5. 用户入口与交互

### 5.1 高频主入口：`👊 比赛了`

Telegram 常驻键盘中的 `👊 比赛了` 是本功能的默认主入口。它当前对应无关键词的 `start.gg go`，后续仍保持一次点击完成主流程：

```text
点击 👊 比赛了
  -> 同步固定关注选手
  -> 自动发现并激活当前 event
  -> 读取已保存的种子关注档位
  -> 为新 event 自动建立 Top 16/32 临时名单
  -> 立即检查
  -> 开启 15 分钟固定轮询
  -> 如有 active Set，进入 2 分钟 Fast Watch
  -> 返回一张可继续操作的启动结果卡片
```

首次使用时默认 Top 16，因此用户只点击一次 `比赛了` 就已经获得固定选手和种子选手两层监控，不要求进行第二次配置。

启动结果卡片展示：

```text
🥊 start.gg 监控已启动
赛事：Evo 2026
固定关注：7 位
种子关注：Top 16（已同步 16 位）
项目：Street Fighter 6
固定轮询：15 分钟
```

卡片下方提供 inline buttons：

```text
[✅ Top 16] [Top 32]
[关闭种子关注] [查看种子清单]
```

按钮直接作用于当前及后续 active event，并编辑原启动结果卡片反映最新状态，不额外发送一串配置确认消息。

如果用户此前选择过 Top 32 或关闭，下一次点击 `比赛了` 直接沿用该设置。主入口不在每届赛事重复询问同一个选项。

### 5.2 档位选择

第一版提供 16 和 32 两档：

- Top 16：消息较少，覆盖赛事最核心的一组选手。
- Top 32：覆盖面更大，适合 Evo 等超大型赛事。

推荐默认值为 16。用户明确选择 32 后持久化该选择，后续自动发现的新 event 继续使用 32。

`off` 只关闭种子临时关注，不影响固定选手监控、最终 Phase 跟踪和 start.gg 固定轮询。

除启动结果卡片上的按钮外，保留以下命令作为辅助入口：

```text
/startgg seeds 16
/startgg seeds 32
/startgg seeds off
```

命令不是主要操作路径，只用于键盘按钮消息已经不在当前聊天视野中时直接配置。

### 5.3 查看清单

启动结果卡片中的“查看种子清单”是默认查看入口。点击后优先编辑当前卡片，显示：

- 当前配置：Top 16、Top 32 或关闭。
- 当前 active event。
- 已同步的种子选手数量。
- seed number 和 entrant name。
- 最近同步时间。

清单底部提供“返回监控状态”按钮，恢复启动结果卡片。

清单超过单条 Telegram 消息长度时，首条消息继续作为可编辑的状态卡片，超出的名单部分才新增消息。

同时保留 `/startgg seeds` 作为辅助查看入口。

### 5.4 推送内容

种子选手的新完成 Set 使用赛事摘要中的独立区块：

```text
🌟 种子选手赛果（3 场）
• Winners Round 2：Player A 2 - Player B 0 · 胜者 Player A
• Winners Quarter-Final：Player C 2 - Player D 1 · 胜者 Player C
```

每场附 start.gg Set 链接。

固定关注选手更新、种子选手赛果、最终阶段赛果可以进入同一 event 摘要，但必须分区展示。

## 6. 推荐方案

### 6.1 总体链路

```text
固定轮询或 /startgg go
  -> 自动发现 active event
  -> 读取持久化 seed count
  -> 为新 event 选择初始大规模 Phase
  -> 拉取该 Phase seeds
  -> 保存前 N 名 entrant
  -> 固定选手 entrant IDs 与种子 entrant IDs 合并查询 Sets
  -> 固定选手继续走现有选手快照
  -> 种子选手只选择新完成 Sets
  -> 与固定选手、最终 Phase 做 Set 级去重
  -> 发送一条 event 摘要
  -> Telegram 成功后写入 Set 去重记录
```

### 6.2 为什么使用赛事 seeds

赛事 seeds 适合作为第一版唯一推荐依据：

- start.gg 已有结构化 seed number，无需手工维护跨赛事名单。
- seed 与具体 event entrant 直接关联，不需要再次解决 User/Player 身份漂移。
- Top 16/32 能把两千人签表压缩为可控规模。
- 规则确定、用户可理解，也便于在 Telegram 中直接查看。

seed 高不等于比赛一定精彩，但它比全量跟踪或维护一套主观知名选手库更符合当前个人工具的最短主路径。

### 6.3 Phase 选择

现有 API 层已经能读取 event phases 的：

- `id`
- `name`
- `phaseOrder`
- `numSeeds`
- `state`

并能通过 phase ID 分页读取 seeds。

第一版候选规则：

1. 排除 `numSeeds` 为空的 Phase。
2. 选择 `numSeeds` 最大的 Phase。
3. `numSeeds` 相同时选择 `phaseOrder` 最小的 Phase。
4. 按 `seedNum` 升序取前 N 名。

该规则的意图是选择覆盖完整初始签表的 Phase，而不是 Top 8 等后续 Phase。

需要注意：这是基于现有字段含义形成的设计判断，不是已经完成的线上运行时验证。实施前应使用当前大型 event 的真实 Phase 数据确认“最大 `numSeeds` Phase”确实对应初始完整种子表；如果实际数据出现多个语义冲突的同规模 Phase，应暂停自动写入，不猜测选择。

### 6.4 同步时机

种子名单按 event 保存，只在以下时机建立或替换：

- `/startgg go` 激活新 event。
- 固定轮询首次自动发现新 event。
- 用户修改 `/startgg seeds 16|32`。

普通 15 分钟轮询不反复重建已经完整保存的名单。种子顺序属于赛事配置数据，不需要每轮重新查询。

用户在 event 已经进行一段时间后才开启或扩大清单时：

- 当前已完成 Sets 建立为已读基线。
- 只推送启用后的新完成 Sets。
- 不补发种子名单启用前的大量历史比赛。

这条规则用于避免一次开启 Top 32 后立即涌入数十场旧赛果。

### 6.5 Set 查询与推送

将当前 event 的查询 entrant IDs 扩展为：

```text
固定关注选手 entrant IDs
  ∪
赛事种子 entrant IDs
```

对种子选手：

- `completedAt !== null` 才形成赛果推送。
- `startedAt !== null && completedAt === null` 只用于维持 Fast Watch，不发送“正在比赛”消息。
- 同一 Set 两侧都是种子选手时只保留一条。
- Set 涉及固定关注选手时，由固定关注区块展示，不在种子区块重复。
- Set 已由最终阶段区块展示时不重复发送。

种子选手存在 active Set 时计入 `activeSetCount`，因此系统会从 15 分钟固定轮询切换到现有每 2 分钟 Fast Watch。这样大型赛事中的种子选手短局也能获得接近实时的完赛推送。

### 6.6 去重与发送顺序

继续使用现有 `startgg_event_pushed_sets` 作为赛事级 Set 去重记录，不新增第二套种子 Set 去重表。

每轮顺序：

1. 计算固定关注选手更新。
2. 计算种子选手新增完成 Sets。
3. 计算最终 Phase 新增 Sets。
4. 按 Set ID 在三个区块之间去重。
5. 构建 event 摘要。
6. 发送 Telegram。
7. 发送成功后写入赛事级 Set 去重记录。

发送失败时不写入对应去重记录，错误直接暴露。

## 7. 数据模型

### 7.1 运行设置

在 `startgg_runtime_settings` 增加：

```text
featured_seed_count INTEGER NOT NULL DEFAULT 16
```

约束值只允许：

```text
0, 16, 32
```

`0` 表示关闭。

### 7.2 Event 种子名单

新增：

```sql
CREATE TABLE startgg_watch_event_featured_entrants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_event_id INTEGER NOT NULL,
  phase_id INTEGER NOT NULL,
  entrant_id INTEGER NOT NULL,
  entrant_name TEXT NOT NULL,
  seed_num INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(watch_event_id) REFERENCES startgg_watch_events(id),
  UNIQUE(watch_event_id, entrant_id),
  UNIQUE(watch_event_id, seed_num)
);
```

不创建全局 Player 记录，因为该功能关注的是 event entrant，不需要把临时对象提升为长期身份。

### 7.3 复用现有表

- `startgg_watch_events`：确定名单所属 event 和 active 状态。
- `startgg_event_pushed_sets`：种子赛果与最终阶段的赛事级去重。
- `startgg_sent_messages`：继续记录 Telegram message ID。

event 失活后保留名单和去重历史，行为与现有 event、snapshot 和 pushed set 历史一致；不新增自动清理逻辑。

## 8. 模块改动范围

### `src/reminders/db.ts` 和 `src/reminders/migrations.ts`

- 增加 `featured_seed_count`。
- 增加 event featured entrants 表。

### `src/services/startggRepository.ts`

- 读取和设置 seed count。
- 替换、查询 active event 的 featured entrants。
- 在 event 清空路径中同步清理对应数据。

### `src/services/startgg/queries.ts`

- 现有 Phase seeds 字段足够时直接复用。
- 如果初始 Phase 选择需要额外 event phase 字段，只增加直接必要字段。

### `src/services/startgg/client.ts`

- 复用 Phase seeds 分页请求。
- 增加“读取 event phases 并选取种子来源 Phase”的直接接口。

### `src/services/startggPresetSync.ts`

- 新 event 激活后，根据持久化 seed count 建立 featured entrant 名单。

### `src/services/startgg/tracker.ts`

- 合并固定和 featured entrant IDs。
- 计算 featured active Set。
- 选择 featured 新完成 Set。
- 与固定选手和最终 Phase 结果去重。

### `src/formatters/startggFormatter.ts`

- 增加“种子选手赛果”摘要区块。
- 增加 seed 配置和名单展示。
- 为 `比赛了` 的启动结果增加可编辑状态卡片及 Top 16、Top 32、关闭、查看清单按钮。

### `src/bot/interactive.ts`

- `handleStartggGo()` 在 `比赛了` 主路径中自动同步当前 seed 档位，并返回带按钮的启动结果卡片。
- 增加 seed 档位切换、查看清单和返回状态的 callback 处理。
- 增加 `/startgg seeds`、`/startgg seeds 16|32|off`。
- 配置变更后同步当前 active event 名单。

### `src/bot/callbacks.ts`

- 增加种子档位和名单页面 callback data 的解析。
- callback 携带当前 event 或状态卡片上下文，不依赖用户再次输入赛事名称。

## 9. 消息量控制

第一版只采用以下直接规则：

- 清单规模限制为 16 或 32。
- 只推送完成赛果，不推送开赛提醒。
- 同轮结果按 event 合并。
- 同一 Set 在固定选手、种子选手和最终阶段之间只出现一次。
- 中途开启时不补发历史种子赛果。

不增加定时缓冲、夜间摘要、消息优先级、每日上限或静默丢弃。这些机制会改变实时战报语义，只有真实出现消息过多问题后再单独处理。

## 10. 与当前主路径的关系

完成后的覆盖层次为：

```text
固定关注选手
  -> 用户最关心的长期对象，全程推送状态和赛果

赛事 Top 16/32 seeds
  -> event 临时推荐对象，推送新完成赛果

最终 Phase
  -> Top 8 等最终阶段，推送全部新增赛果和最终排名
```

三层共享同一个 event 轮询和 Telegram 摘要，不建立第二套调度系统。

## 11. 验收标准

1. 用户设置 Top 16 后，active event 保存 seed 1–16 对应的 entrant。
2. 首次点击 `👊 比赛了` 时，无需额外输入即可按默认 Top 16 建立临时名单并开始监控。
3. 用户从启动结果卡片切换 Top 32 后，原卡片更新为 Top 32，不新增配置确认消息。
4. 用户点击“查看种子清单”后可以查看当前 event 名单，并可返回原状态卡片。
5. seed 选手的新完成 Set 能进入赛事摘要。
6. seed 选手存在 active Set 时，系统进入 2 分钟 Fast Watch。
7. 两名 seed 选手交手只产生一条赛果。
8. Set 同时涉及固定关注选手时，不在种子区块重复。
9. Set 进入最终 Phase 后，不与最终阶段区块重复。
10. 中途启用 Top 16/32 不补发启用前的历史赛果。
11. 从 16 调整到 32 后，只新增 17–32 seeds，既有去重记录不被重置。
12. `off` 后停止种子赛果和种子 active Set 检测，但固定选手与最终 Phase 保持原行为。
13. event 结束后不再产生该 event 的种子赛果。
14. Telegram 发送失败时不写入对应 Set 去重记录。

## 12. 推荐实施顺序

1. 先用真实大型 event 核对 Phase 与 seed 数据，确认初始 Phase 选择规则。
2. 增加数据表和 repository。
3. 先完成 `比赛了` 启动结果卡片、callback 和名单展示。
4. 补充 seed 配置命令作为辅助入口。
5. 在 event 激活链路建立临时名单。
6. 接入 Sets 查询、Fast Watch 和赛事级去重。
7. 增加摘要中的种子选手赛果区块。

## 13. 最终建议

第一版采用“event Top 16/32 seeds 临时关注”，不先做可无限扩展的推荐系统。

推荐默认 Top 16，并把 Telegram 常驻键盘中的 `👊 比赛了` 作为绝对主入口：一次点击自动应用已保存档位，启动结果卡片再提供 Top 16、Top 32、关闭和查看清单按钮。用户在 Evo 等大型赛事中需要扩大覆盖时只点一次 Top 32，不需要记忆命令。

该设计能直接解决固定关注选手结束 Day 1 后消息断流的问题，同时复用现有 event、Phase、Set 去重、15 分钟固定轮询和 2 分钟 Fast Watch 主路径，新增概念和长期维护成本都较小。
