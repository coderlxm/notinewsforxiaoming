# About 页面个人简历上传、权限与展示方案

## 1. 目标

在现有“关于我”页面增加个人简历入口，管理员可以上传一份本地 Markdown 或 PDF 简历，访客可以通过稳定地址阅读、下载和转发。

P0 聚焦一条最短主路径：

1. 管理员在站点设置中上传一份简历。
2. 新文件直接替换当前简历。
3. 上传后默认为“仅自己可见”，管理员再选择访问口令、限时链接或完全公开。
4. 完全公开或访问口令模式下，“关于我”出现简历入口；限时分享只通过生成的秘密链接进入。
5. 获得权限的访客进入 `/resume` 阅读，并可下载原文件。
6. 管理员可以替换简历、改变权限或下线；每次权限变化立即使旧授权失效。

本功能仍按单用户个人站点设计，不引入简历库、版本管理或内容协作流程。

## 2. 当前项目事实

以下结论来自当前源码和依赖，而不是历史文档：

- `web/src/components/about/AboutView.vue` 已通过 `siteProfile` store 展示头像、Bio、自我介绍和联系方式，适合直接消费一份轻量的简历摘要。
- `web/src/components/settings/SiteProfileSettingsView.vue` 已按公开资料、联系方式、频道标签、投稿链接分区；头像上传也已经使用 `useFileDialog`。
- `web/src/router.ts`、`web/src/app/appRoute.ts` 和 `web/src/app/appRouteTypes.ts` 共同维护公开路由及应用内部路由模型，新增公开页面时三处需要同步。
- 服务端已经使用 `@fastify/multipart` 接收文件、使用 `file-type` 识别真实文件格式，并使用 `content-disposition` 生成下载响应头。
- 项目已经安装 `marked 18.0.6` 和 `sanitize-html 2.17.6`，可以在不新增 Markdown 依赖的情况下完成解析与安全清洗。
- 站点资料采用 SQLite 单例记录；简历正文不应并入该记录，否则每次读取头像、Bio 或标签时都可能连带读取 PDF 二进制内容。
- 服务端已有 SPA HTML 回送逻辑，因此 `/resume` 可以沿用现有直接访问路径，不需要新增部署规则。

## 3. 联网调研结论

### 3.1 产品形态

