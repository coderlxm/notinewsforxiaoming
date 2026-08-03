# Journal 朋友手机投稿箱：极致性能改造技术备忘

## 1. 文档定位

本文是已经通过评审的
[`journal-friend-mobile-contribution-inbox.md`](./journal-friend-mobile-contribution-inbox.md)
的未来高性能改造附录。

它不重新描述完整产品交互，也不改变以下产品定义：

- 服务对象仍是把日常照片和短视频投稿给小明的朋友；
- 内容仍以手机拍摄为主，不转向专业原片、相机素材或长期原件归档；
- 上传源文件仍只用于生成 Journal 展示资产，处理完成后删除；
- 成功仍表示素材处理、投稿入箱和 Telegram 通知都已经完成；
- 错误直接暴露，不自动重试、不切换处理器、不降级输出、不用另一条通道假装成功。

本文只记录未来服务器和目标终端达到明确性能前提后，应采用的技术选型、固定参数、数据边界与迁移标记。未写到的产品行为继续以上一份文档为准。

本文不是当前 `1 CPU / 512 MB` 部署的实施方案。没有完成第 4 节的硬件前提时，不得只挑选本文中的高并发参数应用到现有容器。

## 2. 证据边界

### 2.1 当前仓库已经确认的事实

以下内容来自当前项目源码、依赖和部署文件：

- Journal 前端为 Vue 3.5 和 Vite 8；
- Journal 服务端为 Fastify 5；
- 数据库为 SQLite，并已使用 WAL；
- 图片处理依赖 Sharp 0.35.3；
- 当前 Journal 容器限制为 `1 CPU / 512 MB`；
- 当前正式数据通过 `/opt/journal/data:/data` 挂载；
- 当前备份会停止 Journal 容器，备份结束后再启动；
- 当前 OpenResty 全局 `client_max_body_size` 为 `210m`；
- 上一份方案选择 `@tus/server`、`@tus/file-store`、`tus-js-client`、
  `mediainfo.js` 和 `p-limit`，但这些是设计选型，不代表已经在源码中实现。

### 2.2 外部技术资料确认的能力

