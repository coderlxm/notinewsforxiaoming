# start.gg 监控使用说明（易用版）

## 1. 前置配置

需要在环境变量中配置：
- `STARTGG_API_TOKEN`：start.gg 官方 GraphQL API token
- `TG_TOKEN`、`TG_CHAT_ID`：Telegram 推送配置

## 2. 固定清单模式（当前主路径）

固定选手配置文件：
- `data/startgg_preset_players.json`

赛事窗口配置文件：
- `data/startgg_tournament_windows.json`

当前项目已经内置你的固定选手清单；无需再手工 `/watch` 添加。
原始名单参考：`doc/startgg/fixlist.md`。
运行时生效名单：`data/startgg_preset_players.json`。

## 3. 赛事窗口维护

两种方式：

1. 文件方式：直接编辑 `data/startgg_tournament_windows.json`
2. 命令方式（自然语言）：
- `/startggwindow <一句话赛事描述>`
- `/startggwindows` 查看窗口
- `/startggwindowdel <窗口名>` 删除窗口

示例：
- `/startggwindow 下个月6月15日到18日监控CEO2026的SF6和KOF15，时区上海`

## 4. 手动监控与查看

1. 发送 `/startgg`  
查看引导、监控数量与当前是否处于赛事窗口。

2. 添加选手（3 选 1）
- 按名字：`/watch Tokido`
- 按用户链接：`/watch https://www.start.gg/user/xxxx`
- 如果名字命中多个候选，机器人会返回按钮，点选即可添加。

说明：固定清单模式下，这一步通常不需要。

3. 添加项目
- `/watch https://www.start.gg/tournament/xxx/event/yyy`

4. 查看列表
- `/watchlist`

## 5. `/watch` 输入规则

`/watch <内容>` 支持三类输入：
- 选手名：在已添加项目中匹配 entrant/player 名称
- 用户页链接：自动解析为 `player_id`
- 项目页链接：自动解析项目 slug 并入库

不再要求手工输入 `player_id` 才能开始使用。

## 6. 常用命令

- `/startgg`：打开 start.gg 引导
- `/watch <...>`：添加选手或项目
- `/watchlist`：查看监控对象和最近状态
- `/fetchstartgg`：手动触发一次检查
- `/startggwindow`：自然语言新增赛事窗口
- `/startggwindows`：查看赛事窗口
- `/startggwindowdel`：删除赛事窗口

兼容保留（不推荐新用户使用）：
- `/startggaddplayer`
- `/startggaddevent`
- `/startggwatchlist`

## 7. 状态说明

状态字段：
- `未在该项目出战`
- `胜者组进行中`
- `败者组进行中`
- `已淘汰`
- `赛事已完赛`

`/watchlist` 的“最近状态”会展示：
- 选手与项目
- 当前状态
- 名次（如有）
- 最近轮次与比分（如有）

## 8. 执行机制

- 自动执行：定时任务每 20 分钟运行一次 `startgg_watch`
- 自动执行前会先判断是否处于赛事窗口：
  - 在窗口内：同步固定选手 + 同步窗口 events + 执行抓取
  - 不在窗口内：跳过抓取
- 手动执行：`/fetchstartgg`（同样遵循赛事窗口判断）

## 9. 数据落库

相关表：
- `startgg_watch_players`
- `startgg_watch_events`
- `startgg_watch_snapshots`
