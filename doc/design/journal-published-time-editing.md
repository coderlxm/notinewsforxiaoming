# Journal 发布时间修改方案

## 1. 背景与目标

最近导入 Journal 的内容中包含大量历史信息和图片。当前系统直接把 Telegram 消息时间或 Web 文章创建时间作为 `source_created_at`，因此这些历史内容会归档到最近的导入日期，影响时间线、日期筛选和“往年今日”。

本次先提供单条记录的发布时间修改能力，支持后续逐条治理历史数据，也保留为长期管理功能。

目标：

- 管理员可以在 `/me` 中修改任意普通记录或富文本文章的发布时间；
- 修改后，记录按新时间重新参与归档、排序、筛选、往年今日和公开 Feed；
- 媒体组仍作为一条完整记录管理；
- 保留采集时间和 Telegram 原始消息，不改写导入事实；
- 实现沿用现有管理主路径，不增加批量治理、定时发布或发布状态机。

## 2. 当前实现结论

### 2.1 Web 端现有功能

公开端目前提供：

- 按发布时间倒序的信息流；
- 标签筛选；
- 普通记录和富文本文章详情；
- RSS 与 JSON Feed。

登录后的 `/me` 目前提供：

- 全部、公开、私有记录查看；
- 关键词、标签、内容类型、起止日期筛选；
- 往年今日；
- 普通记录正文编辑；
- 富文本文章新建与编辑；
- 置顶、公开/私有切换和永久删除；
- 记录详情弹层。

普通记录和文章共用 `JournalEntry`，管理动作集中在卡片及详情中的 `CardActionMenu.vue`，请求状态和列表刷新由 `useJournalApi.ts`、`FeedView.vue` 组织。

### 2.2 “发布时间”的真实字段

当前没有名为 `published_at` 的独立字段。系统实际把 `journal_entries.source_created_at` 当作发布时间和归档时间：

- Telegram 记录创建时写入 Telegram 消息时间；
- Web 文章创建时写入当前时间；
- 卡片和详情用它展示日期；
- 私有日期筛选用它；
- 公开与私有列表按它倒序排序；
- 分页游标包含它；
- “往年今日”按它的上海时区月日查询；
- RSS 和 JSON Feed 用它作为条目日期。

`captured_at` 表示记录进入 Journal 的时间，`updated_at` 表示最后修改时间。二者不应随发布时间修改。

因此本功能应直接编辑 `source_created_at`，不新增重复的 `published_at` 字段，也不做数据库迁移。修改之后：

- `source_created_at`：用户认可的内容发布时间/归档时间；
- `captured_at`：不可变的实际采集或创建时间；
- `updated_at`：本次管理操作发生的时间；
- `telegram_message_json`：不可变的 Telegram 原始数据。

这是基于当前源码行为得到的字段语义调整；字段名保留是为了控制改动范围。

### 2.3 媒体组约束

同一 Telegram 媒体组在数据库中可能有多行，但列表只选择最小 `source_message_id` 的行作为代表，并聚合整组附件。现有置顶、可见性和删除都按组处理。

发布时间也必须按组修改为同一个值。若只修改代表行，组内其他行会保留不同日期，之后的代表选择、数据检查和管理语义会不一致。

## 3. 产品交互

### 3.1 入口

在私有管理界面的记录菜单中，把现有动作调整为：

1. 编辑正文 / 编辑文章
2. 修改发布时间
3. 置顶 / 取消置顶
4. 设为公开 / 转为私有
5. 删除

“修改发布时间”对普通记录和富文本文章都显示。公开页面不显示此入口。

正文编辑仍沿用现有行为：

- 普通记录在卡片或详情内编辑；
- 富文本文章跳转文章编辑页。

发布时间是所有记录共有的管理属性，不放入富文本文章编辑表单，避免文章和普通记录形成两条不同操作路径。

### 3.2 编辑弹层

点击“修改发布时间”后打开一个小型模态框，内容包括：

- 标题：`修改发布时间`
- 当前发布时间，按上海时区展示；
- 日期输入；
- 时间输入，精确到分钟；
- `取消`；
- `保存时间`。

表单初值来自当前 `sourceCreatedAt`。界面明确标注“Asia/Shanghai”，避免浏览器或部署服务器时区影响用户理解。

选择日期和时间后才发起保存；不提供“设为现在”“恢复原始时间”等额外动作。媒体组在说明文字中显示“将同时修改这一组图片/视频的发布时间”，普通记录和文章不显示该说明。

