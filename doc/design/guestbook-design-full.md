# 访客留言板（Guestbook）完整开发设计

> 文档状态：可执行开发方案  
> 目标路由：/guestbook  
> 适用范围：NotiNewsForXiaoming 当前 Journal 前后端与 Telegram Bot  
> 原始输入：doc/design/guestbook-design.md  
> 本文用途：作为本功能实现时的唯一设计基线；原始文档保留，不在本次完善中修改。

## 1. 审阅结论

原始方案已经明确了独立留言板的产品定位、核心页面、公开留言、博主回复、管理操作和 Telegram 通知，但还不能直接据此编码。主要原因不是功能缺失，而是若干关键设计没有与当前仓库的真实结构对应，部分需求也没有在数据、接口和前端状态中形成闭环。

### 1.1 已核对的当前实现事实

| 领域 | 当前事实 | 直接依据 |
| --- | --- | --- |
| 前端框架 | Vue 3.5.41、Pinia 4.0.3、Vue Router 5.2.0，采用 Composition API 与 script setup | package.json、pnpm-lock.yaml、web/src/main.ts |
| 路由结构 | 页面除了注册 Vue Router 路由，还必须进入 AppRoute 联合类型、parseAppRoute 和 publicShellActive | web/src/router.ts、web/src/app/appRouteTypes.ts、web/src/app/appRoute.ts、web/src/composables/useAppRoute.ts |
| 页面壳层 | 公开页面由 App.vue 统一渲染顶栏、左侧/底部导航和 AppRouteViewport | web/src/App.vue、web/src/components/app/AppRouteViewport.vue |
| 导航结构 | 桌面端“照片墙、游戏墙”位于频道区；移动端聚合在“更多”弹层 | web/src/components/journal/PublicChannelNavigation.vue |
| 数据迁移 | Journal SQLite 使用顺序 migration，当前最高版本为 21 | src/journal-server/migrations.ts |
| API 命名 | 公开接口位于 /api/...，站长接口位于 /api/me/...，Bot 内部接口位于 /api/internal/... | src/journal-server/routes/ |
| 管理鉴权 | 站长页面使用 JournalAuth.requireAdmin；Bot 到 Journal 使用 requireInternal | src/journal-server/auth.ts |
| Markdown | 已安装并实际使用 marked 18.0.10 与 sanitize-html 2.17.7 | src/journal-server/interactionService.ts、本地依赖声明 |
| 频率限制 | 已注册 @fastify/rate-limit 11.2.0，global 为 false，现有评论使用路由级 config.rateLimit | src/journal-server/server.ts、src/journal-server/routes/interactions.ts、本地依赖公开接口 |
| 访客身份 | 浏览器已有匿名 UUID 与昵称记忆逻辑，请求通过 X-Journal-Visitor-Id 传递 | web/src/utils/journalVisitorIdentity.ts、web/src/api.ts |
| 评论交互 | 已有蜜罐、Markdown 清洗、昵称/正文限制、公开回复、隐藏、删除及本地列表更新模式 | src/shared/journalProtocol.ts、src/journal-server/interactionService.ts、web/src/components/interaction/ |
| Telegram 通知 | Journal 服务直接发通知；bwgdc01 上的 Bot 通过内部 API 执行 Inline 回调 | src/journal-server/interactionNotification.ts、src/journal-bot/client.ts、src/journal-bot/registerBotHandlers.ts |

### 1.2 对原始方案的关键修订

| 原始方案问题 | 完整方案决定 | 原因 |
| --- | --- | --- |
| 使用 /api/public 和 /api/private | 改为 /api/guestbook、/api/me/guestbook 和 /api/internal/guestbook | 与仓库现有接口边界一致 |
| 需求包含“置顶”，表结构和 API 未承接 | 数据表增加 pinned；增加站长置顶接口和前端排序更新 | 让需求、数据、接口和 UI 闭环 |
| 只写“新增路由” | 补齐 router、AppRoute、parseAppRoute、publicShellActive、App 导航激活态 | 当前应用存在自定义路由解释层 |
| Telegram 只描述发送按钮 | 补齐 Journal 内部接口、Bot API Client、回调正则、授权和按钮状态更新 | Inline 回调实际运行在另一台服务器上的 Bot 进程 |
| 规划独立 Markdown 预览 | 首版仅保留 Markdown 格式提示，不实现实时预览 | 预览不是核心需求，且会扩大前端状态和安全边界 |
| 保存 client_hash，但没有当前消费者 | 不在留言表持久化 client_hash；仅用现有匿名 UUID 作为内存限流键 | 留言没有“当前访客是否操作过”的读回需求，避免无用途字段 |
| 未定义回复层级 | 只允许“顶层访客留言 → 一层博主回复”，允许同一留言有多条博主回复 | 满足公开回复，不引入访客对话树 |
| 未定义隐藏父留言后的回复行为 | 隐藏顶层留言时整组不公开；恢复后仅重新显示本身为 published 的回复 | 与现有评论主路径一致，状态含义明确 |
| 未定义删除范围 | 删除顶层留言级联删除回复；删除回复只删除该回复 | 对应外键语义和管理直觉 |
| 未定义加载与缓存 | 页面框架常驻，列表局部加载；Pinia 按 public/admin 作用域复用已加载数据 | 避免整页闪现和重复请求 |
| 未定义分页 | 首版一次读取全部留言，不增加分页、游标或虚拟列表 | 个人留言板当前没有大数据量证据，保持最短主路径 |

## 2. 产品目标与范围

### 2.1 核心目标

在现有 Journal 公开站点中增加一个独立留言板，让访客无需登录即可留下公开留言，让已登录的博主在同一页面回复和管理，并在收到新留言时通过现有 Telegram Bot 立即获知并可快捷隐藏。

### 2.2 本次必须实现

1. 公开路由 /guestbook 和桌面、移动导航入口。
2. 访客昵称与留言正文提交。
3. 蜜罐字段与路由级轻量频率限制。
4. 安全的 Markdown 服务端渲染。
5. 顶层留言按“置顶优先、时间倒序”展示。
6. 博主回复按时间正序嵌套展示。
7. 登录态下的回复、置顶/取消置顶、隐藏/恢复、永久删除。
8. 新留言 Telegram 通知。
9. Telegram 中打开留言板、隐藏/恢复留言组。
10. 页面局部加载、已加载状态复用和操作后的本地即时更新。
11. 浅色、深色和移动端布局。

### 2.3 明确不做

