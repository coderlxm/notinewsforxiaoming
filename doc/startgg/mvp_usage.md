# start.gg 监控使用说明（精简版）

## 1. 前置配置

需要在环境变量中配置：
- `STARTGG_API_TOKEN`
- `TG_TOKEN`
- `TG_CHAT_ID`

## 2. 最短使用流程（按顺序）

### 第一步：确认固定选手已生效

固定选手来源：
- 原始清单：`doc/startgg/fixlist.md`
- 生效清单：`data/startgg_preset_players.json`

预期：
- 固定选手会在你查看 `/startgg` 或 `/watchlist` 时自动同步进监控库。

### 第二步：添加你这次要看的项目（必做）

发送：
- `/watch https://www.start.gg/tournament/xxx/event/yyy`

预期：
- 返回“已添加项目：xxx”

### 第三步：手动触发一次检查

发送：
- `/fetchstartgg`

预期：
- 返回“项目 X 个，选手 Y 个，状态变化 Z 条”

### 第四步：查看当前监控状态

发送：
- `/watchlist`

预期：
- 可以看到：选手列表、项目列表、最近状态（胜者/败者/淘汰/完赛）

## 3. 关键说明

1. 现在不需要“赛事窗口”才能执行监控。  
2. 只要你添加了项目，手动和定时监控都会执行。  
3. 如果项目数是 0，说明你还没添加项目链接。

## 4. 常用命令

- `/startgg`：查看引导与当前配置数量
- `/watch <选手名 | user链接 | event链接>`：添加选手或项目
- `/watchlist`：查看监控对象与最近状态
- `/fetchstartgg`：立即执行一次监控

## 5. 可选高级能力（不用也行）

如果你仍想提前配置“自动赛事窗口注入项目”，可以使用：
- `/startggwindow <自然语言描述>`
- `/startggwindows`
- `/startggwindowdel <窗口名>`

这套能力现在是可选的，不是主流程必需步骤。
