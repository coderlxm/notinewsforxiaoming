# Journal Web 内容发布方案

## 1. 背景与目标

当前 Journal 有两条内容进入路径：

- Telegram 用于快速发布普通文字、图片等记录；
- `/me` 中的“写文章”用于创建有标题、富文本正文和封面的长文章。

当用户在电脑上整理文字或图片时，不一定希望先发送到 Telegram，再由 bot 采集。因此需要在 `/me` 增加一条直接发布普通内容的 Web 路径。

本功能目标：

- 在 `/me` 的“写文章”旁新增“发布内容”入口；
- 支持从电脑发布纯文字、纯图片或图文组合；
- 发布前选择公开或私有；
- 可以保存为服务端草稿并继续编辑；
- 发布结果继续使用现有普通记录卡片和详情；
- 发布时间、公开信息流、RSS、标签、置顶、可见性、编辑和删除继续走现有 Journal 主路径；
- 不把普通内容伪装成富文本文章；
- 保持发布表单短而直接，不引入自动保存和复杂上传状态。

## 2. 首版产品范围

### 2.1 支持内容

首版支持：

- 纯文字；
- 单张图片；
- 多张图片；
- 文字与图片组合；
- 正文中的 `#标签` 自动提取；
- JPEG、PNG、WebP 和 GIF。

文字和图片至少填写一项。

发布前必须选择：

- `公开`：进入公开信息流、公开详情、RSS 和 JSON Feed；
- `私有`：作为已经完成的内容保存到 `/me`，只有管理员可见。

默认选择公开。公开与私有都是“已发布”状态，发布后仍可使用现有卡片菜单切换。

首版同时支持服务端草稿：

- 草稿可以保存文字、图片或图文组合；
- 草稿固定为私有，不参与公开/私有选择；
- 保存后可从 `/me` 继续编辑正文和图片；
- 草稿只有在点击“发布”后才成为正式记录；
- 发布草稿时重新选择公开或私有。

### 2.2 不属于首版

- 视频、音频、文档和其他文件；
- 标题、富文本格式和正文内嵌图片；
- 定时发布和自动保存；
- 发布时间输入，发布后可使用现有“修改发布时间”；
- 图片排序拖拽；
- 已发布附件的增加、替换或删除，草稿阶段允许继续增删图片；
- EXIF 拍摄时间读取；
- 同步发送到 Telegram；
- 从 Telegram 拉取历史内容；
- 批量发布。

长内容继续使用“写文章”；普通文字和相册使用“发布内容”。两者不合并为通用编辑器。

## 3. 当前实现结论

### 3.1 现有 Web 文章不是普通记录

当前 `JournalRepository.createArticle` 固定写入：

- `source_kind = 'web'`
- `content_type = 'article'`
- `body_format = 'rich'`
- 非空 `title`
- 非空 `rich_body_json`
- 初始 `visibility = 'private'`

数据库的 `journal_entries` CHECK 约束也只允许两种情况：

- Telegram 来源的普通记录；
- Web 来源的富文本文章。

因此不能通过传空标题、构造简化富文本或复用 `createArticle` 来实现本需求。这样会让普通内容进入文章卡片、文章编辑器和文章 Feed 渲染路径，数据语义与界面都不正确。

### 3.2 普通卡片已经可以展示 Web 内容

列表和详情主要按 `body_format` 区分：

- `plain` 使用 `EntryCard.vue` 和普通详情；
- `rich` 使用文章卡片和文章详情。

附件展示读取统一的 `JournalAsset`，并不要求来源必须是 Telegram。`journal_assets` 也已经允许：

- `source_kind = 'web'`
- `role = 'attachment'`
- Telegram 文件标识为空。

因此只要数据库正式允许 `web + plain`，现有列表、详情、媒体画廊、公开链接、RSS、置顶、可见性、发布时间修改和永久删除均可复用。

### 3.3 可复用的图片能力

文章上传已经提供：

- Fastify multipart 接收；
- 20 MB 单图限制；
- JPEG、PNG、WebP、GIF MIME 类型；
- `sharp` 图片尺寸读取和预览图生成；
- Journal 本地资产目录；
- 公开/私有媒体访问控制；
- Web 资产删除。

