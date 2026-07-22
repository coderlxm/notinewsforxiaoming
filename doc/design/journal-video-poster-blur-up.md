# Journal 视频首帧 Blur-up 方案

## 1. 文档状态

- 状态：已设计，延后实施
- 日期：2026-07-23
- 前置能力：图片 Blur-up、`preview_relative_path`、受鉴权预览路由、瀑布流 `data-grid-skip` 已存在
- 范围：公开信息流和个人资产信息流中的视频卡片

## 2. 结论

视频 Blur-up 可以直接扩展当前图片预览链路，不需要新的数据库字段、媒体服务、队列、对象存储或宿主机常驻进程。

推荐在 Journal Docker 运行镜像内加入 FFmpeg。Telegram 视频下载完成后，用 FFmpeg 提取第一帧并生成 64px WebP；前端继续使用当前两层媒体结构，先展示模糊首帧，视频触发 `loadeddata` 后再让首帧淡出、真实视频淡入。

FFmpeg 只作为 Journal 进程按需调用的命令行工具，不在 rndc02 宿主机额外安装服务，也不承担视频转码、压缩或多码率播放。

## 3. 当前实现

### 3.1 已经可以复用的能力

- `journal_assets.preview_relative_path` 已能保存派生预览路径。
- `/media/:assetId/preview` 已复用原媒体的公开/私有鉴权并固定返回 WebP。
- `JournalStorage` 已提供确定性的 `.preview.webp` 路径，记录目录删除和现有备份会自然覆盖预览文件。
- `JournalProgressiveVideo.vue` 已管理 `loading / loaded / error` 三态，但当前加载前只有媒体底板。
- `MediaGallery.vue` 已把卡片视频统一交给 `JournalProgressiveVideo`。
- `.waterfall__item` 已使用 `data-grid-skip="true"`，Masonry 不会等待视频元数据或首帧才完成排版。

### 3.2 当前缺口

- 视频资产的 `previewUrl` 仍为 `null`。
- Journal 镜像没有 FFmpeg，服务端不能抽取视频首帧。
- 历史视频没有派生预览文件。
- 前端视频组件没有首帧预览层，因此只能从底板淡入视频，不可能形成真正的模糊到清晰。

## 4. 功能边界

### 4.1 首版支持

- Telegram `video`；
- Telegram `video_note`；
- MIME 类型为 `video/*` 的 `animation` 和 `sticker`；
- 公开信息流与个人资产信息流的卡片模式；
- 既有历史视频和功能上线后的新视频。

### 4.2 首版不做

- 不转码、不压缩原视频；
- 不生成 HLS、多码率、时间轴缩略图或动态封面；
- 不使用 AI 选择代表画面；
- 不改变详情弹层现有视频 `contain`、尺寸计算或播放控件；
- 不给音频、语音和普通文件生成封面；
- 不在浏览器端解码视频或生成 Canvas 截图；
- 不使用 `requestAnimationFrame`；
- 不加入失败兜底、默认封面、重试或跳过失败资产。

## 5. 服务端设计

### 5.1 FFmpeg 运行方式

在 `deploy/journal/Dockerfile` 的 runtime 阶段安装 Debian Bookworm 仓库提供的 `ffmpeg` 包。这样 FFmpeg 版本与当前 `node:24-bookworm-slim` 基础镜像保持一致，rndc02 宿主机不需要安装任何软件。

Node 端使用 `node:child_process` 的 `execFile` 参数数组直接调用 FFmpeg，不拼接 shell 字符串，也不新增仅用于启动一个命令的封装库。

单次生成过程固定为：

1. 读取原视频的第一个可解码视频帧；
2. 等比缩放至 64px 宽；
3. 输出质量 35 的单帧 WebP；
4. 先写入同目录唯一临时文件；
5. FFmpeg 成功退出后原子重命名为既定 `.preview.webp`。

FFmpeg 使用 `-nostdin`、`-hide_banner` 和 error 级日志，避免进程等待输入或产生无关输出。输出目标显式指定 WebP 格式，命令失败时将 stderr 作为错误原因直接暴露。

### 5.2 `JournalVideoPreviewService`

新增 `src/journal-server/videoPreview.ts`，包含两个明确职责：

- `isJournalVideoAsset(kind, mimeType)`：集中判断本功能支持的视频资产；
- `JournalVideoPreviewService.generate(sourcePath, previewPath)`：执行一次首帧 WebP 生成。

该服务不访问数据库、不决定鉴权、不处理前端状态，也不修改原视频。

### 5.3 新视频入库

`JournalIngestService` 下载单项媒体后按资产类型选择处理器：

```text
图片 → JournalImagePreviewService
视频 → JournalVideoPreviewService
其他 → 不生成预览
```

视频预览仍在当前记录的临时目录内生成，完成后才允许 `finalize()`。FFmpeg 失败会使整次记录入库失败并清理临时目录，保持现有原子边界。

媒体组继续顺序下载、顺序处理，不并行启动多个 FFmpeg 进程，避免增加 512MB Journal 容器的瞬时压力。

### 5.4 历史视频补生成

新增 `JournalVideoPreviewBackfillService`，在 HTTP 服务开始监听前串行处理：

```text
查询 preview_relative_path IS NULL 的受支持视频
  → 生成首帧 WebP
  → 更新 preview_relative_path
  → 继续下一项
```

仓储新增视频专用查询和完成方法，不把图片方法改造成接收大量可选参数的通用入口。任一历史视频处理失败时 Journal 启动失败并暴露资产 ID，不静默跳过。