- 不建立访客账户、登录或个人主页。
- 不允许访客编辑、删除、回复其他留言。
- 不实现多层对话树。
- 不实现 Markdown 实时预览或所见即所得编辑器。
- 不实现图片、附件、表情上传。
- 不引入验证码、第三方反垃圾服务或 IP 持久化。
- 不实现搜索、分页、筛选、批量管理。
- 不实现通知队列、自动重试、备用通知渠道或静默降级。
- 不新增环境变量。
- 不改造现有 Journal 评论表，也不把留言伪装成某一篇文章的评论。
- 不在本设计阶段进入提交、发布或部署。

## 3. 业务规则

### 3.1 角色和层级

- visitor：只能由公开 POST 接口创建，必须是顶层记录，parent_id 为 NULL。
- owner：只能由站长鉴权接口创建，必须回复一条顶层 visitor 记录。
- 回复层级固定为一层；owner 不能回复 owner，visitor 不能创建回复。
- 同一顶层留言允许存在多条 owner 回复，以支持博主后续补充。
- 博主展示名固定复用站点当前名称“小明同学”，不新增配置项。

### 3.2 内容限制

- 昵称：trim 后不能为空，最多 24 个 Unicode 字符。
- 访客正文：trim 后不能为空，最多 1000 个 Unicode 字符。
- 博主回复：trim 后不能为空，最多 1000 个 Unicode 字符。
- 长度以 Array.from(value).length 的字符口径计算，与现有评论一致。
- website 蜜罐字段必须严格等于空字符串。
- 数据库存储原始 Markdown；接口只返回服务端清洗后的 contentHtml。

### 3.3 状态

- published：可公开展示。
- hidden：仅博主列表可见。
- 顶层留言隐藏时，公开接口不返回该留言及其全部回复。
- 顶层留言恢复时，只返回状态为 published 的回复。
- 单独隐藏某条博主回复，不影响顶层留言和其他回复。
- 隐藏不改变 pinned；恢复后仍按原置顶状态排序。

### 3.4 置顶

- 只有顶层 visitor 留言可以置顶。
- owner 回复的 pinned 永远为 0。
- 公开与管理列表都按以下规则排列：
  1. pinned 为 true 的顶层留言在前；
  2. 同一置顶组内 created_at 倒序；
  3. 时间相同按 id 倒序。
- 回复始终按 created_at 正序、id 正序。

### 3.5 数量口径

- 页面“留言数量”只统计顶层 visitor 留言，不把博主回复计入。
- 公开模式统计 published 顶层留言。
- 管理模式显示全部顶层留言数量，并额外显示 hidden 顶层留言数量。

### 3.6 删除

- 删除顶层留言时，SQLite 外键级联删除其所有博主回复。
- 删除博主回复时，只删除该回复。
- 删除是永久操作，页面必须先出现行内二次确认。
- 不增加软删除、回收站或恢复机制。

## 4. 用户界面与完整交互

### 4.1 页面结构

页面使用现有公开壳层和 --reading-width，不创建新的应用入口。

~~~text
App
├── AppHeader（沿用）
├── PublicChannelNavigation（新增留言板入口）
└── AppRouteViewport（沿用通用 RouterView 分支）
    └── GuestbookView
        ├── GuestbookHeader
        ├── JournalCommentForm（visitor 模式，复用并增加 guestbook 文案上下文）
        └── GuestbookList
            └── GuestbookItem × N
                ├── 顶层访客留言
                ├── 博主回复列表
                └── JournalCommentForm（owner 模式，管理态按需出现）
~~~

### 4.2 页面头部

- 眉题：GUESTBOOK
- 主标题：留言板
- 引导文案：来都来了，留句话吧。问候、想法或问题，我都会认真看。
- 右侧或标题下方显示数量：
  - 公开模式：N 条留言
  - 管理模式：N 条留言 · M 条已隐藏
- 列表尚未完成首次读取时显示“— 条留言”，不能先用 0 假装已经得到空结果。
- 头部不依赖列表请求才能出现，进入页面时立即保持稳定布局。

### 4.3 访客表单

公开模式显示表单；管理模式不显示访客表单，避免博主以 visitor 身份误发留言。

表单区域进入页面时保留稳定空间；在首次列表读取完成前保持禁用。这样既不会让页面结构跳动，也不会发生“提交成功后又被较晚返回的初始列表覆盖”的并发状态。相同作用域已有缓存时，表单可立即使用。

默认态：

- 显示紧凑正文输入区。
- 占位文案为“写下你想对小明说的话……”。
- 昵称、Markdown 提示和提交按钮暂不展开。

展开条件：

- 表单内获得焦点；
- 正文已有内容；
- 当前提交发生错误，且草稿仍存在。

展开后：

- 显示昵称输入框。
- 显示“支持 Markdown”提示开关。
- 显示“发送留言”按钮。
- 支持 Ctrl + Enter 和 Cmd + Enter。
- nickname 使用 autocomplete=name。
- website 蜜罐不可聚焦、不可见，但正常进入请求体。

提交主路径：

1. 前端确认昵称与正文非空，按钮进入忙碌态。
2. 使用现有 getOrCreateJournalVisitorId 获取匿名 UUID。
3. UUID 不可用时直接显示现有“浏览器匿名身份不可用”错误，不发起请求。
4. POST /api/guestbook，并传 X-Journal-Visitor-Id。
5. 服务端完成校验、写入和 Telegram 通知后返回创建结果。
6. Store 将返回的留言插入置顶组之后、普通留言最前方。
7. 清空正文；成功请求中的 website 已经严格为空；保留并记住昵称。
8. 显示“留言已发送”即时反馈。

提交失败：

- 不清空昵称或正文。
- 不创建乐观成功记录。
- 直接显示服务端错误。
- 不自动重试，不切换其他发送通道。

### 4.4 列表局部加载

- 页面头部和表单先渲染，只有列表区域显示骨架。
- 首次成功读取后，Store 保存当前作用域的数据。
- 再次进入相同 public/admin 作用域时直接复用列表，不让页面重新闪现。
- public 与 admin 数据不能混用；作用域变化时读取对应接口。
- 加载失败时，列表区域显示真实错误，页面框架保持不变。
- 空列表显示：“这里还很安静，来留下第一句话吧。”

### 4.5 留言卡片

顶层卡片包含：

