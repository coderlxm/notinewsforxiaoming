# Journal Web「发布内容」视频上传方案

## 1. 文档定位

- 状态：待评审
- 目标：让 `/me` 的“发布内容”同时支持文字、图片和短视频，并继续产出普通 Journal 记录。
- 范围：普通内容的新建、草稿继续编辑与发布；不扩展富文本文章编辑器和朋友投稿入口。
- 原则：复用现有视频整理、视频封面和前台展示能力；视频使用分块上传，图片与视频以同一提交顺序写入记录；不增加自动重试、自动恢复或其他兜底路径。

## 2. 已核实的当前事实

### 2.1 发布入口目前只支持图片

`web/src/components/publisher/EntryPublisherView.vue` 只维护 `newImages`，并将其交给 `EntryImagePicker.vue`。前端 API 以 multipart 字段 `images` 或 `newImages` 提交；`src/journal-server/routes/privateEntries.ts` 也只接受这两个文件字段。

服务端全局 `@fastify/multipart` 限制为单文件 20 MiB，普通发布路由随后调用 `part.toBuffer()`。因此，单纯放宽图片选择器的 `accept` 或服务端 MIME 白名单，仍会让一段正常视频经过整文件内存缓冲，不能作为视频入口方案。

### 2.2 数据与展示层已支持视频

- 数据库的第 7 个 migration 已允许 `web + plain` 记录的 `content_type` 为 `text`、`photo` 或 `video`；不需要新增 migration。
- `journal_assets` 已有 `kind`、`mime_type`、尺寸、时长和 `preview_relative_path` 字段，普通 Web 附件也已可写入。
- `MediaGallery.vue`、`JournalMediaStage.vue` 与 `JournalProgressiveVideo.vue` 已按 `kind = video` 使用原生视频和 `previewUrl` 展示；发布成功后的公开页、私有流和详情页不需要另建视频渲染分支。
- `JournalVideoPreviewService` 会用 FFmpeg/ffprobe 取帧并生成 WebP 封面；朋友投稿视频当前已经走这条能力。

### 2.3 可复用但不能直接挪用的上传能力

朋友投稿已使用 `@tus/server`、`@tus/file-store` 与 `tus-js-client`，采用 32 MiB 分块上传。OpenResty 也已为投稿分块上传关闭请求缓冲、限制单块 40 MiB。

这组能力适合普通发布的视频，但不能把管理员发布伪装成一条朋友投稿：投稿链接鉴权、投稿箱记录和 Telegram 通知均不属于此功能。普通发布应新建管理员专用的上传会话，仅复用成熟的 tus 协议、临时文件存储和视频处理逻辑。

## 3. 产品范围与交互

### 3.1 支持范围

“发布内容”中的媒体区域改为统一的“图片与视频”选择器：

| 项目 | 约定 |
| --- | --- |
| 单条记录媒体总数 | 最多 10 项，沿用当前图片记录规模 |
| 视频数量 | 最多 5 段 |
| 图片 | 保持现有 JPEG、PNG、WebP、GIF 与单图 20 MiB 规则 |
| 视频容器 | MP4、MOV |
| 视频编码 | 沿用投稿的 H.264 或 HEVC；音频为 AAC 或无音轨 |
| 视频上限 | 单段、单条记录总量均为 500 MiB；最长 5 分钟；最长边不超过 3840 px；帧率不超过 60 fps |

视频处理后统一保存为 `video/mp4`，加 `faststart`，HEVC 视频标记为 `hvc1`，并生成封面。以上视频约束与已经上线的朋友投稿处理规则一致；这不是对当前服务器吞吐能力的测速结论。

正文和至少一项媒体仍须二选一。`公开` / `私有`、保存草稿、发布、标签提取、发布后编辑正文和可见性等现有行为不变。

### 3.2 选择与预览

将 `EntryImagePicker.vue` 演进为 `EntryMediaPicker.vue`，由它维护一个按选择顺序排列的 `File[]`：

- 点击、拖拽和粘贴图片都追加到同一数组；粘贴仍只处理图片。
- 文件选择器同时接受现有图片 MIME 与 `video/mp4`、`video/quicktime`。
- 本地图片使用现有对象 URL 缩略图；视频使用同一对象 URL 的原生 `<video preload="metadata">` 缩略预览，并显示播放标记与文件名。
- 每项都可在提交前移除；最终媒体的 `sort_order` 严格等于该列表顺序，不另加拖拽排序。
- 选择阶段只做数量、浏览器 MIME、单文件大小和总大小提示。视频真实容器、编码、时长、尺寸和可解码性只以服务端 ffprobe 结果为准。