[GitHub 官方个人网站示例](https://github.com/github/personal-website)把详细简历作为独立页面，并使用文件名形成可直接分享的稳定 URL；[Reactive Resume 项目](https://github.com/amruthpillai/reactive-resume)也把唯一链接分享和 PDF 导出作为两项并列能力。对本项目而言，最合适的组合因此不是把完整简历塞进 About，而是“About 提供入口、独立地址负责阅读、原文件负责下载”。

### 3.2 Markdown

[Marked 官方文档](https://marked.js.org/)明确说明解析结果不会被自动清洗，输出 HTML 在进入页面前必须经过独立的 HTML sanitizer。当前项目已有 `sanitize-html`，因此正确路径是“服务端 Marked 解析 → 服务端 sanitize-html 白名单清洗 → 前端展示清洗后的 HTML”，而不是在浏览器里直接解析后写入 DOM。

当前锁定的 `sanitize-html 2.17.6` 已高于 [GitHub Advisory 对相关问题给出的修复版本 2.17.4](https://github.com/advisories/GHSA-rpr9-rxv7-x643)，本功能无需为此升级依赖。

### 3.3 PDF

[PDF.js 官方入门文档](https://mozilla.github.io/pdf.js/getting_started/?lang=en)和[官方示例](https://mozilla.github.io/pdf.js/examples/index.html)表明，自定义 PDF 阅读器需要引入显示层、worker、逐页 canvas 渲染及高分屏缩放逻辑；[官方集成说明](https://github.com/mozilla/pdf.js/wiki/Setup-pdf.js-in-a-website)也要求处理构建与 worker 配置。其当前实现还包含基于 `requestAnimationFrame` 的渲染调度，可在 [PDF.js API 源码](https://mozilla.github.io/pdf.js/api/draft/api.js.html)中查到，与本项目禁止 RAF 的代码约束不一致。

本项目只是公开展示一份个人 PDF，不需要页缩略图、批注、搜索或自定义渲染工具栏。P0 应使用浏览器原生 PDF 阅读能力，通过同源 `<iframe>` 展示；`iframe` 的基本嵌入方式和可访问名称要求可参考 [MDN iframe 文档](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)。

PDF 文件接口应明确返回 `Content-Disposition: inline`，下载接口明确返回 `attachment`；两种响应语义见 [MDN Content-Disposition 文档](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition)。同时发送 `X-Content-Type-Options: nosniff`，避免浏览器把上传内容解释成其他类型，依据见 [MDN X-Content-Type-Options 文档](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options)。

### 3.4 上传边界

[Fastify multipart 官方文档](https://github.com/fastify/fastify-multipart)支持单文件读取和路由级 `fileSize` 限制；[file-type 官方文档](https://github.com/sindresorhus/file-type)提供基于文件魔数的 `fileTypeFromBuffer`。因此 PDF 必须同时满足扩展名、声明 MIME 和真实字节类型，不能只相信浏览器传来的文件名或 MIME。

### 3.5 权限与秘密链接

[OWASP Password Storage 指南](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)要求口令以带独立盐值的慢哈希保存，并把 scrypt 列为可接受算法；当前项目已经用 Node `crypto.scrypt` 处理公开内容访问口令，可以复用同一实现，数据库不保存明文。

[OWASP Session Management 指南](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)建议访问会话使用 `Secure`、`HttpOnly` 和明确的 `SameSite` Cookie，不把会话秘密写入 localStorage。简历解锁后也应使用同源签名 Cookie，PDF iframe 和下载接口自然携带该授权。

[OWASP 临时令牌建议](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)要求 URL 令牌由密码学安全随机数生成、足够长、安全存储并设置过期时间。项目现有投稿链接已经采用 `randomBytes(32)`、URL-safe token 和数据库 SHA-256 摘要，限时简历链接直接复用这条成熟路径。

访问口令还需要限制在线猜测。当前依赖没有限流插件；[`@fastify/rate-limit` 官方兼容表](https://github.com/fastify/fastify-rate-limit)明确 `10.x` 及以上匹配 Fastify 5，因此 P0 新增这一项依赖，只应用于简历口令解锁接口，不手写计数器。

## 4. 方案选择

| 内容类型 | 候选方式 | 结论 | 原因 |
| --- | --- | --- | --- |
| Markdown | 浏览器端解析 | 不采用 | 安全边界落在前端，公共接口也无法直接复用已清洗结果 |
| Markdown | 服务端解析并清洗 | 采用 | 复用现有 `marked` 与 `sanitize-html`，HTML 只有一个可信来源 |
| PDF | PDF.js 自定义阅读器 | 不采用 | 引入额外依赖、worker 和渲染状态，并触碰项目 RAF 禁令 |
| PDF | 浏览器原生 `<iframe>` | 采用 | 保留原 PDF 排版，不增加前端渲染系统，适合单文件个人站点 |
| PDF | 转图片或转 HTML | 不采用 | 增加转换链路，破坏文本选择、下载和原文件保真度 |

最终形态为：About 页面只放入口卡片，完整简历位于独立公开页面 `/resume`。这样不会让多页 PDF 撑长 About，也能提供一个长期稳定、方便直接转发的地址。

权限不是附加补丁，而是简历资源的首版组成部分。推荐采用四个互斥模式：

| 模式 | About 公开入口 | 固定 `/resume` | 分享方式 |
| --- | --- | --- | --- |
| 仅自己可见 | 不展示 | 仅管理员可访问 | 不分享 |
| 访问口令 | 展示“需口令” | 输入口令后访问 | 分享固定地址和 6 位口令 |
| 限时链接 | 不展示 | 普通访客返回 404 | 分享包含随机 token 的限时地址 |
| 完全公开 | 展示 | 直接访问 | 分享固定地址 |

四种模式互斥，避免出现“限时链接是否还要再输口令”等组合状态。上传后的默认模式必须是“仅自己可见”，不会因为文件上传成功而自动公开。

## 5. 用户体验

### 5.1 关于我

当 `siteProfile.resume` 为完全公开或访问口令模式时，在自我介绍之后、联系方式之前增加 `AboutResumeCard`。组件名虽然沿用 Card，但视觉上应是 About 的一个内容章节，而不是独立的后台卡片：

- 标题：`个人简历`
- 辅助信息：`Markdown · 更新于 2026年08月16日` 或 `PDF · 更新于……`
- 访问口令模式额外显示低强调度的“需访问口令”，不透露口令本身。
- 操作提示使用与现有页面一致的箭头图标，不使用文字按钮堆叠。
- 整张卡片通过 `RouterLink` 进入 `/resume`。

仅自己可见、限时链接或未上传时完全不渲染该区域，不展示空状态，也不向普通访客暴露简历是否存在。

### 5.2 公开简历页

页面顶部保持轻量工具栏：返回“关于我”、下载原文件；完全公开和访问口令模式额外提供复制固定 `/resume` 地址。限时链接的完整地址只在管理端生成时出现，访问者页面不会把已经从地址栏移除的 token 再次暴露出来。主体按格式区分：

- Markdown：使用项目排版变量渲染正文，控制阅读宽度，支持标题、列表、引用、代码块、表格与链接；浅色、深色和打印样式跟随站点主题。
- PDF：同源 `<iframe title="小明同学的个人简历">` 占据视口主要高度，文件接口以 `inline` 返回，让浏览器原生 PDF 阅读器负责缩放、分页和打印。

进入 `/resume` 后才请求简历正文或 PDF 文件。普通信息流及 About 页面只读取几十字节的摘要，不下载正文。

不同权限的进入行为：

- 仅自己可见：管理员登录状态可以阅读；其他请求进入现有 404 页面。
- 访问口令：先显示与项目现有受保护内容一致的 6 位口令输入区，成功后原地显示简历。
- 限时链接：地址形如 `/resume#token=<secret>`；页面把 token 交换为签名 Cookie 后立刻从地址栏移除 fragment，再读取简历。
- 完全公开：直接读取简历。

保护模式和限时模式下，Markdown 数据、PDF iframe 与下载接口都必须经过同一服务端权限判断，不能只保护页面 JSON 而让原文件 URL 可直接访问。

### 5.3 管理入口

在 `/me/settings` 增加独立的“个人简历”分区，由 `SettingsResumePanel.vue` 负责：

- 未上传：展示支持格式、大小限制和“选择文件”。
- 已上传：展示文件名、格式、更新时间、当前权限，以及“查看”“替换”“下线”。
- 选择文件后直接明确展示待上传文件，再由用户点击“上传简历”。
- 上传、替换、下线都是独立操作，不并入现有公开资料的统一保存按钮和脏状态。

权限区使用四项单选，不做多开关组合：

- 仅自己可见：保存后立即撤销当前口令会话或限时链接。
- 访问口令：设置或替换 6 位数字口令；输入框使用 `autocomplete="new-password"`，页面不回显已有口令。
- 限时链接：选择 `1 小时`、`24 小时`、`3 天`、`7 天` 或不超过 `30 天`的自定义到期时间，生成后展示完整链接和复制操作。
- 完全公开：明确提示“任何人都可以访问并下载”，由用户确认后生效。

限时 token 只在创建响应中返回一次。页面刷新后只显示创建时间和到期时间；需要再次获得完整地址时重新生成，新链接立即替换旧链接。

独立提交可以避免替换 PDF 时连带提交 Bio、头像和联系方式，也避免在现有 `SiteProfileSettingsView` 中继续扩大文件状态管理。

### 5.4 视觉融合硬约束

实现不能重新设计一套“简历主题”，必须延续当前 About 的编辑感和全站设计变量：

- 页面宽度直接沿用 `.about-view` 的 `min(calc(100% - var(--page-gutter) * 2), 960px)`，Markdown 正文沿用 `--reading-width`，不再发明新的桌面断点和内容宽度。
- 简历入口沿用 `AboutContactList` 的视觉语言：`2px` 左侧强调线、紧凑的标签与正文层级、hover/focus 时由 `--border-subtle` 过渡到 `--accent`；不使用投影、渐变、大面积强调色或悬浮位移。
- 页面标题和 Markdown 正文使用 `--font-serif`；文件格式、更新时间和工具栏使用 `--font-sans`，与 About 当前“内容衬线、辅助信息无衬线”的关系一致。
- 颜色只能来自 `--surface-page`、`--surface-card`、`--surface-muted`、`--text-primary`、`--text-muted`、`--border-subtle`、`--border-strong`、`--accent` 和 `--accent-strong`，禁止在简历组件内新增亮色/暗色硬编码。
- 圆角只使用 `--radius-card` 和现有按钮的 `8px`；PDF 外框使用 `--radius-card`，不增加新的圆角层级。
- 操作复用全局 `.button`、`.button--quiet` 或 `.text-button`；图标复用项目已有 SVG 线性图标语言，不引入 Element Plus 图标或新的图标库。
- 链接必须使用 `RouterLink`/`a`，操作必须使用 `button`；图标按钮提供 `aria-label`，装饰图标标记 `aria-hidden="true"`，所有交互保留现有 `:focus-visible` 轮廓。
- 文件名允许任意长度，容器设置 `min-width: 0` 并进行单行截断；日期通过 `Intl.DateTimeFormat` 生成，不在模板中拼接固定格式。
- 手机端保持 About 现有纵向节奏，操作触点最小高度为 `2.75rem`；不通过 JavaScript 测量布局，不添加横向滚动。
- 不增加持续动画。若加入轻微的进入或 hover 过渡，只允许 `opacity`、颜色和边框色，并遵守 `prefers-reduced-motion`。

Markdown 的站内呈现可以完全遵守这些规则。PDF 的页面外壳、工具栏、间距和边界同样可以统一，但 `<iframe>` 内部的浏览器原生 PDF 工具栏由 Chrome、Safari 等浏览器自行绘制，站点 CSS 无法控制，因此不能承诺该内部控件与项目风格一致。P0 接受这一明确边界，以避免引入 PDF.js；如果未来要求 PDF 阅读器内部也完全品牌化，需要重新评估 PDF.js 与项目 RAF 禁令之间的取舍。

## 6. 数据设计

新增迁移和单例表 `journal_site_resume`：

```sql
CREATE TABLE journal_site_resume (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  format TEXT NOT NULL CHECK (format IN ('markdown', 'pdf')),
  original_name TEXT NOT NULL,
  content BLOB NOT NULL,
  rendered_html TEXT,
  access_mode TEXT NOT NULL DEFAULT 'private'
    CHECK (access_mode IN ('private', 'protected', 'temporary', 'public')),
  access_password_hash TEXT,
  access_grant_id TEXT NOT NULL,
  access_revision INTEGER NOT NULL DEFAULT 1 CHECK (access_revision > 0),
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL,
  CHECK (
    (format = 'markdown' AND rendered_html IS NOT NULL)
    OR (format = 'pdf' AND rendered_html IS NULL)
  ),
  CHECK (
    (access_mode = 'protected' AND access_password_hash IS NOT NULL)
    OR (access_mode <> 'protected' AND access_password_hash IS NULL)
  )
);

CREATE TABLE journal_resume_share_link (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

选择独立 SQLite BLOB 的理由：

- 系统只保存一份当前简历，容量边界明确，不需要建立通用文件系统。
- 替换和下线可以保持单事务。
- 简历会自然进入现有数据库备份范围。
- 与 `journal_site_profile` 分表，站点资料查询不读取正文 BLOB。
- 与信息流资产分离，简历不会进入“我的资产”、公开瀑布流或条目媒体处理链路。
- 限时分享只保留一个当前链接，符合个人工具的最短管理路径；数据库只保存 token 摘要。

限制：

- PDF：最大 10 MiB。
- Markdown：最大 1 MiB，仅接受 UTF-8 的 `.md` 或 `.markdown` 文本。
- P0 的 Markdown 简历只支持单文件文本，不支持本地相对图片、内嵌 data URL 或随文件上传的资源目录。

`revision` 每次替换递增，用于生成版本化文件 URL；`access_revision` 和随机生成且不可复用的 `access_grant_id` 在权限模式或口令改变时一同更新，用于使旧 Cookie 立即失效，并防止删除后重新上传时版本号从头开始导致旧 Cookie 命中新简历。切换出限时模式时删除分享链接；下线简历时同时删除两个单例记录。

## 7. 共享类型

在 `src/shared/journalProtocol.ts` 增加：

```ts
type JournalResumeFormat = 'markdown' | 'pdf';
type JournalResumeAccessMode = 'private' | 'protected' | 'temporary' | 'public';

interface JournalResumeSummary {
  format: JournalResumeFormat;
  originalName: string;
  updatedAt: string;
  viewUrl: '/resume';
  accessMode: 'protected' | 'public';
}

type JournalPublicResume =
  | {
      kind: 'locked';
      accessMode: 'protected';
    }
  | {
      kind: 'resume';
      format: 'markdown';
      accessMode: JournalResumeAccessMode;
      originalName: string;
      updatedAt: string;
      renderedHtml: string;
      downloadUrl: string;
    }
  | {
      kind: 'resume';
      format: 'pdf';
      accessMode: JournalResumeAccessMode;
      originalName: string;
      updatedAt: string;
      contentUrl: string;
      downloadUrl: string;
    };

interface JournalAdminResumeSummary {
  format: JournalResumeFormat;
  originalName: string;
  updatedAt: string;
  accessMode: JournalResumeAccessMode;
  temporaryShare: { createdAt: string; expiresAt: string } | null;
}
```

`journalSiteProfileSchema` 增加 `resume: JournalResumeSummary | null`。只有完全公开和访问口令模式返回摘要；仅自己可见和限时模式返回 `null`。管理页通过独立管理员接口读取完整状态。

## 8. 服务端接口

### `GET /api/site-profile`

沿用现有接口，在返回值中增加可公开发现的 `resume` 摘要。About 页面不需要额外请求。

### `GET /api/resume`

执行统一访问判断：

- 管理员、完全公开或持有有效简历访问 Cookie：返回简历内容。
- 访问口令模式且尚未解锁：返回 `kind: 'locked'`。
- 仅自己可见、限时模式但没有有效授权、没有简历：返回 404。

获得访问权限后，Markdown 返回已经清洗的 `renderedHtml`，PDF 返回版本化 `contentUrl`。

### `GET /api/resume/file?v=<revision>`

返回原文件供页面内展示：

- PDF：`Content-Type: application/pdf`、`Content-Disposition: inline`。
- Markdown：`Content-Type: text/markdown; charset=utf-8`、`Content-Disposition: inline`。
- 两者都发送 `X-Content-Type-Options: nosniff`。
- URL 带当前 `revision`，替换简历后 URL 会改变。
- 响应使用 `Cache-Control: no-store`，保证替换或下线后旧简历不会继续被浏览器或中间缓存公开提供。
- 每次请求重新执行当前简历权限判断；不能因为 URL 带 revision 就绕过权限。

### `GET /api/resume/download?v=<revision>`

返回同一原文件，使用经过 `content-disposition` 生成的 `attachment` 文件名。

### `POST /api/resume/unlock`

仅在访问口令模式接受 6 位数字口令。通过现有 scrypt 匹配后设置签名访问 Cookie，Cookie 同时绑定当前权限模式、`access_revision` 和 `access_grant_id`，使用 `Secure`、`HttpOnly`、`SameSite=Lax`、`Path=/api/resume` 且不设置持久化 `Max-Age`。接口由 `@fastify/rate-limit` 限制为全站每分钟 5 次尝试。

### `POST /api/resume/share-session`

从 `Authorization: Bearer <token>` 读取限时 token，计算 SHA-256 后查询当前单例链接并检查 `expires_at`。成功后设置签名访问 Cookie，其有效期不超过链接剩余时间；此后的正文、PDF 和下载请求仍在服务端核对 Cookie 中的到期时间与当前链接记录，不能只依赖浏览器删除过期 Cookie。token 不进入 JSON body、query string、服务端日志或 Cookie。

前端只从 URL fragment 读取 token；交换成功后使用 Vue Router 的 `replace` 移除 fragment。该流程延续项目现有投稿链接不把 token 发送给服务器 HTML 路由的做法。

### `PUT /api/me/resume`

管理员认证的单文件 multipart 接口。一次只接受字段名 `resume` 的一个文件，并执行：

1. 路由级文件大小限制。
2. 校验安全文件名和允许的扩展名。
3. PDF 使用 `fileTypeFromBuffer` 确认真实字节为 PDF。
4. Markdown 确认是有效 UTF-8 文本。
5. Markdown 使用独立 `Marked` 实例解析，再通过专用 `sanitize-html` 白名单生成公开 HTML。
6. 单事务写入原文件、格式、文件名、清洗后的 HTML、递增 revision 和更新时间；PDF 的 `rendered_html` 为 `null`。

接口成功后返回新的 `JournalAdminResumeSummary`。初次上传处于私有模式，因此公开 `siteProfile.resume` 仍为 `null`；只有后续切换到访问口令或完全公开时才更新公开摘要。

初次上传固定写入 `access_mode = 'private'`。替换文件保留当前权限模式和口令/限时链接，但递增文件 revision；已经打开的页面随后读取的是新文件。

### `GET /api/me/resume`

返回管理员摘要、当前权限模式和限时链接的创建/到期时间，不返回口令、口令哈希、token 或 token 摘要。

### `PUT /api/me/resume/access`

接受以下判别联合之一：

```ts
type JournalResumeAccessInput =
  | { accessMode: 'private' }
  | { accessMode: 'protected'; password: string }
  | { accessMode: 'temporary'; expiresAt: string }
  | { accessMode: 'public' };
```

权限变更在单事务中写入模式、口令哈希或限时链接，并递增 `access_revision`。限时模式的成功响应是唯一一次返回完整 `shareUrl` 的位置。切换模式时删除不再适用的口令哈希和限时链接。

### `DELETE /api/me/resume`

管理员认证后在单事务中删除简历与限时链接。成功后返回 204，前端将 `siteProfile.resume` 设为 `null`。

## 9. Markdown 安全与排版规则

服务端专用 sanitizer 仅允许：

- 结构：`h1`～`h6`、`p`、`ul`、`ol`、`li`、`blockquote`、`hr`、`br`
- 强调：`strong`、`em`、`s`
- 代码：`code`、`pre`
- 表格：`table`、`thead`、`tbody`、`tr`、`th`、`td`
- 链接：`a[href]`

链接只允许 `http`、`https` 和 `mailto`，统一增加 `target="_blank"` 与 `rel="noopener noreferrer"`。不允许 `style`、事件属性、`script`、`iframe`、`object`、`embed`、`img` 或 SVG。

前端唯一的 `v-html` 位置位于 `MarkdownResumeViewer.vue`，输入类型和命名明确为服务端已清洗的 `renderedHtml`，不接受原始 Markdown 或任意 HTML。

## 10. 前端结构

建议新增：

```text
web/src/components/about/AboutResumeCard.vue
web/src/components/resume/ResumeView.vue
web/src/components/resume/ResumeAccessGate.vue
web/src/components/resume/MarkdownResumeViewer.vue
web/src/components/resume/PdfResumeViewer.vue
web/src/components/settings/SettingsResumePanel.vue
web/src/components/settings/SettingsResumeFilePanel.vue
web/src/components/settings/SettingsResumeAccessPanel.vue
```

职责边界：

- `AboutResumeCard` 只接收摘要并负责公开入口视觉。
- `ResumeView` 只负责读取 `/api/resume`、页面标题、访问状态编排和顶部操作。
- `ResumeAccessGate` 接收 locked 状态并向上发出 6 位口令提交事件，不直接调用 API。
- 两种 Viewer 只负责各自格式展示，不包含请求和路由逻辑。
- `SettingsResumePanel` 是管理区组合层，只持有当前管理员摘要并协调两个子面板。
- `SettingsResumeFilePanel` 负责文件选择、上传、替换与下线，通过 typed emits 把操作提交给父层。
- `SettingsResumeAccessPanel` 负责四种权限选择、口令和限时到期输入，通过判别联合事件提交权限变更。
- `siteProfile` store 仍是公开摘要的唯一前端状态来源，不新增简历全局 store。

路由增加：

```ts
{
  path: '/resume',
  name: 'resume',
  component: () => import('./components/resume/ResumeView.vue'),
}
```

同时在 `AppRoute` 联合类型、`parseAppRoute`、`useAppRoute` 的普通页面分支和页面标题映射中加入 `resume`。使用路由级懒加载后，简历页面代码不会进入访客首次打开信息流所需的主组件路径。

## 11. 服务端结构

建议新增：

```text
src/journal-server/resumeService.ts
src/journal-server/routes/resume.ts
```

并在现有层次中补充：

- `migrations.ts`：创建单例表。
- `repository.ts`：补充简历内容、权限状态和单例限时链接所需的直接读写方法。
- `server.ts`：注册简历路由。
- `siteProfileService.ts`：组装 `resume` 摘要，不读取内容 BLOB。
- `src/shared/journalProtocol.ts`：共享 schema 和类型。
- `package.json`、`pnpm-lock.yaml`：增加与 Fastify 5 匹配的 `@fastify/rate-limit`。

`resumeService` 集中处理上传识别、Markdown 解析清洗、响应模型和版本 URL；路由只负责认证、multipart 读取及 HTTP 响应头。

`resumeService` 同时是所有简历内容接口唯一的权限入口，按管理员 Cookie、access mode、`access_revision` 和限时到期时间做出确定判断。文件接口不得自行复制一套较弱的条件。

## 12. P0 交付范围

- 一份 Markdown 或 PDF 当前简历。
- 管理端上传、替换和下线。
- 默认为仅自己可见。
- 访问口令、限时链接和完全公开三种可选分享方式。
- 权限切换、旧授权失效、限时链接到期与重新生成。
- 访问口令与完全公开模式下的 About 简历入口。
- 独立 `/resume` 阅读页，以及与权限模式对应的固定地址或限时地址。
- Markdown 安全渲染和站点主题排版。
- PDF 浏览器原生展示。
- 获得权限后的原文件下载，以及管理端分享地址复制。
- 手机、平板和桌面布局。
- 深色、浅色与跟随系统主题。
- About 入口、公开页外壳和管理面板遵守第 5.4 节视觉融合约束。

## 13. 暂不纳入

- 多份简历、历史版本和回滚。
- 浏览器内编辑 Markdown。
- Markdown 与 PDF 相互转换。
- PDF.js、自定义分页、页缩略图、全文搜索或批注。
- Markdown 附件包、本地图片和远程图片。
- OCR 和访问统计。
- 同时叠加口令与到期时间、多个并行限时链接、一次性访问链接。
- 为简历链接单独生成 Open Graph 分享卡片；可在实际出现社交平台预览需求后单独补充。

## 14. 实施顺序

1. 增加共享 schema、数据库迁移、repository 与 `resumeService`。
2. 注册 `@fastify/rate-limit`，增加访问口令、限时链接交换及统一内容授权。
3. 增加公开读取、文件展示、下载和管理员写入接口。
4. 扩展 `SiteProfile` 摘要与前端 API 类型。
5. 增加设置页独立简历面板和四种互斥权限设置。
6. 增加 `/resume`、口令入口、两种 Viewer 和路由模型映射。
7. 在 About 页面按权限接入简历入口，并统一主题与响应式样式。

## 15. 预期结果

- 上传 Markdown 并切换到访问口令或完全公开后，About 出现入口；获得权限后 `/resume` 展示经过白名单清洗的排版内容，下载得到原 `.md` 文件。
- 上传 PDF 后，新文件替换旧文件；`/resume` 使用原始 PDF，下载文件名保持上传时名称。
- 新上传的简历只有管理员能够访问，不因上传完成自动公开。
- 访问口令模式只向正确输入口令的浏览器开放正文和原文件。
- 限时模式只能通过当次生成的秘密链接访问，到期、重新生成、切换权限或下线后旧链接不能继续访问。
- 完全公开模式允许任何访客从 About 进入、阅读和下载。
- 普通访客不访问 `/resume` 时，不下载简历正文或 PDF。
- 下线后 About 不再展示入口，公开简历地址不继续返回旧内容。
- 简历文件不会出现在信息流、条目附件或“我的资产”列表中。
