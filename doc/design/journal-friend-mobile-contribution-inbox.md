# Journal 朋友手机投稿箱首期产品定义与精简实施方案

## 1. 文档定位

- 状态：首期产品定义与实施基线，已实施
- 日期：2026-07-26
- 产品定位：让朋友把手机里的文字、照片和短视频直接送到小明的 Journal 投稿箱，由小明确认后发布
- 用户规模：最多 5 位已知朋友，不按开放投稿平台设计
- 输入前提：朋友使用的文件格式和大小可以事先约定，不为未知公众输入设计复杂兼容路径
- 硬件边界：Journal 单容器 `1 CPU / 1 GB`、SQLite、本地磁盘、Cloudflare 与 OpenResty
- 与旧方案的关系：本文件是首期实施依据；`journal-friend-contribution-inbox.md` 只保留为未来大文件边界参考
- 与性能版的关系：`journal-friend-mobile-contribution-inbox-performance-extreme.md` 只供未来升级硬件时参考，不把其中的高并发和转码设计提前带入首期

首期只解决一条短路径：

> 朋友填写一张表单，选择约定范围内的手机照片或短视频，点击一次“送给小明”，等待上传和整理完成。

### 1.1 固定决策

1. 不建设“上传草稿系统”。选择中的文件只保存在当前页面，点击送达后才上传。
2. 点击送达后创建进程内上传会话，素材逐个使用独立 `multipart/form-data` 请求上传；不使用 tus、分块上传、断点续传、上传指纹或状态轮询。
3. 单个视频请求不超过 90 MiB，明确低于 Cloudflare Free/Pro 的 100 MB 单请求上限；服务端累计整份投稿不超过 500 MiB。
4. 客户端只检查数量、扩展名和大小，不加载 `mediainfo.js`，不在浏览器中分析视频编码。
5. 服务端流式接收文件到临时目录，不调用 `part.toBuffer()`，不在 Node.js 内存中形成完整媒体副本。
6. JPEG、PNG、WebP 和 HEIC/HEIF 仍由服务端生成 Journal 展示图，源文件不归档。
7. 合规的 H.264 和 HEVC 视频都只做 MP4 容器整理与流复制，不因为 HEVC 名称本身转码成 H.264。
8. 媒体随单文件请求按顺序处理；全局最多有一个素材进入媒体处理，不建设持久任务队列。
9. 页面只表达“正在上传”“服务器正在整理”“已送达”或具体失败，不展示伪造的服务端百分比。
10. 媒体与 SQLite 已提交即表示投稿送达；Telegram 只在送达后提醒小明。
11. 不自动重试、不切换上传通道、不降低输出要求、不跳过失败文件。
12. 小明发布时默认私有，明确选择后才能公开。

### 1.2 为什么这样精简

最多 5 位已知朋友意味着：

- 不需要为陌生用户建设账号、限流、审计或内容审核；
- 不需要为大量并发投稿建设任务平台；
- 不需要持久化每个文件的上传状态；
- 不需要为了偶发网络失败预先建设断点续传；
- 不需要在浏览器里提前识别所有媒体边界；
- 可以通过清楚约定格式和大小，把极少发生的非法输入交给服务端直接拒绝。

首期接受一个明确取舍：如果任一请求失败，服务端丢弃本次上传会话，页面保留已经填写
的文字和本地文件选择，由朋友明确再次点击提交；不会自动恢复已经传输的字节。

## 2. 证据与设计判断

### 2.1 当前项目事实

以下结论来自当前仓库：

- 前端为 Vue 3.5 和 Vite 8，当前只有一个 HTML 入口；
- 当前 `App.vue` 会加载信息流、管理会话和编辑能力，不适合直接作为朋友投稿入口；
- 服务端为 Fastify 5，已经安装并注册 `@fastify/multipart`；
- 现有普通发布接口通过 `part.toBuffer()` 读取小图片；投稿路由不能复用这段完整 Buffer 路径；
- 数据库为 SQLite WAL；
- 已有本地资产目录、图片预览、媒体鉴权与 Range 响应；
- 当前 Journal 容器限制为 `1 CPU / 1 GB`；
- OpenResty 当前全局 `client_max_body_size` 为 `210m`；
- 每日 04:50 的备份会停止 Journal 容器并复制 `/opt/journal/data`。

这些是源码与部署事实，不代表投稿功能已经存在。

### 2.2 外部能力边界