- 基于昵称生成的圆形头像：首个 Unicode 字符 + 六组固定色板。
- 昵称。
- createdAt 格式化时间，复用 formatEntryTime。
- 置顶徽章。
- 已隐藏徽章，仅管理模式。
- 安全清洗后的 Markdown 内容。
- 管理操作，仅管理模式。
- 博主回复区。

头像规则直接复用 JournalCommentItem 当前的字符求和取模算法和六组浅/深色色板，不引入头像服务或新依赖。

Markdown 内容样式：

- p、br、strong、em、del、s。
- 行内 code 与 pre 代码块。
- blockquote。
- ul、ol、li。
- a 链接使用强调色，打开新窗口。
- 长链接和代码块不能撑破卡片。

### 4.6 博主回复

- 每条顶层留言提供“回复”按钮。
- 同一时间页面只展开一个回复表单。
- 回复表单显示“回复 {昵称}”。
- 取消后关闭表单，不修改留言数据。
- 发送成功后，把返回回复追加到该留言 replies 尾部。
- 回复使用博主头像；站点资料尚未出现时显示固定文字头像，不创建额外加载链路。
- 回复显示“博主”徽章和时间。

### 4.7 管理操作

顶层留言操作：

- 回复
- 置顶 / 取消置顶
- 隐藏 / 恢复
- 删除

博主回复操作：

- 隐藏 / 恢复
- 删除

交互规则：

- 桌面端操作在 hover 或 focus-within 时出现。
- 触摸设备始终显示操作。
- 任一管理变更请求期间暂时禁用全部管理操作，并在发起操作的记录上显示忙碌态，避免删除父留言与修改子回复并发发生。
- 置顶成功后立即按统一比较器重新排序。
- 隐藏成功后管理列表保留该记录并显示“已隐藏”。
- 删除顶层留言的确认文案为“永久删除这条留言及其全部回复？”
- 删除回复的确认文案为“永久删除这条回复？”
- 所有失败直接显示错误，当前列表和草稿保持原状态。

### 4.8 导航

桌面端：

- 在 PublicChannelNavigation 的“游戏墙”之后增加“留言板”。
- 图标使用独立 GuestbookNavigationIcon，采用纸张/对话气泡轮廓。
- 当前路由为 guestbook 时显示激活态。

移动端：

- 底部栏仍只显示三个基础频道和“更多”。
- “更多”弹层内排列顺序为：照片墙、游戏墙、留言板、AI 助手、关于我。
- 留言板卡片文案：
  - 标题：留言板
  - 描述：与博主打个招呼
- guestbook 激活时，“更多”入口和留言板卡片同时显示激活态。

### 4.9 响应式与可访问性

- 页面宽度：min(100% - 2 × --page-gutter, --reading-width)。
- 桌面上下留白使用 clamp；移动端缩小留白，并为底部导航保留安全区域。
- 表单、卡片和回复区全部使用现有 surface、text、border、accent、danger 变量。
- 所有按钮具有明确文本或 aria-label。
- 时间元素带 datetime。
- 忙碌区域使用 aria-busy。
- 列表状态反馈使用 aria-live=polite。
- 删除确认使用 role=alert。
- 状态不能只靠颜色区分，必须同时有文字。
- 动效只使用 CSS transition/Transition，并遵守 prefers-reduced-motion。

## 5. 总体技术结构

~~~text
访客浏览器
  ├── GET /api/guestbook
  └── POST /api/guestbook
          │
          ▼
Journal Server（rndc02）
  Guestbook Route
      → Guestbook Service
          → Guestbook Repository → journal.sqlite
          → Guestbook Notification → Telegram API
                                          │
                                          ▼
                                博主 Telegram 消息
                                  ├── 打开 /guestbook
                                  └── jg:h:{id}
                                          │
                                          ▼
Bot（bwgdc01）
  registerJournalBotHandlers
      → JournalApiClient
          → PATCH /api/internal/guestbook/{id}/status
              → Journal Server
~~~

职责边界：

- Route：鉴权、参数与请求体解析、HTTP 状态和缓存头。
- Service：角色/层级规则、Markdown 转换、业务错误、通知编排。
- Repository：SQL、行映射、排序、CRUD。
- Notification：生成 Telegram 纯文本和 Inline Keyboard。
- Shared protocol：Zod 请求/响应 Schema 与前后端共享类型。
- Pinia Store：列表缓存、请求状态和成功后的不可变本地更新。
- Vue 组件：呈现和显式 props down / events up。

## 6. SQLite 数据设计

### 6.1 Migration

在 src/journal-server/migrations.ts 新增 version 22：

~~~sql
CREATE TABLE journal_guestbook_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER,
  author_role TEXT NOT NULL
    CHECK (author_role IN ('visitor', 'owner')),
  author_name TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden')),
  pinned INTEGER NOT NULL DEFAULT 0
    CHECK (pinned IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_id)
    REFERENCES journal_guestbook_messages(id) ON DELETE CASCADE,
  CHECK (
    (
      author_role = 'visitor'
      AND parent_id IS NULL
    )
    OR
    (
      author_role = 'owner'
      AND parent_id IS NOT NULL
      AND pinned = 0
    )
  )
);

CREATE INDEX idx_journal_guestbook_public
ON journal_guestbook_messages(
  status,
  pinned DESC,
  created_at DESC,
  id DESC
)
WHERE parent_id IS NULL;

CREATE INDEX idx_journal_guestbook_parent
ON journal_guestbook_messages(
  parent_id,
  status,
  created_at ASC,
  id ASC
)
WHERE parent_id IS NOT NULL;
~~~

### 6.2 为什么使用单表

- 当前只有两种记录和固定一层父子关系。
- 删除顶层留言时可直接依赖 ON DELETE CASCADE。
- 与现有 journal_entry_comments 的成熟结构相近，Repository 和 Service 更容易保持一致。
- 不需要为只有博主回复的简单关系引入第二张表或通用树模型。

### 6.3 数据库约束与服务约束

数据库直接保证：

- author_role 只能是 visitor 或 owner。
- visitor 必须是顶层。
- owner 必须有 parent_id 且不能置顶。
- status 和 pinned 值域有效。
- 删除父记录时级联删除回复。

Service 继续保证数据库无法用 CHECK 表达的跨行规则：

- owner 的 parent_id 必须指向存在的顶层 visitor。
- 置顶目标必须是顶层 visitor。
- published 或 hidden 的顶层留言都允许博主回复；hidden 父留言下的新回复只在管理列表出现，待父留言恢复后再按回复自身状态决定是否公开。

### 6.4 不保存 client_hash

