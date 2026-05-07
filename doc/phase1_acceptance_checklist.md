# Phase 1 验收清单

## 环境准备

- [ ] 依赖已安装：`node-schedule`、`better-sqlite3`
- [ ] Type 定义已安装：`@types/node-schedule`、`@types/better-sqlite3`
- [ ] `better-sqlite3` native build 成功
- [ ] `pnpm install` 无错误

## 现有功能不受影响

- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=vitamin pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=server_health pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=news pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=wakeup pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=sleep pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=github pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=v2ex pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=fitness pnpm start` 正常推送
- [ ] `TEST_MODE_ENABLED=1 TEST_FORCE_MODE=english pnpm start` 正常推送

## Bot 启动

- [ ] `pnpm start:bot` 能启动 long polling，日志输出 "Bot started. Long polling for updates..."
- [ ] 启动时无 pending 提醒则正常进入 polling，无崩溃
- [ ] 重复启动（端口/Token 冲突）应有明确错误

## 权限检查

- [ ] `.env` 中 `TG_CHAT_ID` 以外的 chat 发送 `/start`、`/help`、`/remind` 消息不会得到任何回复
- [ ] 非授权 chat 点击按钮不会触发业务逻辑

## 基本命令

- [ ] 发送 `/start` 收到欢迎消息
- [ ] 发送 `/help` 收到帮助消息，包含命令和格式说明

## 创建提醒 — 确定性命令

- [ ] `/remind 2026-05-08 15:30 开会` 创建成功，回复包含时间和内容
- [ ] `/remind 10m 收衣服` 创建成功，回复包含时间（当前时间 +10 分钟）和内容
- [ ] `/remind 2h 看日志` 创建成功，回复包含时间（当前时间 +2 小时）和内容
- [ ] 创建成功后消息包含 `[取消提醒]` 按钮
- [ ] `/remind` （无参数）回复格式错误提示
- [ ] `/remind bad input` 回复格式错误提示
- [ ] 时间在过去（如 `2020-01-01 10:00 测试`）回复"提醒时间必须在未来"
- [ ] 内容为空时回复错误提示

## SQLite 持久化

- [ ] 创建提醒后 `data/notinews.sqlite` 中有对应记录
- [ ] 记录包含 `chat_id`、`text`、`trigger_at`、`status = 'pending'`、`created_at`
- [ ] `source_message_id` 记录了用户发送的消息 ID

## 提醒触发

- [ ] 到点后 Telegram 收到提醒消息，内容为用户指定的文本
- [ ] 提醒消息包含 `[已完成]` 和 `[推迟 5 分钟]` 按钮
- [ ] `sent_message_id` 在触发后被更新到数据库

## 按钮动作 — 已完成

- [ ] 点击 `[已完成]` 后，提醒状态更新为 `done`
- [ ] 数据库 `done_at` 字段被写入
- [ ] 原消息按钮移除或回复完成确认
- [ ] 已完成的提醒不会再次触发

## 按钮动作 — 推迟 5 分钟

- [ ] 点击 `[推迟 5 分钟]` 后，`trigger_at` 更新为当前时间 + 5 分钟
- [ ] 状态保持 `pending`
- [ ] 5 分钟后能再次触发提醒
- [ ] 回复消息告知新的提醒时间

## 按钮动作 — 取消提醒

- [ ] 在创建成功消息上点击 `[取消提醒]` 后，状态变为 `cancelled`
- [ ] 数据库 `cancelled_at` 字段被写入
- [ ] 已取消的提醒不会触发

## 启动恢复

- [ ] 有未来 pending 提醒时，启动 `pnpm start:bot` 会自动注册调度
- [ ] 日志输出 `Scheduled N pending reminder(s).`
- [ ] 有已过期的 pending 提醒时，启动会抛出错误并退出
- [ ] 错误信息明确包含 `reminder id` 和 `trigger_at`

## 文件清单

- [ ] `src/reminders/db.ts` — 数据库初始化
- [ ] `src/reminders/repository.ts` — CRUD 操作
- [ ] `src/reminders/parser.ts` — 命令解析
- [ ] `src/reminders/formatter.ts` — 消息和按钮格式化
- [ ] `src/reminders/scheduler.ts` — 内存调度
- [ ] `src/bot/createBot.ts` — Telegraf 实例创建（IPv4 agent）
- [ ] `src/bot/auth.ts` — 权限检查
- [ ] `src/bot/callbacks.ts` — callback_data 解析
- [ ] `src/bot/interactive.ts` — 命令和回调注册
- [ ] `src/resident.ts` — 常驻进程入口
- [ ] `package.json` — 新增 `start:bot` 脚本
- [ ] `.gitignore` — 新增 `data/notinews.sqlite`
- [ ] `data/notinews.sqlite` — 运行时自动创建

## data 目录文件确认

- [ ] `data/notinews.sqlite` 由程序自动创建，无需手动创建
- [ ] `data/notinews.sqlite` 不会提交到 git
