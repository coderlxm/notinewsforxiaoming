# Journal 朋友投稿收件箱需求与实施方案

## 1. 文档状态与审查结论

- 状态：已完成性能、上传体验与产品交互审查，待实施
- 日期：2026-07-26
- 产品定位：让小明的朋友把聚会中的文字、照片和视频直接交给 Journal，由小明确认后进入现有信息流
- 实施边界：扩展现有 Journal Web、Fastify、SQLite、本地资产目录、Telegram 通知和 OpenResty，不建设独立网盘、朋友账号系统、对象存储或内容审核平台

本次审查后的核心结论：

1. `/contribute` 必须使用独立、轻量的 Vite 页面入口，不能进入当前会同时加载信息流、编辑器、Pinia、Vue Router，并请求站点资料和管理员会话的 `App.vue`。
2. 文件通过前端整批校验后立即开始后台上传，朋友可以在上传同时填写称呼和正文；“送给小明”只负责锁定表单、等待现有上传队列完成并正式送达，不再把全部传输延迟到最后一次点击。
3. 上传保持单文件、单活动上传流顺序执行。当前 Journal 容器只有 `1 CPU / 512 MB`，`@tus/file-store` 又不支持并行分块拼接；在没有真实线上吞吐证据时，不用多个活动请求争抢同一上行、磁盘和预览处理资源。
4. tus 分块由 32 MiB 调整为 64 MiB，并启用 Creation With Upload，让首个分块随创建请求直接发送。4 GiB 文件固定拆成 64 个不超过 64 MiB 的请求，兼顾 Cloudflare 最低计划 100 MB 请求体边界、移动端内存和请求往返开销。
5. 浏览器、OpenResty 和 Node 全链路不形成额外的完整文件 Buffer；上传字节只经过一条流写入临时文件，不由 OpenResty 先落一次临时盘。
6. 图片生成 2,048 px 展示图和 64 px 低清预览，视频生成海报和低清预览。投稿箱、整理页和发布后的信息流默认读取派生资源，只有用户明确查看原图或播放视频时才读取原文件。
7. 朋友端不自动重试、不跨刷新续传、不自动跳过失败文件、不切换上传通道；一项失败立即停止队列并暴露具体错误。这条约束服从本项目“严禁任何兜底”的总原则。
8. 整理投稿时可见性默认设为“私有”，避免聚会人物素材因默认值被误公开；按钮文案随选择明确显示“公开发布”或“保存为私有记录”。
9. 分享设置增加系统分享和二维码，降低聚会现场逐个转发链接的摩擦；二维码使用成熟的 `qrcode` npm 包生成，不手写编码。
10. 现有每日 04:50 停止 Journal 容器的备份会中断当时正在进行的上传。该事实不能由前端文案掩盖；本方案不擅自改写已经确认的停机一致性备份策略，并将其列为唯一已知的固定中断边界。

性能优先级固定为：

```text
送达真实性
  → 尽早开始占用有效上传时间
  → 避免重复传输与完整文件内存副本
  → 上传过程中持续、可信、可访问的反馈
  → 投稿箱和信息流不自动读取原始大媒体
  → 最后才考虑增加并发和更多状态
```

## 2. 证据边界

### 2.1 已由当前源码确认的事实

- `web/src/main.ts` 当前只挂载一个 `App.vue`。
- `App.vue` 静态导入信息流、文章编辑器、普通发布器和设置页，并在挂载时请求管理员会话与站点资料。
- `web/vite.config.ts` 当前只有一个 HTML 入口，没有路由级或多页面拆包。
- 普通 Web 发布接口使用 `@fastify/multipart`，全局单文件限制为 20 MiB，路由通过 `part.toBuffer()` 把每个文件完整读入内存。
- `JournalStorage`、`journal_assets`、图片尺寸与 64 px WebP 预览、受鉴权媒体读取和 Range 请求已经存在。
- Web 普通记录的数据库约束目前只允许 `text` 或 `photo`，尚不能正确表达以视频为主的 Web 记录。
- OpenResty 当前 `client_max_body_size` 为 210 MiB，上传路径尚未关闭请求体缓冲。
- Journal Compose 当前限制为 `1.0 CPU` 和 `512m` 内存。
- Journal 每天 04:50 的备份会停止容器，复制整个 `/opt/journal/data` 后再恢复服务。

以上属于源码和部署文件行为，不代表尚未运行的投稿功能已经具备这些能力。

### 2.2 当前外部文档确认的边界

