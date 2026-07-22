# Journal 占位瀑布流与渐进式媒体加载完整方案

## 1. 文档状态

- 状态：已按 2026-07-23 当前源码复核，待实施
- 范围：公开信息流和个人资产信息流的首屏占位瀑布流、图片 Blur-up、视频首帧淡入、文章卡片封面 Blur-up，以及详情媒体缩略导航复用低清预览
- 核心形态：页面进入后立即出现与真实信息流同构的静态瀑布流轮廓；真实卡片在其下完成排版，图片由低清模糊预览过渡到原图，视频由媒体底板过渡到首帧
- 实现原则：沿用现有 SQLite、Journal 本地资产目录、Fastify 与 Vue，不增加图片服务、队列、对象存储或 CDN

## 2. 当前实现与问题

### 2.1 当前源码行为

- Telegram 图片由 `JournalIngestService` 下载到 `data/assets/<year>/<month>/<publicId>/`，数据库只保存原文件相对路径。
- Web 文章封面和文中图片由 `JournalArticleService` 写入同一套资产目录。
- `/media/:assetId` 根据记录公开状态执行访问控制，再通过 Fastify Static 返回原文件。
- `JournalAsset` 已包含 `width`、`height` 与原图 `url`，但没有低清预览地址。
- `MediaGallery.vue` 和 `ArticleCardContent.vue` 仍直接渲染原图 `<img>`；网络慢时，卡片背景先空着，原图随后突然出现。
- 当前信息流已经由 `WaterfallFeed.vue` 统一接入 `@egjs/grid` 的 `MasonryGrid`，首屏在 `renderComplete` 前隐藏整体瀑布流，继续分页时也会隐藏尚未完成布局的新卡片。
- 首次请求和筛选替换期间，`WaterfallFeed.vue` 当前显示居中的 `JournalLoading`（“正在整理记录”或“正在筛选记录”），真实瀑布流要等数据请求及 `renderComplete` 都结束后才整体出现；这正是本次需要替换的体验。
- 详情已经演进为 `JournalDetailOverlay.vue`、`JournalDetailLayout.vue` 与 `JournalMediaStage.vue` 组合：主媒体根据图片比例自适应弹层，移动端使用独立布局，多媒体还包含缩略导航；主图和缩略图目前均直接请求原图。
- Telegram 图片一般已有宽高；Web 上传图片当前没有提取宽高，因此文章封面加载前无法稳定预留比例。
- 整条 `data` 目录已经由现有备份任务归档，因此只要缩略图仍位于记录资产目录，就会自然进入备份。

### 2.2 根因

当前问题包含两个连续阶段，不能只解决图片请求：

1. 数据返回与 Masonry 首次排版之前，页面只有居中的加载提示，没有任何信息流空间结构；
2. 真实瀑布流出现后，图片仍直接请求原图，因此媒体区域会从空底色突然切成完整图片。

CSS 模糊不能凭空显示尚未下载的像素。要获得稳定的“模糊到清晰”，必须有两个独立资源：

1. 体积极小、可以迅速完成的低质量缩略图；
2. 保持原质量的正式图片。

只对原图添加 `filter: blur()`，最多能改善原图已经开始绘制后的短暂阶段，无法解决原图首字节到达前的空白，因此不属于本方案的完整实现。

## 3. 目标与非目标

### 3.1 目标

1. 冷启动、刷新和筛选替换时不再显示居中的“正在整理记录”，立即显示具有当前卡片宽度、间距和高低节奏的占位瀑布流。
2. 真实数据返回后，真实卡片在占位瀑布流下方完成 Masonry 排版；只有 `renderComplete` 后才与占位层交叉淡化，不暴露纵向排列过程。
3. 信息流图片进入视口后先出现稳定的模糊色块，再自然过渡到清晰原图；视频在首帧可用前保持媒体底板，完成后自然淡入。
4. 媒体加载过程中卡片尺寸不变化，不触发 `MasonryGrid` 的二次几何变化，不破坏当前分页批次显隐和滚动恢复。
5. Telegram 图片、Web 文章封面以及历史存量图片使用同一缩略图规则。
6. 公开与私有图片继续沿用现有权限边界，缩略图不能绕过原图鉴权。
7. 新增图片在记录入库前完成缩略图生成；生成失败直接暴露并终止写入。
8. 历史图片在首次启用时完整补齐，不形成长期的新旧两套体验。
9. 保持单机、单进程与本地文件存储，不引入后台任务系统。

