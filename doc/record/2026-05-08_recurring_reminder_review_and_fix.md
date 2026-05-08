# 2026-05-08 循环提醒实现 Review 与修复记录

## 范围

本次 review 覆盖以下改动文件：

- `src/reminders/parser.ts`
- `src/reminders/recurring.ts`
- `src/reminders/repository.ts`
- `src/reminders/scheduler.ts`
- `src/bot/callbacks.ts`
- `src/bot/interactive.ts`
- `src/reminders/formatter.ts`
- `src/reminders/db.ts`
- `src/resident.ts`
- `package.json` / `pnpm-lock.yaml`

## 发现的问题（已修复）

## 问题 1：循环提醒运行记录 `runId` 绑定错误

现象：

- 循环提醒触发后，消息按钮 callback_data 使用了固定值 `runId=0`。
- 用户点击「已完成 / 跳过本次」时，无法正确更新实际运行记录。

根因：

- `scheduleRecurringRule()` 在发送消息时调用 `buildRecurringReminderButtons(current.id, 0)`。
- 真实 `RecurringRun` 在发送后才创建，导致按钮拿不到真实 `run.id`。

修复：

1. 调整顺序：先创建 `RecurringRun`，再发送 Telegram 消息。
2. 发送时使用真实 `run.id` 生成 callback_data。
3. 新增 `setRecurringRunSentMessageId(runId, messageId)`，发送成功后回写 `sent_message_id`。
4. `createRecurringRun()` 插入时显式写入 `action='none'`，避免空值状态。

受影响文件：

- `src/reminders/scheduler.ts`
- `src/reminders/repository.ts`

## 问题 2：恢复调度时错误更新 `last_triggered_at`

现象：

- 启动恢复阶段会重算 `next_trigger_at`。
- 现有实现在该场景也会写 `last_triggered_at`，导致“未触发却被记为已触发”。

根因：

- `updateRecurringNextTrigger()` 无区分“真实触发推进”与“恢复重算”两种调用场景。

修复：

1. 将 `updateRecurringNextTrigger()` 扩展为可选 `lastTriggeredAt` 参数。
2. SQL 更新时使用 `COALESCE(?, last_triggered_at)`，仅在提供值时写入。
3. 真实触发路径传入当前触发时间；恢复重算路径不传，保持历史不变。

受影响文件：

- `src/reminders/repository.ts`
- `src/reminders/scheduler.ts`

## 修复后行为

- 每次循环提醒触发都会先落一条 `recurring_reminder_runs`。
- 按钮 callback_data 中携带真实 `runId`（非 0）。
- 点击「已完成 / 跳过本次」会更新到正确的 run 记录。
- 启动恢复只会修正 `next_trigger_at`，不会错误污染 `last_triggered_at`。

## 验证结论

- 通过静态代码链路确认 callback_data 已从固定 `0` 改为真实 `run.id`。
- 仓库当前存在历史 TypeScript 配置/模块解析问题，无法用全量 `tsc --noEmit` 作为本次变更的有效信号（该问题与本次修复无直接关系）。

## 备注

- 本记录只包含本次 review 发现并已修复的明显主路径问题。
- 其余实现结构（规则建模、AI 协议、调度恢复）与设计文档整体一致，未发现同级别阻断问题。
