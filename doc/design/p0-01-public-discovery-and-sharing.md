# P0-01 公开发现与分享基础设施开发设计

> 对应需求：`doc/requirements/p0-01-public-discovery-and-sharing.md`  
> 文档日期：2026-08-12  
> 设计原则：保留当前 Vue SPA 与 Fastify 主路径，以请求时 HTML head 注入补齐机器发现，以既有内容权限作为唯一公开判断。

## 1. 技术结论

本功能不需要迁移 SSR 框架。最小方案是：

1. Fastify 启动时读取当前 Vite 产出的 `index.html`，每次页面请求根据路由和数据库内容生成页面元数据，再把结果写入 HTML head 后返回。
2. 用一份纯数据的 `JournalPageMetadata` 作为服务端 HTML 与客户端 SPA head 的共同语义，避免两套标题和权限规则分叉。
3. 为普通公开内容增加统一分享图路由；现有 `sharp` 负责生成 1200×630 JPEG。
4. 为 sitemap 增加独立的公开记录轻量查询；现有 `cheerio` 负责 XML 结构与实体序列化，不手写 XML 转义器，也不增加新的 npm 包。
5. `web/index.html` 固定加入 RSS/JSON Feed 自动发现，关于页加入可见订阅入口。
6. 公开详情的分享操作直接使用 Clipboard API 和 Web Share API；两个动作互相独立，不构成失败兜底。

初始 HTML 负责抓取器和直接访问；客户端 head 同步只负责 SPA 内路由切换。正文仍由现有 Vue 页面加载和渲染。

## 2. 当前实现证据

### 2.1 HTML 与路由

- `web/index.html` 当前只有固定 `<title>小明同学</title>` 与固定 description，没有 feed `rel=alternate`、Canonical、Open Graph、Twitter Card 或 JSON-LD。
- `web/src/router.ts` 的 `afterEach` 每次都把标题重置为固定站点标题；直接详情加载完成后也不会形成内容标题。
- Vue Router 已存在 `/`、`/about` 和 `/p/:publicId`；频道与标签通过首页的 `channel`、`tag` 查询参数表达。
- `src/journal-server/server.ts` 使用 `fastifyStatic` 提供构建资源，再由 `sendApplication` 返回 `index.html`。它注册了 `/`、`/p/:publicId` 和管理路由，但没有注册 `/about`。

### 2.2 内容与权限

- `JournalRepository.getPublishedAccessByPublicId()` 返回发布内容及 `public`、`protected`、`private` 当前权限。
- `GET /api/entries/:publicId` 对普通公开直接返回完整记录；未授权口令内容经 `protectedPreview()` 只返回 `publicId`、频道、记录/文章类型与来源时间；私有或不存在返回 404。
- `JournalRepository.listPublicFeed()` 只返回已发布的公开或口令代表记录；按标签查看时进一步只保留普通公开内容。
- `GET /media/:assetId` 与 `/media/:assetId/preview` 已按内容当前权限校验；普通公开媒体使用 `public, no-cache`，其他权限使用 `private, no-store`。
- `FeedView.vue` 当前在浏览器中临时创建口令详情的 robots meta，并在组件卸载时删除。该实现应由统一 head 管理替代，避免同一职责存在两个所有者。

### 2.3 阅读与分享界面

- 当前公开详情实际有三条渲染路径：信息流内短记录覆盖层使用 `JournalDetailContent.vue`；直接打开的短记录使用 `EntryCard.vue`；长文章永久页使用 `ArticleCardContent.vue`。分享动作必须由一个专用组件复用并接入三条路径，不能只修改 `JournalDetailContent.vue`。
- `CardActionMenu.vue` 与 `accessLink.ts` 的复制链接只属于站主管理口令内容，不能直接作为公开访客分享入口。
- `JournalTextPoster.vue` 通过 `resolveTextPosterTemplate(publicId)` 在 `editorial`、`book`、`swiss`、`archive`、`cinema`、`notebook`、`gazette` 七种模板中稳定选择。当前结果只存在于浏览器 CSS，无法直接成为 `og:image`。

### 2.4 已有基础设施与版本证据

