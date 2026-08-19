# Journal 引用 Google Drive 视频并在线播放调研

日期：2026-08-19

## 结论

可以接入，而且现有 Journal 已经具备大部分播放基础。推荐的第一阶段方案是：

> 用 Google Drive API 按文件 ID 建立“引用资产”，由 Journal 后端在现有 `/media/:assetId` 地址下代理 Google Drive 的 Range 请求，前端继续使用原生 `<video>`；信息流增加原地点击播放，文章增加 Tiptap 视频块。

这条路线不复制数 GB 的视频到 Journal 数据盘，不要求把 Drive 文件公开分享，也能继续服从 Journal 现有的私有、加密、公开权限。播放器库不是当前瓶颈：原生 `<video>` 已能完成渐进式播放、拖动和全屏；真正缺少的是 Drive 文件引用、同源鉴权和字节范围转发。

第一阶段不建议接入 Google Drive 预览 iframe，也不建议立即引入 HLS.js。HLS.js 只负责播放已经存在的 HLS 清单和分片，不会把当前的 WebM、MP4 原文件自动变成自适应码流；这需要额外转码和派生文件存储，不适合现在 1 CPU、1 GiB 内存的 Journal 容器。

## 当前实现与线上事实

### 已有能力

- 普通信息流已经支持视频资产。`MediaGallery.vue` 在卡片中显示视频海报，进入详情后用原生 `<video controls preload="metadata">` 播放。
- 详情媒体舞台 `JournalMediaStage.vue` 已有视频控制、海报、切换媒体时暂停等逻辑。
- `/media/:assetId` 已统一执行条目权限判断，并通过 Fastify `sendFile` 支持 Range。
- 线上 `feeds.xmcloud.buzz/media/1` 对 `Range: bytes=0-1023` 实际返回 `206 Partial Content`、`Content-Range` 和 `Accept-Ranges: bytes`，Cloudflare 当前保持这条响应链，状态为动态回源。
- 普通网页发布已支持视频上传，但入口限制为单视频 500 MiB、最长 5 分钟，并只接受整理后的 MP4/H.264 或 HEVC + AAC。当前下载的 4K 视频约 2.6 GB、WebM/AV1 + Opus，不适合走现有上传路径。
- 文章正文使用 Tiptap 3 JSON，目前共享扩展只有标题、链接和图片。文章资产服务只允许封面图和正文图，因此文章视频需要新增正式节点，不能伪装成链接或图片。

### Google Drive 与部署现状

- rndc02 宿主机已安装 rclone 1.74.4，并已有 `notinews-drive:` 授权。
- 该远端可直接看到 `NotiNewsDownloads/2026-07`、`2026-08` 等目录。
- Journal 运行在独立 Docker 容器中，目前只挂载 `/opt/journal/data -> /data`，容器没有 Drive 凭据或 Drive 文件系统。
- 现状证明服务器到 Drive 的访问链路成立，但不建议让应用解析或依赖 rclone 的内部 token 配置。Journal 应使用自己的只读 Drive API 授权，职责更清楚。

## 路线比较

| 路线 | 优点 | 关键问题 | 结论 |
| --- | --- | --- | --- |
| Drive `/preview` iframe | 开发量最小，Google 自带播放器 | 依赖第三方 Cookie；界面和移动端行为不可控；文件需要直接满足 Drive 权限；无法严格继承 Journal 的 protected/private 权限 | 不采用 |
| `webContentLink` 或公开直链 | 浏览器直接访问 Drive，不占 Journal 下行 | 私有文件需要 Google 登录；公开分享会绕开 Journal 权限；链接不是适合应用内长期控制的播放接口 | 不采用 |
| rclone mount/serve + 后端代理 | 可复用现有 rclone 授权；Range 和目录读取成熟 | 引用天然依赖文件路径，外部改名或移动会断；还要增加常驻挂载或 sidecar 及启动顺序 | 可做短期原型，不作为正式数据模型 |
| Drive API + Journal Range 代理 | 文件 ID 稳定；无需公开分享；权限、缓存和错误都由 Journal 控制；能列目录和取元数据 | 需要一次只读 OAuth 授权；播放流量经过 rndc02 | 推荐第一阶段 |
| 预转 HLS + HLS.js | 自适应码率和跨网络体验最好 | 必须转码/切片并保存派生文件；计算、存储和流程复杂度明显增加 | 有真实跨端兼容问题后再做 |

