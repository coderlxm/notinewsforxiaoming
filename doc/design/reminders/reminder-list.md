# 提醒列表功能设计

## 入口

`/remind` 不带参数时，展示当前所有待处理提醒的列表。

当前行为：`/remind` 无参数时返回帮助信息。改为列表。

## 交互

```
/remind

📋 待处理提醒 (3)

1. 10:30 开会           [取消]
2. 12:00 取快递         [取消]
3. 05-10 06:00 跑步     [取消]
```

每个提醒一行，附带取消按钮。不展示完成/延后按钮（列表场景下太拥挤，点击取消后回到列表即可）。

单条提醒超过一定数量（如 30 条）时分页或截断。

无提醒时显示「暂无提醒」。

## 实现

### 1. repository 新增查询

```ts
findPendingByChatId(chatId: string): Reminder[]
```

按 `trigger_at ASC` 排序。

### 2. formatter 新增格式化

```ts
formatReminderList(reminders: Reminder[]): string
```

每条格式：`序号. 时间 内容`

- 今天的提醒显示 `HH:mm`，非今天的显示 `MM-DD HH:mm`
- 全部为北京时间

### 3. interactive.ts 修改

`/remind` 命令处理逻辑：

```
if (args为空) → 查列表 → 回复列表（带每条取消按钮）
else → 现有创建逻辑
```

### 4. 按钮布局

每条一个 `取消` 按钮，callback_data 与现有取消格式相同：`reminder:cancel:<id>`

## 不涉及

- 不分页（提醒量级不会超过 Telegram 消息长度限制）
- 不支持已完成/已取消提醒的历史查看
- 不改变现有 `/remind` 创建提醒的行为
