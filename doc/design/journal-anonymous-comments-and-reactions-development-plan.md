# Journal 匿名评论与点赞详细开发方案

## 1. 文档定位

本文是在 `journal-anonymous-comments-and-reactions.md` 核心思路上的完善版开发方案。保留以下原始方向：

- 访客无需注册即可点赞和评论；
- 互动视觉延续 Journal 现有设计语言；
- 信息流只展示轻量摘要，完整互动发生在详情中；
- 博主仍以 Web 私有模式和 Telegram 作为管理主路径；
- 只做适合个人站点的基础反垃圾，不建设复杂审核系统。

本文只校正与当前源码、部署结构或业务主路径不一致的部分，并把数据约束、接口契约、状态流、页面接入点和实施边界补充到可直接开发的程度。

## 2. 现状依据与原方案校正

### 2.1 当前实现事实

本方案以当前实现为准：

- Journal 使用 Fastify 5、SQLite（`better-sqlite3`）和 Vue 3；数据库迁移当前到 version 19，迁移入口为 `src/journal-server/migrations.ts`。
- 条目同时拥有内部数字主键 `id` 和公开 UUID `publicId`。公开接口以 `publicId` 定位，私有接口以内部 `id` 定位。
- 公开条目接口位于 `/api/feed`、`/api/entries/:publicId`；私有管理接口统一位于 `/api/me/*`；bot 到 Journal 的服务间调用位于 `/api/internal/*`。
- 条目具有 `draft` / `published` 发布状态，以及 `private` / `protected` / `public` 可见性。互动不能只判断 `visibility`，还必须复用现有发布与访问授权规则。
- 普通记录会在信息流内打开 `JournalDetailOverlay`；文章从信息流进入独立的 `/p/:publicId` 阅读页；搜索和归档结果会打开另一条详情弹层路径。
- 私有管理详情已经通过 `/me?entry=:id` 打开，Telegram 管理入口应复用这一地址，不新增管理页面。
- 现有实际 CSS token 是 `--surface-card`、`--surface-muted`、`--text-primary`、`--text-muted`、`--border-subtle`、`--border-strong`、`--accent`、`--accent-strong`、`--accent-soft`、`--focus` 和 `--ease-card`。
- 项目已经安装 `@fastify/rate-limit`、`marked`、`sanitize-html` 和 `telegraf`，无需新增同类依赖。

### 2.2 对原方案的必要校正

| 原方案表述 | 完善后的决定 | 原因 |
| --- | --- | --- |
| 浏览器持久化“指纹” | 使用浏览器生成并保存在 LocalStorage 的匿名访客 UUID，称为“访客 ID” | 这不是设备指纹，不应扩大采集或追踪含义 |
| `like` / `heart` / `clap` 多种 reaction | 第一版只保留点赞一种状态 | 当前业务只有一个点赞按钮，多类型会增加无效字段和交互分支 |
| `POST .../reactions` 做 toggle | 使用 `PUT` 表示点赞、`DELETE` 表示取消点赞 | 请求表达目标状态，连续点击或重复请求不会反向翻转 |
| `published` / `pending` / `hidden` / `deleted` 四态评论 | 第一版只保留 `published` / `hidden`；永久删除使用真实删除 | 当前没有“先审后发”需求，也不保留伪删除状态 |
| 邮箱、网址、Gravatar 和邮件回复提醒 | 第一版不收集邮箱和网址 | 当前没有邮件通道；网址会增加垃圾链接入口，收集未使用信息没有业务价值 |
| 原始 User-Agent 和 IP hash 入库 | 第一版不持久化 User-Agent 或 IP | 当前反向代理可信链尚未成为互动身份的一部分；访客 ID、唯一约束、蜜罐和现有限流能力已覆盖基础需求 |
| `journal_entries` 冗余两个计数字段 | 不增加冗余计数，按索引实时聚合 | 单用户个人站点数据量有限，避免维护计数一致性和额外状态分支 |
| 评论与点赞均实时发 Telegram | 只对新评论发 Telegram，点赞不逐条推送 | 点赞通知会污染 bot 消息流，点赞总数在 Web 中即可查看 |
| 后台异步落库 | 前端可以即时呈现提交中状态，但必须等待服务端结果确认 | 不把尚未成功的写入显示成最终成功；失败必须明确暴露并恢复真实状态 |
| 点赞请求防抖 | 单次请求期间锁定该按钮 | 点赞是离散意图，锁定请求比延迟合并更直接 |

## 3. 产品范围与业务规则

### 3.1 第一版包含

1. 已发布且当前可访问的条目可被匿名访客点赞、取消点赞和评论。
2. `public` 条目可直接互动；`protected` 条目只有在管理员身份或现有解锁 Cookie 有效时才可读取和写入互动；`private` 条目与草稿不提供公开互动接口。
3. 信息流卡片显示点赞数、评论数和当前浏览器的点赞状态。
4. 普通记录详情弹层、文章独立阅读页、搜索/归档详情弹层均展示完整互动区。
5. 博主在私有详情弹层中查看公开及隐藏评论，进行回复、隐藏、恢复显示和永久删除。
6. 新访客评论成功后向现有 Telegram bot 会话发送一条通知，提供“打开管理”和“隐藏评论”按钮。
7. 评论支持有限 Markdown，输出统一在服务端清洗后再交给前端展示。

### 3.2 第一版不包含

- 用户注册、OAuth、跨设备身份同步；
- 多种表情 reaction；
- 访客互相回复、访客编辑评论；
- 邮件地址、个人网址、Gravatar、邮件订阅或邮件回复提醒；
- 评论先审后发、关键词审核、AI 审核、验证码；
- 点赞 Telegram 通知、点赞者名单；
- 通知重试、备用通知通道、失败后静默继续；
- 独立评论后台、全站评论收件箱或多管理员权限。

