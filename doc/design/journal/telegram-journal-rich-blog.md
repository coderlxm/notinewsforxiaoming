# Journal 富文本博客扩展设计

## 1. 文档状态

- 状态：已设计，后续实施
- 依赖：现有 Telegram Journal、公开信息流、`/me` 管理、附件存储、编辑与永久删除
- 部署边界：只扩展现有 `rndc02` Journal 服务和 Vue 前端，不新增服务器、数据库或常驻服务
- 产品定位：个人微博客中的长文能力，不建设通用 CMS

## 2. 目标与结论

在现有个人信息流中增加由 Web 创建和编辑的富文本文章，支持标题、封面、结构化正文、文中图片、标签以及公开/私有切换。

普通 Telegram 记录与博客文章继续使用同一种 `Entry`：

```text
Entry
├── Telegram 记录：纯文本、媒体或结构化消息快照
└── Web 文章：标题、富文本正文、封面和文中图片
```

两者共用：

- 同一个公开时间线和 `/me` 私有资产页；
- 同一个公开/私有可见性模型；
- 同一套标签、置顶、永久链接和永久删除；
- 同一个 SQLite 数据库与 `/opt/journal/data/assets` 媒体目录；
- 同一套 RSS、JSON Feed、备份与恢复边界。

不创建独立博客服务、第二个数据库或 WordPress 一类外部 CMS。富文本只改变一部分 Entry 的创作与呈现方式，不改变 Journal 的数据所有权。

## 3. 产品设计

### 3.1 创作入口

登录 `/me` 后，在“我的全部记录”标题区域增加“写文章”按钮，进入：

```text
/me/articles/new
```

新文章先在浏览器内编辑标题、正文和标签。第一次保存时建立一条 `private` Web Entry，随后进入：

```text
/me/articles/:id/edit
```

文章第一次保存前不允许上传图片。保存为私有文章后，才开放封面与文中图片上传。这个额外步骤保证每个上传文件从一开始就属于明确的 Entry，不需要临时上传表、后台清理任务或孤儿文件兜底。

### 3.2 编辑器能力

首版工具栏包含：

- 撤销、重做；
- 正文、二级标题、三级标题；
- 粗体、斜体、删除线、行内代码；
- 无序列表、有序列表；
- 引用、代码块、分隔线；
- 链接；
- 插入已上传图片。

正文不提供任意 HTML 源码模式。标题长度为 1–120 个字符，文章正文不能为空，标签最多 20 个。

不加入表格、数学公式、外部视频嵌入、Slash Command、AI 写作、协同编辑、评论批注和可视化页面搭建。

### 3.3 保存与发布

- 第一次保存固定创建为私有文章；
- 后续保存只更新标题、富文本正文、纯文本摘要、标签和 `updated_at`；
- 发布继续复用现有“设为公开”，不增加 `draft / scheduled / published` 状态机；
- 私有状态就是个人草稿或仅自己可见的长文；
- 文章从私有转公开时不修改创建时间，不将旧文章自动顶到时间线顶部；
- 不做自动保存，只有明确点击“保存文章”才写入数据库。

保存成功后继续停留在编辑页，并提供“查看文章”和“设为公开/转为私有”。退出时不增加浏览器关闭拦截或未保存草稿恢复。

### 3.4 信息流呈现

富文本文章在公开首页和 `/me` 信息流中显示为长文摘要卡片：

- 封面存在时优先显示封面；
- 显示标题；
- 使用 `content_text` 截取纯文本摘要，不在时间线渲染完整富文本；
- 显示标签、时间、公开/私有和置顶状态；
- 点击标题、摘要或时间进入现有 `/p/:publicId` 永久详情。

普通 Telegram 记录的卡片保持当前样式，不强制标题，不改变正文、媒体网格或结构化内容展示。

### 3.5 文章详情

`/p/:publicId` 根据 `bodyFormat` 分支：

- `plain`：继续使用当前 EntryCard 详情；
- `rich`：显示文章标题、封面、作者与时间、完整富文本正文和标签。

公开文章详情不加载编辑器工具栏、私有资产信息或管理接口。登录后的编辑入口只出现在 `/me`。

### 3.6 图片与封面

