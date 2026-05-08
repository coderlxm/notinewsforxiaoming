# clearSourceButtons 无法移除创建消息上的取消按钮（已修复）

## 现象

用户创建提醒后，点击提醒消息上的「已完成」，操作成功，但之前**创建提醒的那条消息**上「取消提醒」按钮仍然存在，可以继续点击。

## 预期行为

点击「已完成」或「取消」后，创建消息上的内联按钮应立即消失。

## 根因

根因是 `source_message_id` 写错了。

创建提醒时，代码把 `source_message_id` 存成了“用户输入消息”的 `message_id`，而不是“机器人回复的创建确认消息（带取消按钮）”的 `message_id`。  
因此 `clearSourceButtons` 实际在编辑错误目标消息，导致取消按钮一直存在。

另外，`editMessageReplyMarkup` 未显式传空 `inline_keyboard`，即使目标正确也不稳定。

## 修复方法

### 1) 修正 `source_message_id` 的写入时机和来源

文件：`src/bot/interactive.ts`

- 创建提醒后先 `await ctx.reply(...)`
- 使用返回的 `createdMessage.message_id` 回写数据库
- 不再把 `ctx.message?.message_id`（用户消息）写入 `source_message_id`

对应新增仓储方法：

文件：`src/reminders/repository.ts`

- 新增 `setSourceMessageId(id, messageId)`

### 2) 显式清空 inline keyboard

文件：`src/bot/interactive.ts`

`clearSourceButtons` 改为：

```ts
await bot.telegram.editMessageReplyMarkup(
  reminder.chat_id,
  reminder.source_message_id,
  undefined,
  { inline_keyboard: [] }
);
```

## 变更摘要

- `src/bot/interactive.ts`
  - `/remind` handler 改为 `async`
  - 两条创建链路（命令创建 / 自然语言创建）统一记录机器人创建消息 ID
  - `clearSourceButtons` 使用显式空按钮数组清理
- `src/reminders/repository.ts`
  - 新增 `setSourceMessageId`

## 验证方法

1. 启动常驻 bot：`pnpm start:bot`
2. 发送 `/remind 2m 测试清按钮`
3. 观察机器人回复的创建消息包含「取消提醒」
4. 等提醒触发后点击「已完成」
5. 预期：创建消息上的「取消提醒」按钮立即消失

同样地，点击「取消提醒」后也应立即清除该创建消息上的按钮。

## 备注

此修复对“修复后新建的提醒”生效。  
历史数据里已写错的 `source_message_id` 不会自动纠正，必要时可取消并重建提醒。

## 状态

已解决（2026-05-08）。
