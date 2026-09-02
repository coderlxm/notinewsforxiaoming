# 下车提醒（bus get-off reminder）交付说明

## 需求

- 每个中国工作日早上 09:22（北京时间）推送一条「下车提醒」
- 消息带「✅ 已下车」按钮
- 点击按钮：当天不再提醒，并清理当天所有提醒消息上的按钮
- 未点击：两分钟后再次提醒，最多提醒 3 次，然后自动关闭

## 行为时序

| 时间 | 行为 |
| --- | --- |
| 工作日 09:22 | 发送第 1 条提醒（带按钮），两分钟后进入下一次检查 |
| 09:24 | 仍未点击则发送第 2 条 |
| 09:26 | 仍未点击则发送第 3 条 |
| 09:28 | 自动关闭：标记当天结束，清空所有消息按钮 |
| 任意时刻点击「已下车」 | 立即结束当天提醒，清空所有消息按钮 |

「最多提醒 3 次」按当天消息总量理解：1 次初始提醒 + 2 次补提醒。

## 实现方式

参照两个现有模式实现：

- 工作日 + 按钮 + 完成清理：`workCheckinReminder`
- 循环定时 + 重启恢复：`vitaminReminder`

### 改动文件

| 文件 | 改动 |
| --- | --- |
| `src/services/busReminder.ts` | 新增，核心服务 |
| `src/reminders/db.ts` / `src/reminders/migrations.ts` | 新增 `bus_reminders`、`bus_reminder_messages` 表（迁移版本 21） |
| `src/formatters/index.ts` | 新增 `formatBusReminderMessage`、`buildBusReminderButtons` |
| `src/bot/callbacks.ts` | 新增 `parseBusReminderCallbackData`（`bus-reminder:done:<date>`） |
| `src/bot/interactive.ts` | callback 处理：点击后 `completeBusReminder` 并提示 |
| `src/scheduled/jobs.ts` | 注册工作日 09:22 定时任务（复用 `isChinaWorkday`） |
| `src/resident.ts` | 启动时 `restoreBusReminderLoop` 恢复未完成循环 |

### 核心逻辑

- `triggerBusReminder(bot)`：09:22 入口。当天已完成或已满 3 次则跳过；否则发第 1 条，写入 `count=1`，安排 2 分钟后的 tick。
- `runBusLoopTick(bot)`：循环 tick。已完成/循环已停则清 timer 返回；`count >= 3` 则自动 `completeBusReminder`；否则发下一条，`count+1`，再安排 2 分钟后的 tick。
- `completeBusReminder(bot, dateKey)`：置 `completed=1`、停循环、清空当天所有消息按钮（复用 work check-in 的多消息清理方式：`bus_reminder_messages` 记录当天全部消息 ID，结束时统一 `editMessageReplyMarkup` 清按钮并删除记录）。
- `restoreBusReminderLoop(bot)`：进程重启后，根据 `loop_active + next_trigger_at` 重建 timer；已过期的 tick 立即触发（从而在重启后正确走到自动关闭）。

### 状态表

```
bus_reminders (
  date_key TEXT PRIMARY KEY,        -- 当天
  completed INTEGER,                -- 1=当天已结束（点击或自动关闭）
  count INTEGER,                    -- 当天已发送条数
  loop_active INTEGER,              -- 循环是否在跑
  next_trigger_at TEXT              -- 下次 tick / 关闭时间
)
bus_reminder_messages (date_key, message_id)  -- 当天已发送消息，用于统一清按钮
```

## 设计说明

- 补提醒发送新消息而非编辑旧消息：编辑消息不会触发新的推送通知，无法起到“再次提醒”作用；全部消息在结束时统一清按钮，避免残留可点击按钮，与 work check-in 行为一致。
- 自动关闭放在第 3 次后 2 分钟，给最后一条消息保留可点击窗口，避免“发完立刻清按钮”的突兀体验。
- 定时任务只在 `isChinaWorkday` 为真时触发，与现有 coffee、v2ex、work check-in 等工作日任务一致。
- 不引入新依赖，全部复用现有 DB、time、formatter、publisher 设施。

## 部署

走项目现有发布路径：按项目提交格式 commit → push 到 main → GitHub Actions 自动部署 bot，观察真实 workflow。