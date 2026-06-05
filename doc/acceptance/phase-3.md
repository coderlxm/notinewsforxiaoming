# Phase 3 验收清单

## 环境准备

- [ ] Phase 1 + Phase 2 全部验收通过
- [ ] `pnpm start:bot` 能启动常驻进程

## 架构重构 — runMode 抽取

- [ ] `src/scheduled/runMode.ts` 包含 `runMode()`、`PushMode`、`parseForcedMode()`
- [ ] `src/index.ts` 从 `./scheduled/runMode` 导入上述符号
- [ ] `src/index.ts` 中不再有 fetcher/AI/formatter/publisher/service 的 import
- [ ] `src/index.ts` 中的时间调度逻辑（`main()`、`SPECIAL_SCHEDULE`、`isNearSchedule`）保持不变

## 一次性任务入口不受影响

- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=sleep pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=wakeup pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=server_health pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=news pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=vitamin pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=github pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=v2ex pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=fitness pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=english pnpm start` 正常推送

## 固定任务注册

- [ ] `src/scheduled/jobs.ts` 包含 `registerFixedJobs()`
- [ ] `src/resident.ts` 启动时调用 `registerFixedJobs()`
- [ ] 启动日志输出 "Fixed jobs registered."
- [ ] 所有 job 指定 `tz: 'Asia/Shanghai'`

### 固定任务时间表

| 模式 | 北京时间 | dayOfWeek | 说明 |
|------|---------|-----------|------|
| sleep | 00:10 | 每天 | 深夜睡眠提醒 |
| wakeup | 08:30 | 每天 | 早安唤醒 |
| server_health | 09:10 | 每天 | 服务器健康检查 |
| news | 09:55 | 每天 | 游戏新闻摘要 |
| vitamin | 12:30 | 每天 | 午餐维生素提醒 |
| github | 15:00 | 每天 | GitHub 趋势 |
| vitamin | 18:30 | 每天 | 晚餐维生素提醒 |
| v2ex | 20:00 | 每天 | V2EX 热帖 |
| fitness | 20:30 | 周一、周三 | 工作日健身 |
| fitness | 14:00 | 周六 | 周末健身 |

## 固定任务执行验证

以下测试可能需要调整系统时间或等待到对应时间点验证：

- [ ] 到 00:10 自动执行 sleep 推送
- [ ] 到 08:30 自动执行 wakeup 推送
- [ ] 到 09:10 自动执行 server_health 推送
- [ ] 到 09:55 自动执行 news 推送
- [ ] 到 12:30 自动执行 vitamin 推送
- [ ] 到 15:00 自动执行 github 推送
- [ ] 到 18:30 自动执行 vitamin 推送
- [ ] 到 20:00 自动执行 v2ex 推送
- [ ] 周一 20:30 自动执行 fitness 推送
- [ ] 周三 20:30 自动执行 fitness 推送
- [ ] 周六 14:00 自动执行 fitness 推送

## 并发运行验证

- [ ] `pnpm start:bot` 常驻进程中固定任务按时触发的同时，交互 bot 仍能响应 `/start`、`/help`、`/remind`
- [ ] 动态提醒不受固定任务影响，正常创建、触发、完成、推迟

## 迁移切换

- [ ] 确认系统 Cron 已停用（`systemctl disable --now notinews.timer` 或对应的 cron job）
- [ ] 不需要同时保留系统 Cron 和内部定时器执行同一任务
- [ ] GitHub Actions `daily-push.yml` 已评估是否需要停用（常驻进程已接管固定任务）

## 错误行为

- [ ] 单个固定任务失败（如 API 异常）不应导致整个常驻进程崩溃
- [ ] 进程遇到严重错误时（如 TG_TOKEN 缺失）直接抛出并 exit(1)，由 systemd 的 `Restart=on-failure` 接管

## 文件清单

- [ ] `src/scheduled/runMode.ts` — 新增，从 `src/index.ts` 抽取 `runMode()` + `PushMode` + `parseForcedMode()`
- [ ] `src/scheduled/jobs.ts` — 新增，`registerFixedJobs()` 注册所有固定任务
- [ ] `src/index.ts` — 精简约 120 行，仅保留时间调度和测试入口
- [ ] `src/resident.ts` — 新增 `registerFixedJobs()` 调用
- [ ] `.gitignore` — 新增 `data/notinews.sqlite-*` 忽略 WAL 日志文件