### 3.2 非目标

- 首版不生成视频封面，也不处理视频 Blur-up。
- 占位瀑布流不使用 Element Plus 一类通用骨架组件，不显示灰色文字条扫光、闪烁渐变、Spinner 或加载文案。
- 数据返回前无法知道真实记录的图片比例，因此占位瀑布流表达的是稳定的信息流节奏，不承诺每个占位卡片与随后真实卡片逐项同高或逐项变形。
- 不改变详情弹层现有的尺寸计算、图片 `contain`/满幅策略和视频加载方案；只让缩略导航读取已经生成的低清预览。
- 不给富文本正文中的行内图片增加 Blur-up；首版只处理首页高频信息流。
- 不生成多档响应式图片，不加入 `srcset`、AVIF 原图重编码或 CDN 实时裁剪。
- 不把缩略图写成 Base64 塞入信息流 JSON。
- 不在浏览器端生成缩略图。
- 不增加重试、静默跳过、默认图片或失败后继续入库。
- 不使用 `requestAnimationFrame`。

## 4. 推荐技术决策

### 4.1 图片处理库

采用 `sharp 0.35.3`，并由 `pnpm-lock.yaml` 锁定实际安装版本。

选择依据：

- 当前稳定版本为 `0.35.3`；
- 官方要求 Node.js `>= 20.9.0`，当前 Journal 镜像使用 Node 24；
- 官方提供 Linux x64 glibc 预编译二进制，当前 `node:24-bookworm-slim` 镜像满足要求；
- Docker 构建阶段在 Linux 容器内安装依赖，产物再复制到相同 Linux 运行镜像，不存在从 macOS 搬运原生二进制的问题；
- `sharp` 自带 TypeScript 类型，不增加 `@types` 包；
- rndc02 宿主机无需额外安装 ImageMagick、libvips 或其他系统服务。

官方资料：

