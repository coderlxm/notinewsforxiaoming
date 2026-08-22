# Bilibili 视频内嵌技术调研

调研日期：2026-08-22  
调研范围：`web` 前端、文章服务端富文本链路、普通内容发布链路，以及 Bilibili 站外播放器与 Tiptap 当前公开能力。

## 结论摘要

可以实现，而且不需要下载或代理 Bilibili 视频文件。Bilibili 官方提供站外播放器，使用一个受控的 iframe 地址即可：

```text
https://player.bilibili.com/player.html?bvid=BVxxxxxxxxxx
```

本项目最适合将它作为“文章富文本中的一个独立块节点”保存，而不是把原始 iframe HTML 或 Bilibili 视频页 URL 直接写进正文。文章链路已经使用 Tiptap JSON，编辑器和服务端共用富文本扩展；新增一个受限的 `bilibiliVideo` 节点可以完整覆盖编辑、预览、公开阅读和 RSS HTML 生成。

普通“内容”目前是纯文本正文加附件，文本在页面中会被转义显示，服务端 feed 也按纯文本输出，因此不能通过在 `contentText` 中写入 iframe 来实现内嵌。如果普通内容也必须出现播放器，建议增加一个独立的 Bilibili 外部媒体字段或块，显示在正文/附件区域；如果要求视频出现在文字中间，则应直接使用文章编辑器。

## 当前项目现状

### 文章链路

- `web/src/components/article/RichTextEditor.vue` 使用 Tiptap 编辑器，正文保存为 `JournalRichDocument` JSON。
- `src/shared/journalRichText.ts` 是客户端和服务端共用的节点扩展入口，目前包含 StarterKit、标题唯一 ID 和带 `data-asset-id` 的图片节点，没有 iframe 或视频节点。
- `src/shared/journalProtocol.ts` 对富文本节点类型做 Zod 白名单校验，目前允许 `image`，不允许视频节点。
- `src/journal-server/richText.ts` 在服务端执行节点校验、纯文本提取、HTML 生成和 `sanitize-html` 清洗。目前允许的 HTML 标签只有文字、列表、链接和图片，没有 `iframe`。
- `src/journal-server/articleService.ts` 创建或更新文章时会重新校验并序列化富文本，富文本 JSON 上限为 512 KB。文章正文是否为空目前通过提取出的文本和内联图片判断，视频节点若不纳入判断，视频-only 文章仍会被视为空正文。
- `web/src/components/article/RichArticleRenderer.vue` 使用同一套共享扩展渲染文章预览和阅读页，因此新增节点后可以复用该渲染链路。

当前根目录 `package.json` 声明的 Tiptap 版本为 `3.30.2`，已安装 core、Vue 3、StarterKit、图片、占位符等包；没有安装 `@tiptap/extension-youtube`，也没有 Bilibili 专用 Tiptap 扩展。

### 普通内容链路

- `web/src/components/publisher/EntryPublisherView.vue` 只编辑 `title`、`contentText` 和上传媒体。
- `src/shared/journalProtocol.ts` 将普通 Web 内容定义为纯文本字段；没有富文本正文节点。
- `web/src/components/journal/JournalDetailContent.vue` 以文本节点显示普通正文，不会把正文当 HTML 解析。
- `src/journal-server/routes/feeds.ts` 对普通内容直接输出 `contentText`；文章才调用富文本 HTML 生成器。

因此，普通内容和文章不是同一个渲染模型。两者都支持“视频相关内容”，但“视频在文字中的具体位置”只有文章富文本模型天然支持。

## 外部技术事实

### 1. Bilibili 官方支持站外播放器