服务启动顺序调整为：

```text
数据库迁移
  → 图片历史预览补齐
  → 视频历史预览补齐
  → 注册并开放 HTTP 服务
```

### 5.5 数据、权限、删除与备份

- 继续复用 `preview_relative_path`，无需新增数据库迁移。
- API 中视频资产获得现有 `/media/:assetId/preview` 地址，无需修改前端协议。
- 预览路由继续复用原媒体的公开/私有权限，不新增静态直链。
- Telegram 记录永久删除时整个记录目录会连同视频预览一起删除。
- 视频预览仍位于 `/opt/journal/data`，现有 rclone 备份范围不变。

## 6. 前端设计

### 6.1 `JournalProgressiveVideo.vue`

组件新增必填 `previewSrc`，职责仍只限单个卡片视频的渐进展示：

```text
既定尺寸容器
├── 低清首帧 img：立即请求、blur(14px)、scale(1.06)
└── 原 video：preload="metadata"，初始透明
```

状态变化：

1. 组件挂载后首帧预览立即请求；
2. 视频继续按现有方式请求元数据与可显示帧；
3. `loadeddata` 到达后，视频约 280ms 淡入，预览约 220ms 淡出；
4. `src` 或 `previewSrc` 变化时重置为 `loading`；
5. 视频错误时直接露出原生视频错误状态，不让预览长期伪装成功。

预览图只作为视觉层，使用空 `alt` 和 `aria-hidden="true"`；可访问性和播放控制仍由视频元素承担。`prefers-reduced-motion: reduce` 下直接完成透明度切换。

### 6.2 `MediaGallery.vue`

卡片模式调用调整为：

```vue
<JournalProgressiveVideo
  :src="asset.url"
  :preview-src="asset.previewUrl!"
  fit="cover"
/>
```

现有单媒体真实宽高比、多媒体固定网格、圆形 `video_note` 和 `+N` 折叠逻辑保持不变。详情模式仍直接使用现有 `<video>`，不扩大本次范围。

### 6.3 与 Masonry 的关系

视频加载状态不得参与瀑布流是否完成排版。现有 `.waterfall__item[data-grid-skip="true"]` 必须保留，由卡片既定宽高比负责几何稳定，`JournalProgressiveVideo` 只改变两层媒体的透明度。

## 7. 失败语义

- 新视频无法抽取首帧：整条 Telegram Journal 入库失败；
- 历史视频无法抽取首帧：Journal 新版本启动失败并指出资产 ID；
- 预览文件缺失：预览接口直接返回错误；
- 浏览器无法加载首帧预览或原视频：直接暴露媒体请求错误；
- 不返回默认图，不改用原视频充当预览，不重试，不吞错。

## 8. 资源影响

- 每个视频新增一个约 64px 宽的 WebP，磁盘和备份增量很小。
- 新视频入库时增加一次短暂 FFmpeg 子进程；处理结束后不常驻。
- 历史补生成严格串行，只在首次上线或存在未补齐视频时发生。
- Docker 镜像会因 FFmpeg 及其运行库明显增大，这是本方案最主要的部署成本。
- 浏览器每个可见视频多请求一个很小的首帧预览，但可显著改善视频首帧出现前的空底板体验。

## 9. 实施文件范围

### 新增

- `src/journal-server/videoPreview.ts`：视频类型判断、FFmpeg 首帧生成、历史补齐服务。

### 修改

- `deploy/journal/Dockerfile`：runtime 镜像安装 FFmpeg；
- `src/journal-server/ingest.ts`：新视频入库时生成预览；
- `src/journal-server/repository.ts`：查询历史缺失视频并保存预览路径；
- `src/journal-server/types.ts`：历史视频补齐资产类型；
- `src/journal-server/server.ts`：HTTP 开放前执行视频历史补齐；
- `web/src/components/ui/JournalProgressiveVideo.vue`：增加模糊首帧层和双层淡入淡出；
- `web/src/components/journal/MediaGallery.vue`：向视频组件传入 `previewUrl`。

不修改数据库迁移、共享 Journal API 协议、媒体路由、OpenResty、宿主机服务、bot 消息交互和备份任务。

## 10. 验收标准

1. 信息流接口返回后，Masonry 不等待视频加载即可结束骨架接管；
2. 单视频、多媒体视频和圆形 `video_note` 均先出现模糊首帧，再自然变为视频画面；
3. 视频从首帧预览切换到真实视频时卡片高度不变；
4. 公开与私有视频预览沿用各自权限边界；
5. 新 Telegram 视频在入库时同步生成预览；
6. 历史受支持视频全部补齐预览；
7. 视频播放控件、详情布局和移动端展示保持现状；
8. 删除记录会同时删除原视频和首帧预览；
9. 回退旧 Journal 镜像时，新增视频预览文件和数据库路径不会影响旧版本读取原视频；
10. 图片 Blur-up、分页瀑布流和滚动位置恢复不受影响。

## 11. 推荐实施顺序

1. 在 Journal 镜像加入 FFmpeg，并完成单视频首帧生成服务；
2. 接入新 Telegram 视频入库；
3. 增加历史视频串行补齐；
4. 给 `JournalProgressiveVideo` 增加预览图层；
5. 由 `MediaGallery` 传入视频 `previewUrl`；
6. 按现有不可变 Journal 镜像发布方式上线，bot 保持不变。