- `src/journal-server/routes/feeds.ts` 已通过 `feed` 6.0.0 生成 `/rss.xml` 与 `/feed.json`，数据源是最近 50 条 `visibility=public` 的已发布代表记录。
- 当前锁定 `cheerio` 1.2.0，服务端 `richText.ts` 已使用其 `load` API；本设计复用它操作 HTML 与 XML。
- 当前锁定 `sharp` 0.35.3，站点头像和图片预览服务已经使用；本设计复用它生成 JPEG 分享图。
- 当前运行镜像使用 Node 24，Fastify 锁定 5.10.0，Vue Router 锁定 5.2.0。
- `JOURNAL_PUBLIC_BASE_URL` 已是服务端配置中的规范站点根地址，可作为 Canonical、sitemap、feed 与分享图绝对 URL 的唯一来源。

## 3. 总体结构

```text
页面请求
  ├─ /、/about
  │    └─ 路由参数 + SiteProfile → JournalPageMetadata
  ├─ /p/:publicId
  │    └─ PublishedAccess → 先判权限 → JournalPageMetadata 或 404 元数据
  └─ /me/*
       └─ 固定 noindex 元数据
                    ↓
        JournalPageDocumentService
        读取基础 index.html，替换页面级 head
                    ↓
              返回 HTML shell

SPA 内跳转
  Router afterEach + 详情现有打开/加载事件
                    ↓
          clientPageHead.apply(metadata)
                    ↓
       替换同一批 data-journal-page-meta 节点

/sitemap.xml
  公开轻量查询 + SiteProfile 标签
                    ↓
          Cheerio XML 序列化

/social-card/:publicId.jpg
  Public entry + 视觉资产/海报模板
                    ↓
              Sharp 1200×630 JPEG
```

## 4. 元数据领域模型

新增共享纯数据结构 `JournalPageMetadata`。它不直接操作 DOM，也不包含数据库对象，建议字段如下：

| 字段 | 用途 |
| --- | --- |
| `title` | HTML title、Open Graph 和分享标题 |
| `description` | HTML description、Open Graph 和分享摘要 |
| `canonicalUrl` | 规范绝对 URL；管理和 404 页面为 `null` |
| `robots` | 明确的索引策略 |
| `openGraph` | type、url、siteName、locale、图片和文章扩展字段 |
| `twitterCard` | card、title、description、image、imageAlt |
| `jsonLd` | 已按页面类型形成的对象；受保护页面为 `null` |
| `visibility` | `public-page`、`protected-page`、`non-public-page`，供客户端决定动作，不映射数据库口令 |

共享模块负责：

- 频道名称和说明。
- Unicode 长度截断与空白折叠。
- 标题、摘要和媒体类型文案的确定性规则。
- 规范 URL 与分享图版本 URL。
- 首页 `CollectionPage`、关于页 `ProfilePage`、公开详情 `BlogPosting` 的数据对象。
- 公开、口令和非公开三种元数据策略。

HTML 标签的创建与替换分别留在服务端和浏览器适配层；共享模块不引入 Cheerio 或 DOM 类型。

## 5. 页面策略与权限分流

### 5.1 首页、频道与标签

服务端 `/` 路由读取 `channel` 与 `tag`：

- 未传频道时规范为 `life`。
- `life` 的 Canonical 不携带 `channel=life`。
- `article`、`interest` 保留一个规范化 `channel` 参数。
- 非空 tag 排在 channel 之后，其他查询参数全部从 Canonical 移除。
- 非法频道返回 404 状态的主应用 shell，并写入 non-public 元数据，让客户端继续显示现有 NotFoundView。

频道、标签页面是可索引集合页，但 sitemap 只列站点配置中的公开标签，不能因为任意 `tag` 查询就无限生成 sitemap URL。

### 5.2 关于页

在 Fastify 中显式注册 `/about`，返回带 `ProfilePage` 的主应用 shell。简介、头像与公开联系方式继续由现有 profile API 渲染；head 使用 `JournalSiteProfileService.getProfile()` 的 bio、avatar URL 与 updatedAt，不写入未启用联系方式。

### 5.3 普通公开详情

请求 `/p/:publicId` 时必须先调用 `getPublishedAccessByPublicId()`，再按 `visibility` 分支：

