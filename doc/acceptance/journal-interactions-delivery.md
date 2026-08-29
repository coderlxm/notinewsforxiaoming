# Journal 匿名评论与点赞交付说明

按 `doc/design/journal-anonymous-comments-and-reactions-development-plan.md` 实现完毕。本文列出实际改动与验收要点。

## 数据库

- 迁移新增 version 20（`src/journal-server/migrations.ts`）：新建 `journal_entry_reactions`（`entry_id + client_hash` 唯一）与 `journal_entry_comments`（两层结构、`published/hidden` 两态、复合外键级联）及两个索引。
- 部署后首次启动自动执行，无手工步骤；条目删除时互动数据级联删除。

## 后端

新增文件：

- `src/journal-server/interactionIdentity.ts`：访客 UUID → HMAC-SHA256 `client_hash`（复用 `JOURNAL_COOKIE_SECRET`）。
- `src/journal-server/interactionService.ts`：互动主路径 + 评论 Markdown 渲染（`marked` + `sanitize-html`，仅允许段落/加粗/斜体/删除线/行内代码/代码块/引用/列表/链接，链接限 http/https/mailto 并强制 `rel`/`target`）。
- `src/journal-server/interactionNotification.ts`：新评论 Telegram 通知（纯文本 + 「打开管理」链接 + 「隐藏评论」回调按钮）。
- `src/journal-server/routes/interactions.ts`：公开、私有、internal 三组路由。

公开接口（均 `Cache-Control: private, no-store`，复用现有发布/解锁/管理员访问判断，否则 404）：

| 接口 | 说明 |
| --- | --- |
| `GET /api/entries/:publicId/interactions` | 摘要 + 公开评论树 |
| `PUT / DELETE /api/entries/:publicId/reaction` | 点赞/取消，重复请求幂等 |
| `POST /api/entries/:publicId/comments` | 访客评论，201 返回正式评论 + 摘要 |

私有接口（requireAdmin）：`GET /api/me/entries/:id/interactions`、`POST /api/me/entries/:id/comments`（博主回复）、`PATCH /api/me/comments/:commentId/status`、`DELETE /api/me/comments/:commentId`（返回最新摘要）。

internal 接口（requireInternal）：`PATCH /api/internal/comments/:commentId/status`，供 bot 使用。

其他后端改动：

- `JournalRepository`：新增互动摘要/点赞/评论方法；所有 `JournalEntry` 映射现在携带 `interactions`（真实计数，访客哈希命中时 `viewerReacted: true`）。
- `publicFeed.ts`：`/api/feed` 与 `/api/entries/:publicId` 读取可选 `X-Journal-Visitor-Id` 并回传 `viewerReacted`，`Vary` 同步增加。
- 限流（`@fastify/rate-limit` route 级，按访客 ID 为 key）：评论 10 分钟 3 条、点赞每分钟 20 次，超限返回 `{ error }` 结构 429。
- 评论先落库，再同步等待 Telegram 通知；Telegram 失败按现有错误链返回 500（方案 10.3 的既定边界）。

## Bot

- `JournalApiClient.updateCommentStatus(commentId, status)` 调用 internal 接口。
- `registerBotHandlers.ts` 新增 `jc:h:<id>` / `jc:p:<id>` 回调：校验会话 → 切换状态 → answer 提示 → 原消息按钮在「隐藏评论/恢复公开」间翻转，不新增消息；失败以 alert 展示。

## 前端

新增文件：

- `web/src/utils/journalVisitorIdentity.ts`：`journal.visitor-id.v1` / `journal.visitor-name.v1`，LocalStorage 不可用时读取不阻断、写入明确报错。
- `web/src/composables/useJournalInteractions.ts`：单条目局部状态（评论列表、点赞/提交/单评论变更的进行中锁定、临时评论、错误经 showMessage 展示，不重试）。
- `web/src/components/interaction/` 五个组件：`JournalReactionButton`（描边/实心、1→1.18→1 缩放、详情版单次光晕、`prefers-reduced-motion` 关闭）、`EntryInteractionSummary`（卡片计数条，私有模式只读）、`JournalInteractions`（详情互动区，根节点 `id="comments"`）、`JournalCommentForm`（默认一行聚焦展开、蜜罐 `website`、Cmd/Ctrl+Enter）、`JournalCommentItem`（首字符头像按昵称稳定取色、作者徽标、回复缩进引导线、隐藏 0.62 透明度、删除行内确认、hover/focus-within 管理操作）。

接入点：

- 普通记录卡片：互动摘要位于 `entry__meta-trailing` 时间之前；点赞原地完成、评论图标打开详情并定位评论区。
- 文章卡片：标签后轻量 footer。
- 事件链：`WaterfallFeed` / `PublicArticleFeed` → `PublicFeedResults` → `PublicFeedView`；私有 `PrivateAssetFeedView` 只读计数。
- 详情：`JournalInteractions` 挂在 `JournalDetailContent` 标签之后（私有草稿不显示），覆盖公开弹层、搜索/归档弹层、私有弹层、受保护解锁后弹层。
- 阅读页：`PublicEntryDetailView` 在文章/记录卡片之后挂载同一互动区。
- 摘要同步：弹层内变更经 `interactionsChange` 事件回写 `useJournalApi` 的公开（publicId）/私有（id）缓存条目；卡片点赞走 `togglePublicEntryReaction`（乐观更新、请求期锁定该条按钮、失败回退并报错）。
- `#comments` 定位：卡片评论图标与 `/me?entry=:id#comments`（Telegram「打开管理」）都会在弹层内容出现后滚动到互动区。

## 验收要点

1. 公开条目：无痕窗口点赞 → 计数 +1 心形实心；重复点击不增；刷新后状态保持（localStorage UUID）；再点取消恢复。
2. 评论：填昵称 + 内容提交 → 列表出现「发送中」项并替换为正式评论；刷新后昵称复用；含 `<img>`/脚本/标题的 Markdown 输入只输出允许的结构。
3. Telegram：新评论收到一条通知；「打开管理」落到 `/me?entry=:id#comments` 并定位评论区；「隐藏评论」后按钮变为「恢复公开」，无新消息；隐藏后前台计数同步减少、整组（含回复）不再显示。
4. 私有详情：可回复顶层评论、隐藏/恢复、行内确认删除（删顶层连回复一起消失）；私有信息流卡片只显示计数。
5. 权限：`private`/草稿条目公开互动接口 404；`protected` 未解锁 404，解锁或管理员可互动；条目转私有后互动数据保留。
6. 限流：同一访客 10 分钟第 4 条评论返回 429 错误提示。

## 边界说明

- 未新增 npm 依赖，未触碰 `src/reminders/recurring.ts`，未修改任何兜底/重试逻辑。
- 点赞不推送 Telegram；评论与 Telegram 通知为两个独立系统，通知失败时评论已保存但前端收到 500（方案既定接受）。