### 3.3 访问状态变化

- 条目从 `public` 改为 `private`：互动数据保留，但公开互动接口立即返回 404；博主仍可在私有详情中管理。
- 条目从 `public` 改为 `protected`：互动数据保留，只有已解锁访客与管理员可访问。
- 条目再次公开：原有可见评论与点赞重新显示。
- 删除条目：关联点赞和评论随外键级联删除。
- Telegram 相册组：互动只归属信息流所使用的代表条目和代表 `publicId`，整组仍只有一个互动线程。

## 4. 完整访客主路径

### 4.1 首次进入信息流

1. 页面读取 `journal.visitor-id.v1`。
2. 不存在时使用浏览器 `crypto.randomUUID()` 生成 UUID 并写入 LocalStorage。
3. 公开 feed 请求通过 `X-Journal-Visitor-Id` 请求头携带该 UUID。
4. 服务端只用 HMAC-SHA256 生成不可逆 `clientHash`，原始 UUID 不写入 SQLite。
5. feed 中每个已解锁条目返回互动摘要，卡片直接展示计数与 `viewerReacted`。
6. LocalStorage 不可用时，信息流和评论阅读仍可继续；用户实际发起写操作时明确提示匿名身份无法保存，不伪造成功状态。

### 4.2 点赞与取消点赞

1. 访客点击卡片或详情中的点赞按钮。
2. 当前按钮立即进入忙碌状态并呈现目标视觉，防止同一请求未结束时重复操作。
3. 点赞调用 `PUT`，取消调用 `DELETE`。
4. 服务端核对条目发布状态与访问权限，再根据 `(entry_id, client_hash)` 唯一约束创建或删除点赞。
5. 返回服务端最终的 `reactionCount` 与 `viewerReacted`。
6. 前端用返回值同步当前详情、对应信息流卡片和已缓存条目的摘要。
7. 请求失败时恢复请求前状态并显示真实错误，不自动重试。

### 4.3 首次评论

1. 访客进入详情后，互动区使用条目已有摘要立即显示框架，同时加载评论列表。
2. 评论框默认只显示正文输入；聚焦后自然展开昵称、Markdown 提示与提交按钮。
3. 若 `journal.visitor-name.v1` 已存在，昵称直接复用；否则为空并要求填写。
4. 访客填写 1–24 个 Unicode 字符的昵称和 1–1000 个 Unicode 字符的正文。
5. 隐藏蜜罐字段必须为空；非空时服务端直接拒绝。
6. 提交后在列表中插入明确标记为“发送中”的临时项，表单与快捷键同时锁定。
7. 服务端成功写入并返回正式评论后，用正式记录替换临时项，保存昵称并更新评论数。
8. 服务端错误时移除临时项、保留输入内容并展示错误，不自动重试。

### 4.4 再次进入与跨页面复用

- 同一浏览器复用匿名访客 ID 和昵称。
- feed 接口直接返回该访客的 `viewerReacted`，不依赖前端自行猜测历史点赞。
- 从 feed 打开详情时先复用条目内已有摘要，只请求评论正文，不让详情框架闪现或重建。
- 关闭弹层返回 feed 后，当前条目的新计数和点赞状态继续保留。
- 从搜索、归档或直接链接进入时，详情加载完成后走同一个互动组件与数据契约。

## 5. 数据模型

### 5.1 迁移版本

在 `src/journal-server/migrations.ts` 追加 version 20，只新建互动表和必要索引，不重建 `journal_entries`，不修改现有条目字段。

### 5.2 点赞表

```sql
CREATE TABLE journal_entry_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  client_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  UNIQUE (entry_id, client_hash)
);
```

设计说明：

- 第一版没有 `reaction_type`，一条记录即代表点赞。
- 唯一索引同时支持去重、查询某访客状态和按 `entry_id` 统计，不再重复创建同前缀索引。
- `client_hash` 使用现有 `JOURNAL_COOKIE_SECRET` 作为 HMAC key，不新增环境变量。

### 5.3 评论表

```sql
CREATE TABLE journal_entry_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  parent_id INTEGER,
  author_role TEXT NOT NULL
    CHECK (author_role IN ('visitor', 'owner')),
  author_name TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden')),
  client_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (id, entry_id),
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id, entry_id)
    REFERENCES journal_entry_comments(id, entry_id) ON DELETE CASCADE,
  CHECK (
    (author_role = 'visitor' AND parent_id IS NULL AND client_hash IS NOT NULL)
    OR
    (author_role = 'owner' AND parent_id IS NOT NULL AND client_hash IS NULL)
  )
);

CREATE INDEX idx_journal_entry_comments_public
ON journal_entry_comments(entry_id, status, created_at, id);

CREATE INDEX idx_journal_entry_comments_parent
ON journal_entry_comments(parent_id, created_at, id)
WHERE parent_id IS NOT NULL;
```

设计说明：

- 访客只创建顶层评论；`parent_id` 专用于博主回复，形成最多两层的讨论结构。
- 复合外键保证回复与父评论属于同一条目，删除顶层评论时其博主回复一并删除。
- 隐藏顶层评论时，公开查询同时排除它的回复；恢复顶层评论后，未被单独隐藏的回复重新出现。
- `content_markdown` 保存原始 Markdown，数据库不保存客户端提交的 HTML。
- `author_name` 保存发布当时的显示名；博主回复固定写入站点当前名称“小明同学”。

### 5.4 统计口径

- `reactionCount`：该代表条目的点赞行数。
- `commentCount`：当前公开可见的顶层评论和博主回复总数。
- 隐藏评论不计入公开计数；永久删除后自然减少。
- 私有管理接口也返回同一公开计数，同时额外返回隐藏评论供管理。
- 统计通过带索引的聚合查询实时计算，不在 `journal_entries` 维护冗余字段。

