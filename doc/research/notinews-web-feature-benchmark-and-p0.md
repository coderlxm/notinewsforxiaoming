# NotiNews Web 功能全景、同类产品案例与 P0 建议

> 调研日期：2026-08-12  
> 调研范围：当前 `web/` 前端、与其直接相连的 `src/journal-server/` 服务端实现，以及同类产品的官方公开资料。  
> 本文没有把 `doc/` 中的历史方案当作当前事实。

## 1. 结论摘要

NotiNews Web 当前已经不是一个单纯的个人博客，而是一个完成度较高的“个人信息流操作台”：

```text
Telegram / Web 编辑器 / 临时投稿链接
                ↓
        私有资料库与内容整理
                ↓
  短记录 / 长文章 / 公开、口令、私有
                ↓
      公开信息流、详情页与订阅源
```

现有主路径的强项是：采集入口多、媒体支持完整、公开与私有边界清楚、短内容和长文章共存、移动端阅读体验成熟、单用户管理路径直接。

与优秀的个人博客和个人信息流产品相比，当前最明显的缺口不在“继续增加一种内容编辑器”，而在内容发布之后：

1. 公开内容不容易被站内找到，也不容易被搜索引擎、社交平台和订阅工具正确发现。
2. 已经积累的私人内容缺少稳定的重访入口；现有“往年今日”实现尚未进入当前主界面。
3. RSS 和 JSON Feed 已经存在，但页面没有可见订阅入口和自动发现声明，已有能力没有形成用户闭环。
4. 私人资料库缺少完整导出，数据所有权还停留在“保存在自己的服务端”，没有形成可带走的成果。
5. 记录之间主要依赖频道和标签，详情读完后没有继续探索相邻内容或相关内容的路径。

因此，建议先开发以下五项 P0，并按顺序推进：

1. **公开发现与分享基础设施**：动态页面元信息、站点地图、订阅入口、普通公开内容分享。
2. **私人回顾入口**：把现有“往年今日”真正接入资料库主路径。
3. **公开搜索与年月归档**：让内容积累后仍然可找、可浏览。
4. **完整数据导出**：提供包含原始结构与媒体文件的个人档案包。
5. **详情页继续探索**：时间相邻内容和基于共同标签的相关内容。

这五项都能直接复用现有内容、权限、标签、时间和阅读组件，不要求引入会员、评论、社交关系、复杂推荐系统或新的运营后台，符合个人项目当前阶段。

## 2. 证据口径

本文用三种状态区分事实与判断：

- **已接通**：当前路由、页面、组件和 API 之间已有明确调用链，可以视为现有产品能力。
- **实现存在但未接入主路径**：源码中已有接口、状态或组件，但当前页面没有形成用户可以到达的完整入口，不能算作已交付功能。
- **建议**：根据现有实现与外部案例形成的产品判断，不代表当前能力。

外部案例只引用产品官方文档、官方帮助中心、官方仓库或开放标准。案例说明的是可以借鉴的交互与产品机制，不等于这些产品的全部能力，也不直接证明某个实现适合本项目。

## 3. 当前 Web 项目的功能全景

### 3.1 产品结构

当前路由形成四个清晰表面：

| 表面 | 当前入口 | 主要用途 | 状态 |
| --- | --- | --- | --- |
| 公开信息流 | `/` | 按频道和标签浏览公开、口令内容 | 已接通 |
| 内容详情 | `/p/:publicId` | 阅读短记录、媒体记录或长文章 | 已接通 |
| 站主资料库 | `/me` | 搜索、筛选、查看和管理全部个人内容 | 已接通 |
| 内容生产 | `/me/entries/*`、`/me/articles/*` | 发布短记录与长文章 | 已接通 |
| 投稿协作 | 独立 `/contribute` 页面及 `/me/contributions` | 通过临时链接接收素材并由站主审核发布 | 已接通 |
| 站点设置 | `/me/settings` | 管理个人资料、公开标签、联系方式和投稿链接 | 已接通 |
| 关于页 | `/about` | 展示个人简介与启用的联系方式 | 已接通 |

### 3.2 公开信息流与阅读

当前公开端已经具备：

- “生活”“文章”“兴趣”三个固定频道，以及每个频道的公开标签筛选。
- 生活和兴趣频道的自适应瀑布流；文章频道使用长文列表布局。
- 游标分页、下拉刷新、无限加载，以及最多 30 个频道/标签 feed 状态缓存。
- 页面切换时保留已加载内容和滚动位置；打开详情时保留底层信息流。
- 图片渐进加载、视频预览、多媒体缩略图、左右切换和键盘操作。
- 纯文字记录自动生成稳定样式的文字海报。
- 图片、视频、语音、音频、文件和 Telegram 结构化内容的详情展示。
- 响应式桌面/移动布局、系统明暗主题、减少动态效果偏好和基础键盘焦点样式。