Web 文章图片全部上传到 Journal 自己的媒体目录，不允许直接把外部图片 URL 或 Base64 写入正文。

- 支持 JPEG、PNG、WebP、GIF；
- 单个文件上限 20 MB；
- 不压缩、不转码、不生成缩略图；
- `cover`：每篇文章最多一个封面；
- `inline`：可被富文本正文引用的文中图片；
- 图片继续通过 `/media/:assetId` 的可见性检查提供；
- 私有文章图片必须登录，公开后才能由访客读取。

Tiptap 的 Image 与 FileHandler 扩展只负责编辑器中的图片节点和粘贴/拖拽事件，不实现服务端上传，因此仍需 Journal 提供自己的上传接口。参考：[Tiptap Image](https://tiptap.dev/docs/editor/extensions/nodes/image)、[Tiptap FileHandler](https://tiptap.dev/docs/editor/extensions/functionality/filehandler)。

删除正文中的图片节点并保存后，服务端比较正文引用的 `assetId` 与该文章的 `inline` 资产，永久删除已经不再引用的 inline 图片。封面由独立封面操作管理，不参与正文引用比较。

### 3.7 编辑与删除关系

- 普通记录继续使用现有纯文本内联编辑；
- 富文本文章的“编辑”跳转到文章编辑页；
- 删除文章继续使用现有二次确认永久删除；
- 删除文章时由现有 `JournalDeletionService` 删除 Entry、封面、文中图片和数据库资产行；
- 删除不影响 Telegram，因为 Web 文章没有 Telegram 原始消息。

## 4. 编辑器选型

采用 Tiptap 3.x 在实施时的最新 stable release，并将实际版本写入 `pnpm-lock.yaml`。

选型依据：

- 官方支持 Vue 3 和 `<script setup>`；
- 基于 ProseMirror，文档使用明确 schema，而不是任意 HTML；
- headless 架构便于沿用当前个人信息流视觉；
- StarterKit 覆盖首版大多数段落、标题、列表、引用和代码能力；
- JSON 可在浏览器编辑、SQLite 持久化，并在服务端生成 RSS 所需 HTML。

参考：[Tiptap Vue 3](https://tiptap.dev/docs/editor/getting-started/install/vue3)、[Tiptap Core Concepts](https://tiptap.dev/docs/editor/core-concepts/introduction)。

计划依赖：

| 包 | 用途 |
| --- | --- |
| `@tiptap/vue-3` | Vue 3 编辑器组件与 `useEditor` |
| `@tiptap/pm` | Tiptap 使用的 ProseMirror 依赖 |
| `@tiptap/starter-kit` | 段落、标题、列表、引用、代码块等基础 schema |
| `@tiptap/extension-image` | 文中图片节点 |
| `@tiptap/extension-placeholder` | 空正文提示 |
| `@tiptap/extension-file-handler` | 粘贴和拖拽图片事件 |
| `@tiptap/html` | Node.js 中由 JSON生成 HTML |
| `sanitize-html` | 对公开订阅源 HTML 做允许列表清理 |
| `@fastify/multipart` | Web 图片 multipart 上传 |

不引入 Tiptap Cloud、Hocuspocus、Yjs 或其他协同编辑服务。

## 5. 内容存储原则

### 5.1 JSON 是富文本唯一源数据

`rich_body_json` 保存 `editor.getJSON()` 产生的 Tiptap JSON。Tiptap 官方推荐 JSON 作为持久化格式，因为它更容易解析、扩展和重新编辑。参考：[Tiptap Persistence](https://tiptap.dev/docs/editor/core-concepts/persistence)。

不把 HTML 作为第二份可编辑正文，也不同时维护 Markdown。否则正文修改后需要处理 JSON、HTML、Markdown 三份内容的一致性。

### 5.2 `content_text` 是派生字段

富文本保存时，服务端使用与编辑器相同的 extension schema 提取纯文本并写入 `content_text`。它用于：

- 信息流摘要；
- SQLite `LIKE` 搜索；
- 无 HTML 客户端的降级文本；
- JSON Feed 的 `content_text`；
- 后续数据导出。

客户端不能单独提交一个声称与 JSON 对应的 `content_text`，避免两者不一致。

### 5.3 HTML 只在输出时生成

RSS 和 JSON Feed 需要 HTML 时，服务端使用 `@tiptap/html` 的 `generateHTML` 从 JSON生成，再由 `sanitize-html` 按固定允许列表清理。参考：[Tiptap HTML Utility](https://tiptap.dev/docs/editor/api/utilities/html)。

公开网页详情不使用任意 `v-html`：`RichArticleRenderer.vue` 使用同一 Tiptap schema 创建 `editable: false` 的只读 Editor，并通过 `EditorContent` 渲染 JSON。时间线只使用普通文本摘要，不为每一张卡片创建 Editor 实例。

## 6. 数据模型

### 6.1 `journal_entries` 版本 2

现有表强制 `chat_id`、`source_message_id` 和 `telegram_message_json` 非空，不适合伪造 Web 来源。迁移版本 2 重建表并增加来源与正文格式：

```sql
CREATE TABLE journal_entries_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('telegram', 'web')),
  chat_id TEXT,
  source_message_id INTEGER,
  media_group_id TEXT,
  content_type TEXT NOT NULL,
  title TEXT,
  body_format TEXT NOT NULL DEFAULT 'plain'
    CHECK (body_format IN ('plain', 'rich')),
  content_text TEXT NOT NULL DEFAULT '',
  rich_body_json TEXT,
  visibility TEXT NOT NULL
    CHECK (visibility IN ('private', 'public')),
  tags_json TEXT NOT NULL DEFAULT '[]',
  structured_content_json TEXT,
  telegram_message_json TEXT,
  pinned INTEGER NOT NULL DEFAULT 0
    CHECK (pinned IN (0, 1)),
  source_created_at TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (source_kind = 'telegram'
      AND chat_id IS NOT NULL
      AND source_message_id IS NOT NULL
      AND telegram_message_json IS NOT NULL
      AND body_format = 'plain'
      AND rich_body_json IS NULL)
    OR
    (source_kind = 'web'
      AND chat_id IS NULL
      AND source_message_id IS NULL
      AND media_group_id IS NULL
      AND telegram_message_json IS NULL
      AND content_type = 'article'
      AND body_format = 'rich'
      AND title IS NOT NULL
      AND rich_body_json IS NOT NULL)
  ),
  UNIQUE(chat_id, source_message_id)
);
```

迁移在一个 SQLite transaction 内完成：创建 v2 表、复制现有行、替换旧表并重建原索引。现有数据统一写入：

```text
source_kind = telegram
title = null
body_format = plain
rich_body_json = null
```

不新增 `articles` 表。文章继续参与现有时间线查询、标签筛选、置顶、可见性和删除。

### 6.2 `journal_assets` 版本 2

Web 上传没有 Telegram `file_id`，因此同一次迁移重建资产表：

```sql
CREATE TABLE journal_assets_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('telegram', 'web')),
  role TEXT NOT NULL DEFAULT 'attachment'
    CHECK (role IN ('attachment', 'cover', 'inline')),
  kind TEXT NOT NULL,
  telegram_file_id TEXT,
  telegram_file_unique_id TEXT,
  original_name TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  relative_path TEXT NOT NULL UNIQUE,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (
    (source_kind = 'telegram'
      AND telegram_file_id IS NOT NULL
      AND telegram_file_unique_id IS NOT NULL)
    OR
    (source_kind = 'web'
      AND telegram_file_id IS NULL
      AND telegram_file_unique_id IS NULL)
  ),
  FOREIGN KEY(entry_id) REFERENCES journal_entries_v2(id)
);

CREATE UNIQUE INDEX idx_journal_assets_one_cover
ON journal_assets(entry_id)
WHERE role = 'cover';
```

现有 Telegram 资产复制为 `source_kind = telegram`、`role = attachment`。Web 封面使用 `cover`，文中图片使用 `inline`。

重建顺序固定为：创建并复制 `journal_entries_v2`、创建并复制 `journal_assets_v2`、先删除旧 assets 表、再删除旧 entries 表、依次把 v2 表改为正式表名，最后重建索引。`journal_assets_v2` 在迁移期间引用 `journal_entries_v2`，避免启用 foreign keys 时指向即将删除的旧父表。

## 7. 共享协议

扩展 `JournalEntry`：

```ts
type JournalSourceKind = 'telegram' | 'web';
type JournalBodyFormat = 'plain' | 'rich';

interface JournalEntry {
  // 现有字段
  sourceKind: JournalSourceKind;
  title: string | null;
  bodyFormat: JournalBodyFormat;
  richBody: TiptapDocument | null;
}
```

扩展 `JournalAsset`：

```ts
type JournalAssetSourceKind = 'telegram' | 'web';
type JournalAssetRole = 'attachment' | 'cover' | 'inline';

interface JournalAsset {
  // 现有字段
  sourceKind: JournalAssetSourceKind;
  role: JournalAssetRole;
}
```

新增 Zod schema：

- `journalRichDocumentSchema`：只接受固定 Tiptap 节点与 marks；
- `journalArticleCreateRequestSchema`；
- `journalArticleUpdateRequestSchema`；
- `journalArticleTagsSchema`；
- `journalArticleAssetResponseSchema`。

请求边界：

- 标题 1–120 字符；
- JSON 序列化后最大 512 KB；
- 标签 0–20 个，每个使用现有标签字符约束；
- rich 文档根节点必须是 `doc`；
- 图片节点必须引用当前 Entry 所属的 `inline` asset ID；
- 链接只允许 `https`、`http` 和 `mailto`。

## 8. API 设计

所有写接口继续使用现有 `/me` 管理 Cookie，不新增 token。

### 8.1 创建文章

```http
POST /api/me/articles
Content-Type: application/json

{
  "title": "文章标题",
  "richBody": { "type": "doc", "content": [] },
  "tags": ["生活", "随笔"]
}
```

服务端固定创建为 `private`、`source_kind = web`、`content_type = article`，生成 `publicId` 和时间字段，并由 rich JSON派生 `content_text`。

### 8.2 更新文章

```http
PATCH /api/me/articles/:id
Content-Type: application/json

{
  "title": "修改后的标题",
  "richBody": { "type": "doc", "content": [] },
  "tags": ["生活"]
}
```

接口只接受 `source_kind = web` 且 `body_format = rich` 的 Entry。公开/私有、置顶和永久删除继续复用现有 Entry 接口。

### 8.3 上传文章图片

```http
POST /api/me/articles/:id/assets
Content-Type: multipart/form-data

file=<binary>
role=cover|inline
```

- 只接受当前登录用户可以管理的 Web 文章；
- 校验 MIME 与实际支持范围；
- 使用现有 `JournalStorage` 在 `/opt/journal/data/assets/YYYY/MM/<public_id>/` 写入随机文件名；
- `cover` 上传在一个数据库事务中替换原封面资产；
- `inline` 返回带 `assetId` 的 JournalAsset，编辑器随后插入图片节点；
- 上传失败直接报错，不把失败文件写成成功资产。

### 8.4 删除单个文章图片

```http
DELETE /api/me/articles/:id/assets/:assetId
```

只允许删除属于该文章的 Web 资产。封面可直接删除；inline 图片若仍被当前 rich JSON引用则拒绝删除，用户应先从正文移除并保存。

## 9. 后端实现

### 9.1 `JournalArticleService`

新增 `JournalArticleService`，只组织文章主路径：

- 创建私有 Web Entry；
- 校验并规范化 Tiptap JSON；
- 提取 `content_text`；
- 更新标题、正文和标签；
- 校验正文图片资产归属；
- 在保存时删除不再引用的 inline 资产；
- 上传、选择和删除封面。

Repository 继续只做 SQLite 读写，Storage 继续只做精确文件路径操作。文章服务不接触 Telegram Bot API。

### 9.2 富文本 schema 与渲染

建立一份共享 extension 列表，浏览器编辑、只读详情和服务端 HTML 输出必须使用同一 schema。允许的节点和 marks 只来自首版工具栏，不动态加载数据库中的扩展名。

服务端保存流程：

1. Zod 校验文章请求与 JSON 大小；
2. Tiptap schema 解析 rich JSON；
3. 校验所有图片节点的 `assetId` 属于当前文章；
4. 由 JSON生成纯文本；
5. 在 SQLite transaction 中更新 Entry；
6. 删除正文不再引用的 inline 资产目录与资产行；
7. 返回完整 JournalEntry。

不捕获错误后继续保存部分正文。任一内容或资产校验失败时，本次文章保存直接失败。

### 9.3 搜索与筛选

现有搜索条件由：

```sql
e.content_text LIKE ?
```

调整为：

```sql
(e.title LIKE ? OR e.content_text LIKE ?)
```

内容类型筛选使用 `content_type = 'article'`。无需 FTS、搜索引擎或富文本节点索引。

### 9.4 RSS 与 JSON Feed

- 普通 Entry 保持现有纯文本输出；
- 富文本文章以标题作为 feed item title；
- `@tiptap/html` 生成 `content_html`；
- `sanitize-html` 只允许当前 schema 对应的标签、属性和 URL 协议；
- 图片 URL转换为 `JOURNAL_PUBLIC_BASE_URL + /media/:assetId` 的绝对地址；
- 私有文章永远不进入订阅源。

## 10. Vue 前端设计

所有新组件使用 Vue 3 Composition API、`<script setup lang="ts">` 和 scoped CSS。

### 10.1 组件边界

| 组件/Composable | 单一职责 | 主要契约 |
| --- | --- | --- |
| `ArticleEditorView.vue` | 路由级编排：加载、新建、保存、跳转 | props: `articleId?`; emit: `navigate` |
| `ArticleMetaForm.vue` | 标题与标签输入 | `defineModel`：title、tags |
| `RichTextEditor.vue` | 管理 Tiptap 实例、工具栏、正文和光标位置 | `defineModel<TiptapDocument>`；props: assets、disabled、uploadImage action |
| `ArticleMediaPanel.vue` | 上传、替换和删除封面，查看文章资产 | props: assets、busy；emit: uploadCover、removeAsset |
| `RichArticleRenderer.vue` | 使用只读 Tiptap Editor 渲染一篇文章 | props: document |
| `ArticleCardContent.vue` | 信息流中的标题、封面和纯文本摘要 | props: entry；emit: open |
| `useArticleEditor.ts` | 文章草稿状态、请求状态和显式 actions | readonly state；create、save、upload、removeAsset |

`App.vue` 只增加路由映射，不放编辑器实现。`FeedView.vue` 只组合“写文章”入口和文章卡片，不持有 Tiptap 实例。

### 10.2 状态模型

- 标题和保存状态使用 `shallowRef`；
- Tiptap `Editor` 实例作为外部类实例使用 `shallowRef`/`useEditor`，组件卸载时销毁；
- rich JSON 通过真正的 `defineModel` 双向契约传递；
- `canSave`、摘要和按钮状态使用纯 `computed`；
- 网络保存、上传和删除只存在于 `useArticleEditor` actions；
- composable 返回 readonly state，页面不能直接改请求状态；
- 不引入 Pinia，文章编辑状态只属于当前编辑页。

### 10.3 编辑器视觉

- 编辑区域继续使用现有 680px 内容宽度；
- 工具栏在桌面端单行换行，在移动端横向滚动；
- 编辑正文与公开详情使用同一套 article typography CSS variables；
- 标题使用当前 serif 字体；
- 当前格式按钮同时使用文字/图标状态和 `aria-pressed`，不只依赖颜色；
- 图片包含 alt 文本输入；
- 不引入完整第三方编辑器主题，保持与当前个人主页一致。

## 11. 文件组织

计划增加或调整：

```text
src/
├── shared/
│   ├── journalProtocol.ts
│   └── journalRichText.ts
├── journal-server/
│   ├── articleService.ts
│   ├── migrations.ts
│   ├── repository.ts
│   ├── storage.ts
│   ├── richText.ts
│   └── routes/
│       └── articles.ts
web/src/
├── api.ts
├── types.ts
├── composables/
│   └── useArticleEditor.ts
└── components/
    ├── article/
    │   ├── ArticleEditorView.vue
    │   ├── ArticleMetaForm.vue
    │   ├── ArticleMediaPanel.vue
    │   ├── RichTextEditor.vue
    │   ├── RichArticleRenderer.vue
    │   └── ArticleCardContent.vue
    └── journal/
        ├── EntryCard.vue
        └── FeedView.vue
```

不修改 `src/reminders/recurring.ts`，不把文章代码放进现有 bot handler。

## 12. 安全与内容边界

- 新建、编辑和上传全部要求现有管理员 Cookie；
- 不接受任意 HTML；
- 公开 HTML 必须由受控 JSON生成并经过允许列表清理；
- 文中图片只能引用当前 Entry 自己的资产；
- 不允许 Base64 图片、`javascript:` URL、外部图片热链或 iframe；
- 上传文件使用随机磁盘名，不使用用户文件名拼接路径；
- `/media/:assetId` 继续在每次请求时查询 Entry 可见性；
- 单篇文章 JSON、标题、标签数量和单文件大小都有明确上限；
- 富文本错误直接返回，不保存部分内容或替代格式。

## 13. 部署与备份

- 不新增环境变量、端口或容器；
- 新依赖进入现有 Journal Docker image；
- SQLite migration 由 Journal 服务启动时执行；
- Web 图片继续进入 `/opt/journal/data/assets`；
- 当前 rclone 备份已包含 SQLite 与整个 assets 目录，因此自动覆盖文章和图片；
- 共享协议修改会按现有 GitHub Actions 顺序先发布 Journal，再发布 bot；bot 只接受扩展后的 Entry DTO，不增加文章业务；
- `rndc02` 现有 OpenResty、Cloudflare 和其他容器保持不变。

## 14. 实施顺序

### 阶段一：数据与协议

1. 增加 rich text schema 与共享 DTO；
2. 完成 entries/assets v2 SQLite migration；
3. Repository 支持 Web Entry、article 字段和 Web asset；
4. 让现有 Telegram 记录在新模型下保持 `plain` 行为。

### 阶段二：纯文本富格式文章

1. 增加文章创建与更新 API；
2. 实现 Tiptap 编辑器、标题、标签和手动保存；
3. 实现文章摘要卡片和只读详情；
4. 接入可见性、置顶和永久删除。

### 阶段三：图片

1. 增加 multipart 上传接口；
2. 增加封面与 inline 资产；
3. 编辑器支持粘贴、拖拽和插入已有上传；
4. 保存时清理不再引用的 inline 资产。

### 阶段四：订阅源与交付文档

1. RSS/JSON Feed 输出富文本 HTML；
2. 更新使用手册和验收清单；
3. 经现有 Actions 双节点发布编排交付。

每个阶段均复用同一 Entry，不做阶段间数据搬迁。

## 15. 验收行为

- 登录 `/me` 后可以创建一篇带标题和富文本正文的私有文章。
- 文章第一次保存后可以上传封面和文中图片。
- 标题、正文、标签保存后重新进入编辑页仍保持一致。
- 信息流只显示封面、标题和纯文本摘要，不展开完整编辑器正文。
- 公开详情正确显示标题层级、列表、引用、代码、链接和图片。
- 普通 Telegram 记录的采集、编辑和展示不发生变化。
- 私有文章及其图片未登录时不可访问。
- 转为公开后进入首页、永久详情、RSS 和 JSON Feed。
- 搜索可以命中文章标题和富文本派生的纯文本正文。
- 从正文移除 inline 图片并保存后，图片资产被永久删除。
- 删除文章时，Entry、封面、文中图片和资产行全部删除。
- 富文本 JSON包含未知节点、图片不属于当前文章或链接协议非法时直接报错。
- 备份继续包含文章数据库行与全部本地图片。

## 16. 明确不做

- 独立博客数据库或第二套文章服务；
- WordPress、Ghost、Memos 等外部运行依赖；
- 自动保存、离线草稿恢复和版本历史；
- 定时发布、发布审批和多作者；
- 协同编辑、评论、点赞和文章阅读统计；
- 任意 HTML、iframe、脚本、外部图片热链；
- 图片压缩、裁剪、转码、CDN 和对象存储；
- Markdown/HTML/JSON 多源双向同步；
- Telegram 与 Web 富文本双向同步；
- 为上传或保存失败增加重试、备用通道或后台补偿。
