# start.gg 监控 MVP 验收清单

## 1. 配置与连通

- [ ] 已配置 `STARTGG_API_TOKEN`
- [ ] 手动触发 `/fetchstartgg` 时，无鉴权错误
- [ ] 失败时错误信息会直接回到 Telegram（不静默）

## 2. 监控对象管理

- [ ] `/startggaddplayer` 可成功新增选手
- [ ] `/startggaddevent` 可成功新增项目（slug 或 URL 都可）
- [ ] 重复添加时会返回数据库唯一约束错误
- [ ] `/startggwatchlist` 能展示当前选手与项目列表

## 3. 状态计算主路径

- [ ] 未参赛选手会得到 `未在该项目出战`
- [ ] 在胜者侧推进时状态为 `胜者组进行中`
- [ ] 掉入败者侧后状态切换为 `败者组进行中`
- [ ] 出局后状态切换为 `已淘汰`
- [ ] 冠军完赛状态为 `赛事已完赛`

## 4. 推送行为

- [ ] 首次生成快照会推送首条状态
- [ ] 同一“选手 x 项目”状态未变化时不重复推送
- [ ] 状态/名次/最近对局变化时会推送
- [ ] 推送内容包含赛事、项目、选手、状态、链接

## 5. 数据持久化

- [ ] `startgg_watch_players` 有新增记录
- [ ] `startgg_watch_events` 有新增记录
- [ ] `startgg_watch_snapshots` 对应组合有快照记录
- [ ] 快照是 upsert 更新，不产生同组合重复行

## 6. 调度执行

- [ ] Resident 固定任务可周期执行 `startgg_watch`
- [ ] 每轮执行结束日志包含 events / players / changed 统计