- [sharp v0.35.3 release](https://github.com/lovell/sharp/releases/tag/v0.35.3)
- [sharp 官方安装与预编译平台说明](https://sharp.pixelplumbing.com/install/)

### 4.2 缩略图规格

首版统一使用以下参数：

| 项目 | 决策 |
| --- | --- |
| 输出格式 | WebP |
| 最大宽度 | 64px |
| 放大 | 禁止，原图不足 64px 时不放大 |
| 质量 | 35 |
| EXIF 方向 | 自动校正 |
| 动态 GIF | 取首帧生成静态占位图 |
| CSS 模糊 | `blur(14px)` |
| CSS 放大 | `scale(1.06)`，隐藏模糊边缘 |
| 清晰过渡 | 原图约 280ms 淡入、预览层约 220ms 淡出，仅过渡 `opacity` |

64px 足以保留主色和大块轮廓，同时文件通常只有数 KB。缩略图不承担可读细节，因此不需要更高分辨率。

### 4.3 适用资产

只为当前界面会作为图片渲染的资产生成预览；明确图片类型直接按 `kind` 判断，贴纸和动画再结合下载后的实际 MIME 类型判断：

- Telegram `photo`；
- MIME 类型为 `image/*` 的 Telegram `sticker` 与 `animation`；
- Web 文章的 `cover` 和 `inline` 图片，当前允许 `image/jpeg`、`image/png`、`image/webp`、`image/gif`。

不生成预览的资产：

- `video`、`video_note`；
- MP4/WebM 等视频贴纸与视频动画；
- `voice`、`audio`、`document` 和其他文件。

虽然 Web 行内图片首版不在首页消费预览，但仍在上传时生成，保持图片资产模型一致，也为后续文章阅读页接入留下直接能力。

## 5. 文件与数据模型

### 5.1 文件布局

缩略图与原图放在同一个记录目录，并使用确定性后缀：

```text
data/assets/2026/07/<publicId>/
├── <uuid>                  # 原图
├── <uuid>.preview.webp     # 对应低清预览
├── <uuid-2>                # 另一项原始资产
└── <uuid-2>.preview.webp
```

不为缩略图创建新的资产记录，因为它不是用户独立管理的内容，只是原资产的派生文件。

### 5.2 SQLite 迁移

在 `journal_assets` 增加一个可空字段：

```sql
preview_relative_path TEXT
```

并为非空值建立唯一索引。现有 `width` 和 `height` 字段继续描述原图，不增加另一套尺寸字段。

保留该字段而不只靠路径推导，原因是：

- 数据库可以明确区分“尚未迁移”和“已经生成”；
- API 只在真实存在预览时返回地址；
- 历史补生成可以精确查询未完成资产；
- 文章单张图片删除时可以取得对应派生文件路径；
- 失败不会被一个看似有效、实际不存在的 URL 掩盖。

迁移保持加法式：旧版本代码会忽略新增字段，回滚时原图和记录仍可正常工作。

### 5.3 协议字段

`JournalAsset` 新增：

```ts
previewUrl: string | null;
```

- 图片且预览已生成：`/media/:assetId/preview`；
- 非图片资产：`null`；
- `journalAssetSchema`、服务端返回类型和 `web/src/types.ts` 同步更新；
- 文章资产上传完成后仍按当前逻辑重新读取文章，完整 `JournalEntry` 会带回 `previewUrl`、`width` 和 `height`；无需扩大当前只供编辑器插图使用的 `JournalArticleAssetResponse`。

不把文件系统相对路径暴露给前端。

## 6. 后端实现

### 6.1 `JournalImagePreviewService`

新增一个职责单一的图片预览服务：

```text
输入：原图绝对路径、预览目标绝对路径
输出：原图按 EXIF 方向校正后的 width、height
```

处理顺序：

1. `sharp` 读取原图元数据中的 `autoOrient.width` 与 `autoOrient.height`，得到浏览器实际展示方向的尺寸；
2. 预览生成管线执行 `autoOrient()`；
3. 等比缩放到最大宽度 64px，禁止放大；
4. 输出质量 35 的 WebP；
5. 只有文件写入成功后才允许数据库记录该路径。

该服务不负责数据库、HTTP 或业务状态，只负责一次确定性的图片转换。

### 6.2 Telegram 入库链路

`JournalIngestService` 在现有临时目录中完成全部处理：

```text
Telegram 下载原图
  → 判断为受支持的图片
  → 在同一临时目录生成 preview.webp
  → 原图与预览全部完成
  → finalize 整个记录目录
  → SQLite 同一事务写入原资产和 preview_relative_path
```

这样保持现有原子边界：

- 缩略图生成失败时，临时目录整体删除，记录不入库；
- 数据库写入失败时，最终目录整体删除；
- 不会出现记录成功但新图片没有预览的状态。

媒体相册仍按当前顺序逐项处理，缩略图同样顺序生成，避免 512MB 容器中并行解码多张大图。

### 6.3 Web 文章图片链路

`JournalArticleService.uploadAsset()` 调整为：

1. 保存原始上传文件；
2. 对受支持图片生成预览；
3. 从 `sharp` 的方向校正尺寸取得实际宽高；
4. 将原图路径、预览路径、宽高在同一次资产插入中保存；
5. 保持现有上传响应最小协议不变；编辑器随后重新读取文章时取得完整资产信息。

替换文章封面时，删除旧封面的原图和预览；删除行内图片时也删除两者。任一文件处理失败都直接使本次上传失败，不保留半成品。

### 6.4 历史图片补生成

新增历史数据升级服务，在数据库结构迁移完成后、Fastify 开始监听端口之前查询 `preview_relative_path IS NULL` 的受支持图片资产，并逐张执行：

```text
读取原图
  → 生成固定后缀预览
  → 更新 preview_relative_path
  → 必要时补齐缺失的 width / height
```

执行规则：

- 在 Journal 新版本开始接受 HTTP 请求之前完成；
- 严格串行处理，控制 CPU 和内存峰值；
- 每张图片生成成功后立即更新对应资产；
- 任一图片失败时进程启动失败并暴露具体资产 ID，不跳过、不返回默认值；
- 已经写入 `preview_relative_path` 的资产不再处理；
- 后续启动仍复用同一条查询，但结果为空，不重复转换文件，也不额外引入迁移状态表。

首次部署可能比普通重启多花一些时间，但不会让访客在迁移过程中看到半套数据。当前不可变镜像发布方式可以保留旧容器，若新版本未健康启动，不影响旧版本继续提供原图。

### 6.5 预览读取接口

新增：

```text
GET /media/:assetId/preview
```

它必须复用 `/media/:assetId` 的权限判断：

- 公开记录：允许访问；
- 私有记录：必须具有有效管理员 Cookie；
- 非图片或没有预览：直接返回明确错误；
- 响应类型固定为 `image/webp`；
- 公开与私有缓存策略沿用原图，避免记录从公开转为私有后仍被长期公开缓存。

不使用可猜测的静态文件直链，避免绕过记录可见性检查。

## 7. 删除、备份与一致性

### 7.1 删除整条记录

现有永久删除会删除记录的整个 `publicId` 目录，因此原图和所有 `.preview.webp` 会一起删除。数据库删除数量继续统计用户资产行，不把派生预览算作额外附件。

### 7.2 删除或替换文章单图

当前文章图片可以单独删除或替换，相关仓储记录需要同时返回：

- `relativePath`；
- `previewRelativePath`。

`JournalStorage` 增加一个删除资产文件对的方法，负责删除原图和预览。文章保存时清理未引用行内图、替换封面、单独删除图片这三条调用链继续保持各自当前的数据库与文件操作顺序，不借本功能重写文章资产生命周期。

### 7.3 备份

现有 `journal-backup` 已归档 `/opt/journal/data`，缩略图位于该目录内部，无需修改备份范围、rclone 配置或恢复结构。

## 8. 前端组件设计

### 8.1 新增 `JournalWaterfallPlaceholder.vue`

组件位置：

```text
web/src/components/journal/JournalWaterfallPlaceholder.vue
```

职责只有一个：在尚无真实条目可排版时，立即提供与当前信息流相同的列宽、间距和卡片节奏。

- 纯展示组件，不接收业务数据，不维护响应式状态，也不模拟真实标题、日期或标签；
- 使用 CSS 多列布局生成固定数量的占位卡片，列数跟随当前容器宽度保持 2、3、4、5 列响应式变化；
- 卡片采用一组固定且交错的媒体比例，如 `4 / 5`、`1 / 1`、`3 / 4`、`4 / 3`，形成自然的瀑布流高低关系；
- 每张卡片只保留低对比媒体色块、短日期脊线和克制的正文色块，不出现通用骨架屏常见的逐行灰条；
- 不使用 shimmer、循环动画、随机高度或运行时尺寸计算；浅色与深色模式均复用现有主题变量。

这层不是伪造出来的内容，也不会逐项变形成真实卡片；它只负责让首屏从第一帧开始就保持信息流视觉结构。

### 8.2 `WaterfallFeed.vue` 的接管时序

`WaterfallFeed.vue` 继续作为唯一的 Masonry 生命周期持有者，新增占位层但不让占位组件接触 `MasonryGrid`：

1. `initialLoadPending` 或 `listReplacing` 开始时立即显示 `JournalWaterfallPlaceholder`，不再等待 `useDeferredLoading()`，也不再显示 canvas 版 `JournalLoading`；
2. 数据返回后真实卡片立即挂载在占位层下方，`MasonryGrid` 正常执行 `syncElements()` 与排版；
3. 真实瀑布流排版期间使用 `opacity: 0` 和 `pointer-events: none`，不再使用 `visibility: hidden`，让进入加载范围的低清图与原图可以提前请求；
4. `renderComplete` 后将真实瀑布流淡入，同时让占位层淡出；两个层级共享同一 `grid-area`，中间不插入空白态；
5. 首次加载或整批替换只要条目序列改变，就先将 `layoutReady` 重置为 `false`；纯追加分页不重置整页，只继续沿用当前 `pendingEntryIds` 机制；
6. 请求失败或返回空列表时直接结束占位状态并展示现有错误或空状态，不让占位层长期停留。

占位层只处理冷启动、手动刷新导致的整批替换和筛选替换。加载下一页仍保留当前底部轻量状态，不用整屏占位覆盖已经可读的内容。

占位层始终设置 `aria-hidden="true"`。真实瀑布流在透明排版阶段同时保持不可交互且不进入辅助技术读取范围，接管完成后再恢复；减少动态效果模式下取消交叉淡化但保留相同接管时序。

### 8.3 新增 `JournalProgressiveImage.vue`

组件位置：

```text
web/src/components/ui/JournalProgressiveImage.vue
```

职责只有一个：把一对预览图和原图渲染成 Blur-up 效果。

Props：

```ts
{
  src: string;
  previewSrc: string;
  alt: string;
  fit: 'cover' | 'contain';
  loading?: 'eager' | 'lazy';
}
```

内部状态：

- 一个 `shallowRef<'loading' | 'loaded' | 'error'>` 表达原图状态；
- 原图 `src` 变化时重置为 `loading`；
- 原生 `load` 切换为 `loaded`，原生 `error` 切换为 `error` 并显式露出浏览器图片失败状态；
- 不读取布局、不轮询、不使用 RAF。

渲染层级：

```text
填满父级既定尺寸的容器
├── 预览图：aria-hidden，blur(14px)，scale(1.06)
└── 原图：真实 alt，初始透明，load 后清晰淡入
```

过渡规则：

- 预览层保持静态 `blur(14px)` 与 `scale(1.06)`，在原图加载后约 220ms 淡出；
- 原图在约 280ms 内只通过 `opacity` 淡入，不对大尺寸原图执行实时模糊动画；
- 组件自身不决定宽高比，尺寸完全由 `MediaGallery.vue` 或文章封面容器提供；
- `prefers-reduced-motion: reduce` 下取消渐变时长，直接切换；
- 预览图不拥有可访问性文本，屏幕阅读器只读取一次原图描述。

组件不负责点击、卡片路由、瀑布流或媒体分类。

### 8.4 `MediaGallery.vue`

仅当 `display === 'card'` 且资产为图片时使用 `JournalProgressiveImage`：

- 多图网格继续使用已有固定比例；
- 单图复用当前 `preserveAssetRatio()`，历史补齐后 Web 图片也能稳定获得 `asset.width / asset.height`；
- 贴纸继续使用 `contain`；
- 原图的 `loading="lazy"` 保持不变；
- 音频和文件分支不变；视频只增加单项加载态组件，不改变媒体分类、控件或尺寸规则；
- `+N` 折叠遮罩仍位于图片两层之上。

卡片视频不生成后端模糊预览，也不改变 `preload="metadata"`：媒体位置从一开始就由现有宽高比占住，视频元素在原生 `loadeddata` 前保持透明，首帧可用后只通过短暂 `opacity` 过渡淡入。这样所有视觉媒体都有平滑接管过程，但只有图片执行真正的 Blur-up。

这段视频状态放入新增的 `web/src/components/ui/JournalProgressiveVideo.vue`，组件只管理单个视频的 `loading`、`loaded`、`error` 三态；`MediaGallery.vue` 仍只负责媒体分类、排列和样式参数。视频失败时恢复可见以暴露浏览器原生错误，不保留底板伪装成功。

详情模式继续直接使用原图。用户打开详情前，信息流原图通常已经进入浏览器缓存；这里不额外复制另一套详情过渡状态。

### 8.5 `ArticleCardContent.vue`

仅 `display === 'summary'` 的文章封面使用渐进图片：

- 使用补齐后的封面宽高设置 `aspect-ratio`，避免封面出现前卡片高度变化；
- 外层按钮仍负责打开文章，图片组件不处理点击；
- `display === 'full'` 的文章阅读封面保持当前原图渲染。

### 8.6 `JournalMediaStage.vue`

- 当前正在展示的详情主图仍使用原图，不改变自适应弹层和移动端比例逻辑；
- 多媒体底部的图片缩略导航改用 `previewUrl`，避免为了 46px 缩略格下载完整原图；
- 视频缩略标识、切换逻辑和主媒体入场效果不变。

### 8.7 不调整的组件

- `RichArticleRenderer.vue`：首版不修改 TipTap 生成的行内图片节点；
- `ArticleMediaPanel.vue`：管理端上传预览不是首页高频路径；

`FeedView.vue` 只删除已经不再展示的 `loadingLabel` 计算和传参，继续向 `WaterfallFeed.vue` 传入条目及首次/替换加载状态，不持有占位卡片细节。

## 9. 请求时序

首次进入或整批替换信息流时：

```text
页面立即渲染静态占位瀑布流
        │
        └─ 请求信息流数据
              └─ 挂载真实卡片，但保持透明且不可交互
                    ├─ Masonry 计算真实位置
                    └─ 可见媒体开始请求预览与原资源
                          └─ renderComplete
                                ├─ 真实瀑布流淡入
                                └─ 占位瀑布流淡出
```

真实图片卡片进入浏览器加载范围后：

```text
浏览器同时请求 previewUrl 与 url
        │
        ├─ 小型 WebP 先完成
        │    └─ 放大、模糊并铺满既定图片区域
        │
        └─ 原图继续下载和解码
             └─ 原生 load
                  └─ Vue 切换 loaded class
                       ├─ 清晰原图淡入
                       └─ 预览图淡出
```

两项请求并行，不能等缩略图完成后才开始原图，否则会人为增加原图完成时间。

真实视频卡片进入加载范围后，媒体底板保持当前尺寸，视频首帧触发原生 `loadeddata` 后再淡入；不显示浏览器原生的空白加载闪烁，也不额外生成视频预览文件。

## 10. 性能与资源影响

### 10.1 服务端

- 新图片入库多一次 64px WebP 转换；相对于 Telegram 下载和 20MB 上限，新增耗时可控。
- 历史补生成严格串行，避免多图同时解码冲击 512MB 容器限制。
- 不常驻图片工作线程，不增加队列与后台进程。
- 预览文件体积很小，对现有磁盘与 rclone 备份增量有限。

### 10.2 浏览器

- 首次请求期间只渲染一组固定的轻量占位 DOM，不启动 Masonry、不读取布局、不执行循环动画。
- 每张可见图片增加一个很小的预览请求；原图请求数量不变。
- 预览和原图均受现有懒加载范围控制，不提前请求整页所有图片。
- 提前使用宽高比占位，可以减少瀑布流重排和视觉跳动。
- Blur-up 只过渡两层图片的透明度；模糊和缩放固定在 64px 预览层，不对原图做高成本滤镜动画。

## 11. 错误语义

遵循项目“不做兜底”的约束：

- 新图片无法生成预览：整次 Telegram 记录或文章图片写入失败；
- 历史图片无法处理：数据升级失败，Journal 新版本不进入服务状态；
- 预览接口找不到派生文件：直接返回错误，不改为返回原图；
- 原图前端加载失败：浏览器直接暴露失败状态，不用预览图长期伪装成功；
- 不捕获错误后继续，不生成默认占位图片，不保留只有原图的新资产。

## 12. 发布顺序

一次发布内按以下顺序发生：

1. 新镜像包含 `sharp`、数据库迁移、预览服务、预览路由和前端组件；
2. 新容器打开数据库后增加 `preview_relative_path`；
3. 在 HTTP 服务可用前顺序补齐历史图片；
4. 历史资产全部完成后开始提供新版 API 与页面；
5. 之后 Telegram 采集和文章上传在各自事务主路径中直接生成预览。

不需要修改 OpenResty、1Panel、rclone、宿主机软件或现有域名配置。

## 13. 实施文件范围

### 13.1 新增

| 文件 | 职责 |
| --- | --- |
| `src/journal-server/imagePreview.ts` | 使用 sharp 读取元数据并生成 64px WebP |
| `web/src/components/journal/JournalWaterfallPlaceholder.vue` | 数据返回前立即展示静态占位瀑布流 |
| `web/src/components/ui/JournalProgressiveImage.vue` | 预览图与原图的 Blur-up 展示 |
| `web/src/components/ui/JournalProgressiveVideo.vue` | 卡片视频首帧准备完成后的透明度接管 |

### 13.2 修改

| 文件 | 修改 |
| --- | --- |
| `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml` | 引入并锁定 sharp，允许其原生安装脚本 |
| `src/journal-server/migrations.ts` | 增加 `preview_relative_path` 与唯一索引 |
| `src/journal-server/storage.ts` | 生成预览目标路径、解析安全绝对路径、删除原图与预览 |
| `src/journal-server/ingest.ts` | Telegram 原图下载后生成预览 |
| `src/journal-server/articleService.ts` | Web 图片生成预览、保存宽高、成对删除 |
| `src/journal-server/repository.ts` | 读写预览路径、历史待处理查询、API 映射 |
| `src/journal-server/types.ts` | 服务端资产输入和访问类型增加预览字段 |
| `src/journal-server/server.ts` | HTTP 可用前完成历史预览补生成 |
| `src/journal-server/routes/media.ts` | 新增受鉴权保护的预览读取路由 |
| `src/shared/journalProtocol.ts` | `JournalAsset` 增加 `previewUrl`，文章上传响应保持现状 |
| `web/src/types.ts` | 同步 `previewUrl` |
| `web/src/components/journal/FeedView.vue` | 删除居中信息流 Loading 的文案计算和传参 |
| `web/src/components/journal/WaterfallFeed.vue` | 用占位瀑布流替换居中 Loading，并在 `renderComplete` 后交叉淡化真实瀑布流 |
| `web/src/components/journal/MediaGallery.vue` | 信息流普通图片接入渐进图片组件 |
| `web/src/components/journal/JournalMediaStage.vue` | 详情缩略导航改用低清预览，主媒体逻辑不变 |
| `web/src/components/article/ArticleCardContent.vue` | 信息流文章封面接入渐进图片组件 |

不修改 Telegram bot 消息交互、Journal 路由结构、信息流分页、详情弹层尺寸与布局、OpenResty 和备份脚本。

## 14. 验收清单

1. 冷启动、刷新和筛选替换时不再出现居中的“正在整理记录”或中间空白，首帧直接呈现占位瀑布流。
2. 占位瀑布流没有文字提示、Spinner、扫光或循环动画，并同时适配浅色与深色主题。
3. 真实条目不会以纵向列表短暂露出；Masonry 完成后与占位层自然交叉淡化。
4. 首屏和继续加载出来的普通图片都会先显示模糊缩略图，再平滑变清晰。
5. 卡片视频在首帧可用前保持稳定媒体底板，准备完成后平滑淡入。
6. 公开信息流与个人资产信息流效果一致。
7. 单图、多图网格、`+N` 折叠卡片和文章封面都不因图片加载改变卡片高度。
8. 贴纸保持 `contain`，普通照片保持 `cover`，现有裁切策略不变。
9. 原图加载完成后，模糊层完全不可见且不拦截点击。
10. 减少动态效果模式下不执行长过渡。
11. 公开缩略图可访问，私有缩略图在未登录状态下不可访问。
12. 新 Telegram 图片和新文章图片在入库时同时拥有预览。
13. 历史图片全部拥有预览，Web 历史图片同时补齐可用宽高。
14. 删除普通记录会同时移除目录中的所有预览。
15. 删除、替换文章封面或行内图片会同时移除原图与预览。
16. 语音、文件、详情主媒体和富文本正文保持现有行为；详情图片缩略导航使用低清预览。
17. 备份继续覆盖原图、缩略图和数据库，不增加另一套备份任务。

## 15. 推荐首版决策

建议按本文默认值直接实施：

1. `sharp 0.35.3`；
2. 64px、质量 35、WebP；
3. 首屏和整批替换使用静态占位瀑布流，不再显示 canvas 版居中 Loading；
4. 后端为所有受支持的图片资产生成预览；
5. 前端 Blur-up 只消费信息流普通图片和文章封面，详情缩略导航直接消费预览图但不增加 Blur-up 动画；
6. 卡片视频不生成封面，只在首帧可用后淡入；
7. 历史图片在新版服务开放前一次性完整补齐；
8. 不做多尺寸图片、不引入图片服务或后台任务。

这套范围同时解决“数据回来前只有居中 Loading”和“真实媒体随后突然出现”两个阶段的问题，同时保持当前个人项目的单机结构和清晰主路径。