新功能应复用这些现有能力，抽出通用 Web 图片写入路径，不另写图片解析、预览或存储实现。

## 4. 用户交互

### 4.1 入口与路由

`/me` 顶部操作顺序调整为：

1. 刷新
2. 发布内容
3. 写文章
4. 退出登录

新增路由：

```text
/me/entries/new
/me/entries/:entryId/edit
```

按钮仅在管理员已登录时显示，与现有“写文章”一致。

`/me/entries/:entryId/edit` 只用于编辑 Web 普通内容草稿；已发布普通内容继续使用现有卡片正文编辑，不进入此页面。

### 4.2 发布页面

页面标题为“发布内容”，包含：

- 返回“我的全部记录”；
- 普通多行正文输入；
- 图片选择区；
- 图片缩略图列表；
- 每张待发布图片的移除按钮；
- `公开` / `私有` 可见性选择；
- “保存草稿”次要按钮；
- “发布”主按钮。

正文保留换行，提示可直接使用 `#标签`。不提供标题、标签独立输入、Markdown 工具栏或富文本工具栏。

图片选择使用一个原生多选文件输入。再次选择图片时追加到当前待发布列表；同一文件不做静默去重。用户可在提交前逐张移除。

最多选择 10 张图片，与 Telegram 相册规模保持一致。超过数量时由表单直接显示错误，不裁剪、不跳过文件。

新建页面默认选择公开。编辑既有草稿时不保存上一次可见性选择，用户在实际发布时确认公开或私有；这避免给仍处于草稿状态的记录赋予可被误解的公开状态。

### 4.3 图片预览

浏览器只为待提交的本地 `File` 创建预览 URL：

- 选择后立即显示缩略图；
- 移除文件时释放对应 URL；
- 页面卸载时释放剩余 URL；
- 不在选择阶段上传；
- 不保存浏览器草稿。

预览顺序就是最终 `sort_order`。首版不加入拖拽排序，用户需要调整顺序时可移除后重新选择。

### 4.4 提交行为

点击“保存草稿”或“发布”后，一次性提交正文与图片变更：

- 提交期间禁用正文、图片选择、移除和发布按钮；
- 对应按钮显示“保存中…”或“发布中…”；
- 页面只显示服务端返回的真实错误，不自动重试；
- 首次保存草稿后进入 `/me/entries/{id}/edit`，继续停留在编辑页；
- 后续保存草稿更新同一条记录，不新增草稿；
- 发布成功后进入 `/me?entry={id}`，复用现有私有管理详情弹层查看刚发布的记录。

无论选择公开还是私有，发布成功后都回到 `/me`，因为这是管理操作的连续主路径；用户可从详情继续编辑正文、置顶、切换可见性、修改发布时间或删除。

正文和图片同时为空时，“保存草稿”和“发布”均不可用。不创建完全空白的草稿。

### 4.5 草稿在 `/me` 中的表现

草稿保留在现有私有信息流中，并显示明确的“草稿”状态，不会伪装成已发布的私有内容。

- 点击草稿卡片进入 `/me/entries/:id/edit`；
- 草稿管理菜单只提供“继续编辑”和“删除”；
- 草稿不提供置顶、可见性切换、发布时间修改和普通正文内联编辑；
- 草稿按创建时间参与 `/me` 排序；
- 草稿不进入“往年今日”。

## 5. 数据模型

### 5.1 新记录形态

已发布的 Web 普通内容写入：

| 字段 | 值 |
| --- | --- |
| `source_kind` | `web` |
| `content_type` | 有图片时为 `photo`，纯文字时为 `text` |
| `title` | `NULL` |
| `body_format` | `plain` |
| `publication_status` | `published` |
| `rich_body_json` | `NULL` |
| `content_text` | 用户正文，可为空但图片必须非空 |
| `visibility` | 用户选择的 `public` 或 `private` |
| `tags_json` | 从正文 `#标签` 提取 |
| `structured_content_json` | `NULL` |
| `telegram_message_json` | `NULL` |
| `pinned` | `0` |
| `source_created_at` | 服务端当前时间 |
| `captured_at` | 与创建时间相同 |
| `updated_at` | 与创建时间相同 |

