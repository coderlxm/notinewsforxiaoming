# start.gg 监控 MVP 使用说明

## 1. 前置配置

需要在环境变量中配置：
- `STARTGG_API_TOKEN`：start.gg 官方 GraphQL API token
- `TG_TOKEN`、`TG_CHAT_ID`：Telegram 推送配置

## 2. 监控对象管理（Telegram 命令）

1. 添加选手
- `/startggaddplayer <player_id> <player_name>`
- 示例：`/startggaddplayer 123456 Tokido`

2. 添加赛事项目
- `/startggaddevent <event_slug_or_url> [event_name]`
- `event_slug` 格式：`tournament/<tournament_name>/event/<event_name>`
- 示例：`/startggaddevent tournament/combo-breaker-2026/event/street-fighter-6 ComboBreaker SF6`

3. 查看当前监控列表
- `/startggwatchlist`

## 3. 监控执行方式

1. 自动执行
- Resident 固定任务每 20 分钟执行一次 `startgg_watch` 模式

2. 手动执行
- `/fetchstartgg`
- 返回格式：项目数量、选手数量、本次状态变化条数

## 4. 推送含义

状态字段：
- `未在该项目出战`
- `胜者组进行中`
- `败者组进行中`
- `已淘汰`
- `赛事已完赛`

单条推送包含：
- 赛事名、项目名、选手名
- 当前状态
- 当前名次（有则展示）
- 最新轮次与比分（有则展示）
- 项目页与最近对局链接

## 5. 数据落库

MVP 相关表：
- `startgg_watch_players`
- `startgg_watch_events`
- `startgg_watch_snapshots`

快照为“选手 x 项目”维度的最新状态，状态变化时触发 Telegram 推送。