- Cloudflare 2026-07 官方文档仍说明：Free/Pro 请求体上限为 100 MB、Business 为 200 MB、Enterprise 默认为 500 MB；仓库无法证明当前账户计划，因此设计按最低 100 MB 边界执行。参考：[Cloudflare request limits](https://developers.cloudflare.com/workers/platform/limits/#request-limits)。
- Cloudflare 当前默认 Proxy Read Timeout 为 125 秒；单个上传请求结束后的同步媒体处理不得设计成长时间作业。参考：[Cloudflare connection limits](https://developers.cloudflare.com/fundamentals/reference/connection-limits/)。
- Nginx 默认先完整读取请求体；`proxy_request_buffering off` 才会把请求体边收边转发给上游。参考：[Nginx proxy_request_buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_request_buffering)。
- `@tus/server` 官方提供 Fastify 原始请求接入、`onIncomingRequest` 鉴权、`onUploadCreate` 元数据校验和 `onUploadFinish` 完成处理；`@tus/file-store` 支持 Creation、Expiration 和 Termination，但不支持 Concatenation。参考：[tus Node server](https://github.com/tus/tus-node-server/tree/main/packages/server)、[tus file store](https://github.com/tus/tus-node-server/tree/main/packages/file-store)。
- `tus-js-client` 官方说明小分块会增加请求开销，Creation With Upload 可以减少一次请求，并明确指出普通浏览器会话中并行上传未观察到平均性能提升。参考：[tus-js-client API](https://github.com/tus/tus-js-client/blob/main/docs/api.md)。
- Sharp 预编译二进制支持 JPEG、PNG、WebP、AVIF、TIFF、GIF 和 SVG 输入，但不提供可直接依赖的 HEIC/HEVC 输入保证；其默认输入像素上限远高于本容器适合处理的范围。参考：[Sharp installation](https://sharp.pixelplumbing.com/install/)、[Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/)。

### 2.3 设计判断与尚未确认的运行时事实

- 64 MiB 是基于 Cloudflare 最低请求体边界、当前单容器资源和请求开销作出的设计判断，不是线上测速结论。
- 仓库不能证明 `rndc02` 实际磁盘顺序写速度、出口带宽、Cloudflare 套餐或朋友现场网络质量。
- 仓库不能证明真实相机素材主要是 MP4、MOV、HEIC 还是 JPEG；MOV/HEIC 是否进入首版仍需真实样本。
- 在没有上述运行时证据前，不把“增加并发一定更快”“当前服务器一定能跑满朋友上行”写成结论。

## 3. 背景、目标与主路径

聚会中常由朋友使用相机等设备拍摄。当前素材先传给小明，再由小明重新选择、上传和补充文字，造成：

- 同一批素材经过两次传输；
- 小明重复整理和发布；
- 聚会结束后容易因为传输麻烦而遗漏；
- 大视频需要长时间保持多个应用和聊天窗口处于可用状态。

本功能增加一条独立主路径：

```text
小明系统分享、复制链接或展示二维码
  → 朋友打开轻量投稿页
  → 选择的合法素材立即顺序上传，同时填写称呼和文字
  → 朋友点击“送给小明”，页面锁定并等待队列完成
  → 服务端确认所有字节与媒体派生资源完整
  → Telegram 通知成功
  → 投稿进入小明的私有收件箱
  → 小明整理文字、取舍素材并选择公开或私有
  → 原地转为现有 Journal 普通记录
```

### 3.1 成功定义

朋友端只有在以下条件全部成立后显示“已经送到”：

1. 每个保留文件都达到服务端声明的完整长度；
2. 服务端已识别真实格式并完成图片或视频解析；
3. 必需的展示图、低清预览或视频海报已生成；
4. Telegram 提醒已经发送；
5. 投稿状态已提交为 `submitted`。

浏览器只把字节发送到网络、单个分块达到 100%、或所有文件显示 100%，都不等于整条投稿已经送达。

### 3.2 投稿不能直接公开

投稿只进入管理员投稿箱，不自动出现在公开首页、RSS、JSON Feed 或普通 `/me` 时间线。

公开时间、正文、素材取舍和人物隐私仍由小明最后确认。首版不增加“可信朋友自动发布”。

### 3.3 投稿是发布入口，不是原片归档盘

只接收能够直接生成 Journal 图文或视频记录的素材，不接收 RAW、工程文件、音频、文档、压缩包和任意附件。

原文件会保留在 Journal 资产目录，但本功能不提供文件夹、相册归档、下载整包或网盘浏览。

## 4. 用户角色与状态

### 4.1 朋友

朋友可以：

- 使用有效分享链接建立短期投稿会话；
- 填写称呼和正文；
- 选择、继续追加或移除当前页面中的素材；
- 在素材上传时继续编辑文字；
- 查看当前文件、总进度、已发送字节、服务端处理状态和明确错误；
- 成功后继续投递下一组。

朋友不能：

- 查看私有信息流或其他人的投稿；
- 查看投稿箱编号和最终发布状态；
- 修改已经完整送达的投稿；
- 调用管理员 API；
- 在页面刷新后恢复上一次未送达投稿。

### 4.2 小明

小明可以：

- 开启、关闭或更换投稿链接；
- 系统分享、复制链接或展示二维码；
- 查看待处理数量和投稿列表；
- 查看投稿人、正文、素材、提交时间和总大小；
- 修改正文；
- 暂时移除素材并在发布前撤销；
- 公开发布或保存为私有普通记录；
- 确认后永久删除整条投稿。

### 4.3 状态

投稿只保留两个数据库状态：

```text
uploading → submitted → 转为 Journal Entry 后删除投稿中间记录
```

- `uploading`：投稿已建立，但尚未满足完整送达条件；
- `submitted`：全部内容完整到达、Telegram 提醒已发送，等待小明处理；
- 发布或保存为私有后，投稿资产在同一数据库事务中转为 `journal_assets`，投稿行被删除。

文件项在前端显示的“等待、上传中、服务端处理中、已就绪、失败”由当前队列事件和资产字段推导，不再为每一项建立额外业务状态机。

不保留“已处理投稿历史”。最终结果由现有信息流承担。

## 5. 支持格式与容量

### 5.1 首版限制

| 项目 | 限制 |
| --- | --- |
| 单次投稿素材总数 | 最多 20 个 |
| 其中视频 | 最多 5 个 |
| 单张图片 | 最大 80 MiB，方向校正后最多 67,108,864 像素 |
| 单个视频 | 最大 4 GiB |
| 单次投稿总量 | 最大 5 GiB |
| 投稿文字 | 最大 2,000 字符 |
| 投稿人称呼 | 1–20 字符 |

称呼必填；正文和素材至少有一项。

图片首版支持：

- JPEG；
- PNG；
- WebP。

视频首版支持：

- MP4：H.264/AVC 视频，AAC 音频或无音轨；
- WebM：VP8/VP9 视频，Opus/Vorbis 音频或无音轨。

容器扩展名或浏览器提供的 MIME 不是最终依据。服务端使用成熟的 `file-type` 包识别文件签名，再由 Sharp 或 ffprobe 确认尺寸、容器、编码、时长和可解码性。

GIF 从朋友投稿首版中移除。当前 Journal 普通发布虽然允许选择 GIF，但现有媒体分类和大动画解码资源边界不足以证明它适合 80 MiB 投稿路径，不能把“选择器接受”直接当作可靠展示证据。

### 5.2 客户端预检

文件选择器使用明确的 `accept`，但不设置 `capture`，避免移动端被强制进入相机而无法选择已有原片。

客户端在网络请求前检查：

- 新选择批次与已有素材的数量；
- 视频数量；
- 单文件大小；
- 总大小；
- 文件扩展名和浏览器 MIME 是否至少有一项符合允许范围。

浏览器 MIME 为空但扩展名合法时允许进入服务端识别，避免移动端文件选择器的空 MIME 造成错误拒绝。

一批新选择中任一项不合法时，只拒绝这次新批次，明确指出第一个不合法文件；此前已经进入队列的素材保持不变。

### 5.3 MOV 与 HEIC

首版不接收 MOV、HEIC、HEIF 和相机 RAW：

- 仅接受 MOV 容器不能保证其中编码能在现有 Web 信息流播放；
- 无损 remux 只适用于部分编码组合；
- 转码会显著改变 1 CPU / 512 MB 容器的处理时间和资源模型；
- Sharp 官方预编译环境不能作为 HEIC/HEVC 输入稳定性的依据。

实施前若真实样本证明 MOV 或 HEIC 是主要来源，应单独用样本决定：

- MOV 中哪些编码可以无损 remux 为 MP4；
- 哪些必须有损转码；
- HEIC 是否增加经过确认的解码运行库；
- 转换后的展示文件是否保留原文件。

未取得样本前不在本方案中假定它们可用。

## 6. 分享入口与会话

### 6.1 投稿入口不进入公开导航

公开首页不显示“投稿”按钮。分享地址为：

```text
https://feeds.xmcloud.buzz/contribute#<32 字节随机 URL-safe 凭据>
```

URL fragment 不会随 HTTP 请求进入 OpenResty 与 Cloudflare 请求 URL。投稿页在同步读取 fragment 后立即通过 `history.replaceState` 清除地址栏 fragment，再以 JSON 请求换取投稿 Cookie。

### 6.2 投稿会话

- Cookie 使用签名、`HttpOnly`、`Secure`、`SameSite=Strict`；
- Cookie 路径只覆盖 `/api/contributions`；
- 有效期固定 24 小时；
- Cookie 只保存分享链接版本，不保存管理员能力；
- 每个投稿 API 和 tus 请求都重新读取当前设置并核对 `enabled` 与 `token_revision`；
- 关闭入口或更换链接后，旧 Cookie 从下一次 HTTP 请求起失效；
- 已经开始传输的当前 64 MiB 请求可能完成，后续请求必须直接失败，不能声称可以在 TCP 流中途撤回已经接收的字节。

页面刷新后若仍有有效 Cookie，可开始一条新投稿；不恢复刷新前的文件队列。

### 6.3 设置页

在 `/me/settings` 增加“朋友投稿”分区：

```text
朋友投稿
允许持有分享链接的朋友向投稿箱发送内容

[开启朋友投稿]

分享链接
[ https://feeds.xmcloud.buzz/contribute#... ]

[系统分享] [复制链接] [显示二维码]
[更换分享链接]
```

- 默认关闭；
- 第一次开启生成 32 字节随机凭据；
- 再次开启沿用当前链接；
- “系统分享”仅在浏览器支持 Web Share API 时显示；
- “复制链接”使用 Clipboard API，失败时直接显示错误，不切换旧式复制实现；
- “显示二维码”按需加载 `qrcode`，二维码关闭后从 DOM 移除；
- 关闭入口和更换链接都使用确认对话框，并明确说明会中止旧会话的后续请求；
- 更换链接不删除已经 `submitted` 的投稿；
- 不提供多个链接、朋友名单、权限组和到期时间。

这是一把可更换的投稿箱钥匙，不是用户账号。

## 7. 朋友端页面与交互

### 7.1 独立轻量页面

新增独立 HTML 入口：

```text
web/contribute.html
web/src/contribute-main.ts
web/src/ContributionApp.vue
```

Vite 以多页面模式同时输出现有 `index.html` 和 `contribute.html`。Fastify 对 `/contribute` 明确返回 `contribute.html`。

投稿入口不导入：

- `App.vue`；
- Pinia；
- Vue Router；
- `@egjs/grid`；
- Tiptap；
- 信息流、文章编辑器、普通发布器和管理员设置组件。

投稿页也不请求：

- `/api/auth/session`；
- `/api/site-profile`；
- 天气、公开信息流或私有信息流。

头像可直接读取公开头像资源，页面正文与表单不依赖站点资料请求才能出现。

`tus-js-client` 只进入投稿页构建产物，不增加公开信息流首包。

### 7.2 页面结构

页面沿用 Journal 的明纸色背景、宋体标题、细边框、圆角媒体区和石榴红强调色，不显示管理员导航和站点页脚：

```text
[头像]  给小明投稿
        选好照片或视频后会立即上传，你可以继续写文字

怎么称呼你
[ 阿杰                                      ]

想说的话
[ 这组是饭后在江边拍的……                    ]

照片与视频
┌──────────────────────────────────────────┐
│       点击选择，或将文件拖到这里          │
│       JPEG / PNG / WebP                   │
│       MP4(H.264) / WebM(VP8、VP9)         │
└──────────────────────────────────────────┘

[紧凑素材列表：缩略图、文件名、大小、状态、移除]

[总进度、当前文件、已发送字节、当前速度]

                                  [送给小明]
```

移动端底部操作区固定在可视区域内，并包含 `env(safe-area-inset-bottom)`；它不得遮挡最后一项素材或错误信息。

### 7.3 表单与可访问性

- 称呼与正文使用真实 `<label>` 和有意义的 `name`；
- 称呼使用 `autocomplete="name"`；
- 提交按钮在请求真正开始前保持可点击，点击后才进行完整校验；
- 校验失败时在对应字段旁显示错误，并把焦点移到第一个错误字段；
- 所有按钮使用 `<button>`，导航使用链接，不用可点击 `<div>`；
- 触控目标最小 44 × 44 CSS px；
- 文件名支持换行或截断，不造成横向滚动；
- 数字进度使用等宽数字；
- `prefers-reduced-motion: reduce` 下不播放淡入或位移动画；
- 不禁止页面缩放；
- 不使用 toast 堆叠上传状态；
- 任何实现中都不使用 `requestAnimationFrame`、`cancelAnimationFrame` 或别名。

### 7.4 选择素材

- 桌面端支持点击和拖入；
- 移动端使用系统照片与文件选择器；
- 通过 `URL.createObjectURL` 展示本地图片和视频，不读取完整文件为 Base64；
- 图片缩略项固定宽高并使用延迟加载，视频只读取本地 metadata；
- 离开 DOM或移除文件时立即 `URL.revokeObjectURL`；
- 最多 20 项，不增加虚拟列表；
- 选择顺序就是未来媒体顺序；
- 首版不做拖拽排序，需要调整时移除后重新选择；
- 不压缩、不修改原文件、不自动去重。

客户端批次校验通过后立即向服务端登记文件清单并进入上传队列，不等待称呼或正文完成。

### 7.5 上传与填写并行

正常过程：

```text
选择文件
  → 客户端整批预检
  → 建立 uploading 投稿并登记素材
  → 第 1 个文件立即上传
  → 朋友继续填写称呼与正文
  → 已就绪文件显示完成，下一项自动开始
```

选择更多文件时，新文件追加到队列尾部。进度总分母按真实总字节更新，因此追加大文件后总百分比可以下降；页面同时显示“已就绪 X / Y”，避免只看百分比产生误解。

移除规则：

- 未开始文件：从队列和服务端登记中删除；
- 正在上传文件：先停止当前浏览器请求，再调用明确的删除接口移除该 tus 资源和临时文件；
- 已就绪文件：删除对应原文件、派生图和资产登记；
- 删除接口失败时项目仍显示原项和错误，不能在 UI 中假装已经移除。

### 7.6 “送给小明”

按钮点击后：

1. 完整校验称呼、正文和素材；
2. 纯文字投稿若尚未建立 `uploading` 记录，此时先建立；
3. 固定正文、素材集合和顺序；
4. 禁止继续追加、移除和编辑；
5. 若队列尚未结束，按钮进入“正在上传 43%”并自动等待；
6. 所有文件就绪后调用一次 `submit`；
7. 服务端完成 Telegram 与数据库提交；
8. 页面进入成功结果。

朋友不需要等待上传结束后再点击第二次。

### 7.7 进度反馈

上传区域固定展示：

```text
正在送给小明  43%

正在上传 3 / 8
DSC_1842.jpg
1.2 GiB / 2.8 GiB · 8.4 MiB/s
```

规则：

- `onProgress` 提供当前浏览器已经发送的字节；
- `onChunkComplete` 记录服务端已经接受的分块偏移；
- 只有 `onSuccess` 返回后文件才进入“已就绪”；
- 当前分块字节达到文件长度但服务端仍在解析时显示“服务端正在整理 DSC_1842.jpg…”；
- 总进度按全部文件字节加权，不按文件数量平均；
- 速度使用最近 8 秒发送字节计算，只展示速度，不展示容易剧烈跳动的预计完成时间；
- Vue 可见进度最多每 250 ms 更新一次，避免高频 XHR 事件持续触发组件重渲染；
- 屏幕阅读器 `aria-live` 只播报文件切换、服务端处理、完成和错误，不播报每次百分比变化；
- 使用原生 `<progress>` 或等价的 `role="progressbar"` 与完整数值属性。

### 7.8 离开页面

以下任一条件成立时注册 `beforeunload`：

- 已选素材尚未全部送达；
- 已填写但尚未提交的称呼或正文；
- 正在等待正式 `submit`。

进入成功页或表单完全为空后移除监听。

浏览器进入后台可能暂停 JavaScript 或网络，页面只明确提示“上传期间请保持此页面打开”，不声称可以绕过操作系统限制。

### 7.9 错误

固定失败语义：

- `retryDelays: null`，关闭 `tus-js-client` 默认自动重试；
- `storeFingerprintForResuming: false`，不写入跨页面续传信息；
- 不调用 `findPreviousUploads()`；
- 不自动继续后续文件；
- 不自动跳过失败文件；
- 不改走普通 multipart、备用域名或对象存储；
- 不把未完成投稿显示为成功。

发生错误后取消本次提交意图并重新开放表单操作；已经就绪的文件保持就绪，失败文件保持在列表中等待朋友明确移除。解锁表单不是自动继续上传。

错误区域必须同时说明：

- 哪个文件或哪个阶段失败；
- 服务端返回的明确原因；
- 已经成功的文件仍处于什么状态；
- 用户当前可执行的直接动作。

示例：

```text
DSC_1842.jpg 上传失败：服务器只接受不超过 80 MiB 的图片。
队列已停止。你可以移除这个文件后重新点击“送给小明”，或关闭页面。
```

移除失败文件后继续发送其余文件，不等于自动跳过；这是朋友明确改变投稿内容后的新提交动作。若朋友仍要提交该失败文件，当前页不重试它，需要重新打开分享链接开始一条新投稿。

### 7.10 成功页

```text
已经送到小明的投稿箱

8 个素材 · 3.1 GiB
小明整理后会决定如何放进信息流。

[再投一组]
```

成功页不暴露 `/me`、投稿箱编号、最终可见性和发布状态。

“再投一组”清空本地状态并建立全新投稿，继续复用仍有效的投稿 Cookie。

## 8. 上传协议与后端性能

### 8.1 依赖

采用：

- 浏览器：`tus-js-client`；
- Node 服务端：`@tus/server`；
- 本地文件：`@tus/file-store`；
- 文件签名：`file-type`；
- 视频探测与海报：Docker runtime 中的 FFmpeg / ffprobe；
- 进程调用：`execa`；
- 设置页二维码：`qrcode`；
- 图片派生：现有 `sharp`。

版本在实施时选择当时的 stable 并固定到 `pnpm-lock.yaml`，不手写分块协议、文件签名识别、二维码或 FFmpeg 命令拼接器。

### 8.2 固定 tus 配置

浏览器固定：

```text
chunkSize = 64 MiB
uploadDataDuringCreation = true
parallelUploads = 1
retryDelays = null
storeFingerprintForResuming = false
addRequestId = true
```

服务端固定：

- `maxSize` 为 4 GiB；
- 使用 FileStore；
- FileStore 数据目录与 `FileKvStore` 元数据目录分离，避免正式移动后遗留 tus sidecar；
- 使用单进程默认锁，不增加 Redis；
- `relativeLocation: true`，Location 不依赖代理重建绝对地址；
- `onIncomingRequest` 核对投稿 Cookie、入口开关和 token revision；
- `onUploadCreate` 只接受服务端已登记的资产 ID，并核对声明长度；
- `onUploadFinish` 在返回成功前完成真实格式解析、派生资源生成、正式目录移动和资产登记；
- 文件就绪后删除对应 tus 元数据，并在同一次资产更新中把 `upload_id` 置空；完成资源不再提供 HEAD 或续传；
- Fastify 为 `application/offset+octet-stream` 注册不消费 payload 的 content-type parser，再把 `request.raw` 与 `reply.raw` 交给 tus；
- 不把 tus 请求送入 `@fastify/multipart`。

同源部署不开放跨域上传，不增加 CORS 允许来源列表。

### 8.3 串行而不是并行

首版只允许一个活动文件上传：

- 朋友的总上行通常已是瓶颈，多连接不会创造额外带宽；
- tus 官方未观察到普通浏览器会话的平均并行收益；
- FileStore 不支持 Concatenation，不能使用单文件并行分块；
- 1 CPU / 512 MB 容器需要为 Sharp、ffprobe、FFmpeg 和正常 Journal 请求保留资源；
- 单活动上传流让进度、删除当前项和错误归因保持直接。

上传与用户填写文字并行，已经消除了原方案中最明显的空等时间；没有线上吞吐证据前不再增加文件级并发。

### 8.4 不写 SQLite 进度

字节进度只由浏览器的 tus 回调展示。服务端不：

- 每个分块写一条 SQLite 进度；
- 使用 WebSocket 或 SSE 回推字节；
- 让前端轮询偏移；
- 使用 `POST_RECEIVE` 持续写业务表。

SQLite 只在以下事件写入：

- 建立投稿；
- 登记或移除素材；
- 上传完整并生成派生资源；
- 正式提交；
- 发布或删除。

这避免 4 GiB 上传产生大量同步 SQLite 写入，也避免进度 UI与数据库状态竞争。

## 9. 文件存储、媒体解析与展示资源

### 9.1 临时与正式目录

tus 未完成字节写入：

```text
/data/contributions/.uploads/<uploadId>
```

tus 元数据写入独立目录：

```text
/data/contributions/.tus-info/<uploadId>
```

完整并解析成功后，原文件和派生资源通过同一文件系统内的 `rename` 移到：

```text
/data/assets/YYYY/MM/<contributionPublicId>/
```

文件完成前不复制到正式目录；完成后也不复制大文件。

`.uploads`、`.tus-info` 与 `assets` 必须位于同一个 `/data` 文件系统，禁止跨挂载点导致大文件退化为复制。

### 9.2 图片处理

图片严格串行处理：

1. `file-type` 确认 JPEG、PNG 或 WebP；
2. Sharp 使用 `limitInputPixels: 67108864` 读取，并按 EXIF 自动校正方向；
3. 记录校正后的原图宽高；
4. 从原图生成最长边不超过 2,048 px、质量 82 的 WebP 展示图；
5. 从展示图生成宽 64 px、质量 35 的 WebP 低清预览；
6. 原图、展示图和低清预览全部完成后才登记资产为就绪。

文件布局：

```text
<uuid>                  # 原图
<uuid>.display.webp     # 投稿箱和信息流默认展示
<uuid>.preview.webp     # 低清占位
```

展示图只服务页面性能，原图仍被保留。页面不得把 80 MiB 原图作为投稿箱卡片或信息流卡片的默认 `src`。

### 9.3 视频处理

视频严格串行处理：

1. `file-type` 确认容器；
2. ffprobe 输出 JSON；
3. Zod 解析并确认容器、视频编码、音频编码、时长和宽高；
4. FFmpeg 使用输入侧快速定位，在视频前 0.5–3 秒范围内抽取一帧；
5. 海报最长边不超过 960 px，输出 WebP；
6. 从海报生成 64 px 低清预览；
7. FFmpeg 固定单线程，不转码原视频。

文件布局：

```text
<uuid>                  # 原视频
<uuid>.display.webp     # 视频海报
<uuid>.preview.webp     # 低清占位
```

任一探测、编码约束或海报生成失败时，该文件不进入就绪状态，队列直接失败。

### 9.4 Journal 资产协议

`journal_assets` 增加可空字段：

```text
display_relative_path
```

共享 `JournalAsset` 增加：

```text
displayUrl: string | null
```

媒体接口增加：

```text
GET /media/:assetId/display
```

权限和缓存规则与原文件、低清预览完全一致。

朋友投稿产生的图片：

- 卡片、详情和整理页默认使用 `displayUrl`；
- 低清过渡使用 `previewUrl`；
- 用户明确点击“查看原图”时才请求 `url`。

朋友投稿产生的视频：

- 卡片使用 `displayUrl` 作为 poster，`preload="none"`；
- 打开详情后才使用 `preload="metadata"`；
- 用户点击播放后浏览器按 Range 读取原视频。

历史资产的 `displayUrl` 为 `null`，继续沿用现有资源地址；本功能不顺手批量重编码全部历史图片和视频。

## 10. 小明端交互

### 10.1 入口

在 `/me` 顶部操作区增加：

```text
投稿箱 3
```

只统计 `submitted`。没有待处理内容时显示“投稿箱”，不显示 `0`。

新增路由：

```text
/me/contributions
/me/contributions/:id
```

投稿箱与整理页使用异步组件，只有进入对应路由时才下载其代码。

### 10.2 投稿箱列表

列表每页 20 条，按 `submitted_at DESC, id DESC` 游标分页。

每张卡片只返回和渲染：

- 投稿人称呼；
- 提交时间；
- 正文最多 3 行；
- 最多 4 个派生展示图；
- 剩余素材数量；
- 素材总数与总大小；
- “整理投稿”主操作；
- “删除投稿”次要操作。

列表不返回原文件 URL，不创建 `<video>`，不预读视频 metadata，不一次返回全部 20 个资产详情。

超过 4 个素材时最后一格显示 `+N`。图片使用明确宽高、`loading="lazy"`；长正文和文件名不撑破卡片。

不加入搜索、筛选、批量操作和实时轮询。投稿箱数量在管理员会话确认后读取一次，提交或删除后由当前操作结果更新。

### 10.3 整理页

整理页显示：

- “阿杰的投稿”；
- 不可编辑的投稿人称呼；
- 可编辑正文；
- 提交时间和总大小；
- 按投稿顺序排列的派生展示图；
- 每项“移除”；
- “公开”或“私有”；
- 主按钮；
- “永久删除投稿”。

媒体默认只读取 `displayUrl`。点击单张图片后才打开原图；视频使用海报，播放时才读取原视频。

移除素材先在表单中标记，并提供“撤销”，不立即删除服务端文件。发布时一次提交最终保留 ID，避免每次点击都写数据库和磁盘。

可见性默认“私有”：

- 选择公开：主按钮为“公开发布”；
- 选择私有：主按钮为“保存为私有记录”。

删除整条投稿必须使用确认对话框，明确素材数量和不可恢复性。

首版不允许小明在整理页追加自己的文件。当前已发布普通记录也没有追加媒体能力，因此不能再写成“先发布为私有后沿现有路径追加”；需要混合小明自己的素材时，应另建普通记录。

### 10.4 发布结果

发布或保存后：

- 正文按最终编辑值提取标签；
- `sourceCreatedAt` 使用小明确认时间；
- `capturedAt` 使用朋友完整送达时间；
- 投稿人称呼不进入公开正文；
- 数据仍是 `web + plain` Journal Entry；
- 无素材为 `text`；
- 只有图片为 `photo`；
- 只要保留素材中包含视频即为 `video`；
- 跳转到该记录的管理员详情。

为此需要把 Web plain Entry 的数据库约束从 `text / photo` 扩展为 `text / photo / video`。

## 11. Telegram 通知

正式提交只发送一条新消息：

```text
📮 收到阿杰的投稿

8 个素材 · 3.1 GiB
“这组是饭后在江边拍的……”

[打开投稿箱]
```

固定规则：

- 选择文件、分块进度、失败上传和文件就绪不发消息；
- 使用 Journal 现有 Telegram token、chat id 与 Telegraf；
- 文本按 Telegram HTML 规则使用现有成熟转义能力；
- 正文摘要限制长度，不发送媒体；
- Telegram 发送是 `submit` 的同步必要步骤；
- Telegram 失败时 `submit` 直接失败，投稿保持 `uploading`，不切换通知通道、不吞错；
- Telegram 成功后才把投稿置为 `submitted`。

Telegram 与 SQLite 不存在分布式事务。采用“先通知、后提交”是为了保证朋友看到成功时投稿箱和提醒都已完成；若极少数情况下通知成功后本地数据库提交失败，错误直接暴露，Telegram 中可能出现一条暂时打不开的提醒，不为此增加 outbox、重试或补偿状态机。

首版不向朋友发送发布回执，也不在 Telegram 内审核或发布。

## 12. 数据模型

### 12.1 `journal_contribution_settings`

单行表：

| 字段 | 说明 |
| --- | --- |
| `id` | 固定为 `1` |
| `enabled` | 投稿入口是否开启 |
| `access_token` | 32 字节随机 URL-safe 凭据 |
| `token_revision` | 更换链接时递增 |
| `updated_at` | 最近更新时间 |

该表不进入公开站点资料接口。

### 12.2 `journal_contributions`

| 字段 | 说明 |
| --- | --- |
| `id` | 内部主键 |
| `public_id` | UUID，同时作为未来 Entry publicId |
| `contributor_name` | 投稿人称呼，提交前可空 |
| `content_text` | 投稿正文 |
| `status` | `uploading` 或 `submitted` |
| `token_revision` | 建立投稿时的链接版本 |
| `created_at` | 建立投稿时间 |
| `submitted_at` | 完整送达时间，可空 |
| `updated_at` | 最近变化时间 |

约束：

- `public_id` 唯一；
- `submitted` 必须同时具有非空称呼与 `submitted_at`；
- `uploading` 不出现在管理员列表。

索引：

```sql
CREATE INDEX idx_journal_contributions_inbox
ON journal_contributions(status, submitted_at DESC, id DESC);
```

### 12.3 `journal_contribution_assets`

| 字段 | 说明 |
| --- | --- |
| `id` | 内部主键，同时作为客户端登记后的资产 ID |
| `contribution_id` | 所属投稿 |
| `upload_id` | 活动中的 tus 上传资源，可空且非空时唯一；文件就绪后清空 |
| `kind` | 完成后为 `photo` 或 `video` |
| `original_name` | 原始文件名 |
| `declared_mime_type` | 浏览器声明 MIME |
| `mime_type` | 服务端识别 MIME，完成前可空 |
| `upload_length` | 创建 tus 资源时声明的总字节 |
| `byte_size` | 完成后的真实字节数，可空 |
| `relative_path` | 正式原文件路径，可空 |
| `display_relative_path` | 展示图或视频海报，可空 |
| `preview_relative_path` | 64 px 低清预览，可空 |
| `width` / `height` | 媒体尺寸，可空 |
| `duration` | 视频时长，可空 |
| `sort_order` | 朋友选择顺序 |

索引与约束：

```sql
CREATE INDEX idx_journal_contribution_assets_order
ON journal_contribution_assets(contribution_id, sort_order, id);

CREATE UNIQUE INDEX idx_journal_contribution_assets_upload
ON journal_contribution_assets(upload_id)
WHERE upload_id IS NOT NULL;
```

- 外键使用 `ON DELETE CASCADE`；
- 3 个相对路径分别建立非空唯一索引；
- 已就绪由 `byte_size` 和 3 个路径均非空推导；
- `submit` 要求所有保留资产都已就绪。

### 12.4 发布事务

发布一次数据库事务完成：

1. 使用投稿 `public_id` 创建 `web + plain` Journal Entry；
2. 根据保留素材决定 `text / photo / video`；
3. 将保留的投稿资产插入 `journal_assets`；
4. 删除未保留素材的资产行；
5. 删除投稿资产行；
6. 删除投稿行；
7. 返回现有 `JournalEntry`。

文件在上传完成时已经位于最终 `publicId` 目录，发布不复制、不移动、不重新生成派生资源。

数据库事务失败时投稿仍为 `submitted`，文件和投稿记录保持可再次整理，不显示成已发布。

## 13. API 边界

### 13.1 朋友端业务 API

```text
POST   /api/contributions/session
GET    /api/contributions/session
POST   /api/contributions
POST   /api/contributions/:publicId/assets
DELETE /api/contributions/:publicId/assets/:assetId
POST   /api/contributions/:publicId/submit
```

- `POST session` 用 fragment 凭据换 Cookie；
- `GET session` 只确认现有 Cookie 是否有效；
- `POST contributions` 建立空的 `uploading` 投稿；
- `POST assets` 一次登记一批文件声明，服务端整批核对数量和总量；
- `DELETE asset` 协调停止/删除 tus 资源、正式文件、派生文件和资产行；
- `submit` 一次提交称呼、正文和最终资产顺序。

朋友端没有投稿详情、列表、媒体读取和已提交状态接口。

### 13.2 tus API

```text
OPTIONS /api/contributions/uploads
POST    /api/contributions/uploads
HEAD    /api/contributions/uploads/:uploadId
PATCH   /api/contributions/uploads/:uploadId
DELETE  /api/contributions/uploads/:uploadId
```

tus 创建元数据只允许：

- `assetId`；
- `filename`；
- `filetype`。

服务端以 `assetId` 查找已登记资产，文件名和 MIME 只用于核对与展示，不能决定文件系统路径。

### 13.3 管理员 API

```text
GET    /api/me/contribution-settings
PATCH  /api/me/contribution-settings
POST   /api/me/contribution-settings/rotate

GET    /api/me/contributions/count
GET    /api/me/contributions
GET    /api/me/contributions/:id
GET    /api/me/contributions/:id/assets/:assetId
GET    /api/me/contributions/:id/assets/:assetId/display
GET    /api/me/contributions/:id/assets/:assetId/preview
POST   /api/me/contributions/:id/publish
DELETE /api/me/contributions/:id
```

- 列表响应只包含摘要和最多 4 个展示资源；
- 详情响应才包含全部资产；
- 原文件与视频支持 Range；
- `publish` 一次提交正文、保留资产 ID、顺序和可见性；
- 保留资产 ID 必须属于该投稿且不重复；
- 未知 ID 直接失败，不静默忽略。

### 13.4 错误语义

- `401`：投稿或管理员会话无效；
- `404`：投稿或资产不存在；
- `409`：入口已关闭、链接版本已变化或投稿状态不允许当前操作；
- `413`：文件或投稿总量超限；
- `415`：文件容器或图片类型不支持；
- `422`：容器合法但解码、编码或媒体结构不符合要求。

JSON 业务接口使用 `{ error: string }`；tus 错误由 `onResponseError` 映射为同一套可读原因，并保留 `X-Request-ID` 供日志定位。

不把绝对文件路径、Cookie、token 或 FFmpeg 完整命令回传给朋友。

## 14. 删除与过期清理

### 14.1 朋友移除单项

服务端按资产行中的精确 ID 和路径删除：

- `upload_id` 非空时删除 tus 数据与元数据；
- 原文件；
- 展示图或海报；
- 低清预览；
- 资产行。

不扫描目录猜测目标，不吞掉缺失文件错误。

### 14.2 小明删除投稿

确认后：

1. 读取投稿及全部资产路径；
2. 删除数据库投稿与资产行；
3. 删除该 `publicId` 目录和仍存在的 tus 资源；
4. 返回实际删除的素材数量。

这是永久删除，不提供回收站、撤销窗口或软删除。

### 14.3 过期清理

仍为 `uploading` 且 `created_at` 超过 72 小时的投稿由一个明确的 Journal 定时任务删除。

清理任务：

- 只查询数据库命中的投稿；
- 只删除这些投稿记录中保存的正式路径与 upload ID；
- 调用 FileStore 能力删除 tus 资源；
- 不遍历或猜测其他资产目录；
- 任一删除失败使本次任务直接失败并记录具体投稿 ID。

`submitted` 永不按时间自动删除。

## 15. 前端组件边界

全部 Vue 代码使用当前项目的 Vue 3、Composition API、`<script setup lang="ts">` 和显式类型。

### 15.1 朋友端

| 组件或模块 | 单一职责 |
| --- | --- |
| `ContributionApp.vue` | 会话启动、页面阶段切换和子组件组合 |
| `ContributionForm.vue` | 称呼、正文、提交意图和字段错误 |
| `ContributionMediaPicker.vue` | 文件选择、拖入、本地预览和移除事件 |
| `ContributionUploadList.vue` | 素材状态列表，不持有上传副作用 |
| `ContributionUploadSummary.vue` | 总进度、当前文件、速度和可访问播报 |
| `useContributionUploader.ts` | tus 实例、顺序队列、停止、登记、提交等待和离开提醒 |
| `contributionApi.ts` | 朋友端会话与业务 API |
| `contributionTypes.ts` | 投稿页专用显式类型 |

数据流固定为：

- 表单与选择器通过 typed props 接收状态；
- 通过 typed emits 请求添加、移除和提交；
- `useContributionUploader` 是上传状态唯一来源；
- 可见素材、总字节、已完成数量和按钮文案使用 `computed` 推导；
- `File`、tus 实例和大数组使用 `shallowRef`，通过替换根引用触发更新；
- 高频进度原始值不做深层响应式代理；
- composable 对外返回只读状态和明确动作。

不把上传器、API、副作用和整页模板堆在一个 SFC。

### 15.2 管理员端

| 组件或模块 | 单一职责 |
| --- | --- |
| `ContributionInboxView.vue` | 投稿列表的数据编排与分页 |
| `ContributionCard.vue` | 单条摘要展示 |
| `ContributionReviewView.vue` | 单条详情、编辑状态和发布编排 |
| `ContributionReviewMedia.vue` | 派生媒体展示、移除与撤销 |
| `ContributionSettingsSection.vue` | 投稿开关、分享、二维码与换钥匙 |
| `useContributionInbox.ts` | 列表、游标和数量状态 |
| `useContributionReview.ts` | 详情、保留 ID、可见性、发布和删除 |

管理员投稿组件通过 `defineAsyncComponent` 在对应路由按需加载，并配置明确的延迟加载与错误界面；朋友端独立入口不需要 Vue Router 或 Pinia。

## 16. OpenResty、缓存、Cloudflare 与部署

### 16.1 OpenResty

以下 HTML 与 API 固定为 `private, no-store`：

```text
/contribute
/api/contributions
/api/me/contributions
```

Vite 生成的带 hash JS/CSS 在 `/assets/` 使用 `public, max-age=31536000, immutable`；投稿 HTML 保持 `no-store`。两类缓存规则必须分开，不能因 HTML 私有而禁止浏览器复用构建产物。

tus 路径使用独立 `location`：

- 允许 `POST`、`HEAD`、`PATCH`、`DELETE` 和 `OPTIONS`；
- `proxy_request_buffering off`；
- `proxy_http_version 1.1`；
- 保持连接复用；
- `client_max_body_size` 明确大于 64 MiB 且不超过当前全局 210 MiB；
- 上传相关 proxy 超时不能低于当前 120 秒；
- 继续传递 `Host`、`X-Forwarded-For` 和 `X-Forwarded-Proto`。

单个请求固定 64 MiB，因此无需为 4 GiB 文件提高全局 210 MiB 限制。

### 16.2 Cloudflare

保持现有代理域名，不增加 DNS-only 上传域名。

64 MiB 请求体低于无法确认套餐时采用的 100 MB 最低边界。媒体处理在每个 tus 完成请求内严格串行且只生成单档展示资源，目标是避免接近 Cloudflare 125 秒默认响应等待边界。

本方案不承诺绕过 Cloudflare 固定连接超时，也不通过备用域名规避错误。

### 16.3 Docker

Journal runtime 镜像增加 FFmpeg / ffprobe。宿主机不安装常驻视频服务。

保持：

- 单 Journal 容器；
- `1 CPU / 512 MB`；
- 单个 Sharp 或 FFmpeg 媒体处理；
- 原文件与派生文件都在 `/data`；
- 不增加队列进程、Worker 容器和 Redis。

只有真实运行证据证明合法素材无法在 Cloudflare 单请求时间内处理时，才另行评估资源调整；不提前建设异步媒体平台。

### 16.4 备份

正式原文件、展示资源、低清预览、`submitted` 投稿和 SQLite 都在现有 `/opt/journal/data` 备份范围内。

明确排除：

```text
/data/contributions/.uploads
/data/contributions/.tus-info
```

因此 `scripts/journal-backup` 需要按这两个精确路径排除临时文件，避免一个未完成的 5 GiB 投稿进入每日归档。数据库中对应 `uploading` 行可以进入备份；其未完成资产路径为空，不会被当作已送达。由于 tus 临时字节被明确排除，灾难恢复入口必须在 Journal 第一次开放 HTTP 前调用投稿服务的恢复清理，只删除所有 `uploading` 投稿、其中已经完成的正式资产和对应数据库行。该动作只发生在恢复流程，不用于普通启动，也不猜测 `submitted` 数据。

现有备份在 04:50 停止 Journal：

- 当时的活动请求会失败；
- 浏览器队列停止并显示错误；
- 不自动重试或续传；
- 已经完整写入正式目录的文件与数据库会进入一致快照；
- 未完成 tus 字节不进入恢复包。

若产品以后要求 04:50 也不中断上传，必须单独重审已经确认的停机一致性备份方案；不能在本功能中用重试或假成功掩盖。

## 17. 实施范围

### 17.1 新增依赖

- `@tus/server`
- `@tus/file-store`
- `tus-js-client`
- `file-type`
- `execa`
- `qrcode`
- `@types/qrcode`（若所选版本仍需要）

### 17.2 服务端新增

- `src/journal-server/contributionAuth.ts`
- `src/journal-server/contributionRepository.ts`
- `src/journal-server/contributionService.ts`
- `src/journal-server/contributionUpload.ts`
- `src/journal-server/contributionMedia.ts`
- `src/journal-server/contributionNotifier.ts`
- `src/journal-server/routes/contributions.ts`
- `src/journal-server/routes/privateContributions.ts`

### 17.3 服务端修改

- `src/journal-server/migrations.ts`
- `src/journal-server/repository.ts`
- `src/journal-server/storage.ts`
- `src/journal-server/server.ts`
- `src/journal-server/types.ts`
- `src/shared/journalProtocol.ts`
- `src/journal-server/routes/media.ts`
- `deploy/journal/Dockerfile`
- `deploy/journal/feeds.xmcloud.buzz.conf`
- `scripts/journal-backup`
- `scripts/restore-journal`

现有 `src/reminders/recurring.ts` 的 `rrule` 导入及加载方式不在范围内。

### 17.4 朋友端新增

- `web/contribute.html`
- `web/src/contribute-main.ts`
- `web/src/ContributionApp.vue`
- `web/src/components/contribution/ContributionForm.vue`
- `web/src/components/contribution/ContributionMediaPicker.vue`
- `web/src/components/contribution/ContributionUploadList.vue`
- `web/src/components/contribution/ContributionUploadSummary.vue`
- `web/src/composables/useContributionUploader.ts`
- `web/src/contributionApi.ts`
- `web/src/contributionTypes.ts`

### 17.5 管理员 Web 新增

- `web/src/components/contribution/ContributionInboxView.vue`
- `web/src/components/contribution/ContributionCard.vue`
- `web/src/components/contribution/ContributionReviewView.vue`
- `web/src/components/contribution/ContributionReviewMedia.vue`
- `web/src/components/settings/ContributionSettingsSection.vue`
- `web/src/composables/useContributionInbox.ts`
- `web/src/composables/useContributionReview.ts`

### 17.6 Web 修改

- `web/vite.config.ts`
- `web/src/router.ts`
- `web/src/App.vue`
- `web/src/api.ts`
- `web/src/types.ts`
- `web/src/components/settings/SiteProfileSettingsView.vue`
- `web/src/components/journal/MediaGallery.vue`
- `web/src/components/journal/JournalMediaStage.vue`
- `web/src/components/ui/JournalProgressiveVideo.vue`

现有 `EntryPublisherView.vue` 和 `JournalWebEntryService` 不改造成通用投稿器，避免管理员草稿与外部收件箱共享一套复杂状态。

## 18. 首版明确不做

- 朋友账号、好友列表、手机号或邮件登录；
- 多个分享链接、按聚会分相册、链接有效期；
- 投稿自动公开；
- 评论、点赞、共同编辑和发布状态回执；
- 朋友查看或修改已送达投稿；
- 跨页面续传、自动重试、暂停后恢复；
- 备用上传域名、普通 multipart 备用通道、对象存储或备用服务器；
- 文件级或分块级并发上传；
- RAW、HEIC、HEIF、MOV、GIF、音频、文档、压缩包和任意文件；
- 视频转码、压缩、多码率、HLS 和 AI 选封面；
- 修改原图、浏览器端压缩、美化和 EXIF 编辑；
- 批量审核、批量发布和已处理投稿历史；
- 为投稿单独建立第二套备份；
- Redis、消息队列、后台媒体 Worker 和多容器上传服务；
- 为理论上的未来需求增加多用户权限或复杂状态机。

## 19. 产品与性能验收标准

1. `/contribute` 使用独立页面产物，不加载信息流、Tiptap、`@egjs/grid`、管理员会话和天气数据。
2. 文件选择并通过整批预检后立即开始上传，朋友可同时填写称呼和正文。
3. 点击“送给小明”时若队列未完成，页面自动等待并在完成后提交，不要求第二次点击。
4. 任一时刻最多只有一个文件上传和一个媒体处理任务。
5. 4 GiB 文件由 64 个不超过 64 MiB 的请求传输，不形成单次 4 GiB 请求。
6. OpenResty 不完整缓冲 tus 请求，Node 不把完整投稿文件读入 Buffer。
7. 进度按真实字节加权，文件只有在服务端处理成功后才显示“已就绪”。
8. 进度 UI 更新频率受控，屏幕阅读器不会被每次 XHR 进度事件连续打断。
9. 页面离开、刷新或关闭时，只要存在未提交内容就注册原生离开提醒；是否展示由浏览器能力决定。
10. 任一错误停止队列，不自动重试、不跳过、不切换通道、不显示假成功。
11. 投稿只在管理员投稿箱可见，不进入首页、RSS、JSON Feed 或普通 `/me` 时间线。
12. 投稿箱列表只读取派生展示资源，不读取原图、原视频或视频 metadata。
13. 整理页默认私有，公开需要小明确认选择。
14. 朋友投稿图片进入信息流后默认读取 2,048 px 展示图，原图只在明确操作后请求。
15. 朋友投稿视频卡片先展示海报，不因卡片进入视口就读取 4 GiB 原视频。
16. 完整投稿只发送一条 Telegram 通知；Telegram 失败时投稿不进入 `submitted`。
17. 发布后成为现有普通 `web + plain` Entry，媒体不复制、不重新上传、不重新生成派生资源。
18. `capturedAt` 保留朋友送达时间，`sourceCreatedAt` 使用小明确认时间。
19. 投稿人称呼保持私有，不自动进入正文。
20. 永久删除投稿会删除原文件、展示资源、低清预览和 tus 临时资源。
21. `.uploads` 与 `.tus-info` 不进入每日备份，完整投稿资产继续进入现有恢复包；灾难恢复开放 HTTP 前明确清除备份中的 `uploading` 状态及其正式资产。
22. 关闭或更换链接后，旧会话的下一次业务或分块请求直接失败。

## 20. 实施前仍需确认的事实

### 20.1 真实相机样本

提供 1–2 个常见照片和视频样本，记录：

- 扩展名；
- 容器；
- 视频与音频编码；
- 单文件大小；
- 分辨率和时长。

样本只用于决定是否需要另立 MOV/HEIC 方案，不阻塞 JPEG、PNG、WebP、H.264 MP4 和 VP8/VP9 WebM 的首版。

### 20.2 容量定位

当前建议单视频 4 GiB、单次 5 GiB，目标是覆盖短时 4K 聚会视频，同时保持 Journal 是发布入口。

若真实素材经常超过 5 GiB，应先决定产品是否已经变成原片归档盘。该变化会影响磁盘、备份时间、媒体交付和上传入口，不应仅把数字调大。

### 20.3 固定备份中断

当前每日 04:50 停机备份与“任何时刻都可连续上传”互相冲突。本方案如实保留该限制。

只有小明确认要改变已实施的备份一致性策略后，才能另行设计不停机快照或上传与备份协调；本方案不预埋重试、等待锁或备用通道。