草稿使用同一种 `web + plain` 记录，但：

| 字段 | 草稿值 |
| --- | --- |
| `publication_status` | `draft` |
| `visibility` | 固定为 `private` |
| `source_created_at` | 首次保存草稿时间 |
| `captured_at` | 首次保存草稿时间，后续不变 |
| `updated_at` | 每次保存草稿时更新 |

草稿发布时：

- `publication_status` 改为 `published`；
- `visibility` 写入发布前选择；
- `source_created_at` 改为实际发布时间；
- `captured_at` 保留首次保存草稿时间；
- `updated_at` 写入本次发布时间。

每张图片写入 `journal_assets`：

| 字段 | 值 |
| --- | --- |
| `source_kind` | `web` |
| `role` | `attachment` |
| `kind` | GIF 为 `animation`，其他图片为 `photo` |
| Telegram 文件字段 | `NULL` |
| `relative_path` | Journal 资产路径 |
| `preview_relative_path` | 生成的预览图路径 |
| `width` / `height` | 图片实际尺寸 |
| `sort_order` | 浏览器提交顺序 |

一条 Web 普通内容只有一行 `journal_entries`。多图通过多条 `journal_assets` 聚合，不使用 Telegram 的 `media_group_id`。

### 5.2 数据库 migration

SQLite 现有 CHECK 约束不允许 `web + plain`，且 SQLite 不能直接修改表级 CHECK，因此需要新增 migration 版本并重建表。

新约束允许三类合法记录：

1. `telegram + plain`
2. `web + rich + article`
3. `web + plain`

Web 普通记录约束：

```sql
source_kind = 'web'
AND chat_id IS NULL
AND source_message_id IS NULL
AND media_group_id IS NULL
AND telegram_message_json IS NULL
AND body_format = 'plain'
AND title IS NULL
AND rich_body_json IS NULL
```

Migration 同时重建 `journal_entries` 和 `journal_assets`，复制现有数据后恢复当前索引、外键、封面唯一索引和预览路径唯一索引。原因是资产表外键引用记录表，只重建记录表会让迁移过程和最终外键目标不明确。

新增：

```sql
publication_status TEXT NOT NULL DEFAULT 'published'
  CHECK (publication_status IN ('draft', 'published'))
```

现有 Telegram 记录和 Web 文章迁移后统一为 `published`。数据库额外约束：

```sql
publication_status = 'published'
OR (
  publication_status = 'draft'
  AND source_kind = 'web'
  AND body_format = 'plain'
  AND visibility = 'private'
)
```

不能只用 `visibility = 'private'` 表示草稿，因为“私有发布”也是首版正式能力。若混用，系统无法判断记录是否应该进入往年今日、是否可以置顶，以及卡片应该打开详情还是继续编辑。

## 6. API 设计

### 6.1 发布接口

新增管理员接口：

```http
POST /api/me/entries
Content-Type: multipart/form-data
```

字段：

```text
contentText: string
images: File[]
action: "draft" | "publish"
visibility: "public" | "private"（仅 action=publish）
```

约束：

- `contentText.trim()` 与 `images` 不能同时为空；
- 最多 10 张图片；
- 每张图片最大 20 MB；
- MIME 类型仅允许 JPEG、PNG、WebP、GIF。

成功返回完整 `JournalEntry`。`action=draft` 时服务端强制写入 `visibility=private`，不接受客户端为草稿指定公开状态。

`GET /api/me/entries` 已存在。同一路径使用不同 HTTP method，不需要新路由前缀。

### 6.2 草稿读取与更新

读取继续复用：

```http
GET /api/me/entries/:id
```

新增草稿更新接口：

```http
PATCH /api/me/entries/:id/draft
Content-Type: multipart/form-data
```

字段：

```text
contentText: string
newImages: File[]
removedAssetIds: JSON number[]
action: "draft" | "publish"
visibility: "public" | "private"（仅 action=publish）
```

该接口只接受 `source_kind=web`、`body_format=plain`、`publication_status=draft` 的记录。已发布内容不能重新进入草稿编辑器。