Google 官方支持以 `files.get(..., alt=media)` 下载普通二进制文件，也明确支持通过 `Range` 请求指定字节区间。这正好对应 HTML 视频拖动进度时的请求模型。文件无需设置为“知道链接的任何人可看”，Journal 后端持有只读授权即可。[Google Drive 下载与部分下载](https://developers.google.com/workspace/drive/api/guides/manage-downloads)

Drive 自带播放器并不适合作为 Journal 的内嵌基础。Google 的帮助说明明确提到 Drive 视频播放需要第三方 Cookie；iframe 还会把权限判断交给 Google 页面，而不是 Journal。[Google Drive 视频播放说明](https://support.google.com/drive/answer/2423694)

## 推荐架构

```text
信息流卡片 / 文章视频节点
          │
          │ same-origin /media/:assetId + Range
          ▼
Journal 权限判断（public / protected / private）
          │
          │ Drive fileId + Range
          ▼
Google Drive API files.get(alt=media)
          │
          ▼
Journal 流式转发 206 / Content-Range / Content-Length
```

## 关键网络约束：用户端不得直连 Google

国内网络环境无法把 Google 作为浏览器可直接访问的播放源。无论信息流、文章、详情、海报还是拖动进度，用户浏览器都只能请求 `feeds.xmcloud.buzz`；Google Drive API 只能由 rndc02 上的 Journal 服务端访问。

一次播放的完整网络路径为：

```text
用户浏览器
  │ HTTPS Range: bytes=...
  ▼
feeds.xmcloud.buzz
  │ Cloudflare 转发
  ▼
rndc02 Journal
  │ 权限判断
  │ 带服务端凭据和同一 Range 请求 Drive API
  ▼
Google Drive API
  │ 返回指定视频字节
  ▼
rndc02 Journal 流式转发 200/206 响应体
  │
  ▼
Cloudflare → 用户浏览器
```

用户点击播放时，浏览器请求形如 `/media/123`；拖动进度条时仍请求同一个 Journal 地址，只会改变 `Range`。Journal 将 Range 转发给 `files.get(alt=media)`，再把视频字节流、`Content-Range`、`Content-Length`、`Content-Type` 和 `Accept-Ranges` 返回给浏览器。浏览器网络层不应出现 `google.com`、`googleapis.com`、`googlevideo.com` 或 Drive 临时域名。

这是一项实现验收硬约束：

- `/media/:assetId` 必须在 Journal 内完成响应体代理，禁止向浏览器返回 Google 地址。
- 禁止用 `301`、`302`、`307` 或 `308` 把媒体请求重定向到 Google。
- 禁止在前端使用 Drive `/preview` iframe、`webContentLink`、公开直链或直接调用 Drive API。
- Drive service account/OAuth 凭据只能存在于 rndc02 服务端，不能下发到前端。
- Drive `thumbnailLink` 只能由服务端读取；页面海报使用 Journal 本地固化的 `/media/:assetId/preview`。
- 管理端的视频目录浏览和粘贴 Drive 链接也必须走 Journal API，由服务端查询和校验 Drive 文件。

因此，用户不需要能访问 Google、不需要登录 Google，也不依赖第三方 Cookie。Google 文件无需公开分享，Journal 的 private、protected、public 权限不会被绕过。用户侧仍依赖 `feeds.xmcloud.buzz` 当前的 Cloudflare 访问链路，但不依赖 GFW 内的 Google 连通性。

### Drive 授权

推荐为 Journal 创建独立服务账号，把 `NotiNewsDownloads` 和未来存放个人记录视频的固定目录以只读身份共享给它。Google Drive 的文件夹权限会向子文件和子目录继承，因此以后放进这些目录的视频无需逐个公开，也不需要日常重新登录。服务账号密钥只作为 rndc02 的 Journal secret 提供给容器，Drive 文件本身仍保持非公开。[Google Drive 文件夹权限继承](https://developers.google.com/workspace/drive/api/guides/manage-sharing)、[Drive 服务账号与权限角色](https://developers.google.com/workspace/drive/api/guides/ref-roles)

如果未来明确要求引用个人 Drive 任意位置、又不愿把所在目录共享给服务账号，再改用当前个人账号的一次性 OAuth 离线授权和 refresh token；这不是当前固定视频目录主路径所必需的配置。[Google OAuth Web Server 离线访问](https://developers.google.com/identity/protocols/oauth2/web-server)

Node 侧采用 Google 官方维护的 `@googleapis/drive`，当前公开版本为 21.0.0，包含 TypeScript 类型。它比手写 OAuth 和 Drive HTTP 协议更符合项目“优先成熟 npm 库”的约束。[`@googleapis/drive`](https://www.npmjs.com/package/@googleapis/drive)、[Google 官方 Node.js API 客户端](https://github.com/googleapis/google-api-nodejs-client)

### 引用资产数据

`journal_assets` 应区分“内容来源”和“存储位置”：

- `source_kind` 继续表示 Telegram 或 Web 操作来源。
- 新增 `storage_kind: local | google_drive`。
- Drive 资产保存 `drive_file_id`，这是播放引用的身份主键。
- 同时保存引用时的文件名、MIME、大小、宽高、时长和 Drive `modifiedTime`，用于卡片展示和判断外部内容是否已变化。
- `relative_path` 只对本地资产有值；数据库约束保证 local 与 google_drive 两种字段组合不会混用。
- 海报仍作为本地派生小图保存在 Journal 数据目录，避免页面直接使用 Drive 的临时缩略图地址。

Drive 的 `thumbnailLink` 是短期地址，通常仅持续数小时，私有文件还必须带凭据请求，官方也明确不建议网页直接使用。创建引用时可以由后端取回缩略图并固化为本地 WebP 海报。[Drive files 资源说明](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)

### 播放接口

保留现有 `/media/:assetId` 公共形态：

- 本地资产继续走 `sendFile`。
- Drive 资产先执行完全相同的条目权限判断。
- 将浏览器的单段 `Range` 转发给 Drive `files.get(alt=media)`。
- 原样映射上游的 `200/206`、`Content-Range`、`Content-Length`、`Content-Type` 和 `Accept-Ranges`，响应体直接流式传输，不进入内存缓冲区。
- `private` 与 `protected` 保持 `private, no-store`；`public` 初期仍沿用当前 `public, no-cache`，不把 Cloudflare 缓存设计混入第一阶段。
- Drive 返回文件不存在、授权失效或内容已变化时直接暴露明确错误，不自动切换公开链接、iframe 或本地副本。

这样所有前端仍只认识 `/media/:assetId`，现有信息流、详情、文章和 RSS 资产模型不需要知道 Google 凭据。

## 信息流交互

信息流是主入口，建议保持现有“先海报、用户主动播放”的节奏：

1. 卡片首次出现时只加载本地 WebP 海报，不创建真正的视频请求。
2. 用户点击播放按钮后，在卡片原位置替换成 `<video controls playsinline preload="metadata">`，不强制打开详情。
3. 点击视频控制区不触发卡片的详情打开事件；点击正文和其余空白区域仍沿用现有详情逻辑。
4. 同一信息流只保留一个活动播放器。新视频开始播放时暂停前一个，但不重置它的播放时间。
5. 不自动播放、不静音偷跑、不在列表预载完整视频。大文件只在用户明确播放后产生 Range 流量。
6. 详情页和媒体舞台复用同一个底层播放器组件，保持海报、错误和控制行为一致。

Vue 组件边界建议如下：

| 组件/组合函数 | 单一职责 | 输入与输出 |
| --- | --- | --- |
| `JournalVideoPlayer.vue` | 包装原生 `<video>` 和统一播放状态 | props：asset、preload；emits：play、pause、error |
| `JournalInlineVideo.vue` | 管理卡片海报到播放器的显式切换 | props：asset、active；emits：activate |
| `useActiveFeedVideo.ts` | 保存当前活动 asset ID，并触发前一个播放器暂停 | 返回只读 active ID 和 activate 动作 |
| `DriveVideoReferencePicker.vue` | 在管理端列出 Drive 视频并提交引用 | props：已选 ID；emits：select、close |

`FeedView`、`PublicFeedView` 等路由级组件只负责持有“当前活动视频”并向卡片传递，不承载播放器实现。状态以 props 向下、事件向上传递，不需要新增全局 Pinia store。子播放器只在 `active` 由真变假时执行暂停这一项明确副作用。

## 文章覆盖

文章应增加正式的 Tiptap 块级原子节点 `journalVideo`，而不是把 `<iframe>` 或任意 HTML 塞入正文。

节点建议只保存稳定引用：

```json
{
  "type": "journalVideo",
  "attrs": {
    "data-asset-id": "123",
    "src": "/media/123",
    "poster": "/media/123/preview",
    "title": "视频标题"
  }
}
```

服务端应像当前图片节点一样验证：asset ID 为正整数、`src` 与 asset ID 一致、资产属于当前文章且角色为 `inline`、资产类型确实为视频。文章保存时把视频 ID 纳入已引用 inline assets，未引用资产才允许删除。

共享层只定义可被服务端和浏览器共同使用的 `journalVideo` schema、属性解析和 HTML 输出；Vue NodeView 仅在 Web 编辑器扩展中注册，避免服务端富文本生成依赖 Vue 组件。编辑器里的 NodeView 显示海报、标题、替换和删除操作；只读文章渲染器使用同一 `JournalVideoPlayer.vue`。Tiptap 官方支持自定义块节点和 Vue NodeView，这与当前 Tiptap 3 JSON 存储方式一致。[Tiptap 自定义节点](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node)、[Tiptap Vue NodeView](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/vue)

文章摘要卡不直接加载正文视频。它继续显示封面和摘要；进入文章详情后，正文里的视频节点才呈现播放器。RSS/JSON Feed 中的视频节点建议输出“海报 + 打开原文”的普通链接，因为 RSS 阅读器对 `<video>` 和受 Cookie 保护的媒体支持不一致；公开条目的 enclosure 仍可引用同源 `/media/:assetId`。

## 管理端引用入口

信息流发布器和文章媒体面板都增加“引用 Drive 视频”：

- 默认浏览配置的 `NotiNewsDownloads` 根目录，按月份进入。
- 支持粘贴 Google Drive 文件链接，后端提取并核对 file ID。
- 未来自己上传的视频只要位于配置的 Journal 视频目录，或当前只读账号有权访问，也可用相同方式引用。
- 列表展示文件名、大小、更新时间、分辨率、时长和是否已被引用。
- 选择后由后端读取元数据、生成本地海报并建立资产记录；成功后立刻出现在当前发布器或文章资产面板中。

引用不改变 Drive 文件权限，也不把源文件复制到 Journal。若源文件被删除或账号权限被撤销，对应引用明确显示不可播放；不静默替换为其他同名文件。

## 编码与 HLS 边界

JavaScript 播放器不能补齐浏览器本身不支持的视频编码。当前最高画质下载可能是 WebM/AV1 + Opus；能否播放最终仍由设备和浏览器的解码能力决定。第一阶段应让 `<video>` 按真实 MIME 加载，并把媒体错误明确呈现出来，不因为某个设备不支持就偷偷改播低清版本。

当实际使用确认需要“同一视频在更多设备稳定播放”或“移动网络自动切换码率”时，再进入第二阶段：

- 在下载 worker 或独立媒体处理任务中生成 H.264/AAC 的多档 HLS，而不是在 1 CPU 的 Journal 请求进程中实时转码。
- 将 `.m3u8` 与分片作为 Drive 上的派生目录保存，并在资产中记录明确的播放类型。
- Safari 使用原生 HLS，其余支持 MSE 的浏览器由 HLS.js 绑定现有 `<video>`。

HLS.js 当前 1.x 直接工作在标准 `<video>` 之上，并依赖浏览器 MSE；它只消费已经制作好的 HLS 资源。[HLS.js 官方仓库与兼容说明](https://github.com/video-dev/hls.js/)、[`hls.js` npm](https://www.npmjs.com/package/hls.js)

## 预期改动范围

第一阶段的最小完整范围包括：

1. Journal 独立的 Drive 只读 OAuth 配置与 `@googleapis/drive` 服务。
2. `journal_assets` 的外部存储字段和迁移。
3. Drive 文件列表、引用创建，以及 `/media/:assetId` Range 转发。
4. 引用创建时的元数据读取与本地海报生成。
5. 信息流原地播放和统一的 `JournalVideoPlayer.vue`。
6. Tiptap `journalVideo` 节点、文章编辑器插入和只读渲染。
7. RSS 中的视频链接表达。

不包含上传到 Google Drive、自动转码、HLS、多码率、离线缓存、播放历史同步或自动替代源。这些都不是完成当前“引用并在线播放”主路径所必需的内容。

## 最终判断

该能力与现有 Journal 架构是相容的，而且不需要重做现有媒体系统。最关键的设计选择是让 Google Drive 只承担源文件存储，让 Journal 继续掌握引用关系、访问权限、海报和播放入口。第一阶段使用原生播放器加 Drive Range 代理，能够以最短路径覆盖：

- 已下载到 `NotiNewsDownloads` 的大体积视频；
- 以后自己上传到 Drive 的记录视频；
- 信息流卡片中的原地播放；
- 文章正文中的可编辑视频引用；
- Journal 的 private、protected、public 三种访问模式。