- `public`：允许把 `access.entry` 交给公开元数据生成器，返回 200。
- `protected`：不能把 entry 内容交给公开元数据生成器；只使用请求中的 `publicId` 构造通用 Canonical 和固定文案，返回 200 与 `noindex, nofollow, noarchive`。
- `private`、草稿或不存在：统一返回 404 的应用 shell与 non-public 元数据，不区分原因。

口令 Cookie 和站主 Cookie 不参与该分流。即使浏览器可以读取口令正文，公开 HTML head 仍保持受保护状态。

### 5.4 管理页面

现有 `/me`、设置、编辑、投稿管理路由继续返回 SPA shell，但统一写入 `noindex, nofollow, noarchive`，不输出 Canonical、社交卡片和 JSON-LD。它们不查询内容来生成标题。

## 6. HTML head 生成

### 6.1 基础模板

`web/index.html` 保留 charset、viewport、color-scheme 和图标，并作两项调整：

1. 给默认 title 与 description 加统一的 `data-journal-page-meta` 标识，便于服务端和客户端按组替换。
2. 加入不随页面变化的 RSS 与 JSON Feed `rel=alternate` 标签。

页面级 Canonical、robots、Open Graph、Twitter Card 和 JSON-LD 不静态写死在模板中。

### 6.2 服务端文档服务

新增 `JournalPageDocumentService`：

- 在服务器创建阶段从 `config.webRoot/index.html` 读取 UTF-8 模板；读取失败直接阻止服务完成创建，不退回无元信息的 `sendFile`。
- 每次页面请求为模板创建独立 Cheerio 文档，移除全部 `[data-journal-page-meta]`，再写入当前 metadata。
- 输出唯一 title、description、robots、Canonical、Open Graph、Twitter Card 和 JSON-LD。
- 所有绝对 URL 都来自 `publicBaseUrl`，不根据请求 Host 推断。
- meta 属性由 Cheerio 作为属性值写入；JSON-LD 先做 JSON 序列化并转义会终止 script 的字符序列，正文不能成为 HTML。
- 返回 `text/html; charset=utf-8`。公开页面保持当前 `no-cache`；受保护、404 和管理页面使用 `private, no-store`。

页面 head 生成失败时请求直接失败，不发送未经替换的基础模板。

### 6.3 客户端 head 所有权

新增 `web/src/utils/pageHead.ts`，使用与服务端相同的 `data-journal-page-meta` 标识完成整组替换。

触发点只使用现有明确事件：

1. Router `afterEach` 处理首页、频道、标签、关于页、管理页和 NotFound 页。
2. `App.openEntry()` 已持有信息流条目：路由完成后，普通公开条目立即应用公开 metadata；口令或已解锁的口令条目只应用受保护 metadata。
3. 直接详情由 `handlePublicDetailLoaded()` 在现有 API 返回后应用公开 metadata。
4. `handlePublicDetailUnlocked()` 只更新阅读内容，不改变受保护 metadata。
5. 首次直接进入详情时，Router 不先用固定标题覆盖服务端 head；详情数据到达后再用同一规则重写。

移除 `FeedView.vue` 中局部创建和删除 robots meta 的代码，避免重复所有者。该流程不增加 `watch`、RAF 或轮询。

## 7. 分享图设计

### 7.1 路由契约

新增：

| 路由 | 成功响应 | 权限 |
| --- | --- | --- |
| `GET /social-card/:publicId.jpg?v=:updatedAt` | `image/jpeg`，1200×630 | 仅当前已发布普通公开内容 |

`v` 由页面元数据使用 entry.updatedAt 生成，用于内容更新后改变外部抓取 URL；服务端仍按 `publicId` 当前权限决定是否响应。口令、私有、草稿和不存在统一返回 404。

缓存沿用公开媒体的权限敏感策略 `public, no-cache`，不使用 immutable，避免内容改为非公开后本站继续长期确认旧资源。

### 7.2 视觉资产选择

`JournalSocialCardService` 只执行一次确定性选择：

1. 富文本文章的 cover。
2. 第一张可展示图片资产。
3. 第一项拥有图片预览的媒体资产。
4. 无视觉资产时使用文字海报模板分支。

