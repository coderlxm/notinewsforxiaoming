# P0-01 公开发现与分享基础设施需求

> 优先级：P0  
> 文档日期：2026-08-12  
> 适用范围：NotiNews Web 的公开首页、频道/标签信息流、关于页、公开内容详情、RSS/JSON Feed 与 sitemap。

## 1. 需求结论

NotiNews 已经能够发布和阅读公开记录，也已经提供 RSS 与 JSON Feed，但“发布完成”尚未形成完整的公开发现闭环：页面源 HTML 没有按内容生成元信息，社交平台无法稳定获得正确预览，搜索引擎没有 sitemap，订阅器和普通访客也看不到现成的 feed 入口。

本需求补齐以下一条主路径：

```text
站主发布公开内容
→ 服务端立即提供与该内容一致的页面元信息和分享图
→ 搜索引擎、聊天软件和订阅器可以发现
→ 访客可以复制永久链接或调用系统分享
→ 口令、私有和草稿内容始终留在公开发现范围之外
```

本需求不改变现有内容编辑器、永久链接、公开权限模型和正文阅读方式。

## 2. 当前现状

以下判断来自当前源码调用链，而不是历史文档：

- `web/index.html` 只有固定站点标题和描述，没有 Canonical、Open Graph、Twitter Card、JSON-LD 或 feed 自动发现声明。
- `web/src/router.ts` 在每次路由完成后只设置“关于我 · 小明同学”或“小明同学”，内容详情没有自己的浏览器标题。
- `src/journal-server/server.ts` 对 `/`、`/p/:publicId` 和管理页面返回同一个静态 `index.html`；当前没有为 `/about` 注册可直接访问的服务端 HTML 路由。
- `/api/entries/:publicId` 已经明确区分公开、口令和私有内容；未授权口令内容只返回频道、内容类型与时间，不返回标题、正文、标签或媒体。
- `FeedView.vue` 只在浏览器运行后为口令详情临时加入 `noindex, nofollow`，该信息不在初始 HTML 中，也没有覆盖管理页面。
- `/rss.xml` 和 `/feed.json` 已存在，并只使用最近 50 条公开内容；页面没有可见订阅入口，也没有自动发现链接。
- 普通公开详情没有统一的复制链接或系统分享动作；现有“复制访问链接”只服务于站主的口令内容管理。
- `JournalTextPoster.vue` 已按 `publicId` 稳定选择七种文字海报模板，但它是浏览器 CSS 视觉，不是社交抓取器可读取的图片资源。

## 3. 目标

### 3.1 产品目标

1. 每个公开页面在初始 HTML 中就有与页面一致的标题、描述、Canonical 和社交预览元信息。
2. 每条普通公开内容都有稳定、可访问的分享图和永久链接。
3. 搜索引擎可以从 `sitemap.xml` 发现当前全部公开内容，但看不到口令、私有或草稿内容。
4. RSS 和 JSON Feed 同时具备机器自动发现和普通访客可见入口。
5. 普通公开详情可以直接复制链接；支持 Web Share API 的设备还可以明确调用系统分享。
6. SPA 内部跳转后，浏览器 head 与当前页面同步，不残留上一条内容的元信息。
7. 已有公开、口令、私有边界在页面 head、分享图、sitemap 和 feed 中保持一致。

### 3.2 业务结果

- 公开文章或记录发到聊天软件时，预览标题、摘要和图片与目标内容一致。
- 搜索结果和浏览器标签能够区分首页、频道、关于页及具体内容。
- 访客无需猜测地址即可订阅公开更新。
- 站主把一条内容从公开改为口令或私有后，NotiNews 不再主动向发现入口提供它的内容信息。

## 4. 非目标

- 不迁移 Nuxt、SSR 或其他服务端渲染框架，也不服务端渲染正文页面。
- 不开发 newsletter、邮件地址管理或邮件投递。
- 不做 Mastodon、Bluesky、Threads 等平台的自动同步发布。
- 不做 Webmention、评论、点赞、会员、关注关系或分享统计。
- 不改变 RSS/JSON Feed 当前“最近 50 条公开内容”的内容范围，不新增频道级 feed。
- 不增加 SEO 配置后台、单篇自定义 SEO 字段或手工上传分享图。
- 不生成短链接、二维码、带追踪参数的链接或分享落地页。
- 不为口令内容提供包含真实标题、正文、标签或媒体的社交预览。
- 不保证外部搜索引擎收录或第三方平台刷新已经缓存的旧预览；本需求负责本站当前响应的正确性。

