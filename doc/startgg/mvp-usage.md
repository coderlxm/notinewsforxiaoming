# start.gg 监控使用说明（当前版本）

## 1. 前置配置

需要在环境变量中配置：
- `STARTGG_API_TOKEN`
- `TG_TOKEN`
- `TG_CHAT_ID`

## 2. 推荐使用方式

比赛期间直接发送：

- `/startgg go`

系统会自动同步固定选手，从最近两天有数据变化的 Street Fighter 6 tournament 中筛出当前活动赛事，再按选手身份确认 event，不需要手动查询赛事名称。

如果需要限定某个赛事，也可以发送：

- `/startgg go <赛事关键词>`

示例：

- `/startgg go evo`
- `/startgg go evo-us-2026`
- `/startgg go evo us 2026`

预期：
- 自动同步固定选手清单
- 自动从当前活动的 Street Fighter 6 tournament 中确认固定选手参加的 event
- 不带关键词时自动订阅当前发现到的所有项目
- 带关键词时只订阅 tournament name 或 tournament slug 命中的项目
- 立即执行一次检查
- 自动开启 start.gg 轮询

边界：
- 候选目录限定为最近 48 小时有数据变化、已发布且可公开搜索的 Street Fighter 6 tournament，并按 `startAt/endAt` 保留当前活动赛事。
- 身份优先使用全局 User / Player 精确匹配；断链记录只在 gamerTag 边界匹配且当前候选中的 Participant 唯一时自动确认。
- 名称候选有歧义时不会自动选择。
- 关键词命中多个 tournament 时只展示候选赛事，不会自动订阅。

## 3. 手动使用顺序与预期

### 第一步：确认固定选手已生效

固定选手配置：
- `data/startgg_preset_players.json`

预期：
- 发送 `/startgg` 或 `/watchlist` 时，会自动把固定选手同步进监控库。
- 首次会解析 `user_url -> player_id` 并回写到 `data/startgg_preset_players.json`。

### 第二步：按需手动添加项目

发送：
- `/watch https://www.start.gg/tournament/xxx/event/yyy`

预期：
- 返回“已添加项目：xxx”。

通常不需要手动添加项目；自动监控会在每次检查前同步当前进行中的项目。

新发现或重新启用的项目会推送每个已参赛选手的一条最新状态，不会补发订阅前已经结束的历史对局；同一项目重复执行 `/startgg go` 不会重复发送这条首状态。

### 第三步：触发检查

发送：
- `/fetchstartgg`

预期：
- 如果当前在活跃时段：返回“活跃项目 X 个，本次检查项目 Y 个，选手 Z 个，状态变化 N 条”。
- 如果当前不在活跃时段：返回“按 start.gg tournament startAt/endAt 判定已跳过抓取”。

### 第四步：看结果

发送：
- `/watchlist`

预期：
- 可以看到：选手列表、项目列表、最近状态（胜者/败者/淘汰/完赛）。

## 4. 活跃时段规则（自动）

- 系统不再依赖手工赛事窗口。
- 每次检查前会请求项目所属 tournament 的 `startAt/endAt`。
- 仅当当前时间落在该区间内时，才会对该项目执行抓取。

## 5. 常用命令

- `/startgg go`：自动发现固定选手当前参加的赛事、立即检查并开启轮询
- `/startgg go <赛事关键词>`：按赛事关键词筛选自动发现的项目、立即检查并开启轮询
- `/startgg deleteall`：删除已记录的 start.gg 推送消息，并清空本地赛事、快照和去重状态
- `/startgg`：查看引导、当前配置数量、当前活跃项目数
- `/watch <选手名 | user链接 | event链接>`：添加选手或项目
- `/watchlist`：查看监控对象与最近状态
- `/fetchstartgg`：立即执行一次检查（自动活跃时段判定）

`/startgg deleteall` 只会删除当前实现已记录 `message_id` 的 start.gg 推送；历史上未记录 ID 的消息无法定位删除。清理后会保留固定选手配置，下一次 `/startgg go` 会重新发现赛事。