发布或保存期间，正文、可见性、媒体添加和移除均禁用。界面复用现有提交按钮，在按钮下显示“上传中（百分比）”或“正在整理媒体”；任一媒体失败即展示服务端原始业务错误，本次提交停止。

### 3.3 提交主路径

为保证图片和视频可以交错排序，所有新媒体在用户点击“保存草稿”或“发布”后走同一条上传会话，而不是把图片留在旧 multipart、视频另走一条通道：

```text
点击保存草稿 / 发布
  → 创建管理员媒体上传会话
  → 按列表顺序逐项用 tus 上传（32 MiB 分块）
  → 每项完成后由服务端校验并生成正式临时资产
  → 提交正文、可见性、要删除的旧资产和上传会话 ID
  → 服务端原子写入或更新 Web 普通记录
  → 跳转到现有草稿编辑页或“我的资产”
```

上传逐项进行，不并行上传。客户端不配置自动重试，也不保存指纹以支持刷新后的续传；刷新、离开页面或上传失败后，本次会话不能继续，用户重新发起保存或发布。

草稿编辑时，已存在的附件继续显示在同一媒体列表中；本次选择的新媒体追加在后面，移除既有附件继续复用 `removedAssetIds`。已发布记录的附件编辑范围不扩大。

## 4. 前端设计

### 4.1 组件与状态边界

| 模块 | 职责 | 对外契约 |
| --- | --- | --- |
| `EntryPublisherView.vue` | 路由级组合、正文/可见性/草稿状态、保存或发布后导航 | 向选择器传入现有资产与忙碌状态；接收统一的新媒体列表与移除事件 |
| `EntryMediaPicker.vue` | 文件选择、顺序、对象 URL 预览、客户端预检与逐项移除 | `v-model<File[]>`、`existing-assets`、`disabled`、`remove-existing` |
| `useEntryMediaSubmit.ts` | 创建会话、串行 tus 上传、触发每项服务端处理、完成或丢弃会话 | 返回 `status`、`progress`、`error`、`submit()`；不保存跨页面状态 |
| `useEntryPublisher.ts` | 调用普通记录的创建、草稿更新和发布 API | 输入从 `newImages` 改为 `newMedia` 和会话 ID |

组件保持 props 向下、事件向上的单向数据流。`EntryMediaPicker` 不直接调用 API；网络、进度与副作用集中在 `useEntryMediaSubmit`。

### 4.2 API 调整

新增仅管理员可调用的接口：

```text
POST   /api/me/entry-uploads
POST   /api/me/entry-file-uploads            # tus 创建
PATCH  /api/me/entry-file-uploads/:assetId   # tus 分块
POST   /api/me/entry-uploads/:id/assets/:assetId
DELETE /api/me/entry-uploads/:id
```

创建会话由正常 Fastify 管理员 Cookie 鉴权，返回随机 `uploadId` 和仅用于该上传会话的短期 token。tus 原始请求携带该 token；服务端用它校验上传会话，而不在原始 tus 请求中重复解析 Fastify Cookie。

现有普通记录的创建与草稿更新接口从 multipart 改为 JSON，请求体包括：

```ts
{
  contentText: string;
  action: 'draft' | 'publish';
  visibility?: 'private' | 'public';
  uploadId: string;
  removedAssetIds?: number[];
}
```

`uploadId` 对应的会话必须属于当前管理员请求，且其中全部 tus 文件都已完成处理。没有新媒体时仍创建一个空会话，使新建、纯文字、草稿更新和图文/视频提交共用同一份协议。

### 4.3 前端完成态

- 新建保存草稿成功：进入 `/me/entries/:entryId/edit`。
- 发布成功：回到 `/me`，沿用现有已发布记录的详情和操作。
- 上传/处理/提交失败：留在当前编辑器，保留正文、本地选择列表和未删除的既有附件；只显示本次失败原因，不自动再次上传。
- 浏览器卸载时主动请求丢弃未完成会话并停止当前 tus 上传；服务端在媒体处理失败时也立即丢弃会话目录。

## 5. 服务端设计

### 5.1 管理员媒体上传会话

新增 `JournalWebEntryUploadService`，结构参考现有 `JournalContributionUploadService`，但其职责仅限于普通 Web 记录：