长文章阅读已经具备：

- 封面、富文本正文、标签和独立文章布局。
- H2/H3 标题锚点与目录。
- 桌面端固定目录、移动端目录抽屉和滚动中的当前章节反馈。

公开权限已经具备：

- `public`、`protected`、`private` 三种可见性。
- 口令内容在未解锁时只显示受限预览，不泄露正文和媒体。
- 六位口令解锁与会话内解锁状态保留。
- 口令链接复制。

主要源码证据：`web/src/App.vue`、`web/src/components/journal/FeedView.vue`、`PublicFeed.vue`、`EntryDetail.vue`、`ArticlePage.vue`、`ArticleRichBody.vue`、`src/journal-server/routes/publicFeed.ts`、`src/journal-server/repository.ts`。

### 3.3 私有资料库

站主资料库已经具备：

- 单站主口令登录、会话鉴权与退出。
- 瀑布流和分页表格两种视图。
- 按公开状态、标题/正文关键词、标签、内容类型和时间范围筛选。
- 支持的内容类型包括文字、照片、视频、圆形视频、语音、音频、文件、贴纸、联系人、位置、场所、投票、骰子、游戏、故事、付费媒体和文章。
- 表格中展示来源时间、更新时间、置顶状态、正文摘要、标签、频道、公开状态、来源和媒体数量/体积。
- 查看、编辑、删除、置顶、调整发布时间、修改可见性与口令、复制受保护链接。
- 对已发布纯文字记录进行快速正文编辑。
- 在“生活”和“兴趣”之间移动短记录。
- 草稿继续进入相应编辑器。

当前私有搜索使用标题和正文的 `LIKE` 查询，并已经有标签、内容类型和时间条件，因此后续公开搜索可以复用字段定义、筛选语义和详情跳转，但必须建立独立的公开权限查询，不能直接暴露私有列表接口。

主要源码证据：`web/src/components/journal/AssetManagementToolbar.vue`、`PrivateFeed.vue`、`PrivateEntryTable.vue`、`web/src/composables/useJournalApi.ts`、`src/journal-server/routes/privateEntries.ts`、`src/journal-server/repository.ts`。

### 3.4 短记录生产

Web 短记录编辑器已经具备：

- 标题/主题、正文、正文内标签和频道选择。
- 使用 DeepSeek 生成主题建议和标签建议。
- 公开、口令、私有三种状态，以及六位访问口令。
- 保存草稿或正式发布、自定义发布时间。
- 从文件选择、拖放和粘贴加入媒体。
- JPEG、PNG、WebP、GIF 图片与 MP4、MOV 视频。
- 最多 10 个媒体、最多 5 个视频；图片上限 20 MB，视频上限 500 MiB。
- 媒体预览、排序和移除，以及分片上传进度。
- 编辑已有 Web 记录；Telegram 来源记录保留其来源限制，同时允许调整适用的内容属性。

主要源码证据：`web/src/components/journal/EntryPublisher.vue`、`EntryMediaPicker.vue`、`EntryMediaPreviewGrid.vue`、`web/src/api.ts`、`src/journal-server/routes/entryPublishing.ts`。

### 3.5 长文章生产

长文章编辑器已经具备：

- 标题、封面、标签和 Tiptap 富文本正文。
- 二三级标题、段落、粗体、斜体、删除线、行内代码、有序/无序列表、引用、代码块、分隔线、硬换行和链接。
- 在首次保存后上传、粘贴或拖入正文图片。
- 复用和删除已有正文图片、设置图片替代文本。
- 上传、替换和删除封面。
- 最多 20 个标签和 AI 标签建议。
- 首次保存先形成私有文章，再调整公开状态。
- 私有预览、公开详情跳转和口令链接复制。

主要源码证据：`web/src/components/article/ArticleEditor.vue`、`ArticleRichEditor.vue`、`ArticleAssetPanel.vue`、`ArticleCoverField.vue`、`src/journal-server/routes/articlePublishing.ts`。

### 3.6 投稿协作

投稿功能不是开放社区，而是一条很适合个人站点的受控素材收集路径：

- 站主创建临时或长期投稿链接，并可复制、展示二维码和撤销。
- 投稿者通过 URL fragment 中的令牌进入独立页面，不进入站主管理界面。
- 投稿者可填写最多 24 字的称呼、最多 2000 字的正文，并上传图片和视频。
- 最多 30 个媒体、最多 5 个视频，总体积上限 500 MiB。
- 支持 JPG、PNG、WebP、HEIC、HEIF 和 MP4、MOV，并有图片像素、文件体积和视频时长限制。
- 媒体预览、排序、移除、上传进度和上传期间屏幕唤醒。
- 投稿完成后形成待处理项，并向站主发送 Telegram 通知。
- 站主查看待处理数量和列表，编辑正文、调整媒体、设置发布时间与公开/私有状态，然后发布或删除。