选中资产后，通过 `repository.getAssetAccess(asset.id)` 取得实际存储路径并再次确认当前 `visibility=public`。选中预览时读取 `previewRelativePath`，选中图片时读取 `relativePath`。

图片分支用 Sharp 自动方向校正、等比填满 1200×630，并输出 JPEG。海报分支复用按 `publicId` 选择七种模板的算法，生成与现有文字海报相同语义的背景、装饰、频道/文章标识和日期；不绘制中文正文，因此不新增服务端中文字体依赖。

把 `textPosterTemplates` 和 `resolveTextPosterTemplate()` 移到共享模块，Web 端现有工具只转出共享实现，避免浏览器与服务端对同一 `publicId` 选择不同模板。

如果已经选定的媒体文件不存在或 Sharp 无法解析，请求直接失败。只有“内容原本没有可展示视觉资产”才进入海报分支。

## 8. Sitemap 设计

### 8.1 仓储查询

在 `JournalRepository` 增加专用轻量查询，只返回：

- `publicId`
- `updatedAt`

SQL 条件必须同时包含：

- 媒体组代表记录条件 `groupRepresentativeCondition('e')`。
- `publication_status = 'published'`。
- `visibility = 'public'`。

不复用 `repository.list({ limit: 50 })`，否则 sitemap 会继承 feed 的条数限制并构造完整媒体对象。

### 8.2 XML 输出

新增 `GET /sitemap.xml`：

1. 读取公开 profile 的 channelTags 与 updatedAt。
2. 组合根页、两个非默认频道、关于页、已配置标签页和全部公开详情。
3. 使用 `JOURNAL_PUBLIC_BASE_URL` 形成同一 host 下的绝对 URL。
4. 使用 Cheerio 1.2.0 的 XML mode 创建 `urlset`、`url`、`loc` 与 `lastmod`，由库完成实体转义。
5. 返回 `application/xml; charset=utf-8` 与 `no-cache`。

个人站规模不需要 sitemap index、分页、压缩文件、priority 或 changefreq。生成失败直接暴露，不返回空文档。

### 8.3 P0-03 扩展点

P0-01 先交付时，sitemap 只输出当时存在的公开页面。P0-03 新增发现页面后沿同一服务扩展：

- `/search` 与所有 `q` 都不写入 sitemap，并输出 `noindex, follow`。
- `/archive` 写入 sitemap。
- 公开归档聚合中当前有内容的 `/archive/:year/:month` 写入 sitemap；月份 `lastmod` 使用该月公开内容的最大 `updatedAt`。
- 归档页面元信息使用现有 `JournalPageMetadata` 与 `JournalPageDocumentService`，不能重新注册旧静态 HTML 返回路径。

## 9. Feed 自动发现与可见入口

### 9.1 HTML 自动发现

在 `web/index.html` 的非页面级 head 区域加入：

- RSS：`rel=alternate`、`type=application/rss+xml`、`href=/rss.xml`。
- JSON Feed：`rel=alternate`、`type=application/feed+json`、`href=/feed.json`。

这两个节点不带 `data-journal-page-meta`，页面切换时不能被移除。

### 9.2 关于页

在 `AboutView.vue` 的简介/联系方式之后新增“订阅更新”区：

- RSS 为主要链接，文案解释适合常见订阅器。
- JSON Feed 为并列链接，文案解释适合支持 JSON Feed 的工具。
- 使用普通 `<a>` 指向现有地址，不增加 API 调用或订阅状态。

`feeds.ts` 不修改条数、排序和内容生成逻辑；只在需要共享页面标题/描述工具时做局部复用。

## 10. 分享动作数据流

### 10.1 复制链接

```text
PublicEntryShareActions（公开、已发布）
→ 从 publicId 生成与服务端一致的 /p/:publicId Canonical
→ navigator.clipboard.writeText
→ 成功消息“链接已复制”
```

复制失败直接显示错误。现有 `accessLink.ts` 仍只负责站主口令链接；公开分享建立独立命名，避免权限语义混用。

### 10.2 系统分享

```text
浏览器存在 navigator.share
→ 显示“分享”
→ 用户点击后传入 title、description、canonical URL
→ 由操作系统展示目标
```