## 6. 共享协议与返回模型

### 6.1 条目互动摘要

在 `src/shared/journalProtocol.ts` 和 `web/src/types.ts` 增加：

```ts
interface JournalInteractionSummary {
  reactionCount: number;
  commentCount: number;
  viewerReacted: boolean;
}
```

`JournalEntry` 增加：

```ts
interactions: JournalInteractionSummary;
```

规则：

- 公开 feed 和公开详情根据可选访客 ID 计算 `viewerReacted`。
- 私有、internal 和没有访客 ID 的读取返回真实计数与 `viewerReacted: false`。
- 未解锁的 `ProtectedJournalEntryPreview` 不增加互动字段，避免在锁定卡片上出现不可操作入口。

### 6.2 评论返回模型

```ts
interface JournalPublicComment {
  id: number;
  parentId: number | null;
  authorName: string;
  authorRole: 'visitor' | 'owner';
  contentHtml: string;
  createdAt: string;
  updatedAt: string;
  replies: JournalPublicComment[];
}

interface JournalAdminComment extends JournalPublicComment {
  status: 'published' | 'hidden';
}
```

- 公开返回仅包含 `published` 内容。
- 管理返回包含全部状态。
- `client_hash` 永远不进入 API 响应。
- 顶层 `comments` 按创建时间升序，`replies` 同样升序，让讨论按自然阅读顺序展开。

### 6.3 Markdown 渲染边界

新增单一服务端函数负责 Markdown 转换和清洗，复用当前安装的 `marked` 与 `sanitize-html`：

- 允许：段落、换行、粗体、斜体、删除线、行内代码、代码块、引用、无序/有序列表、链接；
- 禁止：图片、标题、表格、原始 HTML 结构及任意内联样式；
- 链接只允许 `http`、`https`、`mailto`，并统一增加 `rel="noopener noreferrer"` 与 `target="_blank"`；
- 前端只对服务端返回的 `contentHtml` 使用 `v-html`，不渲染客户端本地生成的 HTML。

## 7. 公开 API 契约

所有互动响应设置 `Cache-Control: private, no-store`。涉及受保护条目时继续使用现有解锁 Cookie，并沿用当前的 404 隐藏语义。

### 7.1 读取评论与最新摘要

`GET /api/entries/:publicId/interactions`

可选请求头：

```text
X-Journal-Visitor-Id: 550e8400-e29b-41d4-a716-446655440000
```

响应：

```json
{
  "summary": {
    "reactionCount": 12,
    "commentCount": 3,
    "viewerReacted": true
  },
  "comments": [
    {
      "id": 101,
      "parentId": null,
      "authorName": "喵星探险家",
      "authorRole": "visitor",
      "contentHtml": "<p>这篇总结很有启发！</p>",
      "createdAt": "2026-08-29T10:35:00.000Z",
      "updatedAt": "2026-08-29T10:35:00.000Z",
      "replies": [
        {
          "id": 102,
          "parentId": 101,
          "authorName": "小明同学",
          "authorRole": "owner",
          "contentHtml": "<p>谢谢，会继续整理。</p>",
          "createdAt": "2026-08-29T11:10:00.000Z",
          "updatedAt": "2026-08-29T11:10:00.000Z",
          "replies": []
        }
      ]
    }
  ]
}
```

### 7.2 点赞

`PUT /api/entries/:publicId/reaction`

- 必须携带合法 `X-Journal-Visitor-Id`。
- 已点赞时重复调用仍返回已点赞，不增加计数。

响应：

```json
{
  "reactionCount": 13,
  "viewerReacted": true
}
```

### 7.3 取消点赞

`DELETE /api/entries/:publicId/reaction`

- 必须携带合法 `X-Journal-Visitor-Id`。
- 未点赞时重复调用仍返回未点赞，不产生错误。

响应：

```json
{
  "reactionCount": 12,
  "viewerReacted": false
}
```

### 7.4 提交访客评论

`POST /api/entries/:publicId/comments`

请求头必须包含访客 ID，请求体为：

```json
{
  "authorName": "喵星探险家",
  "content": "这篇总结很有启发！",
  "website": ""
}
```

响应状态为 201：

```json
{
  "comment": {
    "id": 103,
    "parentId": null,
    "authorName": "喵星探险家",
    "authorRole": "visitor",
    "contentHtml": "<p>这篇总结很有启发！</p>",
    "createdAt": "2026-08-29T12:00:00.000Z",
    "updatedAt": "2026-08-29T12:00:00.000Z",
    "replies": []
  },
  "summary": {
    "reactionCount": 12,
    "commentCount": 4,
    "viewerReacted": true
  }
}
```

### 7.5 输入错误语义

- 400：访客 UUID、昵称、正文、蜜罐字段或请求结构不合法；
- 404：条目不存在、未发布、私有，或受保护条目尚未授权；
- 429：当前匿名访客超过评论或互动频率；
- 500：数据库或 Telegram 评论通知等主路径操作失败。

错误继续使用项目现有 `{ "error": "..." }` 结构，不返回默认成功结果。

## 8. 私有与 internal API

### 8.1 私有 Web 管理

`GET /api/me/entries/:id/interactions`

- 返回公开互动摘要和所有 `published` / `hidden` 评论；
- 评论项增加 `status`；
- 仅用于私有详情打开后的局部加载，不并入整页初始化请求。

`POST /api/me/entries/:id/comments`

```json
{
  "parentId": 101,
  "content": "谢谢，会继续整理。"
}
```

- `parentId` 必须是该条目的顶层访客评论；
- 允许回复隐藏评论，但只有顶层评论恢复公开后，该回复才可能公开显示；
- 回复作者固定为 `owner`，不接收前端传入的作者身份。

