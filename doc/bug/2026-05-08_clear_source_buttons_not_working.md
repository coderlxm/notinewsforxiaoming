# clearSourceButtons 无法移除创建消息上的取消按钮

## 现象

用户创建提醒后，点击提醒消息上的「已完成」，操作成功，但之前**创建提醒的那条消息**上「取消提醒」按钮仍然存在，可以继续点击。

## 预期行为

点击「已完成」或「取消」后，创建消息上的内联按钮应立即消失。

## 尝试的修复

调用 `bot.telegram.editMessageReplyMarkup(chatId, messageId)` 清除创建消息（`source_message_id`）上的 inline keyboard。代码在 `src/bot/interactive.ts` 的 `clearSourceButtons` 中。

两种方式都已尝试失败：

1. `editMessageReplyMarkup(chatId, msgId, undefined, { reply_markup: undefined })`
2. `editMessageReplyMarkup(chatId, msgId)` — 不传 extra 参数

## 可能原因

- **Telegram API 行为不确定**：不传 `reply_markup` 时，Telegram 可能保留当前按钮而非移除。需要显式传 `{ reply_markup: { inline_keyboard: [] } }` 来清空。但 Telegraf 类型可能不支持这种用法
- **`source_message_id` 不准确**：如果 `source_message_id` 与实际有按钮的消息 ID 不匹配，调用的消息本身就没有按钮，看起来没变化，但实际是调错目标
- **Telegraf 封装差异**：Telegraf 内部可能出于类型安全不允许传入空 inline keyboard，导致无法发出移除请求

## 状态

未解决。
