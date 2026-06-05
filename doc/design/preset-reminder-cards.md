# 固定提醒卡片设计

## 目标

在 bot 聊天界面底部常驻一组快捷提醒按钮（ReplyKeyboardMarkup），点击后自动创建对应的定时提醒，无需手动输入。

## 交互

### 入口

发送 `/start` 或首次进入 bot 时，回复欢迎信息并附带自定义键盘：

```
👋 你好！我是 NotiNews Bot。
...
```

键盘按钮（2行 x 3列）：

```
🍜 吃泡面    🍅 番茄钟    👕 收衣服
🍵 喝水      🏋️ 健身     ⏰ 小睡一下
```

点击任意按钮后，该按钮的文本作为消息发送到 bot，bot 识别后自动创建一次性提醒并回复确认消息（带取消按钮）。

### 按钮 → 提醒映射

| 按钮文本 | 延迟 | 提醒内容 |
|---------|------|---------|
| 🍜 吃泡面 | 7 分钟 | 吃泡面 |
| 🍅 番茄钟 | 25 分钟 | 番茄钟结束 |
| 👕 收衣服 | 60 分钟 | 收衣服 |
| 🍵 喝水 | 30 分钟 | 喝水 |
| 🏋️ 健身 | 60 分钟 | 健身时间 |
| ⏰ 小睡一下 | 20 分钟 | 小睡结束 |

### 确认消息示例

```
✅ 提醒设置成功 [快捷]
──────────────────
📅 时间：2026-05-23 15:33
📝 内容：吃泡面
──────────────────
任务已记录，我会准时提醒你。
[取消提醒]
```

## 技术方案

### 1. 预设配置 (`src/reminders/presets.ts`)

```ts
export interface PresetReminder {
  id: string;       // 唯一标识
  emoji: string;    // 展示用 emoji
  label: string;    // 按钮文本
  minutes: number;  // x 分钟后触发
}

export const PRESET_REMINDERS: PresetReminder[] = [
{ id: 'noodles',   emoji: '🍜', label: '吃泡面',   minutes: 7  },
{ id: 'pomodoro',  emoji: '🍅', label: '番茄钟',   minutes: 25 },
{ id: 'laundry',  emoji: '👕', label: '收衣服',   minutes: 60 },
  { id: 'water',    emoji: '🍵', label: '喝水',     minutes: 30 },
  { id: 'workout',  emoji: '🏋️', label: '健身',     minutes: 60 },
  { id: 'nap',      emoji: '⏰', label: '小睡一下',  minutes: 20 },
];

const LABEL_MAP = new Map(PRESET_REMINDERS.map(p => [`${p.emoji} ${p.label}`, p]));

export function findPresetByText(text: string): PresetReminder | undefined {
  return LABEL_MAP.get(text.trim());
}
```

### 2. 键盘构建 (`src/reminders/formatter.ts` 新增)

```ts
import { type KeyboardButton, type ReplyKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

export function buildPresetKeyboard(): { reply_markup: ReplyKeyboardMarkup } {
  const buttons = PRESET_REMINDERS.map(p => ({ text: `${p.emoji} ${p.label}` }));
  // 2 行 x 3 列
  const rows: KeyboardButton[][] = [];
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(buttons.slice(i, i + 3));
  }
  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
      one_time_keyboard: false,
    }
  };
}
```

### 3. `/start` 命令修改 (`src/bot/interactive.ts`)

将 `ctx.reply(formatStartMessage(), { parse_mode: 'HTML' })` 改为同时携带键盘：

```ts
ctx.reply(formatStartMessage(), {
  parse_mode: 'HTML',
  ...buildPresetKeyboard(),
});
```

### 4. 文本消息拦截 (`src/bot/interactive.ts`)

在 `bot.on(message('text'), ...)` 的开头，在进入 AI 解析之前加入预设匹配：

```ts
bot.on(message('text'), async (ctx) => {
  if (!isAuthorized(ctx)) return;

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  if (!text || text.startsWith('/')) return;

  // 预设卡片匹配
  const preset = findPresetByText(text);
  if (preset) {
    const receivedAt = new Date();
    const triggerAt = new Date(receivedAt.getTime() + preset.minutes * 60 * 1000);
    const reminder = repo.createReminder({
      chat_id: String(ctx.chat!.id),
      text: preset.label,
      trigger_at: triggerAt,
    });
    scheduleReminder(bot, reminder);
    const createdMessage = await ctx.reply(
      formatReminderCreated(reminder, 'deterministic'),
      { parse_mode: 'HTML', ...buildCancelButton(reminder.id) }
    );
    repo.setSourceMessageId(reminder.id, createdMessage.message_id);
    return;
  }

  // ... 原有的自然语言解析逻辑不变
});
```

### 5. `/help` 命令同步更新

在帮助信息中加入快捷按键说明，并携带键盘（可选，建议不加，避免覆盖现有行为）。

## 边界

- 预设按钮文本以 `emoji + 空格 + label` 精确匹配，避免误触发
- 用户手动输入相同文本也会触发预设行为，这是预期行为
- 预设提醒均为一次性提醒，不支持循环
- 若用户使用 Telegram 客户端自带的「隐藏键盘」按钮隐藏了自定义键盘，下次 `/start` 会重新显示

## 不涉及

- 不支持自定义编辑预设列表（通过改代码修改）
- 不存储预设配置到数据库
- 不改变现有 `/remind` 命令或自然语言解析行为
- 不增加 `/preset` 命令（直接放在 `/start` 键盘中）

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/reminders/presets.ts` | 新增 |
| `src/reminders/formatter.ts` | 新增 `buildPresetKeyboard()` |
| `src/bot/interactive.ts` | 修改 `/start` 命令 + 文本消息处理入口 |