`PATCH /api/me/comments/:commentId/status`

```json
{ "status": "hidden" }
```

- 只接受 `published` 或 `hidden`；
- 隐藏顶层评论时无需逐条改写回复，公开查询通过父评论状态决定整组可见性。

`DELETE /api/me/comments/:commentId`

- 永久删除；
- 删除顶层评论时数据库级联删除其博主回复；
- Web 端必须显示明确确认，不提供静默删除。

### 8.2 Telegram bot internal 操作

新增：

`PATCH /api/internal/comments/:commentId/status`

- 使用现有 ingest bearer token 和 `auth.requireInternal`；
- 只允许切换 `published` / `hidden`；
- 供 `src/journal-bot/registerBotHandlers.ts` 的回调按钮调用，不开放给浏览器。

callback data 使用短格式，确保始终远小于 Telegram 限制：

```text
jc:h:103
jc:p:103
```

其中 `h` 为隐藏，`p` 为恢复公开。

## 9. 后端职责拆分

### 9.1 新增文件

建议新增：

- `src/journal-server/interactionService.ts`：访问条件后的点赞、评论、状态变更和 Markdown 输出主路径；
- `src/journal-server/interactionIdentity.ts`：访客 UUID 校验与 HMAC；
- `src/journal-server/interactionNotification.ts`：新评论 Telegram 文本和按钮；
- `src/journal-server/routes/interactions.ts`：公开、私有和 internal 路由注册。

不再额外拆分 reaction/comment repository 类。SQLite 语句继续放入现有 `JournalRepository`，避免为两个小表引入新的数据访问体系。

### 9.2 Repository 方法

新增最小方法集合：

- `getInteractionSummary(entryId, clientHash?)`；
- `getPublicComments(entryId)`；
- `getAdminComments(entryId)`；
- `addReaction(entryId, clientHash, createdAt)`；
- `removeReaction(entryId, clientHash)`；
- `createVisitorComment(...)`；
- `createOwnerReply(...)`；
- `updateCommentStatus(commentId, status)`；
- `deleteComment(commentId)`；
- `getCommentContext(commentId)`，供状态变更和 Telegram 管理链接确认所属条目。

点赞创建使用 `INSERT ... ON CONFLICT(entry_id, client_hash) DO NOTHING`；取消点赞使用精确 `DELETE`。两者随后读取真实摘要并返回。

### 9.3 条目访问判断

互动路由先调用 `getPublishedAccessByPublicId`，判断顺序与现有公开详情一致：

1. 不存在或私有：404；
2. 公开：允许；
3. 受保护且管理员 Cookie 有效：允许；
4. 受保护且该条目解锁 Cookie 有效：允许；
5. 其他情况：404。

Service 只接收已经确认可操作的代表 `entry.id`，不在多个写方法中重复猜测访问状态。

### 9.4 基础反垃圾

- 请求头访客 UUID 使用 Zod UUID schema；
- 评论昵称与正文按 Unicode 字符数限制，不用 UTF-16 `length` 直接判断；
- `website` 蜜罐非空直接返回 400；
- 评论和 reaction 写接口使用当前 `@fastify/rate-limit` 的 route-level 配置，以访客 ID 作为 key；
- 建议评论限制为同一访客 10 分钟 3 条，reaction 写操作为每分钟 20 次；
- SQLite 唯一约束作为点赞重复写入的最终事实来源；
- 不增加验证码、封禁表、IP 名单或复杂风险分数。

访客 ID 可被主动更换，因此这是适合个人站点的基础限流，不应在文档或 UI 中宣称为强身份或强防刷能力。

## 10. Telegram 通知与管理

### 10.1 通知内容

新评论通知沿用 `JournalContributionNotificationService` 的轻量发送方式，但使用独立服务：

```text
💬 Journal 收到新评论

条目：构建自愈型微服务架构
访客：喵星探险家
内容：这篇总结很有启发！
时间：2026-08-29 20:00

[打开管理] [隐藏评论]
```

- 条目标题存在时使用标题；无标题记录使用正文的短摘要；
- 评论内容按纯文本截取，不开启 Telegram Markdown parse mode，避免访客内容影响消息格式；
- “打开管理”指向 `${publicBaseUrl}/me?entry=${entryId}#comments`；
- “隐藏评论”发送 `jc:h:<commentId>` 回调。

### 10.2 Bot 回调

在 `JournalApiClient` 增加 internal 评论状态方法，在 `registerJournalBotHandlers.ts` 增加单一 callback pattern：

1. 核对当前 chat 与 `allowedChatId`；
2. 调用 Journal internal API 隐藏或恢复评论；
3. 使用 callback answer 给出明确结果；
4. 编辑原通知的按钮为相反操作，复用原消息，不新增一条操作结果消息；
5. Journal API 失败时通过 alert 直接展示真实错误。

### 10.3 通知一致性边界

评论先写入 SQLite，再同步等待 Telegram 请求。Telegram 调用异常不被转换成成功结果，直接沿现有错误链返回。SQLite 与 Telegram 是两个独立系统，无法在不引入持久化通知状态和重试机制的前提下获得真正的跨系统事务；第一版明确接受这一边界，不引入 outbox、重试队列或备用通知通道。

## 11. 前端状态与组件

### 11.1 匿名身份工具

新增 `web/src/utils/journalVisitorIdentity.ts`：

- `getOrCreateJournalVisitorId()`：读取或创建 UUID；
- `getRememberedJournalVisitorName()`；
- `rememberJournalVisitorName(name)`；
- LocalStorage key 只在该文件定义，其他组件不得直接拼 key。

### 11.2 API 方法

在 `web/src/api.ts` 增加：