主要源码证据：`web/src/components/contribution/ContributionApp.vue`、`ContributionForm.vue`、`web/src/components/journal/ContributionInbox.vue`、`ContributionReview.vue`、`src/journal-server/routes/contributions.ts`。

### 3.7 个人资料与站点设置

当前已经具备：

- 上传头像，编辑短简介和关于页介绍。
- 配置 Telegram、邮箱、微信、GitHub 和个人网站；逐项启用或隐藏。
- 在关于页复制或打开相应联系方式。
- 管理各公开频道最多 8 个标签及其顺序。
- 管理投稿链接和退出登录。

主要源码证据：`web/src/components/journal/SettingsView.vue`、`AboutPage.vue`、`src/journal-server/routes/profile.ts`。

### 3.8 订阅源与内容分发

服务端已经提供：

- `/rss.xml`
- `/feed.json`
- 最近 50 条公开记录
- 长文章富文本、标签/分类和首个媒体或文章封面 enclosure

但是当前 `web/index.html` 没有 RSS/JSON Feed 自动发现声明，公开页面也没有明显的订阅入口。因此这是“底层已接通、用户闭环未接通”的能力。

主要源码证据：`src/journal-server/routes/feeds.ts`、`src/journal-server/server.ts`、`web/index.html`。

### 3.9 实现存在但未进入当前主路径的能力

#### 往年今日

`OnThisDay.vue`、`/api/me/on-this-day`、仓储查询和 composable 状态均存在；查询会返回当前月日、早于今年的已发布记录。但当前资料库主页面没有挂载这个组件，也没有沿当前刷新路径加载它。因此应视为尚未形成可用入口，而不是已经交付。

#### 天气

个人资料中存在 `weatherEnabled`，服务端也有天气接口；当前公开页面和设置页面没有形成可见的天气展示与开关交互。它同样属于实现痕迹，不应算作现有功能。

### 3.10 当前明确缺失的产品能力

根据当前源码，没有发现以下完整能力：

- 公开全文搜索、搜索快捷键和可分享的搜索结果页。
- 按年、月、日浏览的公开归档。
- 每条公开内容的服务端动态标题、描述、Canonical、Open Graph、Twitter Card 和结构化数据。
- 动态 XML sitemap。
- 页面中的 RSS/JSON Feed 订阅入口与 HTML 自动发现标签。
- 普通公开内容的统一分享操作。
- 站主完整数据与媒体导出。
- 时间相邻内容、相关内容、手动关系、反向链接或知识图谱。
- 外部链接的结构化收藏卡片、网页剪藏、稍后读和高亮。
- 邮件订阅、跨平台同步发布、评论、站内社交关系或会员系统。

## 4. 同类产品中的优秀案例

### 4.1 案例对照表