## 5. 用户与场景

### 5.1 公开访客分享内容

访客打开一条普通公开记录或文章，在详情中看到“复制链接”。点击后复制当前规范永久链接并收到即时成功反馈。设备支持系统分享时，同时看到“分享”，点击后打开系统分享面板。

### 5.2 访客订阅更新

访客进入“关于我”，在“订阅更新”区域看到 RSS 与 JSON Feed 两个入口，可以直接交给订阅工具。支持自动发现的订阅器也能从任意公开页面的 HTML head 找到这两个地址。

### 5.3 社交抓取器读取详情

抓取器直接请求 `/p/:publicId` 时，无需运行 Vue 即可取得该公开内容的标题、摘要、规范 URL、分享图、发布时间、更新时间与作者信息。

### 5.4 搜索引擎发现公开内容

搜索引擎读取 `/sitemap.xml`，获得站点公开页面和全部普通公开详情。列表不包含口令、私有、草稿内容，也不依赖当前 feed 的 50 条上限。

### 5.5 访问受保护或不存在的永久链接

访问口令内容时，初始 HTML 只表达“受保护内容”，并禁止索引。访问私有、草稿或不存在的 `publicId` 时，对外统一按不存在处理，不透露该标识是否真实存在。

## 6. 详细功能需求

## 6.1 页面元信息

公开页面必须在服务端返回的初始 HTML 中输出页面级信息；客户端只负责 SPA 导航后的同步，不能以客户端补写替代初始 HTML。

| 页面 | 标题规则 | 描述规则 | Canonical | robots | 结构化数据 |
| --- | --- | --- | --- | --- | --- |
| `/` 默认生活频道 | `生活 · 小明同学` | 站点简介与生活频道说明 | 站点根地址 | `index, follow` | `CollectionPage`，关联站点 |
| `/?channel=article` | `文章 · 小明同学` | 文章频道说明 | 保留规范化 `channel=article` | `index, follow` | `CollectionPage` |
| `/?channel=interest` | `兴趣 · 小明同学` | 兴趣频道说明 | 保留规范化 `channel=interest` | `index, follow` | `CollectionPage` |
| 频道标签页 | `#标签 · 频道 · 小明同学` | 明确频道和标签 | 只保留规范化 `channel`、`tag` | `index, follow` | `CollectionPage` |
| `/about` | `关于我 · 小明同学` | 公开简介 | `/about` | `index, follow` | `ProfilePage` 与 `Person` |
| 普通公开 `/p/:publicId` | 内容标题或内容摘要 + 站点名 | 公开正文摘要 | 当前永久链接 | `index, follow` | `BlogPosting` |
| 口令 `/p/:publicId` | `受保护内容 · 小明同学` | 固定的口令访问说明 | 当前永久链接 | `noindex, nofollow, noarchive` | 不输出 |
| 私有、草稿或不存在的 `/p/:publicId` | `页面不存在 · 小明同学` | 固定的不存在说明 | 不输出 | `noindex, nofollow` | 不输出 |
| `/me` 及其子页面 | 固定站主管理标题 | 不包含内容摘要 | 不输出 | `noindex, nofollow, noarchive` | 不输出 |

标题与摘要的内容规则：

1. 长文章使用文章标题；短记录优先使用非空标题。
2. 无标题短记录从公开正文折叠空白后截取前 60 个 Unicode 字符作为页面标题。
3. 既无标题也无正文的媒体记录使用“照片记录”“视频记录”等可理解的内容类型名称与日期组成标题。
4. 描述从公开纯文本内容生成，折叠连续空白并限制在 160 个 Unicode 字符内；空正文使用标题或内容类型说明。
5. Canonical 与 Open Graph URL 使用 `JOURNAL_PUBLIC_BASE_URL` 生成绝对 HTTPS 地址；无关查询参数不得进入 Canonical。
6. 页面语言为 `zh-CN`，Open Graph locale 为 `zh_CN`，站点名统一为“小明同学”。

### 6.2 Open Graph、Twitter Card 与 JSON-LD

普通公开页面应输出：

- Open Graph 的标题、类型、URL、图片、描述、站点名与 locale。
- 普通公开详情额外输出发布时间、更新时间、频道和全部公开标签。
- Twitter Card 的卡片类型、标题、描述、图片与图片替代文本。
- 普通公开详情的 `BlogPosting` JSON-LD，至少包含永久链接、标题、摘要、作者、发布时间、更新时间、频道、标签和分享图。
- 首页/频道/标签页使用 `CollectionPage`；关于页使用 `ProfilePage`，其主体是站主 `Person`。