- `fetchEntryInteractions(publicId, visitorId?)`；
- `setEntryReaction(publicId, visitorId, reacted)`；
- `createEntryComment(publicId, visitorId, input)`；
- `fetchAdminEntryInteractions(entryId)`；
- `createOwnerCommentReply(entryId, input)`；
- `updateAdminCommentStatus(commentId, status)`；
- `deleteAdminComment(commentId)`。

公开 feed 与公开详情读取也携带可选访客 ID，使条目内的 `interactions.viewerReacted` 为服务端事实。

### 11.3 Composable

新增 `web/src/composables/useJournalInteractions.ts`，只负责当前条目的局部状态：

- 初始摘要来自 `entry.interactions`；
- 评论数组在详情互动区挂载时加载；
- 点赞、评论、回复、隐藏和删除分别只有一个进行中目标；
- 提供明确的 `loadingComments`、`reactionPending`、`submittingComment` 和 `mutatingCommentId`；
- 每次成功写入都以服务端响应替换本地摘要；
- 错误交给项目现有消息展示方式，不吞错、不自动重试。

不使用 `watch` 驱动请求，不使用 `requestAnimationFrame`。切换条目通过组件 `key=entry.publicId` 建立新的局部实例，避免旧评论串入新条目。

### 11.4 组件结构

```text
web/src/components/interaction/
├── EntryInteractionSummary.vue
├── JournalInteractions.vue
├── JournalReactionButton.vue
├── JournalCommentForm.vue
└── JournalCommentItem.vue
```

职责：

- `EntryInteractionSummary.vue`：卡片上的紧凑点赞与评论入口；点赞可直接操作，评论按钮打开当前详情。
- `JournalInteractions.vue`：详情中的完整互动区，组合点赞、表单和评论列表。
- `JournalReactionButton.vue`：统一卡片和详情尺寸，管理 `aria-pressed`、忙碌状态及计数。
- `JournalCommentForm.vue`：访客评论或博主回复两种模式，昵称记忆只存在访客模式。
- `JournalCommentItem.vue`：头像、作者徽标、时间、清洗后的正文、回复和私有管理操作。

## 12. 页面接入点

### 12.1 信息流卡片

修改：

- `web/src/components/journal/EntryCard.vue`；
- `web/src/components/article/ArticleCardContent.vue`；
- `PublicFeedResults.vue` 及其当前两类 feed 子组件的事件透传；
- `PublicFeedView.vue` 和 `useJournalApi.ts` 的摘要更新方法。

布局规则：

- 普通记录把互动摘要放入现有 `entry__meta-trailing`，位于时间之前；
- 文章卡片在标签之后增加轻量 footer；
- 私有信息流只显示计数，不允许博主以访客身份给自己点赞；
- 互动按钮属于 `button`，现有卡片点击过滤逻辑会阻止它触发整卡打开；
- 评论图标点击打开详情并定位互动区，点赞图标原地完成操作。

### 12.2 普通记录和搜索/归档弹层

`JournalDetailContent.vue` 是以下路径的共同内容层：

- 公开普通记录信息流弹层；
- 搜索与归档详情弹层；
- 私有管理详情弹层；
- 受保护条目解锁后的详情弹层。

因此完整互动区放在 `JournalDetailContent` 的正文、附件和标签之后。`mode="public"` 展示访客表单与公开评论；`mode="private"` 展示全部评论及管理操作。

摘要更新事件按以下路径向上传递：

```text
JournalInteractions
→ JournalDetailContent
→ JournalDetailLayout
→ JournalDetailOverlay
→ PublicFeedView / PublicDiscoveryDetailOverlay / PrivateAssetFeedView
```

公开 feed 最终更新 `useJournalApi` 中相同 `publicId` 的条目；私有 feed 更新对应 `id` 的条目。

### 12.3 文章独立阅读页

文章从信息流直接进入 `PublicEntryDetailView.vue`，不会经过 `JournalDetailContent`。因此在 `ArticleCardContent display="full"` 之后挂载同一个 `JournalInteractions`。

普通记录直接访问 `/p/:publicId` 时同样在 `EntryCard :linkable="false"` 之后挂载，保证直接链接与弹层路径一致。

受保护条目未解锁时不渲染互动区；解锁并获得完整 `JournalEntry` 后再挂载。

### 12.4 Telegram 管理定位

私有详情中给互动区根节点设置 `id="comments"`。通过 `/me?entry=:id#comments` 进入时：

- 复用现有私有 feed 与 overlay 打开逻辑；
- overlay 内容出现后由互动组件自身聚焦标题或滚动容器定位；
- 不启动新页面，不创建临时条目，不重载私有 feed。

## 13. 视觉与交互规范

### 13.1 信息层级

详情顺序固定为：

```text
正文 / 媒体
→ 标签
→ 点赞区
→ 评论标题与数量
→ 评论表单
→ 评论列表
```

- 点赞区是轻量横条，不再包一层突出的独立大卡片。
- 评论区以一条 `--border-subtle` 分隔线进入，避免在现有卡片内部堆叠多层卡片。
- 空评论状态只显示一句低对比度提示，不使用插画或大面积占位。

### 13.2 信息流卡片效果

互动摘要必须成为现有卡片元信息的一部分，而不是在每张卡片下新增一块独立面板。

普通记录卡片：

```text
┌──────────────────────────────────────────────┐
│                                              │
│              图片 / 视频 / 文字海报          │
│                                              │
├──────────────────────────────────────────────┤
│ 记录摘要……                                   │
│                                              │
│ 2026年08月29日         ♡ 12   ○ 3   20:35   │
└──────────────────────────────────────────────┘
```

文章卡片：