媒体组信息目前没有暴露给 Web 响应。为保持改动最小，首版不为提示文案增加 `mediaGroupId` 等协议字段；界面统一使用“修改后将按新时间重新归档”的说明即可，服务端仍保证组内一致更新。

### 3.3 保存后的页面行为

保存期间沿用现有单条记录 `busy` 状态，禁用该记录的管理动作，菜单区域显示“正在修改发布时间…”。

服务端返回更新后的 `JournalEntry` 后：

- 关闭发布时间弹层；
- 重新加载当前筛选条件下的第一页和“往年今日”；
- 当前详情弹层继续显示该记录及新时间；
- 若新时间不再符合当前日期筛选，记录从列表中消失；
- 若新时间使排序位置变化，记录出现在重新计算后的正确位置；
- 若记录已置顶，仍遵循现有“置顶优先、时间次序”的规则。

不能只在原数组中替换记录，因为 `source_created_at` 同时参与排序、筛选和分页游标；原地替换会留下错误顺序和失效游标。

## 4. 时间输入与协议

### 4.1 前端转换

浏览器表单使用上海本地日期和时间，API 使用带时区含义的 ISO 8601 字符串。

项目已经依赖 `dayjs`。使用其 `utc` 与 `timezone` 插件完成两次转换：

- 打开表单：把 `sourceCreatedAt` 转为 `Asia/Shanghai` 的日期与时间；
- 保存表单：把用户输入按 `Asia/Shanghai` 解析，再输出 UTC ISO 字符串。

不手写时区偏移，不依赖浏览器所在时区，也不新增日期库。

首版精确到分钟。保存时秒和毫秒归零，使治理后的时间值可直接理解。数据库中原有包含秒的历史记录只在用户实际修改后发生这一变化。

### 4.2 请求 schema

在 `src/shared/journalProtocol.ts` 增加：

```ts
export const journalPublishedTimeUpdateRequestSchema = z.object({
  sourceCreatedAt: z.string().datetime({ offset: true }),
});
```

接口：

```http
PATCH /api/me/entries/:id/published-time
Content-Type: application/json

{
  "sourceCreatedAt": "2018-10-21T06:30:00.000Z"
}
```

成功时返回更新后的 `JournalEntry`。身份校验、404 和 schema 错误继续沿用现有 Fastify、Zod 与管理员 Cookie 主路径，不新增错误兜底。

字段采用 `sourceCreatedAt` 而不是只传日期，确保文章、照片和普通消息仍能在同一天内保持确定顺序。

## 5. 服务端设计

### 5.1 路由

在 `src/journal-server/routes/privateEntries.ts` 增加管理员路由：

```ts
server.patch('/api/me/entries/:id/published-time', {
  preHandler: auth.requireAdmin,
}, async (request, reply) => {
  const { id } = idParamsSchema.parse(request.params);
  const { sourceCreatedAt } =
    journalPublishedTimeUpdateRequestSchema.parse(request.body);
  const entry = repository.updatePublishedTime(id, sourceCreatedAt);
  if (!entry) {
    return reply.code(404).send({ error: 'Journal entry was not found.' });
  }
  return entry;
});
```

该接口只属于 `/api/me`，不增加公开写入口，也不修改 Telegram bot API。

### 5.2 Repository

在 `JournalRepository` 增加：

```ts
updatePublishedTime(id: number, sourceCreatedAt: string): JournalEntry | null
```

处理顺序：

1. 读取目标行，不存在则返回 `null`；
2. 调用现有 `updateGroup`；
3. 同时写入 `source_created_at = ?` 和 `updated_at = ?`；
4. 返回组代表记录。

建议语句：

```sql
UPDATE journal_entries
SET source_created_at = ?, updated_at = ?
WHERE ...
```

这里复用 `updateGroup`，使 Telegram 媒体组的每一行获得相同发布时间。普通 Telegram 记录和 Web 文章只更新自身。

`captured_at`、`telegram_message_json`、附件和其他元数据保持不变。

### 5.3 代表记录返回

当前管理页面只会对媒体组代表行发起请求，`updateGroup` 后 `getById(row.id)` 仍返回该代表行。首版不新增“按任意组成员重新寻找代表”的逻辑，因为当前 Web 主路径不会提交隐藏的非代表行。

## 6. Web 端改动

### 6.1 API 与状态