所有正文、标题和标签必须作为数据序列化，不能被解释为 HTML 或脚本。

### 6.3 分享图

每条普通公开详情提供 1200×630 JPEG 分享图，地址稳定且包含内容更新时间版本参数。

分享图按以下明确分支生成：

1. 长文章有封面时，使用封面作为主体。
2. 其他内容存在可展示图片时，选择第一张可展示图片。
3. 只有视频但有预览图时，使用第一张视频预览图。
4. 没有可展示视觉资源时，生成海报型分享图；模板选择复用当前文字海报按 `publicId` 的稳定规则，保留相应构图、色彩和记录/文章标识。P0 不要求把中文正文绘制进位图，标题和摘要由页面元信息承担。

选择到的媒体无法读取或解码时，分享图请求直接返回真实错误，不改用另一张媒体或海报掩盖问题。“没有视觉资源”是正常内容分支，不是失败后的替代路径。

分享图接口只接受当前普通公开内容。口令、私有、草稿和不存在的内容统一返回不存在，不生成通用图，也不暴露媒体。

### 6.4 Sitemap

新增 `/sitemap.xml`，内容包括：

- 站点根页。
- 文章、兴趣两个非默认频道的规范 URL；生活频道使用根页，不重复列出带默认参数的 URL。
- 关于页。
- 站点设置中当前启用的每个频道公开标签页。
- 数据库中全部已发布且 `visibility=public` 的代表记录永久链接。

每条内容的 `lastmod` 使用真实 `updatedAt`；站点、频道、标签和关于页使用公开资料的 `updatedAt`。Sitemap 使用 UTF-8、绝对 URL 和正确 XML 实体转义。

明确排除：

- 口令、私有和草稿内容。
- `/me`、投稿、编辑器和设置页面。
- 当前未配置的任意标签查询。
- 带无关查询参数的重复 URL。

生成过程中发生数据库或 XML 序列化错误时，接口直接失败，不返回空 sitemap 或旧文件。

### 6.5 Feed 自动发现与可见订阅入口

1. 主应用 HTML head 固定声明 `/rss.xml`，类型为 `application/rss+xml`。
2. 主应用 HTML head固定声明 `/feed.json`，类型为 `application/feed+json`。
3. 两个声明都使用 `rel=alternate`、清晰的 title 和站内绝对路径。
4. 关于页新增“订阅更新”区域，RSS 是主入口，JSON Feed 是并列的结构化订阅入口。
5. 两个可见入口直接指向现有 feed，不经过中间页面，不要求登录。
6. 本需求不改变 feed 的排序、正文格式、媒体 enclosure 和最近 50 条上限。

### 6.6 公开详情分享动作

仅在 `visibility=public` 且已发布的详情中显示分享动作：

- “复制链接”始终显示，复制当前内容的 Canonical 永久链接；成功后显示“链接已复制”。
- 浏览器存在 Web Share API 时显示“分享”，传入页面标题、摘要和 Canonical URL。
- 浏览器不支持系统分享时不显示“分享”；“复制链接”仍作为独立动作存在。
- 系统分享失败时显示真实错误，不自动转为复制链接；用户主动取消系统面板视为结束操作，不显示失败提示。
- 剪贴板写入失败时显示真实错误，不使用隐藏输入框或其他复制通道。
- 操作位于详情信息区，桌面与移动详情共用；键盘可到达并有明确可见焦点。
- 信息流内短记录覆盖层、直接打开的短记录永久页和长文章永久页三条真实阅读路径都必须出现同一组动作；不能因为它们当前使用不同渲染组件而只覆盖其中一条。

口令详情即使已在当前浏览器解锁，也不显示本组公开分享动作，且客户端 head 继续保持通用受保护元信息。

### 6.7 SPA 导航后的 head 同步

1. 从信息流打开普通公开详情后，浏览器标题、描述、Canonical、社交标签和 JSON-LD 切换为该内容。
2. 关闭详情或切换频道后，所有页面级节点恢复为目标页面信息，不残留上一条详情的数据。
3. 从一条详情切换到另一条详情时，旧 JSON-LD 和旧分享图节点必须被替换，而不是累加。
4. 直接访问详情时，服务端 head 是初始事实来源；Vue 接管页面不得先把它覆盖成固定站点标题。
5. head 同步由路由完成事件和现有详情加载/打开事件驱动，不新增 `watch`、RAF 或轮询。