```text
┌──────────────────────────────────────────────┐
│ 2026 / 08 / 29                               │
│                                              │
│ 构建自愈型微服务架构                         │
│ 文章摘要内容……                               │
│                                              │
│ #架构  #随笔                                 │
│                              ♡ 12   ○ 3      │
└──────────────────────────────────────────────┘
```

具体视觉规则：

- 点赞与评论使用与现有线性图标一致的 SVG 图标，不用 emoji 作为正式 UI 图标。
- 未互动时使用 `--text-muted`，让它与日期、时间处于同一视觉层级。
- 已点赞时心形填充为 `--accent-strong`，数字同步变色，但不改变卡片背景。
- 数量为 0 时仍保留图标，数字可省略，避免卡片底部连续出现两个醒目的 `0`。
- 点赞按钮直接完成点赞；评论按钮只负责打开详情并定位评论区。
- 两个按钮的可点击范围不小于 40px，但视觉图标保持紧凑，不挤压日期和时间。
- 卡片 hover 仍由现有卡片样式负责，互动按钮 hover 只改变自身颜色，不再次抬升整张卡片。
- 受保护条目未解锁时不显示互动摘要；解锁后以完整条目卡片的正常样式出现。

### 13.3 详情互动区整体效果

详情中的互动区延续原方案“正文之后自然进入讨论”的结构，但不再额外堆叠一个与正文割裂的大卡片。

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                       正文 / 媒体内容                        │
│                                                             │
│  #架构  #随笔                                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ♥ 觉得不错  12                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  讨论  3                                                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 留下你的想法……                                       │  │
│  │                                                       │  │
│  │ 昵称  [ 喵星探险家 ]             [ 发送评论 ]         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ● 喵星探险家                                  2 小时前    │
│    这篇关于自动化架构的思考很有启发。                       │
│                                                             │
│      ● 小明同学  [作者]                         1 小时前    │
│        谢谢，会继续整理。                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

布局细节：

- 点赞区上下留白大于卡片摘要按钮，但小于正文段落间距，形成正文结束后的第一次轻停顿。
- 点赞按钮采用“图标 + 轻文案 + 数量”，详情中不能只剩一个难以理解的孤立心形。
- 评论标题使用正文小标题层级，数量使用次要色，不做醒目的数字徽章。
- 评论表单与列表之间保持明确间距；列表项之间使用留白区分，不给每条评论增加完整边框卡片。
- 博主回复相对顶层评论缩进，并使用一条短的 `--border-subtle` 引导线表达所属关系。
- 讨论区宽度跟随当前正文容器，不突破文章阅读宽度，也不另建居中窄列。

### 13.4 评论输入框的展开效果

评论框默认保持轻量：

```text
┌─────────────────────────────────────────────────────────────┐
│ 留下你的想法……                                             │
└─────────────────────────────────────────────────────────────┘
```

正文输入框获得焦点后，展开完整提交区：

```text
┌─────────────────────────────────────────────────────────────┐
│ 留下你的想法……                                             │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 昵称  [ 喵星探险家 ]   支持 Markdown       [ 发送评论 ]    │
└─────────────────────────────────────────────────────────────┘
```

- 默认态只显示一至两行正文输入高度，不预先展示一整块表单。
- 使用 `:focus-within` 和组件自身的明确编辑状态展开辅助区，不通过全局状态或页面重建实现。
- 展开过程使用 180ms 的透明度与轻微纵向位移动画；容器高度变化应自然，不出现内容先闪现再跳位。
- 已经输入正文、昵称缺失或提交失败时，即使焦点暂时离开也保持展开，避免用户输入区域突然收起。
- 昵称存在于 LocalStorage 时直接填入，但仍允许访客在本次提交前修改。
- Markdown 提示是低对比度辅助信息，可点击展开一个紧凑说明，不在表单中常驻完整语法表。
- 蜜罐字段不占据布局空间，不参与键盘 Tab 顺序，也不被辅助技术读作正常输入项。

### 13.5 点赞视觉与微动效

点赞保留原方案强调的“即点即亮”和轻微情绪反馈，但效果只围绕按钮本身发生，不制造覆盖正文的粒子动画。

状态序列：

```text
未点赞              请求中                 已点赞
♡ 觉得不错 12   →   ♥ 觉得不错 13   →     ♥ 觉得不错 13
次要色               目标色、按钮锁定         强调色、稳定状态
```

动效细节：

- 点击后心形立即从描边切为填充，整体从 `scale(1)` 放大到约 `scale(1.18)` 再回到 `scale(1)`。
- 心形背后使用一个 CSS 伪元素产生单次柔和光晕：从较小的 `--accent-soft` 圆形扩散并淡出。
- 光晕仅在访客从未点赞变为已点赞且服务端成功时完成；取消点赞只做轻微缩小，不播放庆祝效果。
- 请求期间按钮设置 `aria-busy="true"` 和 `disabled`，数量先显示目标值，但不能再次触发请求。
- 服务端返回后数字以最终值为准；若失败，心形和数字回到操作前状态，同时错误消息明确出现。
- 卡片版只播放心形缩放，不播放大范围光晕；详情版同时播放缩放和局部光晕。
- 所有效果由 CSS transition / keyframes 完成，不创建定时粒子节点，不使用 RAF。
- `prefers-reduced-motion: reduce` 下取消缩放、位移和光晕，只保留颜色与填充变化。

### 13.6 评论列表视觉与微动效

评论项结构：

```text
┌─────────────────────────────────────────────────────────────┐
│ [明]  喵星探险家                              2 小时前      │
│       这篇总结很有启发，尤其是状态恢复这一部分。            │
│                                                             │
│       ┃ [小]  小明同学  [作者]                 1 小时前     │
│       ┃      谢谢，会继续整理。                             │
└─────────────────────────────────────────────────────────────┘
```