| 产品/模式 | 当前优秀案例 | 值得借鉴的原则 | 与 NotiNews 的关系 |
| --- | --- | --- | --- |
| [Ghost](https://ghost.org/help/seo/) | 自动生成 Canonical、XML sitemap、结构化数据、Open Graph、Twitter Card；自动 RSS；支持邮件通讯、书签卡片和推荐 | 发布不是终点，机器发现、社交预览和订阅必须成为默认基础设施 | NotiNews 已有公开详情和 feed，只差把这些能力暴露并补齐页面级元信息 |
| [Quartz](https://quartz.jzhao.xyz/features/full-text-search) | `Cmd/Ctrl + K` 全文搜索、结果摘要与关键词高亮，并考虑中文等 CJK 文本；另有反向链接和关系图 | 个人内容越多，检索和内容关系越重要；搜索应是导航的一部分 | 对公开搜索、快捷入口和后续双向关系最有参考价值 |
| [Day One](https://dayoneapp.com/features/calendar-view/) | 日历视图和 On This Day 让历史记录每天重新出现；支持包含媒体的 JSON、PDF、Markdown、纯文本、CSV 导出 | 日记的长期价值来自“重访”和“可带走”，不仅来自记录当下 | NotiNews 已有时间、媒体和往年今日底层实现，融合成本低 |
| [Readwise Reader](https://docs.readwise.io/reader/docs/faqs/filtered-views) | 用查询条件建立可保存、可固定的视图；默认提供最近添加、继续阅读、短读、长读、已高亮等入口 | 筛选条件可以进一步成为稳定的个人视图，而不必增加新的内容分类 | 当前频道、标签、类型和时间过滤可在后续演化为“个人书架” |
| [Raindrop.io](https://help.raindrop.io/using-search) | 在收藏、集合、标签、高亮和注释中统一搜索，并按类型和时间筛选；支持永久副本与备份 | 信息库必须同时解决找回、原文失效和数据带走 | 适合启发未来的链接收藏、网页剪藏和完整导出，不适合直接全部纳入 P0 |
| [Memos](https://github.com/usememos/memos) | 时间线优先的快速记录、标签与搜索、详情返回后恢复原 feed 位置；0.30 增加网页剪藏和更紧凑的信息流 | 个人信息流的核心应保持短路径：随手记录、及时归档、快速找回 | NotiNews 当前状态保持和短记录路径已经同类领先，下一步可补链接型内容 |
| [Micro.blog](https://help.micro.blog/t/automatic-cross-posting-to-mastodon-and-other-services/860) | 内容先发布到自己的站点，再同步到 Mastodon、Bluesky、Threads 等平台；支持 Webmention 和照片集合 | 自有站点应是内容原点，外部平台只是分发端 | 适合后续 POSSE 分发，但依赖多个外部平台 API，不应早于站内发现与分享基础 |
| [Are.na](https://help.are.na/docs/getting-started/connections) | 用 block、channel 和 connection 组织内容，不依赖点赞；同一内容可进入多个集合，并建立人工策展路径 | 对个人知识库而言，“这两条内容为什么相关”比社交热度更有长期价值 | 可启发手动关联、专题集合和内容路径，先从简单相关内容开始 |
| [IndieWeb POSSE](https://indieweb.org/POSSE) / [Webmention](https://www.w3.org/TR/webmention/) | 先在自有站发布，再把副本分发到外部；网站之间可以互相通知引用关系 | 自主内容、可迁移身份和开放互联可以共存 | 是长期方向；本项目不需要在 P0 承担完整联邦协议和反垃圾系统 |

### 4.2 从案例中得到的五条共识

#### 共识一：个人站点首先要可发现

Ghost 把页面元信息、站点地图和 feed 作为默认发布基础；Quartz 把搜索放进全局导航。它们共同说明，内容发布成功不等于内容可以被重新找到。NotiNews 当前阅读层已经成熟，发现层却明显薄弱，因此应先补这里。

#### 共识二：时间本身就是个人内容的导航方式

Day One 的日历和 On This Day 不要求用户主动想起关键词，而是让历史内容按时间自然返回。NotiNews 的内容天然带有来源时间，且已经存在往年今日查询，这比新建推荐系统更贴合当前产品。

#### 共识三：标签不只用于筛选，还可以成为稳定视图和内容关系

Readwise Reader 把查询保存为视图，Are.na 把内容连接成集合和路径，Quartz 展示反向链接。NotiNews 已有标签和频道，近期没有必要增加复杂分类系统；先让现有标签产生“相关内容”和“可固定入口”更有效。

#### 共识四：个人数据的价值要以可带走来兑现

Day One 和 Raindrop 都把导出或备份作为长期使用的重要能力。NotiNews 的 RSS/JSON Feed 只覆盖最近的公开内容，不能替代包含私有、口令、草稿、富文本和媒体的完整个人导出。

#### 共识五：先拥有内容原点，再考虑外部分发和互动

Micro.blog 与 IndieWeb 的核心不是“多发几个平台”，而是自己的站点先成为 canonical source。NotiNews 应先把页面元信息、永久链接、订阅和站内检索做好，再决定是否接入跨平台发布、Webmention 或开放社交协议。

## 5. P0 选择标准

这里的 P0 不是“同行产品所有常见功能”，而是满足以下条件、可以作为下一批开发起点的能力：

1. 直接补齐现有“采集—整理—发布—阅读—重访”主路径。
2. 能复用已有内容模型、权限判断、时间字段、标签、媒体和详情组件。
3. 对单用户个人项目有持续价值，不要求建立会员、审核、社交关系或运营体系。
4. 功能边界可以保持短而清楚，失败时能够直接暴露真实问题。
5. 对公开内容和私有内容的边界有明确行为，不引入模糊的数据泄露风险。

| 候选项 | 用户价值 | 复用现有实现 | 范围 | 结论 |
| --- | --- | --- | --- | --- |
| 公开发现与分享基础设施 | 高 | 高 | 小 | P0，最先开始 |
| 私人往年今日入口 | 高 | 很高 | 小 | P0，紧随其后 |
| 公开搜索与年月归档 | 高 | 高 | 中 | P0 |
| 完整数据导出 | 高 | 中 | 中 | P0 |
| 时间相邻与标签相关内容 | 中高 | 高 | 小到中 | P0 收尾项 |
| 链接收藏/网页剪藏 | 中高 | 中 | 中到大 | P1 |
| 保存筛选视图/公开专题集合 | 中 | 高 | 中 | P1 |
| 跨平台自动发布 | 中 | 中 | 大且依赖外部平台 | P1 |
| 评论、会员、ActivityPub | 低于当前成本 | 低 | 大 | 暂不做 |

## 6. 建议开发的 P0

### P0-1：公开发现与分享基础设施

#### 要解决的问题

当前永久链接适合人直接打开，但没有形成对搜索引擎、社交平台和订阅器友好的发布结果；已有 RSS/JSON Feed 也缺少入口。

#### 参考案例

- Ghost 的 [SEO 默认能力](https://ghost.org/help/seo/) 和 [`ghost_head`](https://ghost.org/docs/themes/helpers/ghost_head_foot/) 输出。
- HTML 标准中的 [feed autodiscovery](https://html.spec.whatwg.org/multipage/links.html#rel-alternate)。

#### 与项目融合的最小形态

1. 为站点首页、频道页、关于页和每个公开详情输出对应的标题与描述。
2. 对 `/p/:publicId` 在服务端返回的 HTML shell 中注入 Canonical、Open Graph、Twitter Card 和 JSON-LD；不为此重做完整 SSR。
3. 短记录优先使用首张公开图片作为分享图；长文章使用封面；纯文字记录可复用现有文字海报视觉生成分享图。
4. 生成只包含公开内容的 `sitemap.xml`。
5. 在 `index.html` 中加入 RSS 与 JSON Feed 自动发现声明，并在公开导航或关于页放置可见的“订阅”入口。
6. 普通公开详情增加“复制链接”和“系统分享”两个清晰动作；它们是独立操作，不把其中一个隐藏成另一个失败后的替代流程。
7. 口令内容只输出不含标题、正文和媒体的通用元信息，并明确禁止索引；私有内容不进入 sitemap。

#### 引入理由

- 这是公开博客的基础设施，不依赖内容规模，也不会改变现有编辑流程。
- 当前详情、封面、标签、文字海报和 feeds 均已存在，新增数据很少。
- 它同时改善搜索入口、聊天软件预览、外部引用和订阅体验，是投入产出比最高的一项。

#### P0 边界

- 不做邮件通讯。
- 不做跨平台自动发布。
- 不做完整服务端渲染框架迁移。
- 不为口令内容生成可泄露内容的分享预览。

### P0-2：把“往年今日”接入私人资料库

#### 要解决的问题

历史内容只能依赖主动搜索和翻页，现有 `OnThisDay` 能力没有用户入口，已经完成的底层投入没有产生产品价值。

#### 参考案例

- Day One 的 [Calendar 与 On This Day](https://dayoneapp.com/features/calendar-view/)。

#### 与项目融合的最小形态

1. 在 `/me` 的常驻资料库框架中增加“回顾”入口或局部卡片，不替换整个资料库页面。
2. 进入回顾时局部请求 `/api/me/on-this-day`，结果在当前会话中复用；不让回顾请求阻塞资料库列表。
3. 记录卡片继续复用现有私有详情覆盖层，关闭后回到原列表和滚动位置。
4. 展示年份、距今年数、原频道、标签与媒体缩略图；所有可见性都只对已登录站主展示。
5. 当天无历史记录时直接显示明确的空状态，不生成虚构推荐。

#### 引入理由

- 组件、API、查询和状态已经存在，是当前最小范围的完整闭环修复。
- 它强化项目区别于普通博客的“私人时间流”价值。
- 不需要 AI、推荐模型或新的内容字段。

#### P0 边界

- 不自动推送 Telegram 提醒。
- 不在公开首页展示私人回顾。
- 不同时扩展日历热力图、随机漫游和年度报告；这些留到后续迭代。

### P0-3：公开搜索与年月归档

#### 要解决的问题

公开端目前只能按三个频道和预设标签浏览。随着记录增多，旧内容会快速沉入瀑布流，访问者无法按关键词或时间找回。

#### 参考案例

- Quartz 的 [全文搜索](https://quartz.jzhao.xyz/features/full-text-search)：全局快捷键、结果摘要、高亮和 CJK 文本考虑。
- Raindrop 的 [统一搜索与筛选](https://help.raindrop.io/using-search)。
- Day One 的时间导航。

#### 与项目融合的最小形态

1. 公开导航增加搜索按钮，并支持 `Cmd/Ctrl + K` 打开搜索面板。
2. 搜索结果显示标题或正文摘要、日期、频道、标签和内容类型；点击继续复用当前详情或文章页。
3. 查询条件写入 URL，例如 `/search?q=关键词`，使前进、后退和复制地址行为明确。
4. 建立独立公开查询：只搜索已发布内容；未获授权的口令记录不得用标题或正文命中，也不得在摘要中泄露内容。
5. 增加 `/archive`，按年和月显示公开记录数量与简洁列表；点击月份进入对应时间范围。
6. 搜索与归档只更新内容区域，保留站点框架、查询结果和返回后的滚动位置。

#### 技术融合思路

- 搜索字段沿用现有标题、正文、标签、频道、类型和 `source_created_at`。
- 公开查询与私有查询共享字段语义，但保持独立权限条件和返回结构。
- 当前是个人规模，可先把“结果正确、中文可用、权限不泄露”作为目标；具体索引方案应在开发前根据当前 SQLite 能力和实际内容量选定成熟实现，不在产品层提前绑定手写分词方案。
- 归档直接使用现有来源时间，不增加人工年份或月份字段。

#### 引入理由

- 搜索和归档是所有后续“相关内容”“专题集合”“个人回顾”的基础。
- 现有详情组件、频道、标签、时间和权限模型都可以复用。
- 它解决真实的内容沉没问题，不需要先引入新的采集渠道。

#### P0 边界

- 不做语义向量搜索和聊天式问答。
- 不做可保存的复杂查询表达式。
- 不把私有资料库搜索结果混入公开搜索。

### P0-4：完整个人数据导出

#### 要解决的问题

RSS 和 JSON Feed 只面向近期公开发布，不包含私有记录、口令记录、草稿、原始富文本与全部媒体，不能承担个人档案导出的职责。

#### 参考案例

- Day One 的 [多格式导出](https://dayoneapp.com/guides/tips-and-tutorials/exporting-entries/)。
- Are.na 的 [数据导出与开放 API](https://www.are.na/about)。
- Raindrop 的备份与永久副本思路。

#### 与项目融合的最小形态

1. 在站点设置增加“导出全部数据”。
2. 由已登录站主触发一次服务端流式归档，产出 ZIP。
3. ZIP 至少包含：
   - 带 `exportVersion` 的完整 JSON 清单；
   - 短记录、文章、草稿、频道、标签、可见性、来源时间、更新时间和来源信息；
   - 文章原始富文本结构；
   - 原始媒体、预览图、文章封面和正文图片；
   - 每个文件与内容记录之间的稳定映射。
4. 导出结果真实反映当前数据；任何记录或文件无法写入时直接终止并报告问题，不产出看似成功但不完整的归档。

#### 引入理由

- 这是个人长期信息库的基本信任能力。
- 现有数据库已经拥有统一记录、媒体和文章资产关系，适合生成规范归档。
- 先定义稳定导出结构，也能为未来迁移或导入建立清晰边界。

#### P0 边界

- 第一版不同时实现导入。
- 第一版不做 PDF、CSV、按筛选导出和定时云备份。
- JSON 与媒体是规范档案；Markdown 等人类阅读格式可在结构稳定后增加。

### P0-5：详情页继续探索

#### 要解决的问题

当前记录和文章读完后基本结束，标签只能回到频道 feed 过滤，没有“上一条/下一条”或“与此相关”的自然路径。

#### 参考案例

- Quartz 的 [Backlinks](https://quartz.jzhao.xyz/features/backlinks) 与 [Graph View](https://quartz.jzhao.xyz/features/graph-view)。
- Are.na 的人工 [Connections](https://help.are.na/docs/getting-started/connections)。
- Micro.blog 的照片集合。

#### 与项目融合的最小形态

1. 在公开详情与长文章底部增加时间上的上一条和下一条公开内容。
2. 增加最多三条“相关记录”：必须至少共享一个标签，并显示形成关联的标签。
3. 相关查询继续遵守公开、口令解锁和私有边界。
4. 点击相关项继续复用现有详情导航与 feed 状态，不开启新的并行阅读系统。
5. 没有共同标签时不显示相关区域；不使用 AI 生成看似相关的结果。

#### 引入理由

- 现有标签已经通过 AI 和人工编辑持续生成，却还没有发挥内容关系价值。
- 时间相邻与共同标签都是可解释关系，适合个人项目，也便于用户纠正内容组织方式。
- 它能提升旧内容曝光，同时为未来的手动关系和专题集合提供真实使用反馈。

#### P0 边界

- 不做知识图谱画布。
- 不做点击率驱动推荐。
- 不增加点赞、热度或协同过滤。

## 7. 推荐的推进顺序

### 第一组：先释放已有能力

1. 公开页面元信息、sitemap、feed 自动发现与可见订阅入口。
2. 将现有往年今日组件接入资料库。

这组几乎不改变内容模型，能够最快补齐两个已经接近完成的闭环。

### 第二组：建立找回能力

3. 公开搜索。
4. 年月归档。
5. 详情页时间相邻与标签相关内容。

这三项共同使用公开查询、时间、标签和详情导航，适合作为一个连续设计批次，避免各自形成不同的过滤和返回行为。

### 第三组：建立长期所有权

6. 定义导出格式并提供完整 ZIP 导出。

导出应单独形成清晰的数据边界，不与公开 feed 或页面抓取混为一体。

### 后续需求与开发文档

| P0 | 需求文档 | 开发文档 |
| --- | --- | --- |
| 01 公开发现与分享 | [需求](../requirements/p0-01-public-discovery-and-sharing.md) | [开发设计](../design/p0-01-public-discovery-and-sharing.md) |
| 02 私人往年今日 | [需求](../requirements/p0-02-on-this-day.md) | [开发设计](../design/p0-02-on-this-day.md) |
| 03 公开搜索与年月归档 | [需求](../requirements/p0-03-public-search-and-archive.md) | [开发设计](../design/p0-03-public-search-and-archive.md) |
| 04 完整个人数据导出 | [需求](../requirements/p0-04-full-data-export.md) | [开发设计](../design/p0-04-full-data-export.md) |
| 05 详情页继续探索 | [需求](../requirements/p0-05-detail-content-exploration.md) | [开发设计](../design/p0-05-detail-content-exploration.md) |

P0-03 的搜索入口已按用户指定视觉方向调整为公开 Header 中的居中长圆角搜索栏；搜索结果页不再重复设置第二个主输入框。

## 8. P1 候选与创新方向

### 8.1 链接型记录与轻量网页剪藏

参考 Ghost bookmark card、Memos Web Clipper 和 Raindrop：在短记录编辑器粘贴 URL 后，由用户明确触发“保存为链接卡片”，保存原始 URL、页面标题、站点、摘要、封面和自己的备注。公开端以卡片展示，私有端可作为稍后整理的素材。

融合价值：NotiNews 会从“记录自己发生的事”扩展到“记录自己正在关注什么”，非常符合个人信息流定位。

不列入 P0 的原因：它会新增外部页面解析、资源存储和链接失效边界，需要先确定这是用户希望扩展的内容类型，而不是默认替代现有短记录。

### 8.2 可保存视图与公开专题

参考 Readwise Reader 和 Are.na：把“频道 + 标签 + 类型 + 时间”的组合保存为一个命名视图，例如“最近读到的 AI”“旅行照片”“项目更新”，站主可以选择只在私有资料库使用，或把其中一部分固定到公开导航。

融合价值：不增加新的分类层级，而是让现有筛选条件成为个人书架。

### 8.3 手动内容关系与反向链接

在自动相关内容有真实使用后，允许站主给两条记录建立可解释关系，例如“后续”“灵感来源”“同一次旅行”“对应文章”。详情页同时显示正向关系和反向引用。

创新点：关系标签可以是自然语言，而不是一开始就做复杂图谱；这更接近个人记忆如何形成上下文。

### 8.4 “本周的我”私人回顾

每周把新增记录按频道、标签和媒体自动整理成私人摘要页，并允许从摘要跳回原记录。后续可以由现有 Telegram bot 发送一个指向该页面的链接。

创新点：它把 Telegram 的及时提醒与 Web 的长期档案连接起来，但原始记录仍是唯一事实来源。第一版不需要生成式 AI，先按时间与标签组成真实摘要。

### 8.5 记忆漫游

在私人回顾中加入“随便带我去一条旧记录”，或者按某个标签随机漫游。它比无限向下翻页更适合重访个人内容，也能暴露缺少标签或错误时间的旧记录。

### 8.6 自有站优先的跨平台分发

参考 Micro.blog 和 POSSE：NotiNews 先产生 canonical 页面，再由站主明确选择是否同步摘要和链接到外部平台。长内容只同步摘要与原文链接，避免多个平台出现互相冲突的正文来源。

不列入 P0 的原因：外部平台 API、认证和内容限制变化快，应在本站的永久链接、分享预览和发现能力稳定之后再做。

### 8.7 照片集合与地点回顾

参考 Micro.blog Photo Collections 和 Day One：允许站主从既有记录中选择图片组成“旅行”“家人”“年度照片”等集合。现有 location/venue 内容也可以形成私人地点回顾，但不需要先引入完整地图产品。

## 9. 当前不建议引入的功能

### 评论、点赞和公开关注关系

这会立即引入访客身份、反垃圾、通知、审核和删除边界，偏离单站主个人工具。若未来确有互动需求，可先研究只接收 Webmention 的受控引用，但它也不属于当前 P0。

### 邮件会员与多 newsletter

Ghost 的 newsletter 很成熟，但邮件地址管理、退订、投递质量和模板维护会把项目推向内容运营系统。当前先把现有 RSS/JSON Feed 接通更合适。

### ActivityPub 或完整开放社交网络

它能增加分发，但会带来 inbox/outbox、远端身份、内容删除同步、协议兼容和滥用处理。对当前个人项目而言，成本明显高于站内发现和 POSSE。

### AI 语义搜索、自动知识图谱和“与我的记录聊天”

项目已经在主题和标签生成中使用 AI。下一步应先让这些结构化结果真正服务搜索和相关内容；在关键词搜索、归档和人工关系还未形成基线前增加向量检索，会掩盖内容组织问题，也增加隐私与运行成本。

### 付费订阅、复杂权限和多作者后台

这些功能没有对应当前单用户个人工具的真实主路径，也会改变整个数据与交互模型，不应因为同类博客平台提供就引入。

## 10. 可直接用于后续需求拆分的功能边界

| 功能 | 新增公开入口 | 新增站主入口 | 服务端主要变化 | 不改变的现有部分 |
| --- | --- | --- | --- | --- |
| 发现与分享 | 订阅、分享、正确社交预览 | 无 | 页面 head、sitemap、公开元信息查询 | 编辑器、内容模型、feed |
| 往年今日 | 无 | `/me` 局部回顾入口 | 现有接口为主 | 资料库列表、详情组件 |
| 公开搜索/归档 | 搜索面板、`/search`、`/archive` | 无 | 独立公开查询与计数 | 私有搜索、详情渲染 |
| 完整导出 | 无 | 设置中的导出动作 | 归档流与导出 schema | RSS/JSON Feed、公开权限 |
| 相关内容 | 详情页底部 | 私有详情可后续复用 | 相邻与共同标签查询 | 标签生成、文章和短记录结构 |

## 11. 资料来源

以下资料均为本次调研直接使用的官方来源，访问日期为 2026-08-12：

- Ghost：[SEO](https://ghost.org/help/seo/)、[RSS feeds](https://ghost.org/help/where-can-i-find-my-rss-feed/)、[`ghost_head` 输出](https://ghost.org/docs/themes/helpers/ghost_head_foot/)、[编辑器 Cards](https://ghost.org/help/cards/)、[邮件投递](https://ghost.org/help/delivering-emails/)、[Recommendations](https://ghost.org/docs/recommendations/)、[Social web](https://ghost.org/help/social-web/)
- WHATWG：[HTML `rel=alternate` 与 feed autodiscovery](https://html.spec.whatwg.org/multipage/links.html#rel-alternate)
- Day One：[Calendar / On This Day](https://dayoneapp.com/features/calendar-view/)、[导出](https://dayoneapp.com/guides/tips-and-tutorials/exporting-entries/)、[Web 端 On This Day](https://dayoneapp.com/releases/on-this-day-now-available-on-web/)
- Readwise Reader：[Filtered Views](https://docs.readwise.io/reader/docs/faqs/filtered-views)、[Default Views](https://docs.readwise.io/reader/guides/filtering/default-views)、[Reader 产品介绍](https://readwise.io/read)
- Quartz：[Full-text Search](https://quartz.jzhao.xyz/features/full-text-search)、[Backlinks](https://quartz.jzhao.xyz/features/backlinks)、[Graph View](https://quartz.jzhao.xyz/features/graph-view)、[功能总览](https://quartz.jzhao.xyz/features/)
- Raindrop.io：[Search](https://help.raindrop.io/using-search)、[Highlights](https://help.raindrop.io/highlights)、[Articles](https://help.raindrop.io/articles)、[Pro 与永久副本](https://raindrop.io/pro)
- Memos：[官方仓库](https://github.com/usememos/memos)、[Tags](https://usememos.com/docs/usage/tags)、[Memo detail](https://usememos.com/docs/usage/memos)、[Search & Archive](https://usememos.com/docs/usage/search-archive)、[Sharing](https://usememos.com/docs/usage/sharing)、[0.30 Releases](https://github.com/usememos/memos/releases)
- Micro.blog：[自动跨平台发布](https://help.micro.blog/t/automatic-cross-posting-to-mastodon-and-other-services/860)、[Webmention](https://help.micro.blog/t/webmention/103)、[Photo Collections](https://help.micro.blog/t/photo-collections/3366)
- Are.na：[Connections](https://help.are.na/docs/getting-started/connections)、[Channels](https://help.are.na/docs/getting-started/channels)、[About / Features](https://www.are.na/about)、[Create Block API](https://www.are.na/developers/explore/block/post-block)
- IndieWeb：[POSSE](https://indieweb.org/POSSE)
- W3C：[Webmention Recommendation](https://www.w3.org/TR/webmention/)

## 12. 最终判断

NotiNews 当前最值得延伸的方向不是变成另一个通用博客 SaaS，而是继续强化它已经形成的独特组合：

```text
个人 Telegram 信息入口
+ 单站主管理的私人档案
+ 可控的公开/口令发布
+ 适合短记录与长文章的公开阅读
+ 让旧内容不断重新产生价值
```

P0 应先让已有内容“被正确发现、被重新找回、被再次看到、可以完整带走”，而不是先增加新的社交和运营负担。完成这批能力后，再根据真实使用选择向“链接收藏与策展”或“自有站优先的外部分发”扩展，会比一次性堆叠同行功能更符合这个项目的个人属性。