- Apple 的普通高效照片与视频分别使用 HEIF/HEIC 和 HEVC，因此保留这两类手机格式能减少朋友修改相机设置的成本。参考：[Apple：在 Apple 设备上使用 HEIF 或 HEVC 媒体](https://support.apple.com/en-us/116944)。
- Sharp 预编译二进制没有直接列出 HEIC 输入；当前 Debian 镜像可使用
  `libheif-examples` 中的 `heif-info` 和 `heif-convert` 处理 HEIC/HEIF。
  参考：[Sharp installation](https://sharp.pixelplumbing.com/install/)、
  [Debian libheif-examples](https://packages.debian.org/bookworm/libheif-examples)。
- Safari 对 HEVC 支持成熟；Chromium 也支持 HEVC，但要求浏览器、操作系统和硬件提供对应能力。首期接受这一设备前提，不再为了覆盖所有浏览器把 HEVC 统一转码为 H.264。参考：[WebKit media support](https://webkit.org/blog/15063/webkit-features-in-safari-17-4/)、
  [Chromium audio/video](https://www.chromium.org/audio-video/)。
- Cloudflare Free 和 Pro 的单请求体上限为 100 MB。90 MiB 单文件加 multipart
  开销仍留有明确余量；500 MiB 总量通过逐文件请求累计。参考：[Cloudflare request limits](https://developers.cloudflare.com/workers/platform/limits/#request-and-response-limits)。
- `@fastify/multipart` 支持按流消费 multipart 文件，不要求将文件读取成 Buffer。
  参考：[`@fastify/multipart`](https://github.com/fastify/fastify-multipart)。

### 2.3 产品假设

以下是用户给出的首期现实，不是仓库运行数据：

- 投稿用户总数最多 5 人；
- 朋友可以遵守明确的格式和大小约定；
- 不会持续提交超大视频、专业相机素材或未知附件；
- 多人同一时刻提交属于低概率事件；
- 目标查看设备为近期主流手机和中高配电脑；
- 偶发失败可以由朋友明确重新提交，不要求自动恢复。

因此，首期不为这些假设之外的极端情况预埋实现。

## 3. 产品主路径

```text
小明创建并分享一条投稿链接
  → 朋友打开独立轻量页面
  → 填写称呼和正文
  → 选择约定范围内的照片或短视频
  → 页面检查数量、扩展名和大小
  → 朋友点击“送给小明”
  → 一次 multipart 请求流式上传整份投稿
  → 服务端按顺序检查并整理媒体
  → 投稿写入私有收件箱
  → 尝试发送 Telegram 提醒
  → 页面显示“已经送到小明”
```

与旧版设计相比，以下步骤已经删除：

- 打开页面时创建服务器草稿；
- 为草稿生成第二个能力令牌；
- 选择文件后立即开始后台上传；
- 每个文件建立 tus 上传；
- 浏览器加载 WASM 分析视频；
- 上传结束后轮询媒体处理状态；
- 清理 24 小时草稿和上传分块；
- 恢复、暂停、终止或拼接上传。

## 4. 内容与容量合同

### 4.1 投稿总量

| 项目 | 首期限制 |
|---|---:|
| 称呼 | 必填，1–24 个字符 |
| 正文 | 最多 2,000 个字符 |
| 素材总数 | 最多 30 项 |
| 视频数量 | 最多 5 项 |
| 全部文件总量 | 不超过 500 MiB |
| 分享链接有效期 | 72 小时 |

正文和素材至少有一个非空。仅文字、仅照片、仅视频和混合投稿都允许。

500 MiB 是一份上传会话中所有源文件的字节总和，不是单个文件额度。页面在请求发出前
完成计算；服务端每接收一个文件后再次累计，超出后直接终止本次上传会话。

### 4.2 照片

| 属性 | 首期支持 |
|---|---|
| 扩展名 | `.jpg`、`.jpeg`、`.png`、`.webp`、`.heic`、`.heif` |
| 真实格式 | JPEG、PNG、静态 WebP、单张 HEIC/HEIF |
| 单文件大小 | 不超过 40 MiB |
| 像素 | 不超过 50 MP |
| 正式输出 | 最长边 2,560 px、WebP quality 82 |
| 预览输出 | 最长边 320 px、WebP quality 60 |
| 元数据 | 删除 EXIF、GPS、设备与编辑信息 |
| 源文件 | 两个输出成功后删除 |

明确不接收：

- 动图和多页图片；
- Live Photo 动态部分；
- RAW、DNG、ProRAW、TIFF、PSD；
- 超过 50 MP 的专业相机照片。

页面持续说明：

> 照片会整理为适合 Journal 展示的尺寸，不作为原片保存。

### 4.3 短视频

| 属性 | 首期支持 |
|---|---|
| 容器 | MP4、MOV |
| 视频编码 | H.264/AVC；HEVC/H.265 Main 或 Main10 |
| 音频 | AAC 或无音频 |
| 单文件大小 | 不超过 90 MiB |
| 时长 | 不超过 5 分钟 |
| 最大画面 | 3,840 × 2,160 |
| 最大帧率 | 60 fps |
| 色彩 | SDR |
| 轨道 | 1 条视频轨，最多 1 条音频轨 |
| 正式输出 | MP4 fast start，音视频流复制 |
| 海报 | 最长边 960 px 的 WebP |
| 源文件 | 标准 MP4 与海报成功后删除 |

H.264 和 HEVC 使用同一条主路径：

1. `ffprobe` 确认容器、轨道、编码、时长、尺寸、帧率和色彩；
2. FFmpeg 复制合规音视频流到标准 MP4；
3. HEVC 输出使用适合浏览器识别的 `hvc1` sample entry；
4. 保留播放所需的方向和色彩信息；
5. 删除定位、设备和无关容器 metadata；
6. 启用 fast start；
7. 提取一帧并生成 WebP 海报。

不执行：

- HEVC 转 H.264；
- 4K 转 1080p；
- HDR 转 SDR；
- 降帧率；
- 视频或音频重新编码；
- 失败后保留原 MOV 作为正式资产。

HDR、HLG、Dolby Vision、ProRes、WebM、AVI 和 MKV 不在首期约定格式中。格式由这
5 位朋友事先控制，因此不为它们增加转码或兼容分支。

### 4.4 校验职责

浏览器只检查：

- 素材数量；
- 视频数量；
- 扩展名和浏览器提供的候选 MIME；
- 单文件大小；
- 文件总量。

服务端检查：

- 文件头和真实格式；
- 图片页数、像素与可解码性；
- 视频容器、轨道、编码、时长、尺寸、帧率和色彩；
- 服务端实际收到的字节数；
- 分享链接状态和整次投稿上限。

首期不在浏览器里识别 H.264、HEVC、AAC、HDR 或轨道。非法媒体需要上传后才能
得到服务端错误；在输入人数和格式均受控的前提下，这是删除 WASM 分析链路所接受
的明确代价。

## 5. 分享链接与权限

### 5.1 单一活动链接

设置页只维护一条活动链接：

- 创建；
- 系统分享；
- 复制；
- 展示二维码；
- 撤销；
- 显示 72 小时到期时间。

创建新链接会使旧链接失效。二维码使用成熟的 `qrcode` npm 包生成。

不增加：

- 朋友账号；
- 联系人体系；
- 多条并行活动链接；
- 单人配额；
- IP 限流；
- 审计日志；
- 内容审核。

### 5.2 能力令牌

分享 URL 使用 fragment：

```text
https://feeds.xmcloud.buzz/contribute#token=<random-token>
```

投稿页从 `location.hash` 读取令牌，并通过 `Authorization` 请求头发送。令牌只在
数据库保存哈希，不写入 Cookie、`localStorage` 或 `sessionStorage`。

页面使用 `Referrer-Policy: no-referrer`，不加载第三方脚本、字体或统计。

同一个分享令牌既读取页面信息，也提交投稿。不再生成草稿令牌，因为服务器上不存在
朋友草稿。

## 6. 朋友端页面

### 6.1 独立入口

新增：

```text
web/contribute.html
web/src/contribute-main.ts
web/src/ContributionApp.vue
web/src/assets/contribution.css
```

Vite 通过 `build.rolldownOptions.input` 同时构建现有入口和投稿入口。

投稿入口只加载 Vue、投稿组件和投稿样式，不加载：

- Vue Router；
- Pinia；
- Vant；
- 信息流；
- 管理员会话；
- Tiptap；
- 普通发布器；
- 文章编辑器；
- 设置页。

不再动态加载 `tus-js-client` 或 `mediainfo.js`，因为两者不进入精简方案。

### 6.2 页面内容

移动端从上到下为：

1. “送给小明”标题和私有投稿说明；
2. 称呼；
3. 纯文本正文；
4. 文件选择；
5. 已选择素材列表；
6. 格式、总量和图片非原片说明；
7. “送给小明”按钮；
8. 当前提交状态。

不增加多步向导、草稿恢复提示或后台上传提示。

### 6.3 选择与编辑

文件输入允许多选，不强制 `capture`。

选择文件后：

1. 页面立即检查数量、扩展名、单文件大小和总量；
2. 每项显示文件名、类型、大小和本地可用的预览；
3. HEIC 或浏览器不能预览的视频显示文件信息，不伪造缩略图；
4. 朋友可以移除文件；
5. 素材顺序保持选择顺序，并提供“前移”“后移”按钮。

同名文件允许。选择阶段不访问服务器，也不产生临时服务器文件。

### 6.4 一次提交

按钮在以下情况禁用：

- 称呼为空；
- 正文和素材都为空；
- 本地限制不满足；
- 请求正在进行。

点击后：

1. 锁定表单、文件增删和排序；
2. 创建一个进程内上传会话；
3. 按当前顺序为每个文件创建独立 `FormData`；
4. 使用 `XMLHttpRequest` 逐个上传文件；
5. 用已完成文件字节与当前请求进度计算整份投稿的总字节进度；
6. 所有素材上传并整理完毕后，以 JSON 提交称呼和正文；
7. 收到成功响应后原地切换为成功页；
8. 收到错误后显示服务端的具体错误并重新解锁表单。

`XMLHttpRequest` 只用于浏览器原生上传进度，不引入另一套 HTTP 客户端依赖。

### 6.5 状态

整页只使用：

```text
idle
  → uploading
  → processing
  → success

任一提交阶段 → failed
```

上传进度来自 `xhr.upload.onprogress`：

```text
loaded / total
```

单个 `xhr.upload` 完成只表示当前文件已经发送，不表示素材已经整理或投稿成功。
全部素材请求成功后显示“服务器正在整理”，不估算最终提交百分比。

不存在每项素材的 `queued`、`processing`、`ready` 服务端状态，也不存在
`paused`、`retrying`、`resuming` 或 `degraded`。

### 6.6 离开与失败

表单有未送达内容或请求正在进行时注册 `beforeunload`。成功或空表单时移除。

请求失败后：

- 保留文字和浏览器仍持有的 `File`；
- 显示具体失败；
- 不自动重新发送；
- 不自动删除失败项；
- 不改走其他域名；
- 由朋友修改内容或明确再次点击“送给小明”。

页面只承诺保持当前页面打开，不承诺进入后台后移动系统继续上传。

### 6.7 成功

成功页只显示：

- “已经送到小明”；
- 投稿人称呼；
- 素材数量；
- 送达时间；
- “再送一份”。

“再送一份”清空本地表单，开始一份新的请求。

## 7. HTTP 上传实现

### 7.1 请求

朋友端使用三个写入步骤：

```text
POST /api/contribution-uploads
Authorization: Bearer <share-token>

POST /api/contribution-uploads/:uploadId/assets
Content-Type: multipart/form-data
Authorization: Bearer <share-token>

POST /api/contributions
Content-Type: application/json
Authorization: Bearer <share-token>
```

单文件 multipart 字段：

```text
asset
```

最终 JSON 字段：

```text
uploadId
senderName
contentText
```

上传会话只存在于当前 Journal 进程和临时目录，不写入 SQLite，不提供读取状态、暂停、
恢复或远端素材编辑接口。

### 7.2 Fastify 接收

素材路由使用 `@fastify/multipart` 的流式 parts API，并设置独立限制：

- 每个请求只有 1 个文件；
- 单文件最大 90 MiB；
- 上传会话最多 30 个文件、5 个视频；
- 上传会话源文件总量最大 500 MiB；
- 字段数量和字段长度按第 4.1 节限制；
- 遇到超限立即结束请求。

处理顺序：

1. 校验分享令牌；
2. 创建进程内上传会话；
3. 每个素材请求创建独立源文件临时目录；
4. 文件 part 直接通过 Node stream 写入临时文件；
5. 累计会话的素材数量、视频数量和源文件字节；
6. 当前素材进入全局单并发媒体处理区；
7. 当前素材处理完成后删除其源文件；
8. 所有素材请求完成后校验最终正文；
9. 移动正式资产目录并创建投稿记录。

禁止：

- `part.toBuffer()`；
- `FileReader.readAsArrayBuffer()`；
- Blob 转 base64；
- 完整媒体 Buffer；
- 全文件哈希；
- tus、分块拼接或另一条上传通道。

### 7.3 单并发处理

使用一个成熟的 `p-limit(1)` 包住单个素材的媒体处理阶段。

它只解决当前 `1 CPU / 1 GB` 下两份请求偶然同时到达的问题：

- 上传仍可同时流式落盘；
- 一次只整理一个素材；
- 朋友端严格按投稿顺序发出素材请求；
- 请求等待的是当前进程内 Promise；
- 不持久化任务；
- 不建立消费者服务；
- 进程结束时当前请求直接失败；
- 服务重启后不自动重跑。

## 8. 媒体处理

### 8.1 真实格式

服务端先用成熟的 `file-type` 读取文件头，再交给媒体工具确认：

- JPEG、PNG、WebP：Sharp；
- HEIC、HEIF：`heif-info` 和 `heif-convert`；
- MP4、MOV：`ffprobe`。

扩展名与浏览器 MIME 只用于选择阶段提示，不能决定正式处理器。

### 8.2 图片

JPEG、PNG、WebP：

1. Sharp 从临时文件路径读取；
2. 确认单页、真实格式和 50 MP 上限；
3. 应用方向；
4. 转换到 sRGB；
5. 去除全部 metadata；
6. 输出 2,560 px 内的 WebP；
7. 输出 320 px WebP 预览。

HEIC、HEIF：

1. `heif-info` 确认主图、尺寸和可读取性；
2. `heif-convert` 生成请求目录内的临时 JPEG；
3. Sharp 按相同规则生成两个 WebP；
4. 删除中间 JPEG。

Sharp 的 `limitInputPixels` 固定为 50 MP。图片逐张处理，`heif-convert` 与 Sharp
不同时运行。

### 8.3 视频

视频只走一条确定路径：

1. `ffprobe` 输出 JSON；
2. 检查第 4.3 节合同；
3. FFmpeg 将 H.264 或 HEVC 流复制到 MP4；
4. AAC 直接复制；
5. HEVC 标记为 `hvc1`；
6. 启用 fast start；
7. 只保留播放需要的方向与色彩信息；
8. 提取一帧；
9. Sharp 输出 960 px WebP 海报。

FFmpeg 失败即本次投稿失败。不得转码、降低分辨率、丢弃不兼容轨道后继续，也不得把
原始 MOV 直接当作正式资产。

### 8.4 文件落点

请求临时源文件：

```text
/tmp/journal-contribution-requests/<request-id>/
```

处理输出：

```text
/data/assets/.tmp/<contribution-public-id>/
```

最终提交成功时，同一投稿目录移动到：

```text
/data/assets/<year>/<month>/<contribution-public-id>/
```

照片最终保存展示 WebP 和预览 WebP；视频最终保存标准 MP4 和 WebP 海报。上传源
文件、中间 JPEG 和请求临时目录随后删除。

## 9. 成功、错误与清理

### 9.1 成功条件

服务端只有在以下条件全部成立后返回成功：

1. 上传会话中的全部单文件请求完整接收；
2. 所有文件真实格式合规；
3. 所有图片和视频处理完成；
4. 正式资产目录已经就绪；
5. 投稿、素材顺序和最终路径已经写入 SQLite。

页面不能因上传达到 100% 或媒体文件已经落盘而提前显示成功。

Telegram 提醒不属于送达事务。数据库提交成功即表示投稿送达；提醒失败时保留投稿，
记录明确的 Journal 服务日志，并继续返回成功。不自动重试，不切换提醒通道。

### 9.2 失败

任一文件失败时，整次投稿失败：

- 不写入投稿收件箱；
- 删除本次请求创建的临时源文件、中间文件和未提交资产；
- 不保留其中已经成功处理的素材；
- 不继续处理后续素材；
- 不自动重新发送；
- 返回具体文件名和业务错误。

这是小规模、受控输入下换取简单逐文件实现的明确行为。

### 9.3 错误格式

统一响应：

```json
{
  "error": {
    "code": "VIDEO_FORMAT_UNSUPPORTED",
    "message": "video-01.mov 不符合约定的视频格式。",
    "filename": "video-01.mov"
  }
}
```

首期错误码：

- `LINK_EXPIRED`
- `LINK_REVOKED`
- `INVALID_FORM`
- `TOO_MANY_ASSETS`
- `TOO_MANY_VIDEOS`
- `FILE_TOO_LARGE`
- `CONTRIBUTION_TOO_LARGE`
- `IMAGE_FORMAT_UNSUPPORTED`
- `IMAGE_PIXEL_LIMIT_EXCEEDED`
- `VIDEO_FORMAT_UNSUPPORTED`
- `VIDEO_DURATION_EXCEEDED`
- `MEDIA_PROCESSING_FAILED`

前端按 `code` 显示固定中文文案，不匹配底层英文异常文本。

### 9.4 启动清理

服务启动时直接删除：

- `/tmp/journal-contribution-requests` 中的遗留请求目录；
- `/data/assets/.tmp` 中的遗留投稿目录。

不存在草稿表、分块文件或 `uploading`/`processing` 数据库状态，因此不需要推断
某次中断应如何恢复。

文件系统错误直接暴露并阻止服务继续启动，不静默跳过。

## 10. 数据模型

### 10.1 `journal_contribution_links`

```text
id
token_hash               UNIQUE
expires_at
revoked_at                NULLABLE
created_at
```

只允许一条未撤销且未过期的活动链接。

### 10.2 `journal_contributions`

```text
id
public_id                 UNIQUE
link_id
sender_name
content_text
submitted_at
created_at
updated_at
```

没有 `draft`、`status` 或 `draft_token_hash`。数据库中的投稿都已经完整送达且等待处理；
发布或保存为私有 Journal Entry 后直接删除投稿中间记录。

### 10.3 `journal_contribution_assets`

```text
id
contribution_id
kind                      photo | video
source_name
mime_type
byte_size
relative_path             UNIQUE
preview_relative_path     UNIQUE
width
height
duration                  NULLABLE
sort_order
created_at
```

`mime_type` 和 `byte_size` 记录最终资产。表中没有 `upload_id`、上传状态、处理状态或
失败信息，因为失败请求不会写入收件箱。

### 10.4 索引

只增加：

```text
journal_contribution_links(token_hash)
journal_contributions(submitted_at DESC, id DESC)
journal_contribution_assets(contribution_id, sort_order, id)
```

不增加全文检索、投稿人索引、统计表或审计表。

## 11. API

### 11.1 朋友端

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/api/contribution-link` | 校验分享令牌并返回限制摘要 |
| `POST` | `/api/contribution-uploads` | 创建当前进程内的临时上传会话 |
| `POST` | `/api/contribution-uploads/:uploadId/assets` | 上传并整理一个素材 |
| `POST` | `/api/contributions` | 提交正文与已整理素材 |

正文不自动保存。朋友端 API 不使用管理员 Cookie。

### 11.2 管理员端

| 方法 | 路径 | 作用 |
|---|---|---|
| `GET` | `/api/private/contribution-link` | 读取当前链接 |
| `POST` | `/api/private/contribution-link` | 创建新链接 |
| `DELETE` | `/api/private/contribution-link` | 撤销链接 |
| `GET` | `/api/private/contributions` | 读取全部待处理投稿 |
| `GET` | `/api/private/contributions/:publicId` | 读取投稿详情 |
| `POST` | `/api/private/contributions/:publicId/publish` | 私有保存或公开发布 |
| `DELETE` | `/api/private/contributions/:publicId/assets/:assetId` | 删除单项素材 |
| `DELETE` | `/api/private/contributions/:publicId` | 删除整份投稿 |

待处理投稿直接按 `submitted_at DESC, id DESC` 返回，不为最多 5 位朋友的首期收件箱
增加游标分页。将来只有实际积累使响应明显变大时再增加。

## 12. 投稿箱与发布

### 12.1 管理入口

管理员导航新增“朋友投稿”和待处理数量。列表只展示：

- 称呼；
- 送达时间；
- 正文摘要；
- 图片和视频数量；
- 最多 4 张预览或海报。

列表不加载正式图片，不创建带 `src` 的视频。

不增加已读/未读、分组、搜索、筛选或批量操作。

### 12.2 整理

详情页允许：

- 修改正文；
- 调整素材顺序；
- 删除单项素材；
- 选择发布时间；
- 选择私有或公开；
- 发布；
- 删除整份投稿。

默认：

- 发布时间为送达时间；
- 可见性为私有；
- 正文和素材顺序沿用朋友提交内容。

首期不在整理页追加新素材。

### 12.3 发布

发布前确认投稿记录仍存在，并且保留素材文件存在。

单个 SQLite 事务：

1. 新增 `journal_entries`；
2. 将保留素材写入 `journal_assets`；
3. 没有素材时使用 `text`；
4. 只有图片时使用 `photo`；
5. 含视频时使用 `video`；
6. 删除已经转交的投稿素材行；
7. 删除投稿记录。

媒体已经是正式资产，发布时不复制、不转换、不重新生成预览。
已处理历史由普通 Journal Entry 承担，不保留第二套投稿状态和发布关系。

图片继续使用现有预览加载；视频先显示海报，用户明确播放后才请求 MP4，并继续使用
现有 Range 响应。

## 13. Telegram 通知

媒体全部完成后：

1. 生成投稿 `public_id`；
2. SQLite 事务写入投稿与素材；
3. 数据库提交后发送一条 Telegram 提醒；
4. 返回成功。

通知示例：

```text
📮 收到朋友投稿

来自：阿明
内容：6 张照片 · 1 段视频
留言：今天一起爬山很开心……

查看投稿
```

“查看投稿”指向 `/me/contributions/<public-id>`，不携带分享令牌。

Telegram 失败时：

- 已经送达的投稿保留；
- Journal 服务记录明确错误；
- 页面仍显示送达成功；
- 不切换通知渠道；
- 不自动重试。

首期不发送上传开始、单文件完成或媒体处理过程通知。

## 14. 前端组件边界

### 14.1 组件图

```text
contribute-main.ts
└── ContributionApp.vue
    ├── ContributionHeader.vue
    ├── ContributionForm.vue
    │   ├── ContributionMediaPicker.vue
    │   └── ContributionMediaList.vue
    │       └── ContributionMediaItem.vue
    ├── ContributionSubmitBar.vue
    └── ContributionSuccess.vue
```

责任：

- `ContributionApp`：读取分享令牌，组合表单、提交和成功页；
- `ContributionForm`：持有称呼、正文和文件选择；
- `ContributionMediaPicker`：原生文件输入；
- `ContributionMediaList`：展示顺序和汇总；
- `ContributionMediaItem`：单项预览、移动和移除事件；
- `ContributionSubmitBar`：提交按钮、总进度和处理状态；
- `ContributionSuccess`：只显示成功结果。

props 向下、事件向上；输入值使用类型明确的 `defineModel`。

### 14.2 组合函数

只需要：

```text
useContributionForm.ts
  - 本地字段与文件
  - 数量和大小检查
  - 总量与可提交状态

useContributionSubmit.ts
  - FormData
  - 单个 XMLHttpRequest
  - 上传进度
  - 上传结束后的处理状态
  - 成功或错误
```

约束：

- Vue 3 Composition API；
- `<script setup lang="ts">`；
- `File`、`XMLHttpRequest` 和对象 URL 使用 `shallowRef` 或非响应对象；
- 总字节、可提交状态和素材计数使用纯 `computed`；
- `watch` 只用于 `beforeunload` 与资源释放等副作用；
- 组件卸载时撤销 Object URL 并终止仍活动的 XHR；
- 不使用全局 Pinia store；
- 不使用 `requestAnimationFrame`、`cancelAnimationFrame` 或任何别名。

管理员投稿视图按现有 Router 增加并异步加载，不重构 `App.vue`、信息流或普通发布器。

## 15. 交互与可访问性

- 所有输入都有可见 `<label>`；
- 文件选择使用原生 `<input type="file">`；
- 触控目标至少 44 × 44 CSS px；
- 底部操作区考虑 `env(safe-area-inset-bottom)`；
- 状态不只依赖颜色；
- 错误紧邻对应区域并聚焦；
- 提交按钮使用 `aria-busy`；
- 上传状态使用 `aria-live="polite"`；
- 错误和成功使用 `aria-live="assertive"`；
- 高频字节变化不逐次朗读，只更新整数百分比；
- 图片声明宽高或 `aspect-ratio`；
- 不使用 `transition: all`；
- 动画遵从 `prefers-reduced-motion`；
- 不用教学弹窗解释限制，限制摘要直接放在选择按钮下。

## 16. OpenResty、Cloudflare 与 Docker

### 16.1 OpenResty

只为素材上传接口增加：

```text
/api/contribution-uploads/:uploadId/assets
  client_max_body_size 95m
  proxy_request_buffering off
  proxy_buffering off
```

95 MiB 为 90 MiB 单文件和 multipart 边界留出余量。最终 `/api/contributions` 是
小型 JSON 请求，独立限制为 1 MiB；500 MiB 投稿总量由 Journal 上传会话累计。

投稿页面与 API 增加：

- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- 只允许本站资源的 CSP
- 投稿 HTML `Cache-Control: no-cache`
- 带内容哈希的静态资源长期缓存

### 16.2 Cloudflare

首期继续使用现有域名，不增加：

- 上传子域名；
- DNS-only 入口；
- R2；
- Worker；
- Stream；
- 备用通道。

如果单个真实视频经常超过 90 MiB，才重新评估分块上传；不在当前版本同时维护两套协议。

### 16.3 Docker

镜像增加：

- Debian `ffmpeg`；
- Debian `libheif-examples`；
- HEIC 解码所需运行库。

不编译自定义 libvips，不增加 GPU 映射。CPU 保持 1 核，容器内存提高到 1 GB。

## 17. 依赖与实施范围

### 17.1 新增 npm 依赖

- `file-type`
- `p-limit`
- `qrcode`

继续复用：

- `@fastify/multipart`
- Fastify
- better-sqlite3
- Sharp
- Zod
- Vue
- 现有 Telegram bot 能力

明确不新增：

- `@tus/server`
- `@tus/file-store`
- `tus-js-client`
- `mediainfo.js`
- 新的 HTTP 客户端
- 任务队列或 Redis 客户端

### 17.2 服务端

新增：

- 投稿链接仓储与服务；
- 进程内上传会话与逐文件投稿路由；
- 流式 multipart 临时文件写入；
- 单并发媒体处理；
- 图片标准化；
- H.264/HEVC 容器整理和海报；
- 投稿管理路由；
- Telegram 通知；
- 启动时临时目录清理。

修改：

- Journal 数据库迁移；
- Web 普通记录允许 `content_type = 'video'`；
- 媒体访问支持投稿箱私有预览；
- Fastify 静态路由增加 `/contribute`；
- Vite 增加投稿 HTML 入口；
- Docker 增加系统媒体工具；
- OpenResty 增加单个 multipart 路径的流式代理。

### 17.3 前端

新增：

- 独立 HTML 与 Vue 入口；
- 一页投稿表单；
- 本地数量和大小检查；
- 单次 XHR 上传；
- 总上传进度；
- 服务端整理状态；
- 成功页；
- 管理员投稿列表、整理页和分享设置。

不借本功能重构现有路由、信息流、编辑器或普通发布器。

## 18. 首期明确不做

- 服务器草稿；
- 正文自动保存；
- 选择文件后立即后台上传；
- tus 或其他分块协议；
- 断点续传；
- 上传暂停；
- 自动重试；
- 浏览器视频编码分析；
- 每个文件的远端状态；
- 媒体处理状态轮询；
- 多文件并发上传；
- HEVC 转 H.264；
- HDR/Dolby Vision 转换；
- 视频压缩、裁剪、降分辨率或降帧率；
- 原片保存和下载；
- Live Photo；
- 专业相机格式；
- 音频、文档、压缩包和任意附件；
- 对象存储；
- 朋友账号；
- 多管理员；
- 评论和回复；
- 自动公开；
- 搜索、分页、统计和审计；
- 企业级限流、内容审核、多租户或分布式任务。

## 19. 完成标准

### 19.1 朋友

- 有效链接打开独立投稿页，不加载公开信息流和管理员代码；
- 页面不创建服务器草稿；
- 朋友可以填写称呼、正文并选择约定媒体；
- 页面在发送前阻止明显超数量、超单文件和超总量；
- 点击一次后按顺序产生单文件 multipart 请求，并在最后提交一次 JSON；
- 上传时有可信的总字节进度；
- 全部素材请求完成后明确显示服务器正在整理；
- HEIC 生成 Journal WebP，不保存源文件；
- 合规 H.264 和 HEVC 都以流复制方式生成 MP4；
- HEVC 不因为浏览器兼容性的理论边界被统一转码；
- 任一素材失败时本次投稿明确失败；
- 成功只在媒体和数据库全部完成后显示。

### 19.2 资源

- 投稿首屏不包含 Router、Pinia、Tiptap、信息流或管理员视图；
- 不包含 tus 或 mediainfo WASM；
- 浏览器不读取完整媒体为 ArrayBuffer 或 base64；
- OpenResty 不完整缓冲请求体；
- Fastify 不调用 `part.toBuffer()`；
- Node 内存占用不随上传总文件大小线性增长；
- 一次只处理一个素材，同一投稿的素材按顺序上传；
- 视频不重新编码；
- 投稿列表只读取预览图或海报；
- 视频在明确播放前不请求主体。

### 19.3 错误

- 链接失效、表单错误、超限、图片错误、视频错误和处理错误有明确文案；
- 不自动重试；
- 不跳过失败文件继续提交；
- 不把上传 100% 当作送达；
- 临时文件清理错误不被吞掉；
- 服务中断时当前请求直接失败，重启后不猜测恢复。

### 19.4 小明

- 设置页可以创建、分享、展示二维码和撤销一条链接；
- 导航显示待处理数量；
- 列表直接读取全部待处理投稿；
- 整理页可以修改正文、顺序、发布时间、素材取舍和可见性；
- 默认可见性为私有；
- 发布时不复制或重新处理媒体；
- H.264 与 HEVC MP4 都沿用现有 Range 响应；
- 删除投稿会删除其未发布资产，不影响其他 Journal 记录。
- 发布或保存为私有记录后，投稿中间记录被删除，历史只由 Journal Entry 承担。

## 20. 以后重新设计的触发条件

只有实际出现以下问题时，才重新增加相应复杂度：

| 真实问题 | 再考虑的能力 |
|---|---|
| 单个视频经常超过 90 MiB | 分块上传或 tus |
| 一份投稿经常超过 500 MiB | 重新评估本地磁盘额度与原片存储 |
| 朋友网络失败使已完成文件重传成为主要阻碍 | 持久上传会话、断点续传与明确重试 |
| 服务端整理经常接近 Cloudflare 响应时限 | 上传与处理拆分、状态读取 |
| 多人同时投稿使单并发等待明显 | 持久任务队列 |
| 目标设备确实无法播放大量 HEVC | 生成 H.264 展示副本 |
| HDR 视频成为常见输入 | 固定 HDR 展示或色调映射路径 |
| 待处理投稿数量使一次列表响应明显变大 | 分页 |
| 原片保存成为明确需求 | 回到大文件方案重新设计存储 |

在触发条件发生前，不为它们保留空表、状态、接口或备用依赖。