匿名 UUID 的当前作用只是公开提交的路由级限流键。留言展示、回复、置顶、隐藏和删除都不需要按访客身份读回状态，因此不把 UUID 或 HMAC 写入 SQLite，也不返回给前端或 Telegram。

这项决定不影响蜜罐和频率限制，同时避免为不存在的管理需求保存匿名来源标识。

## 7. 共享协议设计

新增 src/shared/guestbookProtocol.ts，集中定义所有请求、响应和状态类型。前端 API、Journal Route、Journal Service、Bot API Client 都从这里引用，不在 web/src/types.ts 再复制一套。

### 7.1 展示结构

~~~ts
type GuestbookStatus = 'published' | 'hidden'

interface GuestbookPublicReply {
  id: number
  parentId: number
  authorRole: 'owner'
  authorName: string
  contentHtml: string
  createdAt: string
  updatedAt: string
}

interface GuestbookPublicMessage {
  id: number
  authorRole: 'visitor'
  authorName: string
  contentHtml: string
  pinned: boolean
  createdAt: string
  updatedAt: string
  replies: GuestbookPublicReply[]
}

interface GuestbookAdminReply extends GuestbookPublicReply {
  status: GuestbookStatus
}

interface GuestbookAdminMessage
  extends Omit<GuestbookPublicMessage, 'replies'> {
  status: GuestbookStatus
  replies: GuestbookAdminReply[]
}
~~~

公开接口不返回 status，因为被返回的记录必然是 published。管理接口返回 status，用于显示与操作隐藏记录。

### 7.2 请求 Schema

~~~ts
guestbookVisitorCreateRequestSchema = {
  authorName: string.trim，1..24 Unicode 字符
  content: string.trim，1..1000 Unicode 字符
  website: string 且必须等于空字符串
}

guestbookOwnerReplyRequestSchema = {
  content: string.trim，1..1000 Unicode 字符
}

guestbookStatusRequestSchema = {
  status: 'published' | 'hidden'
}

guestbookPinnedRequestSchema = {
  pinned: boolean
}
~~~

### 7.3 响应 Schema

~~~ts
GuestbookPublicListResponse {
  messages: GuestbookPublicMessage[]
}

GuestbookAdminListResponse {
  messages: GuestbookAdminMessage[]
}

GuestbookVisitorCreateResponse {
  message: GuestbookPublicMessage
}

GuestbookOwnerReplyResponse {
  parentId: number
  reply: GuestbookAdminReply
}

GuestbookStatusMutationResponse {
  id: number
  status: GuestbookStatus
  updatedAt: string
}

GuestbookPinnedMutationResponse {
  id: number
  pinned: boolean
  updatedAt: string
}

GuestbookDeletionResponse {
  id: number
}
~~~

## 8. HTTP API 设计

### 8.1 接口总表

| 方法 | 路径 | 权限 | 用途 |
| --- | --- | --- | --- |
| GET | /api/guestbook | 公开 | 获取 published 顶层留言和 published 博主回复 |
| POST | /api/guestbook | 公开 + 匿名 UUID | 创建顶层访客留言 |
| GET | /api/me/guestbook | 博主 | 获取全部留言与回复 |
| POST | /api/me/guestbook/:id/replies | 博主 | 回复指定顶层访客留言 |
| PATCH | /api/me/guestbook/:id/status | 博主 | 隐藏或恢复留言/回复 |
| PATCH | /api/me/guestbook/:id/pinned | 博主 | 置顶或取消置顶顶层留言 |
| DELETE | /api/me/guestbook/:id | 博主 | 永久删除留言或回复 |
| PATCH | /api/internal/guestbook/:id/status | Bot 内部 | Telegram 隐藏或恢复留言组 |

### 8.2 GET /api/guestbook

返回：

~~~json
{
  "messages": [
    {
      "id": 12,
      "authorRole": "visitor",
      "authorName": "路过的读者",
      "contentHtml": "<p>很喜欢你的文章。</p>",
      "pinned": true,
      "createdAt": "2026-09-04T13:30:00.000Z",
      "updatedAt": "2026-09-04T13:30:00.000Z",
      "replies": [
        {
          "id": 13,
          "parentId": 12,
          "authorRole": "owner",
          "authorName": "小明同学",
          "contentHtml": "<p>谢谢你来。</p>",
          "createdAt": "2026-09-04T14:00:00.000Z",
          "updatedAt": "2026-09-04T14:00:00.000Z"
        }
      ]
    }
  ]
}
~~~

响应头：

- Cache-Control: no-cache

### 8.3 POST /api/guestbook

请求头：

- Content-Type: application/json
- X-Journal-Visitor-Id: 有效 UUID

请求体：

~~~json
{
  "authorName": "路过的读者",
  "content": "很喜欢你的 **文章**。",
  "website": ""
}
~~~

处理顺序：

1. 路由级 rateLimit 先计数。
2. 校验 X-Journal-Visitor-Id。
3. 用共享 Zod Schema 校验请求体和蜜罐。
4. Service 创建 published、非置顶的 visitor 记录。
5. Service 读取新记录并渲染安全 HTML。
6. await Telegram 通知。
7. 返回 201 和 GuestbookVisitorCreateResponse。

响应头：

- Cache-Control: private, no-store

限流配置与现有评论保持一致：

~~~ts
{
  max: 3,
  timeWindow: '10 minutes',
  keyGenerator: request => X-Journal-Visitor-Id 或空字符串,
  errorResponseBuilder: () => ({
    error: '留言发送太频繁，请稍后再试。'
  })
}
~~~

不使用 IP 作为主键，因为当前 Fastify 没有启用 trustProxy，服务又位于 OpenResty 之后；直接改用 request.ip 会把反向代理地址当作访客地址。

### 8.4 GET /api/me/guestbook

- preHandler 使用 auth.requireAdmin。
- 返回全部顶层留言和全部回复，包括 hidden。
- 排序与公开列表一致。
- Cache-Control: private, no-store。

### 8.5 POST /api/me/guestbook/:id/replies

- id 必须是正整数。
- 父记录不存在时返回 404。
- 父记录不是顶层 visitor 时返回 400。
- 创建 author_role=owner、pinned=0、status=published。
- 返回 201 和 GuestbookOwnerReplyResponse。

### 8.6 PATCH /api/me/guestbook/:id/status

- 可作用于顶层留言或博主回复。
- 目标不存在返回 404。
- 更新 status 和 updated_at。
- 顶层留言只更新自身；回复的公开可见性由列表查询规则决定。