不把新建内容的图片拆成多个先上传接口。首次保存或直接发布保持一个请求，避免在用户明确保存前产生服务器记录。既有草稿更新也在同一个请求内提交正文、图片增删和保存/发布动作。

### 6.3 协议 schema

Multipart 文件由 Fastify 读取；共享协议增加服务端实际使用的字段 schema：

```ts
export const journalWebEntryCreateFieldsSchema = z.object({
  contentText: z.string(),
  action: z.enum(['draft', 'publish']),
  visibility: journalVisibilitySchema.optional(),
});
```

另增加 `journalPublicationStatusSchema`：

```ts
export const journalPublicationStatusSchema =
  z.enum(['draft', 'published']);
```

`JournalEntry` 响应增加 `publicationStatus`。

文件数量、大小和 MIME 类型由发布服务基于 multipart 文件执行明确校验。

前端只提交用户选择的发布可见性，不自行生成标签、发布时间、`contentType` 或 `publicId`。服务端校验动作与可见性的组合，并决定最终持久化字段。

字段 schema 需要交叉约束：

- `action=publish` 时必须提供 `visibility`；
- `action=draft` 时不得提供 `visibility`。

## 7. 服务端设计

### 7.1 `JournalWebEntryService`

新增 `src/journal-server/webEntryService.ts`，只组织 Web 普通内容发布主路径：

1. 解析正文、图片、动作和发布可见性；
2. 确认正文与图片至少存在一项；
3. 确认图片数量、大小和 MIME 类型；
4. 生成 `publicId` 和当前 ISO 时间；
5. 使用通用 Web 图片存储能力写入原图；
6. 使用现有 `JournalImagePreviewService` 生成预览图和尺寸；
7. 从正文提取标签；
8. 调用 Repository 在一个数据库事务中创建或更新记录及全部资产；
9. 返回完整 `JournalEntry`。

Service 提供三条明确动作：

- `create(input)`：首次保存草稿或直接发布；
- `updateDraft(id, input)`：继续保存既有草稿；
- `publishDraft(id, input)`：以公开或私有方式发布既有草稿。

`updateDraft` 和 `publishDraft` 可共用内部数据准备，但 Repository 写入必须根据动作明确更新 `publication_status`、`visibility` 和时间字段。

出错直接向上抛出，不重试、不跳过某张图片、不发布剩余内容，也不返回默认成功结果。

### 7.2 图片能力复用

将现有仅以文章命名、实际可通用的能力调整为 Web 资产能力：

- `JournalStorage.writeArticleAsset` 重命名为 `writeWebAsset`；
- 文章服务与新发布服务共同调用；
- Web 图片 MIME 集合、单图大小和 MIME 到 `kind` 的映射提取到一个短小的共享模块，例如 `webImage.ts`；
- 继续使用 `JournalImagePreviewService`，不手写图片解析和缩略图生成。

共享模块只包含图片协议规则，不建立通用上传框架。

### 7.3 Repository

增加：

```ts
createWebEntry(input: CreateWebEntryInput): JournalEntry
updateWebDraft(id: number, input: UpdateWebDraftInput): JournalEntry
publishWebDraft(id: number, input: PublishWebDraftInput): JournalEntry
```

输入包含：

- `publicId`
- `contentText`
- `tags`
- `sourceCreatedAt`
- 已完成存储与预览生成的图片元数据

Repository 使用单个 `better-sqlite3` transaction：

1. 插入一行 `journal_entries`；
2. 按数组顺序插入全部 `journal_assets`；
3. 返回新记录。

更新草稿时，事务同步完成：

1. 更新正文、标签和 `updated_at`；
2. 删除用户明确移除的草稿资产行；
3. 插入新增图片资产行；
4. 重新形成连续的 `sort_order`；
5. 若为发布动作，同时写入 `publication_status=published`、目标 `visibility` 和实际 `source_created_at`。

标签提取逻辑目前存在于 `updateContent`。将其收敛为 Repository 文件内的纯函数，让创建和后续正文编辑使用同一规则；不引入新的标签服务。

### 7.4 路由

在 `privateEntries.ts` 的现有 `/api/me/entries` 路由组中增加 POST，继续使用：

