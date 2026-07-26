# Journal 朋友手机投稿箱首期产品定义与实施方案

## 1. 文档定位

- 状态：首期产品定义与实施基线，待实施
- 日期：2026-07-26
- 产品定位：让朋友把手机相册中的文字、照片和短视频直接送到小明的 Journal 投稿箱，由小明确认后发布
- 硬件边界：沿用当前 Journal 单容器 `1 CPU / 512 MB`、SQLite、本地磁盘、Cloudflare 与 OpenResty
- 与旧方案的关系：本文件是首期实施依据；`journal-friend-contribution-inbox.md` 保留为大文件、相机素材和后续扩展的边界参考，不按其大文件能力实施首期

首期不再把产品理解为“朋友把原片传给小明”，而是：

> 朋友把适合出现在 Journal 里的手机内容送给小明。

这一定义带来以下固定决策：

1. 手机照片是首期绝对主路径，短视频是受限的补充路径。
2. 图片投稿不承担原片归档职责。服务端接收手机文件后统一生成 Journal 展示图，成功后删除上传源文件。
3. 首期直接接收 JPEG、PNG、WebP、HEIC 和 HEIF 照片，不要求 iPhone 用户事先修改相机格式。
4. 视频只接收能够无重编码进入现有 Web 播放链路的 H.264/AVC 短视频；不在 `1 CPU / 512 MB` 容器中转码 HEVC/H.265。
5. 朋友选择素材后立即上传，上传与填写文字并行；照片和视频都只保留一个活动上传流。
6. 每个上传请求固定为 16 MiB 分块，降低移动网络中单次请求持续时间，同时避开 Cloudflare 请求体上限。
7. 朋友端使用独立的轻量 Vite 页面，不加载信息流、管理会话、编辑器、Pinia 或 Vue Router。
8. 投稿成功必须表示素材已经处理完成、投稿记录已经写入收件箱、Telegram 通知已经发送，不能用“文件传完了”冒充“已经送到”。
9. 不自动重试、不跨刷新续传、不切换上传通道、不自动跳过失败文件；任何失败都停在具体失败项并直接展示原因。
10. 小明整理投稿时默认私有，明确选择后才能公开。

性能优先级固定为：

```text
朋友尽快开始上传
  → 不让手机承担大图转码
  → 不上传首期明确无法处理的视频
  → 全链路不制造完整文件内存副本
  → 服务端媒体处理严格串行
  → 投稿箱和信息流只预取预览图
  → 最后才考虑更多并发、原片和专业格式
```

## 2. 证据与设计判断

### 2.1 当前项目已经确认的事实

以下结论来自当前仓库源码和部署文件：

- `web/src/main.ts` 只挂载一个 `App.vue`。
- `App.vue` 静态导入信息流、普通发布器、文章编辑器和设置页，并在挂载后读取站点资料与管理员会话。
- `web/vite.config.ts` 当前只有一个 HTML 入口。
- 普通 Web 发布接口使用 `@fastify/multipart`，全局单文件限制为 20 MiB，并通过 `part.toBuffer()` 形成完整文件内存副本。
- Journal 已有 Fastify、SQLite WAL、本地资产目录、图片预览、媒体鉴权和 Range 响应。
- `journal_entries` 当前允许 Web 普通记录使用 `text` 或 `photo`，尚未允许 Web `video` 记录。
- `journal_assets` 已有 `relative_path`、`preview_relative_path`、尺寸、时长和排序字段，可以承载处理后的图片、视频和视频海报。
- OpenResty 当前全局 `client_max_body_size` 为 210 MiB，尚未为投稿上传关闭请求体缓冲。
- Journal 容器限制为 `1.0 CPU` 和 `512m` 内存。
- 每日 04:50 的 Journal 备份会停止容器，并复制完整 `/opt/journal/data`。

这些是当前实现事实，不表示投稿能力已经存在。

### 2.2 外部资料确认的边界