### 8.7 PATCH /api/me/guestbook/:id/pinned

- 只允许顶层 visitor。
- 目标不存在返回 404。
- 目标是回复时返回 400。
- 更新 pinned 和 updated_at。

### 8.8 DELETE /api/me/guestbook/:id

- 目标不存在返回 404。
- 删除顶层留言时依赖外键级联删除回复。
- 成功返回 GuestbookDeletionResponse。

### 8.9 PATCH /api/internal/guestbook/:id/status

- preHandler 使用 auth.requireInternal。
- 请求和响应复用 guestbookStatusRequestSchema 与 guestbookStatusMutationResponseSchema。
- 只供 Telegram Bot 回调使用。
- Bot 的“隐藏留言”只针对通知对应的顶层留言，因此公开效果是隐藏整组。

### 8.10 HTTP 错误口径

| 状态 | 情况 | 对外错误 |
| --- | --- | --- |
| 400 | 匿名 UUID 缺失或非法 | 需要有效的访客标识。 |
| 400 | 昵称、正文、蜜罐非法 | 使用共享 Schema 的具体错误 |
| 400 | 回复目标不是顶层访客留言 | 只能回复顶层访客留言。 |
| 400 | 对回复执行置顶 | 只能置顶访客留言。 |
| 401 | 站长或内部鉴权失败 | 沿用 JournalAuth 现有错误 |
| 404 | 留言或回复不存在 | 留言不存在。 |
| 429 | 超过公开提交频率 | 留言发送太频繁，请稍后再试。 |
| 500 | 数据库、Markdown 或 Telegram 主路径异常 | 由全局错误处理直接暴露 |

不返回默认成功结果，不吞掉通知错误，不增加自动重试。

## 9. 后端模块设计

### 9.1 GuestbookRepository

新增 src/journal-server/guestbookRepository.ts。

公开方法：

~~~ts
listPublicRows(): GuestbookRow[]
listAdminRows(): GuestbookRow[]
getRow(id: number): GuestbookRow | null
createVisitor(input): GuestbookRow
createOwnerReply(input): GuestbookRow
updateStatus(id, status, updatedAt): GuestbookRow | null
updatePinned(id, pinned, updatedAt): GuestbookRow | null
delete(id): boolean
~~~

实现要点：

- 所有 SQL 只访问 journal_guestbook_messages。
- Row 使用 snake_case，领域对象使用 camelCase。
- listPublicRows 只返回：
  - published 顶层；
  - 父记录为 published 顶层且自身为 published 的 owner 回复。
- listAdminRows 返回全部记录。
- Service 使用一次遍历建立 parentId → replies Map，再组装顶层列表，避免按每条留言重复扫描。
- 顶层和回复分别使用明确比较器，不依赖数据库返回的偶然顺序。

### 9.2 GuestbookService

新增 src/journal-server/guestbookService.ts。

公开方法：

~~~ts
listPublic(): GuestbookPublicListResponse
listAdmin(): GuestbookAdminListResponse
createVisitor(input): Promise<GuestbookVisitorCreateResponse>
createOwnerReply(parentId, input): GuestbookOwnerReplyResponse
setStatus(id, status): GuestbookStatusMutationResponse
setPinned(id, pinned): GuestbookPinnedMutationResponse
delete(id): GuestbookDeletionResponse
~~~

职责：

- 校验跨行角色与父子关系。
- 生成 ISO 时间。
- 调用 Repository。
- 把 Markdown 转成 contentHtml。
- 组装 public/admin DTO。
- 新访客留言写入后调用 Telegram 通知。
- 抛出带 statusCode 的 GuestbookError，交给现有全局错误处理。

Markdown 不复制新实现，直接复用 interactionService.ts 已导出的 renderJournalCommentHtml。虽然函数名称带 Comment，但其允许标签、链接协议和链接属性完全符合留言需求；首版不为命名美观重构现有评论链路。

### 9.3 Guestbook Routes

新增 src/journal-server/routes/guestbook.ts。

路由层只做：

- params、headers、body 的 Zod 解析。
- requireAdmin / requireInternal。
- route-level rateLimit。
- HTTP code 和 Cache-Control。
- 调用 Service 并原样返回。

不在 Route 中写 SQL、Markdown 转换或列表拼装。

### 9.4 Server 装配

修改 src/journal-server/server.ts：

1. 用现有 database 创建 GuestbookRepository。
2. 用现有 telegramToken、allowedChatId、publicBaseUrl 创建 JournalGuestbookNotificationService。
3. 创建 GuestbookService。
4. 在 rate-limit 插件注册完成后调用 registerGuestbookRoutes。

不增加配置字段，不改变现有服务启动结构。

## 10. Telegram 通知与快捷管理

### 10.1 通知服务

新增 src/journal-server/guestbookNotification.ts。

通知文本使用 Telegram 纯文本，不设置 parse_mode，避免访客输入参与 Telegram Markdown 解析。

~~~text
📬 Journal 收到新留言

访客：路过的读者
内容：很喜欢你的文章……
时间：2026/09/04 21:30
~~~

规则：

- 昵称和内容都先压平连续空白。
- 昵称在既有 24 字限制内完整显示。
- 内容最多保留 80 个 Unicode 字符，超出添加省略号。
- 时间使用 Asia/Shanghai。
- Inline Keyboard 第一行包含：
  - 打开留言板 → {JOURNAL_PUBLIC_BASE_URL}/guestbook
  - 隐藏留言 → callback_data: jg:h:{id}

通知属于创建留言的主路径，Service 必须 await sendMessage。发送失败直接抛出，不记录为“通知成功”，也不切换备用渠道。

SQLite 写入与 Telegram HTTP 请求无法组成原子事务。本方案沿用现有 Journal 评论链路的确定顺序：先写入留言，再 await 通知。通知失败时 HTTP 请求直接报错，但已经落库的留言仍以数据库事实为准；首版不为这个边界增加通知队列、补偿删除、自动重试或幂等状态机。

### 10.2 Bot API Client

修改 src/journal-bot/client.ts：

~~~ts
updateGuestbookStatus(
  id: number,
  status: GuestbookStatus,
): Promise<GuestbookStatusMutationResponse>
~~~

请求：

- PATCH /api/internal/guestbook/:id/status
- Authorization 继续使用 JOURNAL_INGEST_TOKEN。
- 响应通过共享 Zod Schema 解析。

### 10.3 Bot 回调