- Sharp 可以使用系统全局 libvips；Sharp 也明确指出，在 glibc Linux 且没有
  jemalloc 时，默认每张图片的 libvips 并发会降为 1，以减少内存碎片。Sharp
  同时提供显式的并发、缓存、队列计数和 SIMD 控制。因此极致版应把 libvips
  构建、内存分配器和线程预算作为一个整体，而不是只把 `sharp.concurrency`
  调大。参考：[Sharp installation](https://sharp.pixelplumbing.com/install/)、
  [Sharp global properties](https://sharp.pixelplumbing.com/api-utility/)。
- FFmpeg 支持硬件设备、硬件解码与硬件编码，但官方文档明确表明具体能力取决于
  FFmpeg 构建、硬件、驱动和过滤链；不能把“机器有核显”等同于整条转码链已经
  运行在硬件上。libplacebo 可以在 GPU 上完成缩放、色域转换、HDR 峰值分析和
  色调映射，并能处理嵌入的 Dolby Vision 元数据。参考：
  [FFmpeg main documentation](https://ffmpeg.org/ffmpeg.html)、
  [FFmpeg codecs](https://ffmpeg.org/ffmpeg-codecs.html)、
  [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html)。
- tus 的同一文件并行分块依赖 Concatenation 扩展；
  `@tus/file-store` 支持 Creation With Upload、Expiration 和 Termination，
  但不支持 Concatenation。因此可以并行上传多个独立文件，不能把
  `parallelUploads` 调大后宣称同一视频已经并行上传。参考：
  [tus protocol](https://tus.io/protocols/resumable-upload)、
  [`@tus/file-store` extensions](https://github.com/tus/tus-node-server/tree/main/packages/file-store#extensions)。
- Cloudflare Free 和 Pro 计划的单请求体上限仍为 100 MB。服务器升级不会改变
  这条边缘网络限制，所以极致版仍必须使用小于该上限的固定分块。参考：
  [Cloudflare request body limits](https://developers.cloudflare.com/workers/platform/limits/#request-and-response-limits)。
- WebCodecs 可以运行在 Dedicated Worker，但规范不要求浏览器支持任何特定
  编解码器或配置。它不能作为“最近两年旗舰手机一定支持”的前提，也不能成为
  唯一上传主路径。参考：[W3C WebCodecs](https://www.w3.org/TR/webcodecs/)。
- Vite 原生支持多页面入口、动态导入、WebAssembly 资源和模块 Worker，Worker
  推荐使用 `new Worker(new URL(..., import.meta.url), { type: 'module' })`
  形式。参考：[Vite build guide](https://vite.dev/guide/build.html#multi-page-app)、
  [Vite features](https://vite.dev/guide/features.html)。
- OpenResty/Nginx 可以关闭上游请求体缓冲，也可以通过
  `X-Accel-Redirect` 完成内部重定向，并使用 `sendfile` 或线程 AIO 发送文件。
  这允许 Fastify 只做权限与业务判断，不再经由 Node.js 读取和转发完整媒体。
  参考：[Nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)、
  [Nginx core module](https://nginx.org/en/docs/http/ngx_http_core_module.html)。

### 2.3 仍属于未来决策、不能当成当前事实的内容

以下参数是本文的目标配置，不是当前环境已经达到的运行时结论：

- 参考服务器规格；
- Intel 核显及其 VAAPI、Vulkan、libplacebo 能力；
- 图片和视频处理耗时；
- 三文件并发是否能占满投稿者的实际上行链路；
- 容器 CPU、内存和媒体并发参数；
- 不停机备份所依赖的文件系统快照能力。

未来购置的硬件如果不符合参考实现，应先更新本文中的硬件档案和唯一媒体路径，
不能在运行时同时保留 Intel、NVIDIA、软件编码三套实现。

## 3. 极致版目标

极致版优化的是朋友实际感知到的完整投稿时长，而不是单独追求某个组件的峰值：

```text
选择素材
  → 本地快速识别
  → 尽快发出第一批字节
  → 多个独立文件并发上传
  → 每个文件到齐后立即处理
  → 所有正式资产就绪
  → 投稿入箱
```

优先级固定为：

1. 主线程输入、滚动和按钮反馈不被媒体分析阻塞；
2. 第一份合法素材尽快开始发送；
3. 一次投稿中的网络上行与服务端处理尽量重叠；
4. 服务端不因单个大文件形成与文件大小等量的内存占用；
5. HEIC、HEVC 和手机 HDR 视频进入确定的服务端路径；
6. 媒体派生物适配 Journal 页面实际展示尺寸，减少以后浏览时的网络浪费；
7. 所有并发均有固定上限，不以无界队列换取短时跑分。

极致版不追求：

- 在手机浏览器中完成全量图片压缩或视频转码；
- 保存手机原片、Live Photo 组合、ProRAW、ProRes 或相机 RAW；
- 多节点、Redis、消息中间件、对象存储或分布式媒体处理；
- 失败后的自动重试、软件编码兜底或备用上传域名；
- 为旧设备增加 legacy bundle、polyfill 分支或第二套页面；
- 用 AVIF 编码耗时换取小量存储收益；
- HLS、自适应码率或多清晰度视频流。

## 4. 参考硬件档案与启用门槛

### 4.1 唯一参考实现

本文以一台 Linux 单机作为唯一参考：

| 项目 | 目标规格 |
|---|---|
| CPU | 至少 8 个现代 CPU 核心 |
| 内存 | 至少 16 GiB |
| 正式与临时媒体盘 | 同一块本地 NVMe 文件系统 |
| 可用空间 | 启用投稿前至少保留 100 GiB |
| 网络 | 至少 1 Gbps 网卡与稳定公网出口 |
| 视频硬件 | Intel 核显，支持 HEVC Main/Main10 解码和 H.264 编码 |
| Linux 媒体接口 | VAAPI + Vulkan |
| 文件系统 | 能为 `/opt/journal` 数据集创建原子快照 |

优先选择带 Intel 核显的主机，是因为本项目只需要单机短视频规范化，不值得为此
维护独立 GPU 服务。本文的视频参数统一按 Intel Linux 媒体栈设计。

如果最终购买 NVIDIA 或纯 CPU 主机，必须先重新确定唯一视频路径；不能把
NVENC、VAAPI 和软件编码同时放进生产代码，让失败时依次尝试。

### 4.2 容器资源档案

参考主机上的 Journal 容器固定为：

| 资源 | 目标值 |
|---|---:|
| CPU 上限 | 6 核 |
| 内存上限 | 8 GiB |
| Node/libuv 工作线程 | 8 |
| Sharp 活动输出流水线 | 2 |
| 每条 Sharp 流水线的 libvips 并发 | 3 |
| 视频活动任务 | 1 |
| 上传活动文件 | 3 |

保留的主机资源用于内核页缓存、OpenResty、SQLite、Telegram bot 和驱动。不能把
16 GiB 全部分配给 Journal 容器。

这些值是一个完整档案，不能单独把图片任务改为 4 或把 libvips 线程改为 8。
未来换成更多核心时，应重新给出整套资源档案。

### 4.3 启用判据

极致版对硬件的最低结果要求为：

- 投稿上传和媒体处理同时进行时，Fastify 业务 API 仍保持稳定响应；
- 两张 50 MP 手机照片并行处理时不交换到磁盘；
- 一路 4K HEVC Main10 手机视频规范化的速度不低于 2 倍实时；
- HDR 转 SDR 的固定过滤链实际运行在选定 GPU 路径；
- 容器内没有自动切回软件解码或软件编码；
- NVMe 上的上传临时文件、处理暂存文件和正式资产可以同文件系统原子改名；
- 备份不再通过每天停止 Journal 容器完成。

任何一项未满足，都表示硬件档案或媒体参数尚未定版，而不是在代码中增加兜底。

## 5. 目标架构

```text
最近两年主流手机 / 中高配电脑
  │
  ├─ Vue 投稿页面
  │    ├─ 主线程：表单、文件列表、固定频率进度
  │    └─ Module Worker：mediainfo.js + WASM 分段读取
  │
  └─ 3 个独立文件上传流，每个文件内部顺序 tus 分块
       │
Cloudflare
       │  单请求 16 MiB
OpenResty
       │  关闭请求体缓冲
Fastify + @tus/server + @tus/file-store
       │
本地 NVMe 上传目录
       │
       ├─ p-limit Sharp 输出池 2
       │    └─ Sharp + 全局 libvips/libheif + jemalloc
       │
       └─ p-limit 视频池 1
            └─ FFmpeg + VAAPI + Vulkan/libplacebo
                  │
同盘 staging
       │  原子改名
/data/assets 正式资产
       │
Fastify 鉴权 / 可见性判断
       │  X-Accel-Redirect
OpenResty sendfile / Range
```

仍然只运行一个 Fastify 业务进程。图片计算由 libvips 原生线程完成，视频由 FFmpeg
子进程和核显完成；为此再引入 Node cluster、Piscina 或独立媒体微服务不会改善
主路径，反而会扩大 SQLite 协调和部署边界。

## 6. 技术选型总表

| 层级 | 极致版选择 | 标注 |
|---|---|---|
| 前端框架 | Vue 3 `<script setup lang="ts">` | 延续现有项目 |
| 构建 | Vite 多页面入口，`target: 'es2022'` | 不输出 legacy bundle |
| 本地媒体识别 | `mediainfo.js` + Dedicated Module Worker | WASM 按需加载 |
| 客户端转码 | 不做 | 手机算力用于交互和识别，不消耗在全片重编码 |
| 上传客户端 | `tus-js-client` | 3 个文件并发；单文件不并行 |
| 上传服务端 | `@tus/server` + `@tus/file-store` | 保留 Fastify 内认证和单进程边界 |
| 服务端队列 | 两个 `p-limit` | Sharp 输出流水线 2、视频 1 |
| 图片 | Sharp + 自编译全局 libvips | 直接读 HEIC/HEIF，不再经过 JPEG 中间文件 |
| 内存分配器 | jemalloc | 与 glibc Linux 下的 Sharp 并发一起定版 |
| 视频 | 固定 FFmpeg 构建 | VAAPI 解码/编码，Vulkan/libplacebo 处理 HDR |
| 数据库 | 现有 SQLite WAL | 不写上传字节进度 |
| 存储 | 单机 NVMe bind mount | 上传、staging、正式资产同文件系统 |
| 媒体响应 | Fastify + `X-Accel-Redirect` | Node 不搬运正式文件字节 |
| 日志 | Fastify/Pino 结构化日志 | 不增加外部监控平台 |
| 备份 | 同文件系统原子快照 | 不再定时停止容器 |

## 7. 前端与构建细节

### 7.1 页面入口

继续使用独立投稿 HTML 入口，通过
`build.rolldownOptions.input` 与现有 Journal 管理页面共同构建。

固定选择：

- `build.target` 使用 `es2022`；
- 不安装 legacy 插件；
- 不引入 SSR、Nuxt、PWA 或 Service Worker；
- 投稿页只同步加载首屏表单、文件选择和最小状态逻辑；
- `tus-js-client` 在出现首个合法文件后动态加载；
- `mediainfo.js`、其 Worker 和 WASM 在出现首个视频后动态加载；
- WASM 作为带内容哈希的独立静态资源，不内联到 JavaScript；
- 投稿页不导入 Journal 管理端组件和管理端数据层。

目标是让普通文字投稿和仅图片投稿不为视频识别模块付出下载与解析成本。

### 7.2 Vue 状态边界

组件仍采用单向数据流：

```text
ContributionApp
  ├─ ContributionFields
  ├─ ContributionPicker
  ├─ ContributionAssetList
  │    └─ ContributionAssetItem
  └─ ContributionSubmit
```

技术约束：

- `ContributionApp` 只编排 composable 和服务端状态；
- `File`、tus upload 实例、Worker 实例和对象 URL 使用 `shallowRef`；
- 素材数组使用根引用替换，不让 Vue 深度代理浏览器原生对象；
- 派生的总字节、总进度和可提交状态使用 `computed`；
- `watch` 只承担启动/停止上传、释放对象 URL、终止 Worker 等副作用；
- 每个副作用都在清理函数中释放对应资源；
- 列表稳定键只使用服务端预分配的 `assetId`，不用数组下标；
- 文字输入组件不随上传进度更新重建；
- Worker 与主线程消息使用可辨识联合类型，不传递任意对象。

建议 composable 边界：

```text
useContributionDraft()
useMediaInspectorWorker()
useUploadScheduler()
useContributionStatus()
```

不要建立全局 Pinia store。投稿页面是一次性局部流程，组件树和状态所有权都足够
清楚，全局 store 只会延长文件与上传实例的生命周期。

### 7.3 主线程预算

最近两年旗舰设备仍不等于可以无节制触发 Vue 更新：

- 视频容器分析全部在 Module Worker 中执行；
- Worker 通过 `Blob.slice()` 按 mediainfo 请求读取，不把完整视频复制进内存；
- 同时最多分析 2 个文件；
- 上传回调的字节变化先写入非响应式计数器；
- 每 100 ms 最多提交一次 Vue 状态更新；
- 文件完成或失败时立即提交最终状态，不等待下一次定时更新；
- 只使用时间戳和 `setTimeout` 合并进度更新；
- 不读取完整文件为 `ArrayBuffer`，不计算全文件哈希；
- 本地对象 URL 在素材移除或页面卸载时立即释放。

不得使用 `requestAnimationFrame` 或其任何别名。

### 7.4 为什么不做客户端压缩和 WebCodecs 转码

客户端转码会延迟第一批上传字节，持续占用电池和温控预算，还会让结果取决于浏览器
实际暴露的编解码器。即使目标设备较新，WebCodecs 规范也不保证 HEVC 编码或解码
必然存在。

因此客户端只负责：

- 文件数量、声明大小与名称检查；
- 通过分段读取识别容器、编码、时长、分辨率和色彩信息；
- 本地预览；
- 原文件流式上传。

正式解码、色彩归一和派生资产全部由唯一的服务端路径完成。

## 8. 上传路径

### 8.1 固定参数

| 参数 | 极致版值 |
|---|---:|
| tus 分块 | 16 MiB |
| 同时活动文件 | 3 |
| 同一文件活动分块 | 1 |
| `parallelUploads` | `1` |
| Creation With Upload | 开启 |
| 自动重试 | 关闭 |
| 跨刷新查找历史上传 | 关闭 |
| 指纹持久化 | 关闭 |
| 上传压缩 | 关闭 |

服务器和终端升级不能消除移动网络抖动与 Cloudflare 单请求上限。16 MiB 已足够大，
HTTP 头和往返开销相对媒体字节很小，同时比 32 MiB 更不容易把一次弱网请求拖到
边缘连接时限附近，所以极致版不盲目增大分块。

三文件并发只作用于三个独立素材：

```text
photo-a: PATCH 0 → 16 MiB → ...
photo-b: PATCH 0 → 16 MiB → ...
video-c: PATCH 0 → 16 MiB → ...
```

同一文件仍严格按照 tus offset 顺序写入。`@tus/file-store` 不支持
Concatenation，不得把客户端参数调大制造虚假的同文件并行。

### 8.2 调度规则

上传调度器固定为：

- 总并发 3；
- 视频同时最多 1 个，剩余位置优先让照片开始；
- 一个文件完成上传后立即释放槽位并进入服务端处理；
- 不等待整批文件传完才开始第一项处理；
- 上传队列与图片、视频处理池互相独立；
- 首个失败直接进入明确失败状态，不自动重发分块。

这样可以让照片快速到达并完成，同时避免两个大视频长期占满朋友的上行链路。

### 8.3 全链路流式

字节路径固定为：

```text
File
  → tus-js-client
  → Cloudflare
  → OpenResty（不缓存请求体）
  → Fastify / @tus/server
  → @tus/file-store
  → NVMe 临时文件
```

禁止在任何层执行：

- `arrayBuffer()` 读取完整媒体；
- 将请求体聚合为 Buffer；
- multipart 与 tus 双实现；
- OpenResty 请求体落盘后再转发；
- 对 JPEG、HEIC、MP4 或 MOV 做 HTTP gzip/brotli；
- 上传失败后切换直连源站。

### 8.4 OpenResty 上传位置

上传路径单独配置：

- `client_max_body_size 17m`；
- `proxy_request_buffering off`；
- `proxy_buffering off`；
- `proxy_http_version 1.1`；
- `proxy_next_upstream off`；
- 上传超时只覆盖一块 16 MiB 请求，不覆盖后续媒体处理；
- 业务 JSON API 不继承上传路径的大请求设置。

上传请求成功只表示当前 tus 操作完成。媒体处理通过独立状态 API 查询，不能让
Cloudflare 连接等待 FFmpeg 或 Sharp。

### 8.5 同文件并行的保留迁移点

默认仍选择 `@tus/server`，因为它直接复用 Fastify 的草稿权限、SQLite 状态和
现有部署边界。增加一个 tusd 侧车只为追求理论并行，会新增认证 hook、完成通知、
文件归属和进程生命周期协调。

只有未来运行数据同时满足以下条件，才允许整体替换上传后端：

- 单个大视频占一次投稿总字节的绝大多数；
- 一个 tus 连接无法占到朋友可用上行的 70%；
- Fastify、OpenResty、NVMe 和 Cloudflare 均未形成瓶颈；
- 增加多文件并发无法改善该场景。

届时应一次性把 `@tus/server`/`@tus/file-store` 替换为支持 Concatenation 的
唯一 tus 服务端，并让同一文件使用 3 个 partial upload。不能同时保留 Node tus
和 tusd，也不能在上传失败后切换二者。

## 9. 图片处理

### 9.1 输入能力

产品数量和对外容量仍以上一份文档为准。极致版的媒体实现应预留以下手机输入上限，
但是否向用户开放更高配额由以后产品调整单独决定：

| 项目 | 技术上限 |
|---|---:|
| 单张源文件 | 50 MiB |
| 解码像素 | 50 MP |
| 格式 | JPEG、PNG、静态 WebP、单张 HEIC/HEIF |
| 动画与多页图片 | 不接收 |
| RAW / DNG / ProRAW | 不接收 |

扩展名、浏览器 MIME 和 tus metadata 仍只做候选判断。正式处理前由 libvips
读取真实格式、页数、尺寸和像素数。

### 9.2 libvips 构建

极致版不再使用 `heif-convert → JPEG → Sharp` 两段路径，而是构建带以下能力的
全局 libvips，并让 Sharp 固定链接它：

- libheif HEIC/HEIF 解码；
- JPEG、PNG、WebP；
- lcms 色彩管理；
- EXIF 方向处理；
- Highway SIMD；
- 与当前 Sharp 要求匹配的 libvips 版本。

容器固定使用：

- `SHARP_FORCE_GLOBAL_LIBVIPS=1`；
- jemalloc；
- `sharp.concurrency(3)`；
- `sharp.cache({ memory: 256, files: 64, items: 256 })`；
- Sharp SIMD 保持开启；
- `limitInputPixels` 固定为 50 MP。

服务启动时读取 `sharp.versions`、`sharp.format` 和 SIMD 状态。与镜像声明的媒体
档案不一致时服务直接失败，不切换 Sharp 预编译 libvips，也不调用
`heif-convert`。

### 9.3 有界多尺寸输出

每张图只建立一个规范化计划：

1. 从 NVMe 文件路径读取，不形成整文件 Buffer；
2. 读取真实 metadata 并执行上限判断；
3. 自动应用方向；
4. 转为 sRGB SDR；
5. 删除 EXIF、定位、设备与编辑元数据；
6. 为四个尺寸建立相同输入约束的 Sharp 输出流水线；
7. 每个派生文件先写 staging；
8. 所有文件完成后在同一文件系统原子改名；
9. 一次 SQLite 事务写入资产和全部 variant；
10. 删除上传源文件。

固定生成：

| variant | 最长边 | WebP quality | 用途 |
|---|---:|---:|---|
| `thumb` | 320 px | 68 | 投稿箱和小图 |
| `feed` | 960 px | 78 | 手机 Journal 列表 |
| `detail` | 1,600 px | 82 | 主流手机详情 |
| `full` | 2,560 px | 84 | 高分屏和电脑大图 |

所有尺寸均 `withoutEnlargement: true`。输出统一为 WebP，不同时生成 AVIF 和
WebP。对于这个个人站点，WebP 编码更快、现有读取链路已经使用 WebP；单一格式也
避免内容协商、缓存键和双倍派生任务。

### 9.4 图片并发

全局 Sharp 输出池固定允许 2 条活动流水线，每条最多使用 3 个 libvips 线程。
同一素材的四个 variant 和不同素材共同竞争这两个槽位，因此最多只有 6 个
libvips 工作线程。资产任务可以汇合四个已经进入全局限制器的 Promise，但不得在
限制器外直接用 `Promise.all` 并行调用 Sharp。

这里不承诺四个 variant 只发生一次物理解码。Sharp/libvips 是否复用解码与缓存由
具体输入格式和处理图决定；本文只保证不生成 JPEG 中间文件、输入直接来自 NVMe，
并且所有输出流水线都受同一个全局限制器约束。

队列长度和处理计数通过 Sharp 自带的 `queue`、`counters()` 与 `cache()` 进入
结构化日志。它们用于以后调整整套硬件档案，不用于运行时自动改变并发。

## 10. 视频处理

### 10.1 输入能力

极致版为普通手机视频增加：

- MP4 和 MOV；
- H.264/AVC；
- HEVC/H.265 Main 与 Main10；
- AAC 音频；
- 最高 4K、60 fps；
- SDR、HDR10、HLG 和手机 Dolby Vision 基层；
- 最长 180 秒的处理能力。

仍不接收：

- ProRes；
- RAW 视频；
- 8K；
- 多视频轨、多音轨编辑工程；
- 外挂字幕；
- 无法由固定 FFmpeg 构建识别的编码。

这些是处理能力上限，不自动改写上一份产品文档中的首期时长和容量合同。

### 10.2 固定 FFmpeg 镜像

FFmpeg 镜像必须固定版本和构建选项，并包含：

- VAAPI；
- Intel media driver；
- Vulkan；
- libplacebo；
- H.264、HEVC、AAC、MP4 和 MOV 所需 demux/mux；
- WebP 海报输出；
- `ffprobe`。

容器只挂载选定的 render node，不授予多块 GPU。处理器配置中明确记录该设备，
不使用 `auto` 硬件选择。

服务启动时确认固定解码器、编码器、过滤器和设备都存在。任一能力缺失时服务直接
失败，不能悄悄改用软件编码。

### 10.3 两个确定的处理计划

视频在执行前只会被分配到以下两个主路径之一。这是输入合同决定的处理计划，不是
发生错误后的 fallback。

#### A. 直接整理

仅当源文件同时满足以下条件：

- H.264 Baseline、Main 或 High，且像素格式可直接 Web 播放；
- AAC-LC；
- 不高于 1,920 × 1,080；
- 不高于 60 fps；
- SDR BT.709；
- 方向、时间戳和轨道结构合法。

此路径只做：

- 丢弃非必要轨道和源 metadata；
- 重建连续时间戳；
- MP4 faststart；
- 生成 WebP 海报。

视频与音频 packet 不重新编码。

#### B. 硬件规范化

其余允许的 H.264 或 HEVC 手机视频统一经过：

```text
VAAPI 硬件解码
  → Vulkan/libplacebo
       ├─ 应用方向
       ├─ 限制为 1,920 × 1,080，保持比例
       ├─ HDR / HLG / Dolby Vision → SDR BT.709
       └─ 输出 8-bit NV12
  → VAAPI H.264 编码
  → AAC-LC
  → MP4 faststart
```

输出合同：

| 项目 | 固定值 |
|---|---|
| 容器 | MP4 |
| 视频 | H.264 High，yuv420p/NV12 |
| 最大尺寸 | 1,920 × 1,080 |
| 最大帧率 | 60 fps |
| 色彩 | SDR BT.709 |
| 码率控制 | 质量优先的硬件 VBR，峰值 10 Mbps |
| 音频 | AAC-LC，48 kHz，最高 160 kbps |
| 网络播放 | faststart |
| 海报 | 1,280 px 最长边 WebP |

具体 VAAPI 质量参数属于硬件档案，应在购买主机后固定为一个值写入配置，不能根据
失败情况切换 preset 或改用软件编码。

### 10.4 单图完成视频与海报

硬件规范化使用一个 FFmpeg filter graph，从同一解码结果分出：

- 正式 H.264 MP4；
- 一张已完成方向和色彩归一的 WebP 海报。

两个输出都先写 staging。FFmpeg 正常结束、两个文件均存在且 metadata 符合输出
合同后，才原子改名并提交 SQLite。任一输出失败则整个素材失败，不保留半成品，
也不重新运行另一条命令补海报。

视频池固定并发 1。核显支持多会话不代表本项目需要同时转两段视频；单路硬件转码
已经能与三路网络上传和两路图片处理重叠，并能避免 GPU filter graph 互相争抢。

## 11. 服务端调度与状态

### 11.1 三类资源互相独立

服务端只设置三个固定限制器：

| 资源 | 限制 |
|---|---:|
| tus 活动文件写入 | 3 |
| Sharp 输出流水线 | 2 |
| FFmpeg 视频任务 | 1 |

上传完成事件只负责：

1. 把素材从 `uploading` 原子更新为 `processing`；
2. 图片 variant 进入全局 Sharp 输出池，视频进入 FFmpeg 视频池；
3. 立即结束上传请求。

不在 tus 完成回调中同步等待媒体结果，也不把所有媒体放进一个串行队列。

### 11.2 不引入任务平台

继续使用素材记录本身表达任务状态：

```text
uploading → processing → ready
                        ↘ failed
```

不增加 Redis、BullMQ、RabbitMQ、消费者服务或独立调度数据库。单机进程内的两个
`p-limit` 已经能准确表达资源边界。

进程在 `processing` 期间结束时，该素材在下次服务启动时直接标为 `failed` 并记录
服务中断，不自动重跑。尚未开始处理的素材只有在确实已经完整上传且状态仍为
`uploading` 时才进入明确的数据修复范围，不能靠扫描临时目录猜测成功。

### 11.3 SQLite 写入

SQLite 只记录业务阶段，不记录：

- tus 每个 PATCH；
- 上传百分比；
- FFmpeg 帧进度；
- Sharp variant 百分比；
- 前端轮询次数。

一次素材处理只在进入处理、完成或失败时写数据库。所有 variant 与资产 ready 状态
在一个事务中提交，页面不会看到“记录已 ready 但某个尺寸尚未落盘”的中间状态。

建议新增：

```text
journal_asset_variants
  id
  asset_id
  kind
  mime_type
  relative_path
  width
  height
  byte_size
  created_at

UNIQUE(asset_id, kind)
```

现有 `relative_path` 可继续指向 `full` 或视频 MP4，
`preview_relative_path` 可继续指向 `thumb` 或视频海报，避免同时重写全部现有
Journal 读取代码。新页面读取 variants 后再使用 `srcset`。

资产记录额外保留：

- `source_codec`；
- `source_color_transfer`；
- `processing_plan`：`image-v2`、`video-remux-v2` 或
  `video-vaapi-v2`；
- `processor_version`。

不保存完整 ffprobe JSON。

## 12. 存储布局

### 12.1 同盘目录

以下目录必须位于同一 NVMe 文件系统：

```text
/opt/journal/runtime/uploads
/opt/journal/runtime/staging
/opt/journal/data/assets
/opt/journal/data/journal.sqlite
```

`uploads` 和 `staging` 通过独立 bind mount 进入容器，但不放进 Docker overlay。
正式改名不跨文件系统，避免复制大视频。

禁止：

- 把上传临时文件放在 tmpfs；
- 把媒体写入容器可写层；
- 从机械盘读取源文件、向另一块盘写正式文件；
- 将源文件复制到“工作目录”后再处理；
- 为一次处理保留第二份长期源文件。

### 12.2 空间预留

创建素材上传前，根据声明字节记录空间预留：

- 图片预留 `source + 256 MiB`；
- 直接整理视频预留 `source × 2`；
- 硬件规范化视频预留 `source × 2 + 256 MiB`；
- 文件系统始终保留 20 GiB 不参与预留。

上传结束并删除源文件后释放预留。空间不足时创建上传直接失败，不先接收部分字节，
也不在中途删除其他投稿来腾空间。

预留值只用于拒绝新的上传，不用于伪造操作系统剩余空间。

### 12.3 正式写入

每个处理任务只允许：

1. 从 `uploads` 读取一个源文件；
2. 向 `staging/<asset-id>/` 写入全部派生物；
3. 完整关闭文件句柄；
4. 同盘原子改名到 `data/assets/<asset-id>/`；
5. 提交 SQLite；
6. 删除源文件和空 staging 目录。

正式资产路径使用服务端生成的 ID，不使用朋友上传的文件名。

## 13. 正式媒体读取

当前通过 Fastify `sendFile` 返回正式媒体的路径，极致版改为：

1. Fastify 根据 asset ID 查询 SQLite；
2. Fastify判断投稿者能力令牌、管理员会话或公开可见性；
3. Fastify只返回正确的 MIME、缓存策略和 `X-Accel-Redirect`；
4. OpenResty 的 `internal` location 从 `/opt/journal/data/assets` 发送文件；
5. Range、`sendfile` 与线程 AIO 由 OpenResty 处理。

内部 location 不能从公网直接访问，也不能接受客户端提供的任意文件系统路径。
Fastify 只生成由数据库 relative path 映射出的内部 URI。

这一改动让 Node.js 不再为视频拖动、图片响应和 Range 请求搬运媒体字节。媒体可见性
仍由 Fastify 决定，不把私有文件目录直接暴露成静态站点。

公开资产仍使用可重新校验的缓存策略。因为同一素材以后可能从公开变为私有，不能
给原 URL 设置长期 immutable 缓存，也不能依赖 Cloudflare 缓存作为权限层。

## 14. 备份与部署

### 14.1 不停机备份是启用前提

当前每日停止 Journal 容器的备份方式会中断正在进行的上传和处理，与极致版目标
冲突。新服务器必须让数据库、正式资产和相关元数据位于同一可快照数据集：

```text
/opt/journal/data
```

备份从该数据集的只读原子快照读取。`runtime/uploads` 和 `runtime/staging` 不进入
备份。

正式资产删除必须先在 SQLite 事务中移除引用，再物理删除文件。这样快照最多包含
未被数据库引用的多余文件，不会包含仍引用但已经消失的媒体。

### 14.2 媒体镜像

媒体镜像必须一次性固定：

- Node 24；
- Sharp 及其要求的全局 libvips；
- libheif；
- jemalloc；
- FFmpeg；
- VAAPI/Vulkan/libplacebo；
- Intel 用户态媒体驱动。

依赖升级必须作为整套媒体档案升级，不能只升级 Sharp 或 FFmpeg 后继续沿用旧输出
结论。镜像版本应写入每个新资产的 `processor_version`。

### 14.3 发布切换

发布时先停止接收新的投稿草稿，再等待当前上传和媒体任务自然结束，然后替换容器。
不能强制结束后依赖自动续传，也不能在新旧容器之间共享一个正在写入的
`@tus/file-store` 上传。

## 15. 可观测数据与性能目标

### 15.1 结构化事件

沿用 Fastify/Pino，每个素材使用同一个 `assetId` 关联：

- `upload-created`；
- `upload-finished`；
- `processing-started`；
- `processing-finished`；
- `processing-failed`；
- `asset-served`。

关键字段：

```text
assetId
draftId
mediaType
sourceBytes
sourceCodec
processingPlan
uploadDurationMs
queueWaitMs
processingDurationMs
outputBytes
imageQueue
imageProcessing
```

不记录投稿正文、能力令牌、原文件名、EXIF 或完整 ffprobe 输出。

### 15.2 浏览器性能摘要

浏览器只记录本次页面内的：

- 页面入口脚本加载完成；
- 视频识别模块加载完成；
- 选择素材到首个上传请求发出；
- 每个文件首字节与末字节时间；
- 状态更新次数；
- 主线程 long task 数量。

成功送达时最多提交一份汇总，不逐个进度事件上报。汇总失败直接暴露，不影响已经
完成的投稿业务事务，也不再次发送。

### 15.3 目标值

以下是未来硬件档案的容量目标，不是当前服务承诺：

| 指标 | 目标 |
|---|---:|
| 投稿页首屏同步 JS | 不超过 85 KiB gzip |
| 未选择视频时下载的媒体 WASM | 0 |
| 上传中的 Vue 进度提交 | 每秒不超过 10 次 |
| 同时上传文件 | 3 |
| 25 MP 图片处理 | P95 不超过 2 秒 |
| 50 MP 图片处理 | P95 不超过 4 秒 |
| 4K HEVC/HDR 视频规范化 | 至少 2 倍实时 |
| 媒体处理时业务 API P95 | 不超过 100 ms |
| 单个上传造成的 Node 内存增长 | 不随文件总大小线性增长 |
| 处理队列空闲时的排队时间 | 接近 0 |

这些目标用于决定硬件档案是否可以启用。未达到时回到唯一实现的线程预算、驱动、
过滤链或存储路径定位根因，不自动降低输出尺寸、质量或格式。

## 16. 迁移落点

### 16.1 前端

- 为投稿页增加独立 Vite 多页面入口；
- 使用 Vue Composition API 和 `<script setup lang="ts">`；
- 新增 `useMediaInspectorWorker`；
- 新增 `useUploadScheduler`，总并发 3、视频并发 1；
- 将 mediainfo Worker 与 WASM 改为按需独立 chunk；
- 将上传进度合并到 100 ms 响应式更新；
- Journal 图片读取增加 variants 和 `srcset`；
- 不增加 legacy、PWA、Service Worker 或客户端转码代码。

### 16.2 服务端

- 增加两个独立的 `p-limit`；
- 图片路径改为 Sharp 直接读取 HEIC/HEIF；
- 图片通过全局双流水线限制器生成四个 WebP variants；
- 视频增加确定的 remux 与 VAAPI 规范化计划；
- 所有派生文件先写同盘 staging，再原子改名；
- 新增资产 variants 表与处理档案字段；
- 正式媒体响应改用 `X-Accel-Redirect`；
- 上传、图片、视频和正式媒体读取都使用同一个 `assetId` 日志关联。

### 16.3 部署

- 更换符合第 4 节的主机；
- 数据与 runtime 目录迁移到同一 NVMe 文件系统；
- 建立带 libheif 的全局 libvips 和 jemalloc 运行环境；
- 固定 Intel VAAPI/Vulkan/libplacebo 媒体镜像；
- 只向 Journal 容器映射选定的 render node，不映射其他 GPU 节点；
- 调整为 6 CPU / 8 GiB 容器档案；
- OpenResty 增加上传专用流式 location 和媒体 internal location；
- 备份改为同数据集只读快照，不再停止 Journal 容器。

## 17. 明确不随极致版引入

- Redis 或任何外部队列；
- 多个 Fastify 实例；
- 媒体微服务；
- Kubernetes；
- S3/R2/MinIO；
- CDN 图片转换；
- HLS 与多码率视频；
- AVIF/WebP 双格式；
- 浏览器端正式转码；
- WebCodecs 主上传路径；
- 自动线程调节；
- 自动硬件选择；
- FFmpeg 软件编码 fallback；
- HEIC 命令行转换 fallback；
- 自动上传重试；
- 跨刷新续传；
- tusd 侧车；
- 备用上传域名；
- 失败后降低清晰度重跑；
- 为理论并发引入分布式锁。

## 18. 未来实施顺序

未来改造应按以下依赖顺序完成：

1. 先确定并记录实际主机、核显、文件系统和容器资源档案；
2. 将停止容器备份替换为同数据集快照；
3. 固定 libvips/libheif/jemalloc 图片镜像；
4. 固定 FFmpeg/VAAPI/Vulkan/libplacebo 视频镜像与唯一参数；
5. 建立 NVMe uploads、staging、assets 同盘布局；
6. 增加 variants 数据模型和原子落盘；
7. 将 Sharp 输出池设为 2、视频池设为 1；
8. 将客户端改为三文件并发和 Worker 按需分析；
9. 将正式媒体读取切换到 `X-Accel-Redirect`；
10. 达到第 15.3 节目标后，再向产品层开放 HEVC/HDR 与更高手机素材上限。

顺序不能倒置。尤其不能在当前 `1 CPU / 512 MB` 环境先开放 HEVC、三文件并发或
双图片处理，再等待未来硬件补齐。

## 19. 最终技术结论

这个项目的“性能极致”不是把上传、解码和转码分别拆成更多服务，而是在单机边界内
消除不必要的等待与字节搬运：

- 浏览器主线程只做交互，WASM 识别进入 Worker；
- 原文件立即流式上传，不在手机上转码；
- 三个独立素材并发，但单个 tus 文件保持顺序写入；
- 上传和处理重叠，图片与视频使用各自固定资源池；
- Sharp 直接通过带 libheif 的全局 libvips 处理手机照片；
- HEVC/HDR 视频进入唯一的 Intel GPU 规范化路径；
- 临时文件、staging 和正式资产在同一 NVMe 上原子移动；
- Fastify 做权限，OpenResty 发送正式媒体；
- SQLite 只写业务阶段，不承载高频进度；
- 备份不再中断投稿；
- 任何失败都回到唯一主路径定位，不靠重试、降级或备用实现掩盖。

这套方案保留了当前个人项目的短主路径，同时把未来强硬件真正转化为朋友能感知到的
更早开始上传、更高并行度、更广手机格式支持和更短处理等待。