不支持时不渲染按钮。分享 Promise 的主动取消按用户结束处理；其他拒绝显示错误。任何失败都不自动调用复制链接。

新增 `PublicEntryShareActions.vue`，它只接收当前 `JournalEntry`，内部只在 `visibility=public` 且 `publicationStatus=published` 时渲染。其标题和描述使用共享 metadata 生成器，避免界面分享文本与 HTML head 不一致。

### 10.3 三条详情接入

- 信息流内短记录覆盖层：在 `JournalDetailContent.vue` 的正文、媒体与标签之后挂载分享组件。
- 直接短记录：在 `FeedView.vue` 的 reading stage 中，把现有 `EntryCard` 与分享组件组合成同一阅读容器。
- 长文章永久页：在相同 reading stage 中，把现有 `ArticleCardContent` 与分享组件组合成同一阅读容器。

文章编辑预览、私有详情和口令解锁后的详情不挂载该组件。组件通过 props 读取数据，不修改父状态；反馈继续使用现有消息工具。

P0-05 后续也会在这三条路径加入“继续探索”。两项功能应作为同一详情末尾区域中的相邻独立组件组合，不互相嵌套，也不为此把完整分享逻辑重新塞回 `FeedView.vue`。

## 11. 路由与响应变化

| 路由 | 当前 | 设计后 |
| --- | --- | --- |
| `GET /` | 静态 index shell | 按 channel/tag 注入公开 metadata 的 shell |
| `GET /about` | 未注册 | 注入 ProfilePage metadata 的 shell |
| `GET /p/:publicId` | 无条件静态 index shell | 权限分流后的公开、受保护或 404 shell |
| `GET /me*` | 静态 index shell | 注入 noindex 的管理 shell |
| `GET /rss.xml` | 已存在 | 行为不变，由 HTML 暴露 |
| `GET /feed.json` | 已存在 | 行为不变，由 HTML 暴露 |
| `GET /sitemap.xml` | 不存在 | 当前全部普通公开 URL 的 XML |
| `GET /social-card/:publicId.jpg` | 不存在 | 普通公开内容的 JPEG 分享图 |

不新增“元信息 API”。服务端页面请求直接使用仓储，客户端使用已经加载的 `JournalEntry`，避免多一次请求和两个权限响应结构。

## 12. 预计修改文件

### 12.1 新增

| 文件 | 职责 |
| --- | --- |
| `src/shared/journalPageMetadata.ts` | 页面标题、摘要、Canonical、社交数据和 JSON-LD 的共享纯数据规则 |
| `src/shared/journalTextPoster.ts` | 文字海报模板列表与稳定选择算法 |
| `src/journal-server/pageDocumentService.ts` | 读取 index 模板并用 Cheerio 写入服务端 head |
| `src/journal-server/socialCardService.ts` | 选择公开视觉资产并用 Sharp 生成分享图 |
| `src/journal-server/routes/siteDiscovery.ts` | sitemap 与 social-card 公共路由 |
| `web/src/utils/pageHead.ts` | SPA 导航后的页面级 head 整组替换 |
| `web/src/utils/publicShare.ts` | 公开 Canonical、复制链接与系统分享动作 |
| `web/src/components/journal/PublicEntryShareActions.vue` | 三条公开详情路径共用的分享操作与反馈 |

### 12.2 修改

| 文件 | 最小变化 |
| --- | --- |
| `web/index.html` | 标记默认页面节点，加入 RSS/JSON Feed 自动发现 |
| `web/src/router.ts` | 删除固定标题覆盖，改为调用页面 head 路由处理 |
| `web/src/App.vue` | 在现有打开、直接加载和路由返回事件中应用当前 metadata |
| `web/src/components/journal/FeedView.vue` | 移除局部 protected robots meta，并在直接短记录与长文章阅读容器接入分享组件 |
| `web/src/components/journal/JournalDetailContent.vue` | 信息流短记录覆盖层接入分享组件 |
| `web/src/components/about/AboutView.vue` | 加入可见的 RSS/JSON Feed 区域 |
| `web/src/utils/textPosterTemplate.ts` | 转出共享模板选择实现，保持现有引用路径稳定 |
| `src/journal-server/repository.ts` | 增加 sitemap 轻量公开查询 |
| `src/journal-server/server.ts` | 组装页面文档/分享图服务，替换页面 sendFile 路由并注册 `/about`、发现路由 |