修改 src/journal-bot/registerBotHandlers.ts：

- 新增正则：/^jg:(h|p):(\d+)$/。
- 先复用 isAuthorized 校验 allowedChatId。
- h 映射 hidden，p 映射 published。
- 调用 api.updateGuestbookStatus。
- 成功后 answerCbQuery。
- 使用 editMessageReplyMarkup 把按钮在“隐藏留言”和“恢复公开”之间切换。
- 保留“打开留言板”按钮和原通知正文。
- JournalClientError 继续以 Telegram alert 直接显示。

## 11. 前端路由和应用壳层

### 11.1 Vue Router

修改 web/src/router.ts：

~~~ts
{
  path: '/guestbook',
  name: 'guestbook',
  component: () => import('./components/guestbook/GuestbookView.vue'),
}
~~~

afterEach 标题增加：

~~~text
留言板 · 小明同学
~~~

### 11.2 AppRoute

修改 web/src/app/appRouteTypes.ts：

~~~ts
| { name: 'guestbook'; key: 'guestbook' }
~~~

修改 web/src/app/appRoute.ts：

- parseAppRoute 在 games/photo 等公开模块附近识别 guestbook。
- 返回固定 key guestbook。
- 不把 guestbook 加入 persistentFeedKey；它不是 Feed，数据复用由 Pinia Store 负责。

修改 web/src/composables/useAppRoute.ts：

- publicShellActive 增加 route.name === 'guestbook'。
- 不把 guestbook 放入 isAssetRoute 或 isPrivateRoute。

### 11.3 App.vue

增加：

~~~ts
const guestbookActive = computed(() => route.value.name === 'guestbook')

function openGuestbook(): void {
  navigate('/guestbook')
}
~~~

向 PublicChannelNavigation 传递：

- guestbook-active
- select-guestbook

guestbook 不属于沉浸式页面：

- 不加入 immersiveActive。
- AppHeader 保持显示。
- 使用普通公开页面背景和侧栏。

### 11.4 AppRouteViewport

无需为 guestbook 增加专用渲染分支。当前 backgroundFeedRoute === null 的通用 component 分支会渲染该 RouterView 页面，普通路由切换也会由 useAppScrollRestoration 把共享滚动容器复位到顶部。

除非实现时当前源码结构已经改变，否则不要为此修改 AppRouteViewport。

## 12. 前端组件设计

### 12.1 文件结构

~~~text
web/src/components/guestbook/
├── GuestbookView.vue
├── GuestbookHeader.vue
├── GuestbookList.vue
├── GuestbookItem.vue
└── GuestbookNavigationIcon.vue
~~~

继续复用：

- web/src/components/interaction/JournalCommentForm.vue
- web/src/utils/journalVisitorIdentity.ts
- web/src/utils/formatters.ts
- web/src/utils/message.ts

### 12.2 GuestbookView.vue

单一职责：路由级组合和数据动作编排，不承载长列表卡片细节。

依赖：

- useSessionStore
- useGuestbookStore
- storeToRefs
- useTemplateRef

本地界面状态：

- replyTargetId: number | null

挂载主路径：

1. await session.load()。
2. 根据 ownerAuthenticated 选择 admin 或 public。
3. await guestbook.ensureLoaded(scope)。

不使用 watch 或 watchEffect。登录和退出会经过现有页面导航；再次进入时由 ensureLoaded 的 scope 参数决定复用还是读取对应数据。

事件处理：

- visitor submit → store.createVisitorMessage。
- owner reply → store.createOwnerReply。
- set status → store.setStatus。
- set pinned → store.setPinned。
- delete → store.remove。
- 打开回复时设置 replyTargetId；回复成功或主动取消后设回 null，使回复表单卸载并清空。
- 删除当前 replyTargetId 对应的顶层留言成功后同时设回 null。
- 成功后用 showMessage 提供明确反馈。
- 失败时显示原始错误，不清空表单。

### 12.3 GuestbookHeader.vue

Props：

~~~ts
{
  total: number | null
  hiddenTotal: number | null
  ownerMode: boolean
}
~~~

无事件、无请求、无 Store 依赖。

### 12.4 JournalCommentForm.vue 的最小扩展

不新增重复表单组件。给现有组件增加可选上下文：

~~~ts
context?: 'comment' | 'guestbook'
disabled?: boolean
~~~

默认值分别为 comment 和 false，确保现有文章评论文案和行为不变。

当 context 为 guestbook：

- visitor placeholder：写下你想对小明说的话……
- visitor aria-label：留言内容
- visitor textarea name：guestbook-content
- nickname input id/name 使用 guestbook 前缀，避免页面标识重复。
- visitor submit：发送留言
- owner 模式仍为“发送回复”。
- disabled 为 true 时禁用输入与提交，但不把它标记为一次正在发送的请求。

蜜罐、Markdown 提示、快捷键、busy、clearContent 和 markFailed 行为沿用当前实现。

### 12.5 GuestbookList.vue

Props：

~~~ts
{
  messages: readonly GuestbookMessage[] | null
  loading: boolean
  loadError: string | null
  ownerMode: boolean
  mutatingId: number | null
  submittingReply: boolean
  replyTargetId: number | null
}
~~~

Events：

~~~ts
openReply: [parentId: number]
closeReply: []
reply: [parentId: number, content: string]
setStatus: [id: number, status: GuestbookStatus]
setPinned: [id: number, pinned: boolean]
remove: [id: number]
~~~

职责：

- 列表骨架、错误、空状态和列表四种互斥呈现。
- 根据受控的 replyTargetId 保证同一时间只有一个回复表单。
- 用稳定 id 作为 v-for key。
- 把动作继续向上发给 View，不直接调用 API。

### 12.6 GuestbookItem.vue

Props：

~~~ts
{
  message: GuestbookPublicMessage | GuestbookAdminMessage
  ownerMode: boolean
  busy: boolean
  replyOpen: boolean
  submittingReply: boolean
}
~~~

Events：

~~~ts
openReply: []
closeReply: []
submitReply: [content: string]
setStatus: [id: number, status: GuestbookStatus]
setPinned: [id: number, pinned: boolean]
remove: [id: number]
~~~

职责：

- 展示一个顶层留言线程。
- 生成头像字符和颜色 class。
- 展示 pinned/hidden/owner 徽章。
- 展示一层回复。
- 管理行内确认。
- 只对服务端返回的 contentHtml 使用 v-html。
- pending 或错误文案一律使用文本插值，不把未清洗 Markdown 传给 v-html。