- 新评论确认成功后，以 160ms 的淡入和最多 6px 的向上归位进入列表。
- 临时评论使用与正式评论相同的尺寸，右侧时间位置显示“发送中…”，避免确认后列表重新排版。
- 服务端成功时只替换临时评论内容，不让整段评论列表重新进入。
- 评论加载时互动区标题、表单和点赞区保持常驻，只在列表位置显示两条低对比度文本骨架。
- 空状态与首条评论使用相同内容区域高度变化，不让整个详情页先留大块空白再突然收缩。
- 博主回复不使用另一种强烈背景色，仅通过缩进、引导线和“作者”徽标建立层级。
- 私有模式下，管理操作在指针设备的 `hover` / `focus-within` 时出现；触摸设备直接显示紧凑操作按钮。
- 隐藏评论使用约 0.62 的内容透明度，并显示“已隐藏”状态；作者名和管理操作保持足够对比度。
- 永久删除确认在当前评论项内展开，不弹出新的全屏对话框，不移动到页面顶部。

### 13.7 头像与作者身份

- 访客头像为 32–36px 圆形，显示昵称首个可见字符。
- 头像颜色从一组预先定义的柔和浅色/深色组合中稳定选择；同一昵称得到一致结果。
- 不从邮箱生成 Gravatar，不发起外部头像请求。
- 博主头像优先复用站点当前 profile avatar；不可用时使用“小”字头像，不冒充加载成功的远程图片。
- “作者”徽标使用 `--accent-soft` 背景和 `--accent-strong` 文字，尺寸低于标签 badge，不抢正文标题层级。

### 13.8 桌面端与移动端呈现

桌面端：

- 普通记录详情弹层中，互动区位于 `JournalDetailContent` 的同一纵向滚动容器，不创建嵌套评论滚动区。
- 有媒体的双栏详情仍由右侧内容列滚动，评论会自然接在正文之后；媒体舞台不因评论加载而重新计算宽度。
- 文章独立阅读页中，互动区跟随文章卡片阅读宽度，顶部不新增悬浮工具栏。

移动端：

```text
┌───────────────────────────┐
│ 正文 / 媒体               │
│                           │
│ ♥ 觉得不错 12             │
├───────────────────────────┤
│ 讨论 3                    │
│ ┌───────────────────────┐ │
│ │ 留下你的想法……       │ │
│ │                       │ │
│ │ 昵称                  │ │
│ │ [喵星探险家]          │ │
│ │          [发送评论]   │ │
│ └───────────────────────┘ │
│                           │
│ 评论列表                  │
└───────────────────────────┘
```

- 昵称与发送按钮从桌面横排改为上下排列，发送按钮靠右，不挤压昵称输入。
- 点击目标不小于 44px；评论正文、链接和代码块不得造成页面横向滚动。
- 软键盘出现时不把发送按钮做成 fixed 元素；表单保持在正常文档流中，避免遮挡输入内容。
- 回复缩进缩小到 16–20px，不能因两层结构压缩正文到难以阅读。
- 安全区间距沿用现有详情页的 `env(safe-area-inset-*)` 处理，不单独建立另一套底部栏。

### 13.9 明暗主题效果

- 浅色主题中评论区继续使用白色卡面和纸张背景的现有对比关系。
- 深色主题不使用纯黑评论卡片；沿用 `--surface-card` 与 `--surface-muted`，分隔主要依靠 `--border-subtle`。
- 点赞光晕在深色主题降低不透明度，避免形成高亮红色光斑。
- 头像色板为明暗主题分别定义可读前景色，不通过 CSS filter 反转。
- Markdown 代码块使用 `--surface-muted`，链接与作者徽标沿用现有 accent token。

### 13.10 Token

- 背景：`var(--surface-card)`、`var(--surface-muted)`；
- 正文：`var(--text-primary)`；
- 次要信息：`var(--text-muted)`；
- 边框：`var(--border-subtle)`、`var(--border-strong)`；
- 激活与作者标识：`var(--accent)`、`var(--accent-strong)`、`var(--accent-soft)`；
- 键盘焦点：`var(--focus)`；
- 动效曲线：`var(--ease-card)`。

不引入原方案中当前不存在的 `--bg-card`、`--bg-input`、`--border-focus` 或 `--accent-primary`。

### 13.11 点赞反馈的可访问状态

- 未点赞：描边心形、次要文字色；
- 已点赞：实心心形、`--accent-strong`；
- 请求中：保持目标视觉，按钮不可再次点击并设置 `aria-busy="true"`；
- 成功：使用一次 CSS `scale` 回弹；
- 失败：恢复请求前状态并显示错误；
- `prefers-reduced-motion: reduce` 下关闭缩放动画；
- 不引入动画库，不使用 RAF。

### 13.12 评论项内容规范

- 头像使用昵称首字符；背景色从昵称稳定映射到一组预定义的柔和 token 组合，不生成任意高饱和 HSL；
- 博主回复显示“小明同学”和“作者”徽标；
- 时间沿用项目现有上海时区格式化方式；
- 正文保持可读行高，代码块允许横向滚动；
- 桌面端管理操作在 hover 或 focus-within 时出现，移动端始终可触达；
- 隐藏评论在私有模式降低透明度并明确标记“已隐藏”，不与公开评论混淆。

### 13.13 表单行为规范

- 正文为空时发送按钮不可用；
- `Cmd/Ctrl + Enter` 与点击发送进入同一个提交函数；
- Enter 本身保留换行；
- 发送期间昵称、正文和按钮全部锁定；
- 成功后清空正文但保留昵称；
- 失败后保留昵称与正文，便于用户自行处理；
- 蜜罐字段从视觉和辅助技术树中隐藏，但仍随表单提交。

## 14. 状态同步规则

### 14.1 单一事实来源