- `auth.requireAdmin`
- `@fastify/multipart`
- 现有统一错误暴露

路由只读取 multipart 并交给 `JournalWebEntryService`，不在路由中写数据库或处理图片。

`registerPrivateEntryRoutes` 需要接收该 service，服务端装配位置相应增加实例。现有 GET、PATCH、DELETE 行为不变。

公开查询、公开详情、RSS 和 JSON Feed 必须明确要求 `publication_status=published`。草稿虽然同时固定为 private，查询仍写明状态条件，避免以后可见性逻辑变化后把草稿带入正式内容。

`listOnThisDay` 同样只查询 `published`。私有 `/me` 列表保留草稿。

现有管理写接口也要以状态限定主路径：

- 正文内联编辑、置顶、可见性切换和发布时间修改只接受 `published`；
- 草稿正文和图片只能通过草稿更新接口修改；
- 永久删除继续同时接受 `draft` 和 `published`。

## 8. Web 端设计

### 8.1 路由与 App 编排

`web/src/router.ts` 增加：

```text
name: entry-new
path: /me/entries/new

name: entry-edit
path: /me/entries/:entryId/edit
```

`App.vue` 的路由解析增加 `entry-new` 和 `entry-edit`，并在两条路由渲染 `EntryPublisherView.vue`。`App.vue` 只负责路由映射和传递可选 `entryId`，不持有表单和上传状态。

### 8.2 组件边界

新增目录：

```text
web/src/components/publisher/
├── EntryPublisherView.vue
├── EntryImagePicker.vue
└── EntryVisibilityField.vue
```

组件职责：

| 组件 | 单一职责 | 主要契约 |
| --- | --- | --- |
| `EntryPublisherView.vue` | 新建/草稿续编、正文与可见性状态、保存/发布及跳转 | props: `entryId?`；组合 composable 与图片选择器 |
| `EntryImagePicker.vue` | 既有草稿图片、本地新增图片、预览和移除 | props: existing assets、disabled；model: new files；emit: removeExisting |
| `EntryVisibilityField.vue` | 公开/私有单选 | `defineModel<JournalVisibility>` |
| `useEntryPublisher.ts` | 草稿加载、首次创建、保存草稿、发布和请求状态 | readonly entry/status/error；create、saveDraft、publish |

`EntryPublisherView` 使用 `<script setup lang="ts">` 和 Composition API。可保存、可发布状态使用 `computed`，网络状态只存在于 composable，图片预览 URL 的创建与释放只存在于 `EntryImagePicker`。可见性状态只影响发布动作，保存草稿不提交该值。

不把这套表单放进 `FeedView.vue`。`FeedView` 只新增入口按钮，继续保持信息流编排职责。

### 8.3 API

`web/src/api.ts` 增加：

```ts
publishEntry(input: {
  contentText: string;
  images: File[];
  action: 'draft' | 'publish';
  visibility?: JournalVisibility;
}): Promise<JournalEntry>

updateDraft(id: number, input: {
  contentText: string;
  newImages: File[];
  removedAssetIds: number[];
  action: 'draft' | 'publish';
  visibility?: JournalVisibility;
}): Promise<JournalEntry>
```

它构造 `FormData`：

```text
contentText
action
visibility（发布时）
images / newImages
removedAssetIds（更新草稿时）
```

沿用 `requestJson` 和管理员 Cookie，不设置 multipart 的 `Content-Type`，由浏览器生成 boundary。

### 8.4 草稿卡片

`JournalEntry.publicationStatus` 为 `draft` 时：

- `CardDateSpine` 显示“草稿”而不是公开/私有状态；
- 点击卡片由 `FeedView` 跳转 `entry-edit`；
- `EntryCard` 不启用正文内联编辑；
- 管理菜单只显示“继续编辑”和“删除”。

组件只根据协议状态决定表现，不通过 `sourceKind`、空标题或私有可见性推断草稿。

### 8.5 成功跳转

保存草稿成功：

```ts
router.replace({
  name: 'entry-edit',
  params: { entryId: saved.id },
});
```

后续仍停留在编辑页。