### 12.7 GuestbookNavigationIcon.vue

- 使用 Vue SFC 内联 SVG。
- viewBox 统一为 0 0 24 24。
- aria-hidden=true。
- 颜色由 currentColor 或局部 SVG 渐变控制。
- 不引入图片文件或图标依赖。

## 13. Pinia Store 设计

新增 web/src/stores/guestbook.ts，使用 Setup Store。

### 13.1 状态

~~~ts
type GuestbookScope = 'public' | 'admin'

messages = shallowRef<GuestbookMessage[] | null>(null)
loadedScope = shallowRef<GuestbookScope | null>(null)
loading = shallowRef(false)
loadError = shallowRef<string | null>(null)
submittingVisitor = shallowRef(false)
submittingReply = shallowRef(false)
mutatingId = shallowRef<number | null>(null)
~~~

模块内非响应状态：

~~~ts
pendingLoad: Promise<void> | null
pendingLoadScope: GuestbookScope | null
~~~

派生值：

- total：messages 为 null 时返回 null，否则返回顶层留言数量。
- hiddenTotal：messages 为 null 或当前不是 admin 数据时返回 null，否则返回 status=hidden 的顶层留言数量。

### 13.2 Actions

~~~ts
ensureLoaded(scope): Promise<void>
load(scope): Promise<void>
createVisitorMessage(input, visitorId): Promise<GuestbookPublicMessage>
createOwnerReply(parentId, content): Promise<GuestbookAdminReply>
setStatus(id, status): Promise<void>
setPinned(id, pinned): Promise<void>
remove(id): Promise<void>
~~~

调用边界：

- createVisitorMessage 只在 loadedScope=public 且 messages 已存在时调用。
- reply、status、pinned、remove 只在 loadedScope=admin 且 messages 已存在时调用。
- View 根据同一条件开放对应按钮；Store 不把缺失列表当作空数组继续写入。

### 13.3 数据复用

ensureLoaded(scope) 规则：

1. loadedScope 与 scope 相同且 messages 已存在：直接结束。
2. 相同 scope 已有 pendingLoad：返回同一个 Promise。
3. scope 不同：清空旧作用域数据和错误，再读取新作用域。
4. 成功后同时设置 messages 和 loadedScope。
5. 失败时设置 loadError，不保留另一个作用域的数据充当结果。

### 13.4 本地更新

Store 中的数组和嵌套对象都以替换根引用的方式更新，适配 shallowRef：

- 新留言：加入 messages 后统一排序。
- 新回复：map 找到 parentId，复制父对象并把 reply 追加到 replies。
- 状态：map 更新顶层或嵌套 reply 的 status/updatedAt。
- 置顶：更新顶层 pinned/updatedAt 后统一排序。
- 删除顶层：filter 移除整条线程。
- 删除回复：map 父对象并 filter 对应 reply。

所有本地更新只在服务端成功响应后执行。失败不回滚乐观状态，因为本方案不进行乐观写入。

### 13.5 并发规则

- visitor 和 reply 各自只有一个提交中的请求。
- 管理变更通过 mutatingId 保证同一时刻只处理一条记录。
- mutatingId 非 null 时禁用全部管理入口；该 id 对应的记录显示忙碌态。
- busy 状态不触发页面重新加载。
- 不在 Store 中加入请求重试、超时替代结果或静默忽略。

## 14. 前端 API 扩展

修改 web/src/api.ts，复用 requestJson、jsonRequest 和 withVisitorId；请求方式与现有评论 API 保持一致：

~~~ts
fetchPublicGuestbook()
createGuestbookMessage(visitorId, input)
fetchAdminGuestbook()
createGuestbookReply(id, input)
updateGuestbookStatus(id, status)
updateGuestbookPinned(id, pinned)
deleteGuestbookMessage(id)
~~~

约束：

- URL 中的 id 使用 Number 来源，不拼接未解析字符串。
- POST/PATCH 使用 jsonRequest。
- 公开提交使用 withVisitorId。
- 返回类型全部来自 src/shared/guestbookProtocol.ts。
- 不为 Guestbook 新建第二套 fetch 包装器。
- 不把只用于上传链路的 requestMutationWithTimeout 扩展到 Guestbook。

## 15. Markdown 与内容安全

### 15.1 服务端唯一可信渲染

复用当前评论配置：

~~~ts
marked.parse(markdown, {
  gfm: true,
  breaks: true,
  async: false,
})
~~~

marked 18.0.10 当前类型声明明确支持 async:false 时同步返回字符串。

随后由 sanitize-html 2.17.7 清洗：

- allowedTags：p、br、strong、em、del、s、code、pre、blockquote、ul、ol、li、a。
- a 只允许 href、rel、target。
- allowedSchemes：http、https、mailto。
- 所有链接强制 rel=noopener noreferrer、target=_blank。

### 15.2 前端渲染边界

- contentHtml 只能来自 Guestbook Service。
- 组件不能在浏览器调用 marked 生成可直接 v-html 的内容。
- 表单草稿和发送中内容只使用文本插值。
- Telegram 使用纯文本，不使用访客可控制的 parse_mode。

## 16. 文件级变更清单

### 16.1 新增

| 文件 | 内容 |
| --- | --- |
| src/shared/guestbookProtocol.ts | 请求、响应、状态 Zod Schema 与共享类型 |
| src/journal-server/guestbookRepository.ts | Guestbook SQLite CRUD 和行映射 |
| src/journal-server/guestbookService.ts | 业务规则、DTO 组装、Markdown、通知 |
| src/journal-server/guestbookNotification.ts | Telegram 新留言通知 |
| src/journal-server/routes/guestbook.ts | 公开、站长、内部接口 |
| web/src/stores/guestbook.ts | 列表缓存和 mutation 后本地更新 |
| web/src/components/guestbook/GuestbookView.vue | 路由页面组合 |
| web/src/components/guestbook/GuestbookHeader.vue | 标题和数量 |
| web/src/components/guestbook/GuestbookList.vue | 列表状态和回复目标 |
| web/src/components/guestbook/GuestbookItem.vue | 留言线程与管理操作 |
| web/src/components/guestbook/GuestbookNavigationIcon.vue | 导航图标 |

### 16.2 修改

