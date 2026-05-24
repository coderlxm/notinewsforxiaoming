# start.gg 监控使用说明（易用版）

## 1. 前置配置

需要在环境变量中配置：
- `STARTGG_API_TOKEN`：start.gg 官方 GraphQL API token
- `TG_TOKEN`、`TG_CHAT_ID`：Telegram 推送配置

## 2. 快速开始（推荐路径）

1. 发送 `/startgg`  
查看引导和当前配置数量。

2. 添加选手（3 选 1）
- 按名字：`/watch Tokido`
- 按用户链接：`/watch https://www.start.gg/user/xxxx`
- 如果名字命中多个候选，机器人会返回按钮，点选即可添加。

3. 添加项目
- `/watch https://www.start.gg/tournament/xxx/event/yyy`

4. 查看列表
- `/watchlist`

## 3. `/watch` 输入规则

`/watch <内容>` 支持三类输入：
- 选手名：在已添加项目中匹配 entrant/player 名称
- 用户页链接：自动解析为 `player_id`
- 项目页链接：自动解析项目 slug 并入库

不再要求手工输入 `player_id` 才能开始使用。

## 4. 常用命令

- `/startgg`：打开 start.gg 引导
- `/watch <...>`：添加选手或项目
- `/watchlist`：查看监控对象和最近状态
- `/fetchstartgg`：手动触发一次检查

兼容保留（不推荐新用户使用）：
- `/startggaddplayer`
- `/startggaddevent`
- `/startggwatchlist`

## 5. 状态说明

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

## 6. 执行机制

- 自动执行：定时任务每 20 分钟运行一次 `startgg_watch`
- 手动执行：`/fetchstartgg`

## 7. 数据落库

相关表：
- `startgg_watch_players`
- `startgg_watch_events`
- `startgg_watch_snapshots`