发布成功后：

```ts
router.push({
  name: 'private',
  query: { entry: created.id },
});
```

现有 `/me?entry=id` 会读取私有详情并打开管理弹层。无需为成功页或公开详情增加新页面。

## 9. 文件改动范围

### 9.1 服务端

- `src/shared/journalProtocol.ts`
- `src/journal-server/migrations.ts`
- `src/journal-server/storage.ts`
- `src/journal-server/repository.ts`
- `src/journal-server/webImage.ts`
- `src/journal-server/webEntryService.ts`
- `src/journal-server/articleService.ts`
- `src/journal-server/routes/privateEntries.ts`
- Journal server 依赖装配文件

### 9.2 Web

- `web/src/router.ts`
- `web/src/App.vue`
- `web/src/api.ts`
- `web/src/composables/useEntryPublisher.ts`
- `web/src/components/publisher/EntryPublisherView.vue`
- `web/src/components/publisher/EntryImagePicker.vue`
- `web/src/components/publisher/EntryVisibilityField.vue`
- `web/src/components/journal/FeedView.vue`
- 草稿状态涉及的普通卡片、日期状态和管理菜单组件

### 9.3 无需修改

- Telegram bot 和 Journal ingest；
- 普通详情和媒体画廊；
- 发布时间修改功能；
- 富文本文章数据与编辑器；
- `src/reminders/recurring.ts`。

## 10. 数据与现有功能关系

发布成功后，Web 普通内容自然进入现有能力：

- 公开时间线；
- `/me` 全部记录；
- 关键词、标签、内容类型和日期筛选；
- 普通正文编辑；
- 图片画廊和详情弹层；
- 置顶；
- 公开/私有切换；
- 发布时间修改；
- 往年今日；
- RSS 和 JSON Feed；
- 永久删除及资产目录删除。

正文编辑只更新 `content_text` 和从正文重新提取的标签，不影响图片。附件编辑不在首版范围内。

草稿只进入：

- `/me` 全部记录；
- `/me` 私有筛选；
- 草稿续编；
- 永久删除。

草稿不进入公开页面、Feed、往年今日，也不能置顶、切换可见性或修改发布时间。

## 11. 业务验收口径

- 登录 `/me` 后，“发布内容”显示在“写文章”旁；
- 可以发布纯文字，结果使用普通记录卡片而不是文章卡片；
- 可以发布单图、多图和图文组合；
- 发布前可以选择公开或私有，默认公开；
- 私有发布内容只出现在 `/me`，且与草稿有明确状态区别；
- 可以把文字、图片或图文组合保存为草稿；
- 首次保存草稿后继续编辑同一条草稿；
- 重新进入 `/me` 后可以从草稿卡片继续编辑；
- 草稿阶段可以增加或移除图片；
- 草稿发布时可以重新选择公开或私有；
- 草稿发布时，发布时间使用实际发布时刻，首次保存时间保留在 `captured_at`；
- 草稿不进入公开信息流、RSS、JSON Feed或往年今日；
- 只选择图片、不填写正文时可以发布；
- 正文和图片都为空时不能发布；
- 超过 10 张图片时明确报错，不截断图片列表；
- 不支持的文件类型或超限图片直接报错，整条内容不发布；
- 图片显示顺序与选择列表顺序一致；
- 发布期间不能重复提交或继续修改表单；
- 成功后进入新记录的 `/me` 详情；
- 选择公开的新记录立即出现在公开信息流，并具有公开详情 URL；
- 选择私有的新记录不出现在公开信息流、公开详情、RSS 或 JSON Feed；
- 正文中的标签进入现有标签筛选；
- 新记录可以继续编辑正文、修改发布时间、置顶、转为私有和永久删除；
- 永久删除时同时删除 Web 图片及预览文件；
- “写文章”和现有文章编辑流程不发生变化；
- Telegram 采集流程不发生变化。

## 12. 后续可独立评估

以下能力只有出现实际需求后再单独设计：

- Web 视频发布；
- 文件附件；
- 已发布图片的增加、替换、删除和排序；
- 在发布表单直接指定历史发布时间；
- 将 Web 发布内容同步到 Telegram。