- 点赞最终状态与计数只采信 mutation 响应；
- 评论最终 ID、HTML、时间和计数只采信创建响应；
- feed 中的缓存条目通过 `publicId` 替换 `interactions`，不重新请求整个 feed；
- 私有缓存条目通过内部 `id` 替换摘要；
- 评论列表只归当前 `JournalInteractions` 实例所有，不放进全局 store。

### 14.2 连续操作

- 点赞请求进行中时不可再次点击，因此不会出现乱序 toggle；
- 评论发送中不可再次提交，因此不会由一次用户动作产生两条本地临时评论；
- 隐藏、恢复或删除某评论时只锁定该评论，其他评论仍可阅读；
- 删除顶层评论成功后，本地同时移除整组回复，并使用服务端摘要更新计数；
- 关闭后重新打开详情，框架沿用 feed 摘要，评论列表重新读取当前公开状态。

## 15. 实施顺序与文件范围

### 阶段一：协议、迁移和数据主路径

1. 在共享协议中增加互动摘要、评论、公开/私有请求与响应 schema。
2. 追加 migration 20，创建两张表和索引。
3. 在 `JournalRepository` 增加实时摘要、评论读取和写入方法。
4. 增加匿名访客 HMAC 与评论 Markdown 渲染函数。
5. 让所有 `JournalEntry` 映射都带有互动摘要；公开 feed/详情额外接收访客 hash 计算 `viewerReacted`。

### 阶段二：公开、私有与 bot 接口

1. 增加 `interactionService.ts` 与 `routes/interactions.ts`。
2. 在 `server.ts` 实例化依赖并注册互动路由。
3. 给公开写接口配置 route-level 限流。
4. 增加评论 Telegram notification service。
5. 扩展 `JournalApiClient` 和 bot callback handler，实现隐藏/恢复并编辑原通知按钮。

### 阶段三：前端身份、API 与通用组件

1. 增加访客 ID / 昵称持久化工具。
2. 扩展 `web/src/types.ts` 与 `web/src/api.ts`。
3. 增加 `useJournalInteractions.ts`。
4. 完成五个 interaction 组件及浅色、深色、窄屏样式。

### 阶段四：接入现有页面与状态复用

1. 接入普通记录与文章信息流卡片摘要。
2. 接入 `JournalDetailContent`，覆盖公开弹层、搜索/归档弹层与私有弹层。
3. 接入 `PublicEntryDetailView`，覆盖文章和普通记录直接链接。
4. 串联摘要更新事件，使关闭详情后 feed 保留最新状态。
5. 接入私有回复、隐藏、恢复、删除和 `#comments` 定位。

## 16. 完成标准

### 16.1 访客侧

- 首次访客无需注册即可点赞和评论，刷新后昵称与点赞身份仍可复用。
- 重复点赞不会增加计数；取消点赞后计数与图标一致。
- 卡片、普通记录弹层、文章直接阅读页、搜索/归档弹层展示同一份最终计数。
- 公开条目可互动；未解锁的受保护条目和私有/草稿条目不可通过公开接口读取或写入互动。
- 评论 Markdown 只显示允许的格式，访客 HTML、脚本、图片和危险链接不进入最终 DOM。
- 评论失败不会被展示为已发布，用户输入不会被清空。

### 16.2 博主侧

- 私有详情可看到公开和隐藏评论，并能回复、隐藏、恢复和永久删除。
- 删除顶层评论后其作者回复一并消失。
- 新评论产生一条 Telegram 通知；按钮可打开对应私有详情并定位评论区。
- Telegram 隐藏/恢复操作编辑原通知按钮，不额外制造操作消息。
- 点赞不会逐条推送 Telegram。

### 16.3 数据侧

- 匿名访客原始 UUID、IP、User-Agent、邮箱和网址均不写入互动表。
- `client_hash` 不通过任何公开或私有 API 返回。
- 条目删除后无孤立互动数据；回复不能跨条目引用父评论。
- 评论可见性和公开计数来自同一组查询条件，不出现隐藏评论仍计数的状态分裂。

## 17. 最终开发范围清单

预计直接修改：

- `src/shared/journalProtocol.ts`
- `src/journal-server/migrations.ts`
- `src/journal-server/repository.ts`
- `src/journal-server/server.ts`
- `src/journal-server/routes/publicFeed.ts`
- `src/journal-bot/client.ts`
- `src/journal-bot/registerBotHandlers.ts`
- `web/src/types.ts`
- `web/src/api.ts`
- `web/src/composables/useJournalApi.ts`
- `web/src/components/journal/EntryCard.vue`
- `web/src/components/article/ArticleCardContent.vue`
- `web/src/components/journal/JournalDetailContent.vue`
- `web/src/components/journal/JournalDetailLayout.vue`
- `web/src/components/journal/JournalDetailOverlay.vue`
- `web/src/components/journal/public-detail/PublicEntryDetailView.vue`
- 当前 public/private feed 的必要事件透传文件

预计新增：

- `src/journal-server/interactionIdentity.ts`
- `src/journal-server/interactionService.ts`
- `src/journal-server/interactionNotification.ts`
- `src/journal-server/routes/interactions.ts`
- `web/src/utils/journalVisitorIdentity.ts`
- `web/src/composables/useJournalInteractions.ts`
- `web/src/components/interaction/EntryInteractionSummary.vue`
- `web/src/components/interaction/JournalInteractions.vue`
- `web/src/components/interaction/JournalReactionButton.vue`
- `web/src/components/interaction/JournalCommentForm.vue`
- `web/src/components/interaction/JournalCommentItem.vue`

不修改 `src/reminders/recurring.ts`，不增加新 npm 依赖，不新增独立管理路由、队列、验证码、邮件服务或数据冗余计数。