`web/src/api.ts` 增加：

```ts
updateEntryPublishedTime(
  id: number,
  sourceCreatedAt: string,
): Promise<JournalEntry>
```

`useJournalApi.ts` 增加 `setPublishedTime(entry, sourceCreatedAt)`：

- 设置 `mutationEntryId`；
- 调用更新接口；
- 用响应更新当前 `detail`，使弹层立即显示新时间；
- 暴露请求错误；
- 清除 `mutationEntryId`。

列表重载仍由 `FeedView.vue` 在请求成功后发起，与现有正文、可见性和置顶操作保持同一层级。

### 6.2 组件

新增：

- `web/src/components/journal/PublishedTimeDialog.vue`
  - 持有日期、时间表单；
  - 使用原生 `<dialog>`，与现有详情弹层技术一致；
  - 负责上海时间的表单转换和提交事件；
  - 不直接发请求。

调整事件传递：

- `CardActionMenu.vue`
  - 增加 `editPublishedTime` 事件和菜单项；
- `EntryCard.vue`
  - 管理发布时间弹层的打开与关闭；
  - 向上发送 `setPublishedTime`；
- `JournalDetailContent.vue`
  - 同样提供发布时间弹层；
- `JournalDetailLayout.vue`、`JournalDetailOverlay.vue`
  - 转发 `setPublishedTime`；
- `WaterfallFeed.vue`、`OnThisDay.vue`
  - 转发 `setPublishedTime`；
- `FeedView.vue`
  - 调用 composable，成功后按当前筛选条件重新加载私有列表及往年今日。

发布时间弹层放在卡片/详情组件内，与现有正文编辑和删除确认的状态归属一致。`FeedView.vue` 只组织请求与刷新，不持有具体表单字段。

### 6.3 时间展示

现有 `CardDateSpine.vue`、`JournalDetailContent.vue` 和文章展示已经读取 `entry.sourceCreatedAt`，无需增加新的显示字段。重载或替换详情后会自然显示新时间。

## 7. 数据影响

不增加数据库列和迁移。一次修改会直接影响：

- 私有与公开时间线位置；
- 日期区间筛选结果；
- 分页游标计算；
- 往年今日；
- 卡片与详情显示时间；
- RSS 与 JSON Feed 条目日期。

不会影响：

- Journal 实际采集时间；
- Telegram 原消息时间和原始 JSON；
- 媒体文件；
- 正文、标签、可见性和置顶状态；
- 公开详情 URL；
- Web 文章内容编辑流程。

公开 Feed 没有缓存层，后续请求会读取新日期。已被外部 RSS 阅读器抓取的历史副本是否重新排序由阅读器自身决定，不在本功能范围内。

## 8. 最小实施范围

需要修改：

- `src/shared/journalProtocol.ts`
- `src/journal-server/routes/privateEntries.ts`
- `src/journal-server/repository.ts`
- `web/src/api.ts`
- `web/src/composables/useJournalApi.ts`
- `web/src/components/journal/PublishedTimeDialog.vue`
- 管理事件链涉及的 Journal 组件

不需要修改：

- 数据库 migration；
- Telegram 导入和 bot 交互；
- `src/reminders/recurring.ts`；
- 公开路由；
- 文章数据结构；
- RSS/JSON Feed 生成逻辑。

## 9. 业务验收口径

- `/me` 中普通记录和富文本文章都能从管理菜单打开发布时间编辑；
- 表单显示的初始值与页面当前上海时间一致；
- 保存历史日期后，卡片和详情显示新时间；
- 记录按新时间重新归档，日期筛选结果随之变化；
- 修改为往年同月同日后，记录进入“往年今日”；
- 已公开记录的公开页面、RSS 和 JSON Feed 使用新时间；
- 修改媒体组中的记录时，整组图片或视频保持为一条记录并共用新时间；
- 修改发布时间不会改变 `captured_at`、Telegram 原始数据、正文、附件、可见性或置顶状态；
- 取消编辑不发起写请求。

## 10. 本次不做

- 批量修改或批量数据治理界面；
- 从图片 EXIF 自动推断拍摄时间；
- 从正文或文件名自动识别年份；
- 定时发布、草稿发布状态或未来时间调度；
- 原始时间恢复记录、修改历史和审计日志；
- Telegram bot 中修改发布时间；
- 将字段重命名为 `published_at`；
- 为外部 RSS 阅读器增加刷新或通知机制。