`src/journal-server/routes/feeds.ts` 原则上不改；只有共享已经存在的标题/摘要规则能直接减少重复时才做局部调整，不能借本需求改变 feed 产品行为。

## 13. 实施拆分

### 13.1 页面元数据主链

- 建立共享 metadata 规则和三类权限策略。
- 建立服务端文档服务。
- 改造 `/`、`/about`、`/p/:publicId` 与 `/me*` 的 HTML 返回。
- 将客户端固定标题和局部 robots 逻辑收口到统一 head 所有者。

完成这一段后，初始 HTML 和 SPA 跳转应使用同一业务规则。

### 13.2 分享图与结构化内容

- 共享文字海报模板选择算法。
- 建立 social-card 服务与公开权限路由。
- 将分享图 URL、图片属性和 `BlogPosting` 接入 metadata。

### 13.3 Sitemap 与 feed 发现

- 增加轻量公开 sitemap 查询。
- 生成 sitemap XML。
- 写入两种 feed 自动发现节点与关于页订阅区。

### 13.4 公开分享交互

- 增加公开复制链接与成功反馈。
- 按 Web Share API 能力显示系统分享。
- 让分享标题、摘要和 URL 复用 metadata 规则。

## 14. 风险与已定决策

### 14.1 SPA 正文仍不是服务端 HTML

本方案只服务端输出 head，不输出正文。它可以直接改善社交预览、Canonical、结构化数据、feed 与 sitemap 发现，但搜索引擎读取正文仍依赖其 JavaScript 渲染能力。这是 P0 的明确边界，不以半套 SSR 扩大实现。

### 14.2 权限必须先于元数据生成

`getPublishedAccessByPublicId()` 会同时持有权限和完整 entry。任何公开元数据 helper 都只能在确认 `visibility=public` 后调用。口令分支不能为了“生成通用标题”读取内容字段，否则以后很容易把真实字段带入 head。

### 14.3 客户端 head 不能有多个所有者

保留 `router.ts` 固定 title、`FeedView` protected robots，再增加新 helper 会造成重复和卸载顺序错误。因此本设计要求一次性收口，而不是在现有代码旁追加标签。

### 14.4 社交平台缓存不由本站控制

`updatedAt` 版本参数可以让修改后的公开内容产生新图片 URL；本站可以在权限变化后停止返回分享图，但无法删除第三方已经抓取的公开预览。本项目不为此引入平台刷新 API 或删除队列。

### 14.5 海报分享图不引入服务端中文字体

部署镜像当前没有声明中文字体包。为一个 P0 分享图扩大运行镜像并引入字体发布问题不符合最小范围。因此无视觉媒体的分享图沿用模板构图和标识，但正文只存在于 HTML 元信息中；后续若确需把正文绘入图，再单独确定字体资产。

### 14.6 不增加第三方依赖

HTML/XML 使用当前已锁定并已有服务端调用的 Cheerio 1.2.0；位图使用当前 Sharp 0.35.3；feed 保持 Feed 6.0.0。这样既避免手写协议转义，也不在文档阶段假设一个尚未安装的包可解析。

### 14.7 失败不降级

- index 模板读取或 head 生成失败时页面请求失败，不退回旧静态 shell。
- sitemap 查询或 XML 生成失败时接口失败，不返回空列表或旧缓存。
- 已选择的媒体分享图无法处理时接口失败，不换另一媒体或海报。
- Clipboard 或 Web Share 失败时向当前用户显示错误，不切换通道。

## 15. 依据

- [Open Graph protocol](https://ogp.me/)
- [Schema.org BlogPosting](https://schema.org/BlogPosting)
- [Google Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google Canonical 指南](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google robots meta 说明](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Sitemaps protocol](https://www.sitemaps.org/protocol.html)
- [WHATWG HTML `rel=alternate`](https://html.spec.whatwg.org/multipage/links.html#rel-alternate)
- [JSON Feed 1.1 Discovery](https://www.jsonfeed.org/version/1.1/)
- [W3C Web Share API](https://www.w3.org/TR/web-share/)