1. 创建时生成 `uploadId`、会话 token、目标 `publicId`、创建时间和 Journal 临时存储会话；
2. `@tus/file-store` 将各文件暂存在现有 Journal 临时上传目录；
3. 文件完成后，按客户端顺序调用对应处理器，将结果加入该会话的 `WebEntryAssetInput[]`；
4. 最终创建/更新请求消费会话：先将临时媒体目录完成移动，再由 repository 在现有事务中写入记录和附件行；
5. 处理失败、显式丢弃或最终数据库写入失败时删除该会话临时目录和 tus 文件。

会话只保存在进程内，不能在服务重启、页面刷新或新浏览器会话后恢复。这与现有投稿上传会话的生命周期一致，也避免为单用户管理后台增加持久化上传状态表。

### 5.2 媒体处理复用

现有 `JournalContributionMediaService` 同时承担投稿错误协议和图片/视频处理，不能让 Web 发布直接依赖投稿错误、投稿数量或投稿记录。实施时只提取其中的视频规范化部分为一个共享的、面向本地临时文件的服务：

```text
临时视频文件
  → ffprobe 验证容器、视频流、音频流、时长、尺寸、帧率与编码
  → FFmpeg 无损重封装为 MP4（faststart；HEVC 标记 hvc1）
  → JournalVideoPreviewService 生成 WebP 封面
  → WebEntryAssetInput(kind=video, mimeType=video/mp4, width, height, duration)
```

朋友投稿继续调用同一视频规范化服务，维持已有格式规则；普通发布自己的会话服务调用它并将错误转为普通 Journal API 错误。图片仍沿用现有 `webImage.ts` 白名单、`JournalImagePreviewService` 和附件写入逻辑，保证已有 GIF/图片行为不改变。

### 5.3 Repository 与协议

`WebEntryAssetInput` 已可携带 `kind` 与 `duration`，只需调整以下计算：

- 任一附件 `kind === 'video'` 时，记录 `content_type = 'video'`；
- 无视频但有附件时为 `photo`；无附件时为 `text`；
- 新建、保存草稿、发布草稿三处使用同一个 `contentTypeOf(assets)`，不能继续以“附件数大于零即 photo”判断。

`journal_assets` 的写入结构、`sort_order`、`/media/:assetId` 权限和视频预览路径均不变。数据库 CHECK 已包含 `video`，本功能不新增数据库 migration。

## 6. 部署涉及的最小改动

在 `deploy/journal/feeds.xmcloud.buzz.conf` 增加专用的 `/api/me/entry-file-uploads` location，配置与现有投稿分块路径一致：

- `client_max_body_size 40m`；
- `proxy_request_buffering off` 与 `proxy_buffering off`；
- `proxy_read_timeout 300s`；
- 继续代理到本机 Journal 服务，并保留私有响应头。

这样每个 tus 块均低于当前站点的 210 MiB 总请求限制，且不经过 OpenResty 请求体缓冲。Journal Docker 镜像已经因朋友投稿视频包含 FFmpeg、ffprobe 与视频封面路径；本方案不要求增加新的媒体运行时依赖。

## 7. 明确不做的内容

- 不为富文本文章增加视频内嵌或视频封面；
- 不给已发布普通记录新增、替换、重排附件；
- 不自动重试、不中断后自动恢复、也不在刷新后恢复本地 File；
- 不复用朋友投稿链接、投稿箱或 Telegram 通知；
- 不引入转码队列、后台任务表、对象存储或 CDN；
- 不根据文件扩展名假定视频合法，也不在视频处理失败后保存“无封面视频”。

## 8. 实施顺序

1. 提取并保持朋友投稿行为不变的视频规范化服务。
2. 新增管理员媒体上传会话、tus 路由与 OpenResty 分块代理 location。
3. 将普通记录创建/草稿更新改为消费上传会话，并按实际附件种类写入 `content_type`。
4. 用 `EntryMediaPicker` 和 `useEntryMediaSubmit` 替换图片专用提交状态，保留现有草稿和可见性主路径。
5. 为首段视频、图文混排、草稿增删媒体、私有/公开发布与格式拒绝建立对应覆盖。

## 9. 评审需要确认的产品取舍

本方案默认采用与朋友投稿一致的 MP4/MOV、H.264/HEVC、单段/总量 500 MiB 和最多 5 段视频。若“发布内容”只需要偶发的小视频，也可以改为保持现有一次 multipart 的小文件方案；但那会继续受 20 MiB 限制和整文件内存缓冲约束，不能复用当前已存在的可靠视频处理路径。
