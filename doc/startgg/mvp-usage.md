# start.gg 监控使用说明（当前版本）

## 1. 前置配置

需要在环境变量中配置：
- `STARTGG_API_TOKEN`
- `TG_TOKEN`
- `TG_CHAT_ID`

## 2. 使用顺序与预期

### 第一步：确认固定选手已生效

固定选手来源：
- 原始清单：`doc/startgg/fixlist.md`
- 生效清单：`data/startgg_preset_players.json`

预期：
- 发送 `/startgg` 或 `/watchlist` 时，会自动把固定选手同步进监控库。
- 首次会解析 `user_url -> player_id` 并回写到 `data/startgg_preset_players.json`。

### 第二步：添加你要看的项目（必做）

发送：
- `/watch https://www.start.gg/tournament/xxx/event/yyy`

预期：
- 返回“已添加项目：xxx”。

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

## 3. 活跃时段规则（自动）

- 系统不再依赖手工赛事窗口。
- 每次检查前会请求项目所属 tournament 的 `startAt/endAt`。
- 仅当当前时间落在该区间内时，才会对该项目执行抓取。

## 4. 常用命令

- `/startgg`：查看引导、当前配置数量、当前活跃项目数
- `/watch <选手名 | user链接 | event链接>`：添加选手或项目
- `/watchlist`：查看监控对象与最近状态
- `/fetchstartgg`：立即执行一次检查（自动活跃时段判定）