| 文件 | 最小修改 |
| --- | --- |
| src/journal-server/migrations.ts | 新增 migration 22 |
| src/journal-server/server.ts | 创建依赖并注册 Guestbook 路由 |
| src/journal-bot/client.ts | 增加 Guestbook 内部状态更新方法 |
| src/journal-bot/registerBotHandlers.ts | 增加 jg 回调与键盘更新 |
| web/src/api.ts | 增加 Guestbook API 函数 |
| web/src/router.ts | 注册 /guestbook 和页面标题 |
| web/src/app/appRouteTypes.ts | 增加 guestbook 联合类型 |
| web/src/app/appRoute.ts | 解析 guestbook |
| web/src/composables/useAppRoute.ts | 纳入公开壳层 |
| web/src/App.vue | 导航激活态与跳转事件 |
| web/src/components/journal/PublicChannelNavigation.vue | 桌面与移动入口 |
| web/src/components/interaction/JournalCommentForm.vue | 增加可选 guestbook 文案上下文与独立 disabled 输入 |

### 16.3 明确不修改

- journal_entry_comments 和 journal_entry_reactions。
- web/src/components/app/AppRouteViewport.vue。
- 现有文章评论 Service、Repository 和 API 行为。
- Journal 配置 Schema 与部署环境变量。
- src/reminders/recurring.ts 的 rrule 导入。
- doc/ 下其他设计或历史文档。

## 17. 实施顺序

### 阶段一：协议与存储

1. 新增 guestbookProtocol.ts。
2. 在 migrations.ts 增加 version 22。
3. 实现 GuestbookRepository。
4. 明确 public/admin 两套列表映射和固定一层回复结构。

阶段完成结果：

- 数据约束可以表达 visitor/owner 主结构。
- Repository 能完成列表、创建、状态、置顶和删除。
- 共享类型已覆盖所有 HTTP 与 Bot 响应。

### 阶段二：Journal 服务

1. 实现 GuestbookService 和 GuestbookError。
2. 复用现有 Markdown 渲染清洗。
3. 实现 GuestbookNotification。
4. 注册公开、站长和内部路由。
5. 在 server.ts 完成依赖装配。

阶段完成结果：

- 公开创建能落库并通知。
- 站长管理动作具有完整业务约束。
- Telegram 内部状态接口可被 Bot 调用。

### 阶段三：Telegram Bot

1. 扩展 JournalApiClient。
2. 增加 jg 回调正则和 handler。
3. 回调成功后只编辑原通知的按钮。

阶段完成结果：

- 新留言通知包含打开和隐藏按钮。
- 隐藏后按钮切换为恢复公开。
- 所有操作仍受 allowedChatId 和内部 Token 双重边界约束。

### 阶段四：前端路由与导航

1. 注册 Vue Router 路由和标题。
2. 扩展 AppRoute 类型与解析。
3. 加入 publicShellActive。
4. 在 App.vue 连接 guestbook active 与 select 事件。
5. 增加桌面和移动入口。

阶段完成结果：

- 直接访问、站内跳转和浏览器前进/后退都进入同一 GuestbookView。
- 页面保持普通公开壳层。
- 桌面与移动导航正确高亮。

### 阶段五：Store 与页面

1. 实现 Guestbook Store。
2. 最小扩展 JournalCommentForm 文案上下文。
3. 实现 Header、List、Item、View 和图标。
4. 接通 public/admin 作用域。
5. 接通回复、状态、置顶和删除后的局部更新。

阶段完成结果：

- 访客和博主各自只看到适合当前身份的操作。
- 初次加载只影响列表区域。
- 返回相同作用域时复用数据。
- 成功操作不触发整页或整列表重新读取。

### 阶段六：主路径收口

按第 18 节逐项确认首次进入、直接操作、取消后再次操作、返回页面和状态恢复，发现问题时回到对应状态源修正，不为单个截图状态追加临时分支。

## 18. 主路径完成标准

### 18.1 公开访客

- 从桌面“游戏墙”下方进入留言板。
- 从移动“更多”中的游戏墙之后进入留言板。
- 页面头部和表单稳定出现，列表单独加载。
- 空留言、超长昵称、超长正文和非空蜜罐被服务端拒绝。
- 有效留言创建后立即出现在置顶区之后的普通列表首位。
- Markdown 只呈现允许的格式，危险标签和属性不会进入页面。
- 刷新或再次进入时可以读取刚创建的留言。
- 频率超过限制时直接得到 429 文案。

### 18.2 博主管理

- 已登录进入 /guestbook 时读取 admin 列表。
- 访客提交表单不在管理模式出现。
- 可以展开回复表单、取消，再次展开并发送。
- 回复成功后出现在目标留言内部末尾。
- 置顶后留言移动到置顶组，取消后回到普通时间序。
- 隐藏顶层留言后管理页面仍保留，公开页面不再显示整组。
- 恢复后顶层和 published 回复重新公开。
- 可单独隐藏或删除博主回复。
- 删除顶层留言前显示包含“全部回复”的确认文案，确认后整组从列表移除。

### 18.3 Telegram

- 正常创建主路径中的每次 POST 只调用一次 Guestbook 通知发送。
- 通知包含访客、正文预览和上海时区时间。
- “打开留言板”指向 /guestbook。
- “隐藏留言”调用 internal API 后隐藏整个公开线程。
- 原 Telegram 消息不新增替代消息，只编辑 Inline Keyboard。
- 隐藏后可以从同一按钮恢复公开。

### 18.4 页面状态

- public/admin 数据不串用。
- 页面返回相同作用域时使用已加载状态。
- 请求中的按钮具有对应忙碌态。
- 请求失败不会清空草稿、删除现有记录或显示伪成功。
- 无自动重试、fallback、静默吞错或整页重载。

## 19. 最终设计决策摘要

1. 独立 Guestbook 表，不复用文章评论表。
2. 单表自关联，只支持顶层访客留言和一层博主回复。
3. 置顶是顶层留言属性，隐藏是每条记录属性。
4. 首版全量读取，不引入分页。
5. 不保存 client_hash；匿名 UUID 只用于现有限流主路径。
6. 服务端统一 Markdown 渲染与清洗，前端只展示安全 HTML。
7. API 路径严格沿用 /api、/api/me、/api/internal 三类边界。
8. Telegram 回调沿用当前 Journal Server 与 Bot 跨服务器协作方式。
9. Pinia 只维护一个明确作用域的数据源，成功后不可变更新。
10. 复用现有 JournalCommentForm 的行为，不复制一套表单状态机。
11. GuestbookView 保持组合层，列表和卡片职责下沉到专用组件。
12. 本批次只完成开发实现，不自动扩展到发布阶段。