- Apple 说明 iPhone 和 iPad 的高效格式分别是照片 HEIF、视频 HEVC；“兼容性最佳”才会改为 JPEG 与 H.264。因此，把 HEIC 和 HEVC 都当成专业相机格式排除，会直接伤害手机投稿定义。参考：[Apple：在 Apple 设备上使用 HEIF 或 HEVC 媒体](https://support.apple.com/en-us/116944)。
- WebKit 从 Safari 17 开始支持 HEIC 导入和编辑；如果只依赖浏览器解码，HEIC 投稿能力就会绑定到朋友所用的浏览器及其版本。首期必须由服务端直接处理 HEIC。参考：[WebKit：Safari 17.0 中的 HEIC](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)。
- Sharp 预编译二进制明确列出的输入格式不包含 HEIC；因此不能只增加一个扩展名就宣称现有 Sharp 可以处理 iPhone 照片。参考：[Sharp installation](https://sharp.pixelplumbing.com/install/)。
- 当前 Docker 运行时基于 Debian Bookworm；Bookworm 官方 `libheif-examples` 包提供 `heif-info` 和 `heif-convert`，可以检查并转换 HEIC/HEIF。参考：[Debian libheif-examples](https://packages.debian.org/bookworm/libheif-examples)、[heif-convert 手册](https://manpages.debian.org/bookworm/libheif-examples/heif-convert.1.en.html)。
- Cloudflare Free 和 Pro 的单请求体上限仍为 100 MB，默认 Proxy Read Timeout 为 125 秒；首期不能把一个 300 MiB 视频放进单次请求，也不能让上传请求同步等待整批媒体处理。参考：[Cloudflare request limits](https://developers.cloudflare.com/workers/platform/limits/#request-and-response-limits)、[Cloudflare connection limits](https://developers.cloudflare.com/fundamentals/reference/connection-limits/)。
- tus 提供成熟的浏览器分块上传客户端、Node 服务端和文件存储实现。首期只使用其分块、偏移校验与终止能力，明确关闭客户端自动重试与跨刷新恢复。参考：[tus-js-client](https://github.com/tus/tus-js-client)、[tus Node server](https://github.com/tus/tus-node-server/tree/main/packages/server)。
- `mediainfo.js` 可以在浏览器中通过 WebAssembly 分段读取本地媒体元数据，适合在上传前识别 MOV/MP4 的视频编码，而不需要先把视频传到服务器。参考：[mediainfo.js](https://github.com/buzz/mediainfo.js)。

### 2.3 属于产品判断、尚不是运行时结论的内容

- 20 MiB 照片、25 MP、300 MiB 视频、90 秒、12 项素材和 16 MiB 分块都是针对“朋友手机投稿”与当前硬件作出的首期边界，不是线上统计结果。
- 25 MP 的目的，是覆盖普通手机拍照，同时明确排除 48 MP 高分辨率模式、ProRAW 和其他原片用途；它不是关于所有手机默认像素的事实判断。
- 16 MiB 分块是移动网络请求持续时间与请求次数之间的设计取舍，不代表已经测得当前服务器或朋友网络的最优值。
- 仓库不能证明朋友实际使用的手机、浏览器版本、运营商上行、视频编码分布、服务器磁盘吞吐和可用于投稿的剩余磁盘容量。
- 首期发布前应以真实朋友手机素材作为产品样本，但不能在方案阶段把未发生的运行结果写成已确认性能。

## 3. 首期产品目标

### 3.1 要解决的问题

朋友拍到适合记录的内容后，当前通常需要：

1. 先通过聊天工具发给小明；
2. 小明再次下载、选择和上传；
3. 小明重新整理文字与公开范围。

首期把路径缩短为：

```text
小明分享链接或二维码
  → 朋友从手机相册选择照片或短视频
  → 合法素材立即顺序上传，同时填写称呼和想说的话
  → 服务端逐项生成 Journal 可直接使用的媒体
  → 朋友点击“送给小明”
  → 投稿进入私有收件箱并通知小明
  → 小明整理、取舍并选择私有保存或公开发布
```

### 3.2 成功定义

朋友端只有在以下条件全部成立后显示“已经送到小明”：

1. 所有保留素材都完成字节上传；
2. 服务端已按真实文件内容完成格式检查；
3. 每张图片已生成展示图和预览图；
4. 每段视频已完成 H.264 校验、MP4 容器整理和海报生成；
5. 投稿正文、称呼、素材顺序和状态已经写入 SQLite；
6. Telegram 通知已经成功发送；
7. 投稿状态已经从 `draft` 变为 `submitted`。

以下状态都不能显示成功：

- 浏览器选择完文件；
- 某个分块达到 100%；
- 整个文件字节已经上传，但服务端还在处理；
- Telegram 通知失败；
- 页面只在本地保存了正文。

### 3.3 产品承诺

首期向朋友承诺的是：

- 可以直接选择常见手机照片；
- 可以投稿兼容的手机短视频；
- 每项素材都有明确状态；
- 成功提示可信；
- 投稿不会自动公开；
- 图片中的拍摄设备、定位等元数据不会进入 Journal；
- 链接失效、格式不支持或处理失败时会直接说明。

首期不承诺的是：

- 保存原始照片质量、HDR、广色域、景深和拍摄参数；
- 保存 Live Photo 的动态部分；
- 保存 HEVC、Dolby Vision 或专业视频；
- 长视频传输；
- 网盘式原文件下载；
- 跨刷新继续上传；
- 失败后自动重试或改走其他传输方式。

## 4. 用户与权限

### 4.1 朋友

朋友通过有效分享链接可以：

- 建立一个匿名投稿草稿；
- 填写称呼；
- 填写纯文本正文；
- 选择、移除和调整本次手机素材顺序；
- 查看本地检查、上传和服务端处理状态；
- 将整份投稿送达小明。

朋友不能：

- 查看其他朋友的投稿；
- 查看 Journal 私有内容；
- 修改已经送达的投稿；
- 直接公开内容；
- 获取管理员 Cookie 或 API；
- 浏览服务器文件。

### 4.2 小明

小明通过现有管理员会话可以：

- 创建、查看和撤销当前投稿链接；
- 查看待处理投稿数量；
- 打开投稿列表和详情；
- 修改正文、发布时间和素材顺序；
- 删除不需要的素材；
- 选择私有保存或公开发布；
- 删除整份投稿。

首期不增加朋友账号、联系人体系、投稿人认证或多人管理员。

## 5. 内容与容量合同

### 5.1 总体限制

| 项目 | 首期限制 | 目的 |
| --- | ---: | --- |
| 称呼 | 必填，1–24 个字符 | 小明能够识别投稿人 |
| 正文 | 最多 2,000 个字符 | 适合手机输入和普通 Journal 记录 |
| 素材总数 | 最多 12 项 | 控制一次选择、处理和整理复杂度 |
| 视频数量 | 最多 2 项 | 控制单机磁盘与视频处理占用 |
| 单次投稿上传总量 | 最多 640 MiB | 给两段短视频保留空间，同时限制临时磁盘 |
| 草稿有效期 | 24 小时 | 清理未送达的临时内容 |
| 分享链接有效期 | 固定 72 小时 | 覆盖一次聚会前后，不形成长期公开入口 |

正文和素材至少有一个非空。仅文字、仅照片、仅视频和混合投稿都允许。

超出限制时必须在上传前阻止本次新增选择；不能先传一部分再静默忽略其余文件。

### 5.2 照片输入

| 属性 | 首期支持 |
| --- | --- |
| 候选扩展名 | `.jpg`、`.jpeg`、`.png`、`.webp`、`.heic`、`.heif` |
| 真实格式 | JPEG、PNG、静态 WebP、单张 HEIC/HEIF |
| 单文件源大小 | 不超过 20 MiB |
| 源图像素 | 不超过 25,000,000 像素 |
| 输出格式 | 静态 WebP |
| 输出尺寸 | 长边最多 2,560 px，不放大 |
| 展示图质量 | WebP quality 82 |
| 预览图 | 长边 320 px、WebP quality 60 |
| 元数据 | 不保留 EXIF、GPS、设备信息、深度和编辑历史 |
| 源文件 | 展示图与预览图成功后删除 |

产品含义：

- 朋友选择的是“投稿照片”，不是“交付原片”。
- HEIC/HEIF 进入服务端后会变成普通 SDR WebP；HDR、广色域和可逆编辑能力不在首期承诺内。
- 透明 PNG 可以保留透明通道。
- 动图、多页图片、HEIF 图像序列和 Live Photo 动态内容不属于首期。
- 48 MP 高分辨率模式、ProRAW/DNG、RAW、TIFF、PSD 和相机专业格式直接拒绝。

朋友端在选择区持续显示：

> 照片会整理为适合 Journal 展示的尺寸，不作为原片保存。

这不是隐藏在帮助页中的技术说明，而是上传前必须可见的产品合同。

### 5.3 短视频输入

| 属性 | 首期支持 |
| --- | --- |
| 容器 | MP4、MOV |
| 视频编码 | H.264/AVC |
| 音频编码 | AAC 或无音频 |
| 单文件源大小 | 不超过 300 MiB |
| 时长 | 不超过 90 秒 |
| 画面长边 | 不超过 3,840 px |
| 帧率 | 不超过 60 fps |
| 轨道 | 1 条视频轨道，最多 1 条音频轨道 |
| 输出容器 | MP4，启用 fast start |
| 视频画面 | 流复制，不重新编码 |
| 元数据 | 移除容器级拍摄与定位元数据 |
| 海报 | 长边 960 px 的 WebP |
| 源文件 | 标准化 MP4 成功后删除 |

明确拒绝：

- HEVC/H.265；
- Dolby Vision；
- ProRes；
- 10-bit HDR 视频；
- WebM、AVI、MKV；
- 超过 90 秒的长视频；
- 需要转码才能播放的音频或视频轨道；
- 只有音频的文件。

MOV 不是直接拒绝项。只要其中是 H.264 与 AAC，服务端使用 FFmpeg 做容器整理和 fast start，不重新编码视频画面。

HEVC 视频不能进入首期，原因不是格式“不属于手机”，而是当前硬件不适合承担可靠的视频转码。朋友端错误文案必须准确：

> 这段视频使用 HEVC/H.265，高效编码视频暂不支持。请选择 H.264 视频。

不能把它写成“文件损坏”或“上传失败”。

选择按钮旁直接说明“短视频会自动检查是否兼容，无需自己判断编码”，避免把 H.264 术语变成朋友使用产品前必须理解的知识。

### 5.4 两级校验

客户端负责尽早发现：

- 文件数量；
- 浏览器可见的扩展名与 MIME 候选；
- 单文件大小；
- 总上传量；
- 普通图片可读取的尺寸；
- MP4/MOV 的时长、分辨率、帧率、视频编码和音频编码。

视频检查通过按需加载的 `mediainfo.js` 完成，只读取分析所需的本地切片，不把视频完整读入 JavaScript 内存。

服务端必须重新确认：

- 魔数和真实容器；
- 实际图片尺寸、页数和可解码性；
- 实际视频、音频轨道和编码；
- 服务端收到的完整长度；
- 投稿、分享链接和素材数量上限。

客户端检查服务于体验，服务端检查才是资产写入依据。两者不是替代或兜底关系。

## 6. 分享入口

### 6.1 单一活动链接

设置页新增“朋友投稿”区域，只维护一条活动链接：

- “创建投稿链接”；
- 显示 72 小时到期时间；
- “系统分享”；
- “复制链接”；
- 展示二维码；
- “撤销链接”。

再次创建链接前必须确认会立即使旧链接失效。二维码使用成熟的 `qrcode` npm 包生成。

投稿入口不出现在公开首页、RSS、JSON Feed、站点导航或搜索入口中。

### 6.2 URL 中的能力令牌

分享 URL 使用片段保存令牌：

```text
https://feeds.xmcloud.buzz/contribute#token=<random-token>
```

选择片段的原因：

- URL fragment 不会随页面请求发送给 OpenResty 或 Fastify；
- 不会进入常规服务端访问日志；
- 不会作为普通 Referer 路径传给其他页面。

投稿页从 `location.hash` 读取令牌，并在 API 请求的 `Authorization` 头中发送。页面不把令牌写入 Cookie、`localStorage` 或 `sessionStorage`。

页面保持 `Referrer-Policy: no-referrer`，不加载第三方脚本、字体、统计或 CDN 资源。

### 6.3 投稿草稿能力

有效分享令牌只允许创建匿名草稿。创建后服务端返回独立的草稿能力令牌：

- 分享令牌不能列出草稿；
- 草稿令牌只操作自己的正文和素材；
- 两类令牌都只在数据库保存哈希；
- 草稿令牌不进入管理员会话；
- 朋友刷新页面后不恢复旧草稿。

刷新后的分享 URL 仍然可以创建新草稿，但旧草稿按 24 小时规则清理。首期不增加跨刷新恢复状态。

## 7. 朋友端页面

### 7.1 独立轻量入口

新增：

```text
web/contribute.html
web/src/contribute-main.ts
web/src/ContributionApp.vue
web/src/assets/contribution.css
```

Vite 通过 `build.rolldownOptions.input` 同时构建现有 `index.html` 和 `contribute.html`。

投稿入口只加载：

- Vue 运行时；
- `ContributionApp`；
- 投稿页样式；
- 建立草稿所需的轻量 API。

以下代码不进入投稿首屏：

- Vue Router；
- Pinia；
- Vant；
- 公开信息流；
- 管理员会话；
- Tiptap；
- 普通发布器；
- 文章编辑器；
- 站点设置。

`tus-js-client` 在第一次选择媒体后加载，`mediainfo.js` 只在第一次选择视频后加载。

### 7.2 页面结构

移动端从上到下固定为：

1. 接收人标题：“送给小明”；
2. 简短说明：“照片、短视频和想说的话会先进入小明的私有投稿箱”；
3. 称呼输入；
4. 正文输入；
5. “选择照片或视频”按钮；
6. 素材状态列表；
7. 图片非原片说明与限制摘要；
8. 底部送达操作区。

不增加多步向导。朋友可以按任意顺序填写文字和选择素材。

### 7.3 选择行为

文件输入使用明确的手机候选类型并允许多选，不添加强制 `capture`，避免把“从相册选择”变成“必须立即拍摄”。

每次新增选择按以下顺序处理：

1. 先检查新增后总数量和总大小；
2. 建立本地素材卡；
3. 图片读取基本尺寸，视频按需分析媒体信息；
4. 所有新增项都合法后加入上传队列；
5. 第一项立即开始上传；
6. 后续项按选择顺序等待。

如果同一次新增选择中有非法文件：

- 这批文件先完整显示在本地选择列表；
- 非法项显示具体错误，合法项保持等待；
- 在非法项被朋友明确移除前，不把这批合法项加入上传队列；
- 保留此前已经合法加入的素材；
- 聚焦到第一个错误；
- 不自动删除、转换、跳过或改走其他路径。

同名文件允许，因为手机相册文件名不具备唯一性。

素材顺序默认使用选择顺序。每张素材卡提供“前移”和“后移”按钮；首期不把拖拽作为唯一排序方式。

### 7.4 素材卡状态

每项只使用以下状态：

```text
checking
  → queued
  → uploading
  → processing
  → ready

任一阶段 → failed
```

中文显示：

- `checking`：正在检查；
- `queued`：等待上传；
- `uploading`：正在上传 `42% · 8.4 / 20 MiB`；
- `processing`：服务器正在整理；
- `ready`：可以送达；
- `failed`：展示具体失败原因。

不增加 `paused`、`retrying`、`resuming`、`degraded` 等首期不存在的状态。

图片卡显示本地预览；浏览器不能本地显示 HEIC 时，卡片显示明确的“HEIC 照片”文件信息，不伪造图片缩略图。视频卡使用本地首帧或文件信息，不自动播放。

朋友移除正在上传的文件时：

1. 明确终止该 tus 上传；
2. 删除服务端临时文件；
3. 撤销本地对象 URL；
4. 从队列和总量中移除；
5. 不影响已经完成的其他素材。

### 7.5 上传与填写并行

合法素材一进入队列就开始上传，不等待正文完成，也不等待“送给小明”点击。

页面同时只允许：

- 一个活动媒体检查任务；
- 一个活动上传请求；
- 服务端一个活动媒体处理任务。

朋友可以在上传过程中继续填写称呼和正文。输入不因进度更新失焦，素材列表更新不重建文本输入组件。

### 7.6 “送给小明”

按钮状态：

- 没有称呼：禁用，并在字段旁解释；
- 正文和素材都为空：禁用；
- 有非法或失败素材：禁用；
- 合法素材仍在上传或处理：允许点击；
- 所有条件满足：允许点击。

用户点击后：

1. 锁定称呼、正文、素材增删和排序；
2. 按钮显示“正在等素材送达 `4 / 7`”；
3. 等待所有素材进入 `ready`；
4. 发送一次提交请求；
5. 等待 Telegram 通知与数据库提交完成；
6. 原地切换为成功页。

按钮不是“开始上传”，而是“确认将当前完整内容送达”。

### 7.7 进度表达

页面同时显示：

- 当前文件状态；
- 当前文件字节进度；
- 已就绪素材数；
- 总上传字节进度；
- 送达阶段。

总上传进度只按网络字节计算：

```text
sum(bytesUploaded) / sum(uploadLength)
```

服务端处理单独显示“正在整理”，不把 100% 上传进度倒退，也不伪造处理百分比。

所有异步状态使用 `aria-live`：

- 普通过程使用 `polite`；
- 失败和送达结果使用 `assertive`；
- 高频字节更新不逐次朗读，只在状态切换和整数进度节点更新可访问文案。

### 7.8 离开页面

以下任一条件成立时注册 `beforeunload`：

- 已经填写未送达文字；
- 已经选择素材；
- 存在上传或处理任务。

成功送达或空草稿时移除提示。

页面只承诺“保持本页打开”。首期不使用屏幕常亮 API，不承诺切到后台后移动系统一定持续传输。

### 7.9 成功页

成功页只显示：

- “已经送到小明”；
- 投稿人称呼；
- 送达素材数量；
- 送达时间；
- “再送一份”按钮。

“再送一份”创建全新草稿，不复用上一次素材、正文或上传状态。

## 8. 上传协议与资源控制

### 8.1 固定配置

首期统一使用 tus：

| 配置 | 固定值 |
| --- | --- |
| 单分块 | 16 MiB |
| 活动上传流 | 每个页面 1 个 |
| Creation With Upload | 启用 |
| 客户端自动重试 | 关闭 |
| 查找历史上传 | 不调用 |
| 跨刷新指纹存储 | 关闭 |
| 并行分块拼接 | 不使用 |
| 上传临时目录 | 容器 `/tmp/journal-contribution-uploads` |

照片也走同一 tus 路径，不再增加一套 multipart 上传实现。大多数普通手机照片会在一个请求内完成，接近 20 MiB 的照片最多需要两个分块。

16 MiB 分块下：

- 300 MiB 视频最多约 19 个数据请求；
- 每个请求显著低于 Cloudflare 100 MB 的最低计划边界；
- 移动上行较慢时，单次请求等待时间比 64 MiB 分块更可控；
- 请求次数仍在个人投稿产品可以接受的范围内。

### 8.2 全链路流式写入

上传字节路径固定为：

```text
手机 File 切片
  → Cloudflare
  → OpenResty 不缓冲请求体
  → Fastify 原始请求
  → @tus/file-store 临时文件
```

不得出现：

- `FileReader.readAsArrayBuffer()` 读取完整文件；
- Blob 转 base64；
- `part.toBuffer()`；
- OpenResty 先完整落一份请求体再代理；
- Node 完整 Buffer；
- 为计算哈希再完整读取一遍。

Vue 状态只保存 `File`、tus `Upload` 实例、字节计数和服务端 ID；`File` 与 `Upload` 使用 `shallowRef` 或非响应对象，不能被深度代理。

### 8.3 上传完成后的处理

文件字节完整后：

1. tus 层把素材状态改为 `processing`；
2. 将媒体处理任务交给进程内单并发队列；
3. 上传请求结束，不同步等待整段媒体处理；
4. 朋友端只在存在 `processing` 项时轮询草稿状态；
5. 任务成功改为 `ready`；
6. 任务失败改为 `failed` 并保存可展示错误。

处理队列使用成熟的 `p-limit`，并发固定为 1。它只控制当前进程的媒体处理，不建设持久任务平台、消费者服务或分布式队列。

轮询不是重试失败操作。任一状态请求失败时停止轮询并直接展示请求错误，不继续假装页面仍在正常处理。

如果进程在媒体处理期间结束，启动时把遗留 `processing` 记录改为 `failed`，错误明确写为服务中断；不自动重跑媒体任务。

## 9. 媒体处理

### 9.1 真实格式识别

服务端先使用成熟的 `file-type` 读取文件头，再交给对应媒体工具确认：

- JPEG、PNG、WebP：Sharp；
- HEIC、HEIF：`heif-info` 与 `heif-convert`；
- MP4、MOV：`ffprobe`。

文件扩展名、浏览器 MIME 和 tus metadata 只用于候选判断与错误展示，不能直接决定最终处理器。

### 9.2 图片主路径

JPEG、PNG 和 WebP：

1. Sharp 从临时文件流读取；
2. 检查单页、像素数和真实格式；
3. 自动应用方向；
4. 转换到 sRGB；
5. 去除全部元数据；
6. 生成最长边 2,560 px 的 WebP；
7. 生成最长边 320 px 的 WebP 预览；
8. 两个输出都完整后删除上传源文件；
9. 将资产状态改为 `ready`。

HEIC 和 HEIF：

1. `heif-info` 确认文件可读取、主图数量和尺寸；
2. 拒绝超过 25 MP 或包含多个主图的文件；
3. `heif-convert` 生成临时高质量 JPEG；
4. Sharp 按同一规则生成展示 WebP 和预览 WebP；
5. 删除 HEIC、临时 JPEG 和转换中间物；
6. 将资产状态改为 `ready`。

`heif-convert` 与 Sharp 不同时运行；同一时刻也不处理另一张图片或视频。

Sharp 必须设置与产品 25 MP 上限一致的 `limitInputPixels`，不能沿用远高于容器承受能力的默认上限。

### 9.3 视频主路径

视频处理顺序：

1. `ffprobe` 输出 JSON 元数据；
2. 确认 MP4/MOV、单 H.264 视频轨、AAC 或无音频、时长、尺寸和帧率；
3. FFmpeg 仅复制合规音视频流到标准 MP4；
4. 启用 fast start；
5. 移除容器级元数据；
6. 从视频中提取一帧；
7. Sharp 生成最长边 960 px 的 WebP 海报；
8. 标准 MP4 与海报都完整后删除上传源文件；
9. 将资产状态改为 `ready`。

禁止加入：

- HEVC 转 H.264；
- 4K 转 1080p；
- 降帧率；
- 重新压缩音频；
- 检测失败后按扩展名强行接受；
- FFmpeg 失败后保留原 MOV 作为可发布资产。

### 9.4 正式资产

最终 Journal 资产只有：

```text
照片：
  relative_path         → 2,560 px 以内的 WebP
  preview_relative_path → 320 px WebP

视频：
  relative_path         → H.264/AAC MP4
  preview_relative_path → 960 px WebP 海报
```

`journal_assets.original_name` 保留朋友手机上的文件名，仅用于小明辨认；`mime_type` 与 `byte_size` 记录最终资产，而不是已经删除的源文件。

图片不新增 `display_relative_path`，因为展示图本身就是正式资产。该选择直接减少数据库字段、媒体路由分支、备份体积和发布后的原片误读取。

## 10. 投稿箱与发布

### 10.1 管理入口

现有管理员导航新增“朋友投稿”，显示 `submitted` 数量：

```text
朋友投稿 3
```

不增加“已读/未读”状态。首期只有待处理、已发布和已删除的业务状态，避免为一个个人收件箱增加阅读状态同步。

### 10.2 投稿列表

`/me/contributions` 按 `submitted_at DESC, id DESC` 游标分页，每页 20 条。

每张列表卡只请求：

- 称呼；
- 送达时间；
- 正文摘要；
- 图片、视频数量；
- 最多 4 张预览或海报；
- 超出数量。

列表不请求 2,560 px 图片，不初始化 `<video>`，不读取视频 metadata。

### 10.3 整理页

`/me/contributions/:id` 提供：

- 投稿人称呼和送达时间；
- 正文编辑；
- 素材顺序调整；
- 单项删除；
- 视频海报与显式播放；
- 发布时间；
- 可见性；
- 发布操作；
- 删除整份投稿。

默认值：

- 发布时间：投稿送达时间；
- 可见性：私有；
- 正文：朋友原文；
- 素材：全部保留；
- 顺序：朋友提交顺序。

首期不允许在整理页追加小明自己的新素材。需要补充内容时，发布后沿用现有 Journal 编辑能力。

按钮文案随选择变化：

- 私有：“保存为私有记录”；
- 公开：“公开发布”。

不能只显示模糊的“发布”。

### 10.4 发布事务

发布前再次确认：

- 投稿状态为 `submitted`；
- 至少有正文或一项保留素材；
- 所有保留素材为 `ready`；
- 每个正式文件和预览文件都存在；
- 可见性、时间和正文合法。

单个 SQLite 事务内：

1. 新增 `journal_entries`；
2. 把保留素材写入 `journal_assets`；
3. 图片资产使用 `kind = 'photo'`；
4. 视频资产使用 `kind = 'video'`；
5. 没有素材时 `content_type = 'text'`；
6. 只有图片时 `content_type = 'photo'`；
7. 含任一视频时 `content_type = 'video'`；
8. 删除已经转交给 `journal_assets` 的投稿素材行；
9. 投稿状态改为 `published` 并记录 `entry_id`。

媒体文件在投稿处理阶段已经写入最终资产目录，发布时不复制、不转码、不重新生成预览，因此发布响应只承担 SQLite 事务。

发布后文件只归 `journal_assets` 所有，`journal_contribution_assets` 不再保留同一路径的第二份所有权。之后删除普通 Journal 记录仍沿用现有资产删除逻辑，不会被投稿记录重复删除。

当前 `journal_entries` 的 Web 普通记录约束需要最小扩展为 `text`、`photo`、`video`，不新增 `mixed` 类型。

### 10.5 发布后的媒体读取

对含投稿视频的卡片：

- 信息流只显示 `preview_relative_path` 海报；
- 不自动创建带 `src` 的 `<video>`；
- 用户进入详情并明确点击播放后才请求 MP4；
- 视频继续使用现有 Range 媒体响应。

图片卡继续使用现有渐进式图片组件：

- 先请求 320 px 预览；
- 进入视口后请求正式 WebP；
- 声明宽高，避免布局跳动。

投稿箱、私有内容和未发布素材使用 `private, no-store`。公开媒体继续服从现有可见性鉴权与缓存策略，不在本功能中扩大公共缓存时间。

## 11. Telegram 通知

朋友点击送达后，服务端按以下顺序执行：

1. 校验草稿与全部 `ready` 素材；
2. 发送一条 Telegram 通知；
3. 在 SQLite 事务中把投稿改为 `submitted`；
4. 返回成功。

通知包含：

```text
📮 收到朋友投稿

来自：阿明
内容：8 张照片 · 1 段视频
留言：今天一起爬山很开心……

查看投稿
```

“查看投稿”指向管理员投稿详情，不携带朋友分享令牌。

Telegram 失败时：

- 请求直接失败；
- 投稿保持 `draft`；
- 朋友端不显示成功；
- 不切换备用通知渠道；
- 不吞掉错误继续标记已送达。

首期不发送上传开始、单文件完成或服务端处理过程通知。

## 12. 数据模型

### 12.1 `journal_contribution_links`

```text
id
token_hash               UNIQUE
expires_at
revoked_at                NULLABLE
created_at
```

只允许一条未撤销且未过期的活动链接。创建新链接前由产品交互明确撤销旧链接。

### 12.2 `journal_contributions`

```text
id
public_id                 UNIQUE
link_id
draft_token_hash          UNIQUE
sender_name
content_text
status                    draft | submitted | published
entry_id                  NULLABLE
submitted_at              NULLABLE
published_at              NULLABLE
created_at
updated_at
```

约束：

- `draft` 可以持有上传中、处理中或失败素材；
- `submitted` 的全部素材必须为 `ready`；
- `published` 必须有 `entry_id`；
- 朋友只能访问持有对应草稿能力令牌的 `draft`；
- `submitted` 后朋友令牌失去写权限。

删除投稿不增加 `discarded` 软删除状态，直接在确认后删除数据库记录和资产，保持个人工具主路径短。

### 12.3 `journal_contribution_assets`

```text
id
contribution_id
upload_id                 UNIQUE
kind                      photo | video
status                    uploading | processing | ready | failed
source_name
source_mime
source_byte_size
stored_mime               NULLABLE
stored_byte_size          NULLABLE
relative_path             NULLABLE UNIQUE
preview_relative_path     NULLABLE UNIQUE
width                     NULLABLE
height                    NULLABLE
duration                  NULLABLE
sort_order
error_code                NULLABLE
error_message             NULLABLE
created_at
updated_at
```

服务端不把每个分块进度写入 SQLite。上传偏移由 tus 文件存储维护，SQLite 只记录业务阶段。

`checking` 只存在于朋友端本地；服务端创建素材记录后从 `uploading` 开始。数据库约束不需要保存纯本地状态。

### 12.4 索引

只增加主路径所需索引：

```text
journal_contribution_links(token_hash)
journal_contributions(status, submitted_at DESC, id DESC)
journal_contributions(draft_token_hash)
journal_contribution_assets(contribution_id, sort_order, id)
journal_contribution_assets(upload_id)
```

不增加全文检索、投稿人索引、分析统计表或审计表。

## 13. API

### 13.1 朋友端业务 API

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/api/contribution-link` | 校验分享令牌并返回到期时间与页面信息 |
| `POST` | `/api/contribution-drafts` | 创建草稿能力令牌 |
| `GET` | `/api/contribution-drafts/:publicId` | 读取自己的素材处理状态 |
| `DELETE` | `/api/contribution-drafts/:publicId/assets/:assetId` | 明确移除素材并终止临时上传 |
| `POST` | `/api/contribution-drafts/:publicId/submit` | 提交称呼、正文与素材顺序 |

朋友端 API 不使用管理员 Cookie。分享令牌只创建草稿，草稿令牌只访问单个草稿。

正文在最终送达时一次提交，不增加输入过程自动保存请求。

### 13.2 tus API

```text
POST    /api/contribution-uploads
HEAD    /api/contribution-uploads/:uploadId
PATCH   /api/contribution-uploads/:uploadId
DELETE  /api/contribution-uploads/:uploadId
```

每个请求都必须带草稿能力令牌。服务端创建上传前确认：

- 草稿仍为 `draft`；
- 链接尚未撤销或过期；
- 素材数、视频数、单文件大小和总量没有超限；
- metadata 中的种类、源文件名和候选 MIME 合法；
- `Upload-Length` 存在且不超过对应类型上限。

### 13.3 管理员 API

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/api/private/contribution-link` | 读取当前链接 |
| `POST` | `/api/private/contribution-link` | 创建新链接 |
| `DELETE` | `/api/private/contribution-link` | 撤销链接 |
| `GET` | `/api/private/contributions` | 游标读取投稿列表 |
| `GET` | `/api/private/contributions/:id` | 读取投稿详情 |
| `POST` | `/api/private/contributions/:id/publish` | 私有保存或公开发布 |
| `DELETE` | `/api/private/contributions/:id/assets/:assetId` | 删除单项素材 |
| `DELETE` | `/api/private/contributions/:id` | 删除整份投稿 |

列表响应只返回预览地址；正式媒体地址只在详情响应中返回。

### 13.4 错误语义

统一返回：

```json
{
  "error": {
    "code": "VIDEO_CODEC_UNSUPPORTED",
    "message": "这段视频使用 HEVC/H.265，高效编码视频暂不支持。请选择 H.264 视频。",
    "assetId": 42
  }
}
```

错误码至少覆盖：

- `LINK_EXPIRED`
- `LINK_REVOKED`
- `DRAFT_EXPIRED`
- `FILE_TOO_LARGE`
- `CONTRIBUTION_TOO_LARGE`
- `TOO_MANY_ASSETS`
- `TOO_MANY_VIDEOS`
- `IMAGE_FORMAT_UNSUPPORTED`
- `IMAGE_PIXEL_LIMIT_EXCEEDED`
- `IMAGE_SEQUENCE_UNSUPPORTED`
- `VIDEO_CONTAINER_UNSUPPORTED`
- `VIDEO_CODEC_UNSUPPORTED`
- `VIDEO_AUDIO_CODEC_UNSUPPORTED`
- `VIDEO_DURATION_EXCEEDED`
- `UPLOAD_LENGTH_MISMATCH`
- `MEDIA_PROCESSING_FAILED`
- `TELEGRAM_NOTIFICATION_FAILED`

前端按 `code` 选择固定中文文案，不通过匹配英文异常文本推断业务原因。

## 14. 删除、过期与备份

### 14.1 临时文件

tus 未完成源文件位于容器：

```text
/tmp/journal-contribution-uploads
```

它们不进入 `/data`，因此不进入现有 Journal 备份。首期本来就不支持跨容器恢复上传，不应为无法恢复的分块扩大备份。

图片和视频处理中的输出先写入：

```text
/data/assets/.tmp/<contribution-public-id>/
```

正式文件完整后才进入：

```text
/data/assets/<year>/<month>/<contribution-public-id>/
```

### 14.2 清理

服务启动时和创建新草稿前执行同一组直接清理：

- 删除超过 24 小时的 `draft`；
- 删除对应 tus 临时文件；
- 删除对应资产临时目录；
- 删除未发布的正式媒体；
- 把进程中断遗留的 `processing` 标记为 `failed`。
- 把找不到对应 tus 临时文件的 `uploading` 素材标记为 `failed`。

清理必须记录删除数量和字节数，不能静默跳过文件系统错误。

`submitted` 投稿不会按时间自动删除；只有小明发布或明确删除后才离开待处理箱。

### 14.3 备份边界

现有备份在 04:50 停止 Journal 容器，这会中断当时的朋友上传。首期不擅自改写已确认的停机一致性备份策略。

由于投稿源分块位于容器 `/tmp`：

- 它们不会进入备份；
- 已完成的正式展示资产仍随 `/data` 备份；
- SQLite 与正式资产继续处于同一停机时间点；
- 恢复后遗留的上传中状态会明确失败，不伪装为可继续。

投稿页不能承诺 04:50 仍可无中断上传，也不增加自动恢复。

## 15. 前端组件边界

### 15.1 朋友端组件图

```text
contribute-main.ts
└── ContributionApp.vue
    ├── ContributionHeader.vue
    ├── ContributorFields.vue
    ├── ContributionMediaPicker.vue
    ├── ContributionMediaList.vue
    │   └── ContributionMediaItem.vue
    ├── ContributionSubmitBar.vue
    └── ContributionSuccess.vue
```

组合函数：

```text
useContributionDraft.ts
  - 分享令牌与草稿建立
  - 称呼、正文和送达

useMediaInspector.ts
  - 本地数量、大小和图片检查
  - 按需加载 mediainfo.js

useContributionUploadQueue.ts
  - 单活动 tus 上传
  - 字节进度
  - 处理状态轮询
  - 明确终止与销毁
```

设计约束：

- 全部使用 Vue 3 Composition API、`<script setup lang="ts">`；
- props 向下、事件向上；
- `ContributionApp` 只编排页面，不承载媒体解析细节；
- `File`、tus 实例和 `AbortController` 使用浅响应；
- 总进度、可送达状态和计数使用 `computed`；
- 不用 `watchEffect` 承担可直接写成事件的动作；
- 组件卸载时撤销全部 Object URL；
- 任何情况下不使用 `requestAnimationFrame`、`cancelAnimationFrame` 或别名。

### 15.2 管理员端

新增：

```text
ContributionInboxView.vue
ContributionReviewView.vue
ContributionCard.vue
ContributionMediaOrganizer.vue
ContributionShareSettings.vue
```

新增管理视图通过异步组件加载。打开公开信息流或普通 `/me` 时不下载投稿整理页代码。

不为投稿新增全局 Pinia store；投稿列表和单个整理页状态局限在对应视图，避免把一次管理流程扩散到全站。

## 16. 交互与可访问性

必须满足：

- 每个输入有可见 `<label>`；
- 文件选择按钮使用原生文件输入关联，不用不可访问的点击容器模拟；
- 触控目标至少 44 × 44 CSS px；
- 移动端底部操作区考虑 `env(safe-area-inset-bottom)`；
- 页面不会出现横向滚动；
- 错误紧邻对应字段或素材，并聚焦第一个错误；
- 异步按钮使用 `aria-busy`；
- 状态不能只靠颜色区分；
- 图片声明宽高或 `aspect-ratio`，避免布局跳动；
- 装饰图标 `aria-hidden="true"`；
- 图标按钮有明确 `aria-label`；
- 禁用按钮旁保留可见原因；
- 危险删除使用就地确认；
- 不使用 `transition: all`；
- 动画遵从 `prefers-reduced-motion`；
- 进度变化不导致按钮和输入发生布局位移；
- 文件大小与时间使用 `Intl.NumberFormat`、`Intl.DateTimeFormat` 格式化；
- 页面文案使用主动、具体的“选择照片或视频”“送给小明”“公开发布”。

朋友端首屏不放教学弹窗。限制摘要在选择按钮下直接可见，只有具体格式表放在可展开说明中。

## 17. OpenResty、Cloudflare 与 Docker

### 17.1 OpenResty

只为 tus 上传路径增加专用配置：

```text
/api/contribution-uploads/
  client_max_body_size 18m
  proxy_request_buffering off
  proxy_buffering off
```

18 MiB 高于固定 16 MiB 分块和少量协议开销，同时远低于当前 210 MiB 全局值。

业务 JSON API 保持小请求体，不共享上传路径配置。

投稿页面与 API 响应增加：

- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- 只允许本站资源的 CSP
- 投稿 HTML `Cache-Control: no-cache`
- 带内容哈希的静态资源长期缓存

### 17.2 Cloudflare

首期不增加：

- 绕过 Cloudflare 的上传域名；
- R2；
- Worker；
- Stream；
- DNS-only 备用上传入口。

16 MiB 分块直接在现有域名内工作。若将来真实数据证明 Cloudflare 或服务器是主瓶颈，再单独立项，不在首期预埋第二条通道。

### 17.3 Docker

运行镜像增加：

- Debian `ffmpeg`；
- Debian `libheif-examples`；
- HEIC 解码所需的系统运行库。

不编译自定义 libvips，不改变现有 Sharp 安装方式。HEIC 明确交给 libheif 工具，JPEG/PNG/WebP 明确交给现有 Sharp。

容器 CPU 和内存限制首期保持不变。媒体处理队列并发 1 是在该边界下的必要条件。

## 18. 实施范围

### 18.1 新增 npm 依赖

- `@tus/server`
- `@tus/file-store`
- `tus-js-client`
- `mediainfo.js`
- `file-type`
- `p-limit`
- `qrcode`

继续复用：

- Fastify；
- better-sqlite3；
- Sharp；
- Zod；
- Vue；
- 现有 Telegram bot 能力。

### 18.2 服务端新增

- 投稿链接仓储与服务；
- 投稿草稿仓储与服务；
- tus 上传适配；
- 单并发媒体处理队列；
- 手机图片标准化服务；
- 短视频检查、容器整理与海报服务；
- 朋友端投稿路由；
- 管理员投稿路由；
- Telegram 投稿通知；
- 草稿和临时资产清理。

### 18.3 服务端修改

- Journal 数据库迁移；
- Web 普通记录允许 `content_type = 'video'`；
- 媒体访问支持投稿箱中的私有预览与视频；
- Fastify 静态路由增加 `/contribute`；
- Docker 运行镜像增加系统媒体工具；
- OpenResty 增加 tus 路径流式代理；
- 服务器关闭时等待当前数据库写入结束，并停止接受新媒体任务。

### 18.4 朋友端新增

- 独立 HTML 与 Vue 入口；
- 投稿表单；
- 本地素材检查；
- 视频编码检查；
- tus 顺序上传；
- 处理状态显示；
- 离开页面提醒；
- 成功页。

### 18.5 管理员 Web 新增

- 投稿导航计数；
- 投稿列表；
- 投稿整理页；
- 投稿链接与二维码设置。

### 18.6 现有 Web 修改

- Vite 多页面输入；
- 管理员投稿路由；
- 投稿管理视图异步加载；
- 视频资产使用海报，显式播放后才设置视频源；
- 现有媒体组件接收视频 `previewUrl`。

不借本功能重构现有 `App.vue`、路由系统、信息流状态或普通发布器。

## 19. 首期明确不做

- 专业相机原片；
- RAW、DNG、ProRAW、TIFF、PSD；
- 48 MP 高分辨率照片；
- 原图下载与原片归档；
- Live Photo 动态部分；
- HEVC/H.265、Dolby Vision、ProRes；
- 视频重编码、裁剪或压缩；
- 长视频；
- 音频、文档、压缩包和任意附件；
- 自动重试；
- 断点跨刷新恢复；
- 上传暂停与恢复；
- 多文件并发上传；
- 分块并行拼接；
- 备用上传域名；
- 对象存储；
- 投稿账号；
- 评论、回复与状态追踪；
- 自动公开；
- AI 自动挑图、改写或审核；
- 管理员整理页追加新素材；
- 长期有效的公开投稿入口；
- 企业级限流、审计、内容审核或多租户能力。

## 20. 产品验收标准

### 20.1 朋友主路径

- 有效分享链接能直接打开独立投稿页，不加载公开信息流和管理员接口。
- 朋友可以填写称呼与正文，并直接选择常见手机 JPEG、PNG、WebP、HEIC 或 HEIF。
- 选择合法素材后第一项立即上传，朋友可以继续输入。
- HEIC 在服务端生成 Journal WebP，不要求朋友先改 iPhone 相机设置。
- 图片完成后只保留展示 WebP 与预览 WebP，页面已明确告知不保存原片。
- H.264 MP4/MOV 在上传前通过本地媒体检查。
- HEVC、超时长和超容量视频在上传前展示准确原因，不开始发送视频字节。
- 页面任意时刻只有一个活动上传流。
- 上传完成与服务端处理有不同状态，不把字节 100% 显示成已送达。
- 点击“送给小明”后可以等待仍在进行的上传，成功页只在全部成功条件满足后出现。

### 20.2 性能与硬件

- 投稿首屏不包含 Router、Pinia、Tiptap、信息流与管理员页面代码。
- `mediainfo.js` 不进入无视频投稿的首屏资源。
- 浏览器不把完整文件读入 ArrayBuffer、base64 或 Vue 深响应状态。
- OpenResty 不为 tus 分块形成完整请求体缓冲。
- Node 不为上传形成完整文件 Buffer。
- 媒体处理并发严格为 1。
- HEIC 解码与 Sharp 输出不同时处理另一项素材。
- 视频只做流复制、容器整理和单帧海报，不做转码。
- 投稿列表只获取预览图或海报，不下载正式图片和视频。
- 信息流视频在用户明确操作前不请求视频主体。

### 20.3 错误真实性

- 无效、过期和已撤销链接显示不同错误。
- 文件过大、像素过高、编码不支持、处理失败和通知失败显示不同错误。
- 一项失败后不自动重试、不继续跳过它完成整份投稿。
- 服务中断后的处理中素材明确变为失败。
- Telegram 失败时不显示“已经送到”。
- 服务端文件、数据库或媒体工具错误不被静默吞掉。

### 20.4 小明主路径

- 设置页可以创建、分享、展示二维码和撤销一条 72 小时链接。
- 导航可以看到待处理投稿数量。
- 投稿列表不加载原始媒体。
- 整理页可以修改正文、顺序、发布时间、素材取舍和可见性。
- 默认可见性为私有。
- 发布不复制或重新处理媒体。
- 含视频投稿进入现有 `video` 内容类型并可以在 Journal 播放。
- 删除投稿会删除对应资产，不影响已发布的其他 Journal 记录。

## 21. 后续扩展触发条件

以下能力只有在真实首期使用出现对应问题后再单独设计：

- 朋友确实频繁使用 48 MP 手机模式，且 25 MP 成为主要阻碍；
- HEVC 视频占比使短视频投稿主路径不可用；
- 300 MiB 或 90 秒限制持续阻碍正常手机内容；
- 朋友网络失败率证明必须重新讨论重试或恢复；
- 单机媒体处理排队成为可观察瓶颈；
- 展示图不保存原片无法满足明确的归档需求；
- 本地磁盘或备份体积成为真实问题。

届时应回到 `journal-friend-contribution-inbox.md` 中的大文件边界重新评估，而不是在本首期方案中预埋相机传输、视频转码、对象存储或复杂任务系统。