Bilibili 的[站外（外链）播放器使用说明](https://player.bilibili.com/)给出了官方 iframe 示例，使用 `player.html` 并传入 `bvid`。文档列出的参数包括：

- `bvid`：UGC 视频 ID，官方示例和文档将其作为必要的视频标识；
- `p`：多 P 视频的集数，从 1 开始；
- `t`：起始时间，单位为秒；
- `danmaku`：弹幕开关；
- `autoplay`、`muted`、`poster`：播放和封面相关选项；
- `refer`：跳链时是否携带当前 Referrer；
- `aid`、`cid`、`seasonId`、`episodeId`：其他视频或番剧标识方式。

本项目第一版只需要保存 `bvid`，必要时再保存 `page` 和 `start`，并由应用生成播放器地址。例如：

```text
https://player.bilibili.com/player.html?bvid=BVxxxxxxxxxx&p=2&t=90&danmaku=0&autoplay=0
```

官方播放器是跨域 iframe。父页面不需要读取 Bilibili 页面内容，也不需要对 Bilibili 请求做 CORS 代理；播放器在自己的源中加载和运行。

### 2. Tiptap 没有 Bilibili 官方扩展

Tiptap 的[官方 YouTube 扩展](https://tiptap.dev/docs/editor/extensions/nodes/youtube)提供了一个成熟的“视频块节点”实现方式，但它只识别 YouTube URL，不能直接改配置后用于 Bilibili。

Tiptap 的[通用 iFrame 示例](https://tiptap.dev/docs/examples/experiments/iframe)明确标注为实验性能力：没有已发布包，也没有持续维护承诺。它可以作为实现自定义节点的参考，但不适合作为本项目的生产依赖。

因此，合理方案不是引入一个通用 iframe 编辑器，也不是允许用户粘贴任意 iframe，而是在现有共享扩展中实现一个只接受 Bilibili 播放器地址的 `bilibiliVideo` 节点。

### 3. CSP 会决定 iframe 能否加载

MDN 对 [`frame-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) 的说明是：它控制 `<iframe>` 等嵌套浏览上下文允许加载的来源；如果没有单独声明 `frame-src`，会回退到 `default-src`。

项目中需要注意两条页面路径：

- `web/index.html` 没有当前这套 CSP meta，生产 Nginx 的 `location /` 也没有设置 CSP。文章编辑和公开文章页面目前没有仓库内可见的 `frame-src` 限制。
- `/contribute` 在 `web/contribute.html`、Fastify 路由和 `deploy/journal/feeds.xmcloud.buzz.conf` 中都使用 `default-src 'self'`，且没有 `frame-src`。如果普通内容的投稿页也要直接预览 Bilibili iframe，需要在实际生效的 CSP 中明确加入 `frame-src https://player.bilibili.com`；只改其中一处可能仍被另一层策略阻断。

播放器 iframe 应保留全屏能力，例如同时设置 `allowfullscreen` 和 `allow="fullscreen"`。若后续 Nginx 或应用增加了限制 fullscreen 的 `Permissions-Policy`，还需要在该策略中允许播放器源；MDN 的[fullscreen Permissions Policy 说明](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/fullscreen)对此有明确约束。

## 推荐实现方案

### 文章：新增受控的富文本块节点

建议的持久化形状如下，只保存业务属性，不保存可被用户任意修改的完整 iframe URL：

```json
{
  "type": "bilibiliVideo",
  "attrs": {
    "bvid": "BVxxxxxxxxxx",
    "page": 2,
    "start": 90
  }
}
```

属性建议保持最小：

- `bvid`：必填，经过格式校验；
- `page`：可选，正整数，对应 Bilibili 的 `p`；
- `start`：可选，非负整数，对应 Bilibili 的 `t`。

应用根据这些属性生成固定格式的 `https://player.bilibili.com/player.html` URL，并固定关闭自动播放；弹幕是否默认关闭可以作为本项目的显示策略，而不是让正文携带任意 query 参数。

编辑器交互建议是“粘贴 Bilibili 视频页 URL → 解析并确认 → 插入视频块”，而不是让用户编辑 iframe。第一版只接受能够直接解析出 BV 号的标准视频页 URL，或直接输入 BV 号；短链解析、自动拉取视频标题/封面、番剧和登录态视频不纳入第一版。这样不需要后端请求 Bilibili，也不会把第三方 HTML 注入文档。

代码层面需要保持客户端与服务端使用同一个节点定义：

1. 在 `src/shared/journalRichText.ts` 增加 `bilibiliVideo` 节点扩展，负责节点 schema、解析和 HTML 输出。
2. 在 `src/shared/journalProtocol.ts` 把节点类型加入白名单，并把 `bvid`、`page`、`start` 的约束写入服务端可执行的校验。
3. 在 `RichTextEditor.vue` 增加“插入 Bilibili 视频”入口和节点选中/删除行为。
4. 在 `RichArticleRenderer.vue` 复用相同扩展，让编辑预览、私有阅读和公开阅读的节点行为一致。
5. 在 `src/journal-server/richText.ts` 的富文本校验中只接受合法 Bilibili 节点，并在生成 HTML 时只输出固定的 Bilibili iframe。
6. 让 `hasArticleBody` 将 `bilibiliVideo` 视为有效正文内容；如果产品允许只有视频的文章，服务端的非空正文判断也必须同步调整。
7. 若 RSS 需要包含播放器，`generateArticleHtml` 的清洗白名单需要显式允许 `iframe` 以及必要属性，并只允许 `player.bilibili.com`。RSS 阅读器可能自行移除 iframe，所以 RSS 不应被当作播放器可用性的唯一验证渠道。

推荐输出的 HTML 形态是响应式的 16:9 容器包裹 iframe：

```html
<div class="article-bilibili-video">
  <iframe
    src="https://player.bilibili.com/player.html?bvid=BVxxxxxxxxxx&danmaku=0&autoplay=0"
    title="Bilibili 视频播放器"
    loading="lazy"
    allow="fullscreen"
    allowfullscreen
  ></iframe>
</div>
```

实际代码不应接受用户提交的上述 HTML，而应从已校验的节点属性重新生成。

### 普通内容：单独的外部媒体块，或转入文章

普通内容当前没有正文节点，不能支持视频插入到两段文字之间。若产品只要求“正文下面显示一个引用视频”，可以给普通 Web 内容增加一个受限的 Bilibili 外部媒体字段，并在详情页、公开卡片或媒体区域使用同一个播放器组件渲染。

若产品要求视频和文字任意混排，最短路径是把这类内容作为文章创建，不建议在纯文本字段中发明 HTML 语法。这样可以避免同时维护两套可插入位置的正文协议。

## 不建议的方案

### 把 iframe HTML 直接写进正文

不适用于当前项目：普通正文会转义显示；文章正文会经过 Zod 节点白名单和 `sanitize-html` 清洗。即使现在能显示，也会绕过节点级来源校验，后续很容易变成任意第三方 iframe 注入口。

### 保存 Bilibili 视频页 URL，再让前端任意转换

可以作为链接展示，但不能保证成为播放器；Bilibili 普通视频页和官方站外播放器是不同 URL。转换逻辑应在输入时完成并保存规范化的 `bvid`，而不是在多个渲染端重复猜测。

### 直接引入通用 Tiptap iframe 包

Tiptap 官方通用 iframe 示例目前仍是实验性、无已发布包。对于本项目这样已有服务端 schema 和 HTML 清洗边界的文章系统，自定义一个很小的 Bilibili 节点更容易限制来源，也更容易和现有版本 `3.30.2` 对齐。

### 下载 Bilibili 视频到本地再上传

这会把“引用播放器”扩大成媒体抓取、转码、存储、版权和清晰度管理问题，和当前需求无关，也失去 Bilibili 播放器本身的更新、登录和播放控制能力。

## 风险与边界

- iframe 只引用播放器，不拥有视频内容；视频是否可播放、是否需要登录、弹幕和画质由 Bilibili 及访问者的网络环境决定。
- 播放器是第三方跨站内容，页面加载时会向 Bilibili 发起请求；如果以后需要降低首屏第三方请求，可以在播放器进入视口或用户主动点击后再加载，但这属于体验策略，不是接入前提。
- `Referrer-Policy: no-referrer` 会影响 Bilibili 官方 `refer` 参数所对应的跳链统计；项目不应把该统计当作播放器工作的必要条件。
- 公共文章、私有预览、RSS HTML 和普通内容若使用不同的 HTML/CSP 入口，必须分别纳入同一套来源白名单；不能只让编辑器里能看到而遗漏公开渲染端。
- 不应允许任意 `src`、任意 iframe 属性或任意 iframe HTML。来源、路径、协议、播放参数和 iframe 属性都应由代码固定或从受限字段生成。

## 最终建议

建议把第一批功能边界定为：

1. 先支持文章中插入公开 Bilibili UGC 视频，保存 `bvid`，可选支持分 P 和起始时间。
2. 使用现有 Tiptap JSON 增加 `bilibiliVideo` block node，客户端编辑器、文章阅读器和服务端 HTML 生成共用该节点。
3. 输入端只接受标准视频页 URL 或 BV 号，不接受原始 iframe，不做 Bilibili API 元数据抓取。
4. 普通内容先保持纯文本模型；若必须支持普通内容挂载视频，则增加独立外部媒体块，并接受它不能插入文字中间这一产品约束。
5. 若要在 `/contribute` 页面实时预览播放器，再单独同步修改该页面的 CSP，允许 `https://player.bilibili.com` 的 `frame-src`。

这个方案能复用现有文章链路，新增的第三方能力只暴露一个明确的视频节点，后续即使增加 YouTube 或其他平台，也可以在同一层增加不同的受控节点，而不必开放通用 iframe。

## 参考资料

- [Bilibili 站外（外链）播放器使用说明](https://player.bilibili.com/)
- [Tiptap YouTube extension](https://tiptap.dev/docs/editor/extensions/nodes/youtube)
- [Tiptap iFrame experiment](https://tiptap.dev/docs/examples/experiments/iframe)
- [MDN：Content-Security-Policy header 与 frame-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
- [MDN：Permissions-Policy fullscreen](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/fullscreen)