### 6.8 与后续公开发现页面的衔接

P0-03 会新增 `/search`、`/archive` 和 `/archive/:year/:month`。P0-01 建立的页面元信息、初始 HTML 和 sitemap 必须保持可扩展：

- 搜索结果使用 `noindex, follow`，不进入 sitemap。
- 归档总览和有内容的年月页面使用各自 Canonical 和 `CollectionPage`，并进入 sitemap。
- 后续路由只能扩展同一个 head 所有者，不得恢复静态 shell 或并行维护另一套页面标题。

## 7. 权限与隐私规则

| 能力 | 普通公开 | 口令 | 私有/草稿 | 不存在 |
| --- | --- | --- | --- | --- |
| 内容级标题/摘要 | 有 | 无 | 无 | 无 |
| 内容级 Open Graph/Twitter Card | 有 | 仅固定通用文字，无媒体 | 无 | 无 |
| JSON-LD | 有 | 无 | 无 | 无 |
| 分享图接口 | 有 | 404 | 404 | 404 |
| Sitemap | 收录 | 不收录 | 不收录 | 不收录 |
| RSS/JSON Feed | 沿用现有公开收录 | 不收录 | 不收录 | 不适用 |
| 详情分享动作 | 有 | 无 | 无 | 无 |
| robots | `index, follow` | `noindex, nofollow, noarchive` | `noindex, nofollow` | `noindex, nofollow` |

补充约束：

- 是否已经输入过口令、是否持有站主登录 Cookie，都不能改变口令详情的服务端公开元信息。
- 页面元信息不得包含访问口令、内部数字 ID、媒体存储路径、Telegram 原始消息或结构化内容。
- 私有、草稿与不存在的 `publicId` 对外使用同一不存在行为，避免通过状态差异确认内容存在。
- 内容从公开改为口令或私有后，sitemap、页面 head、分享图接口和 feed 都以当前权限为准。

## 8. 完成标准

1. 首页、两个非默认频道、标签页和关于页的初始 HTML 分别包含唯一且正确的标题、描述、Canonical、Open Graph 和相应 JSON-LD。
2. 普通公开详情的初始 HTML 包含该内容的唯一页面元信息、`BlogPosting` JSON-LD 与可访问分享图；无需执行前端脚本即可读取。
3. 口令详情的初始 HTML 与解锁后的客户端 head 都不出现真实标题、正文、标签和媒体地址，并始终禁止索引。
4. 私有、草稿和不存在的详情返回相同的对外不存在结果，不进入任何发现输出。
5. `/sitemap.xml` 覆盖全部普通公开代表记录和规定的公共入口，并排除其他权限和管理页面。
6. 任意公开页面的 head 都能发现 RSS 与 JSON Feed；关于页能直接看到并打开两种订阅入口。
7. 普通公开详情能复制规范永久链接；支持系统分享的设备显示独立分享动作，不支持时不出现该动作。
8. SPA 内连续打开和关闭多条详情后，head 中每类页面元信息都只有当前页面的一份。
9. 直接访问 `/about` 能返回主应用及关于页元信息，不再由服务端返回未注册路由结果。
10. 本功能没有引入 newsletter、跨平台发布、SSR 框架、分享追踪、`watch`、RAF、重试或失败兜底。

## 9. 参考依据

- [Ghost SEO](https://ghost.org/help/seo/)：个人发布系统默认提供 Canonical、sitemap、结构化数据与社交卡片的产品案例。
- [Open Graph protocol](https://ogp.me/)：Open Graph 基础与图片结构化属性。
- [Schema.org BlogPosting](https://schema.org/BlogPosting)：博客内容结构化数据类型。
- [Google Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)：`BlogPosting`、作者、发布时间和更新时间等字段建议。
- [Google Canonical 指南](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)：HTML 源中的绝对 Canonical 与自引用 Canonical。
- [Google robots meta 说明](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)：页面级索引控制。
- [Sitemaps protocol](https://www.sitemaps.org/protocol.html)：XML 结构、绝对 URL、`lastmod` 与实体转义。
- [WHATWG HTML `rel=alternate`](https://html.spec.whatwg.org/multipage/links.html#rel-alternate)：feed 自动发现基础。
- [JSON Feed 1.1 Discovery](https://www.jsonfeed.org/version/1.1/)：`application/feed+json` 自动发现声明。
- [W3C Web Share API](https://www.w3.org/TR/web-share/)：系统分享数据与用户主动分享行为。
