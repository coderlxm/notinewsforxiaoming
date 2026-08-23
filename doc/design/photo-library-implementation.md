# 照片墙开发实施文档

## 1. 文档定位

本文将 [photo-library.md](./photo-library.md) 中已经确定的产品与技术方向拆解为可直接执行的开发任务，覆盖内容约定、服务端索引与图片处理、公共接口、Vue 页面、宿主机同步、发布资产和验收场景。

本文只描述后续实施，不代表功能已经存在，也不修改 Google Drive、rndc02 或线上服务。

### 1.1 证据边界

- 产品定位、页面结构、Drive 根目录、同步语义、动画与图库选型来自指定调研文档。
- 当前路由、公共页面外壳、局部滚动容器、图片组件、Journal 服务启动方式、Docker 挂载和 GitHub Actions 发布路径来自 2026-08-23 的当前源码。
- `notinews-drive:`、自有 OAuth 客户端、当前 `drive.file` 授权和 rndc02 现有挂载状态沿用调研文档中记录的 2026-08-22 部署事实。
- 第三方 API 以 2026-08-23 的公开资料和本地已安装包声明为准；实施时不得把尚未安装的依赖写成当前事实。

## 2. 交付目标

### 2.1 用户可见结果

- 公开侧边栏在“兴趣”后新增“照片墙”，桌面端位于“关于我”上方。
- 移动端公共底部导航由四栏变为五栏，照片墙拥有独立选中态。
- `/photos` 展示近期精选照片的连续横向作品带和按最新拍摄时间排列的相册。
- `/photos/:albumId` 展示相册标题、拍摄时间范围、照片数量和保持原始比例的 Justified 画廊。
- 首页精选照片和详情照片都能打开 PhotoSwipe；详情查看支持触摸、键盘切换和缩放。
- 沉浸查看底部只显示照片实际具有的标题、拍摄日期、相机、镜头、焦段、光圈、快门和 ISO。
- 已读取的首页与相册数据在当前浏览器会话内复用，路由切换只更新 `.app-scroll` 内容区。

### 2.2 内容管理结果

- Google Drive 的 `NotiNewsPhotos` 是唯一内容源，第一层子目录就是相册。
- Drive 网页中的新增、替换、重命名和删除通过约五分钟一次的单向同步反映到公开照片墙。
- Journal 只公开生成后的 WebP，不公开 Google Drive URL、宿主机源路径或原始 JPEG。
- 任意一次同步或图片处理失败都直接报错，当前已发布索引保持完整，不被半成品替换。

### 2.3 明确不做

- 不新增后台相册编辑器、上传页或数据库管理页。
- 不支持 RAW、ARW、HEIC、PNG、视频、评论、点赞、原图下载或多用户权限。
- 不增加重试、替代来源、静默跳过、默认成功或错误后的自动降级。
- 不把 Google Drive 直接暴露给浏览器。
- 不改 Telegram bot、Lu Dashboard、Journal 文章数据模型或 SQLite migration。

## 3. 当前实现基线

实施必须基于下列当前事实，不重新设计应用框架：

- Journal 前端位于 `web/`，使用 Vue 3.5、Pinia、Vue Router 5 和 Vite 8。
- `App.vue` 常驻承载顶部资料栏与公共导航；内容区在 `AppRouteViewport.vue` 的 `.app-scroll` 内独立滚动。
- Vue Router 之外还有 `AppRoute` 映射、路由 key、公开外壳判断和滚动位置恢复链，照片路由必须同时接入这几层。
- `JournalProgressiveImage.vue` 已提供模糊预览到清晰图的渐进显示，可直接用于照片墙。
- `@egjs/grid` 1.18.0 已安装并在项目中使用，本地类型声明确认导出 `JustifiedGrid`。
- `sharp` 0.35.3、`file-type` 22.0.2 和 `dayjs` 1.11.23 已安装；`file-type` 当前可用 API 为 `fileTypeFromFile`。
- `motion-v`、`photoswipe` 和 `exifreader` 尚未写入根依赖，也未出现在当前 lockfile。
- Journal 容器当前只挂载 `/opt/journal/data:/data`，OpenResty 的通用 `location /` 已能代理新的公开 API 和图片路径。
- 现有发布由 `main` push 触发 GitHub Actions，Journal image 和 host assets 上传到 rndc02，再由 `deploy/journal/deploy-release` 激活。

## 4. 总体架构

```text
Google Drive / NotiNewsPhotos
        │
        │ rclone 单向 sync，约每 5 分钟
        ▼
/opt/journal/photo-source
        │
        │ Docker 只读挂载为 /photo-source
        ▼
JournalPhotoLibraryService
  ├─ 校验两层目录与 JPEG 类型
  ├─ 提取限定 EXIF
  ├─ Sharp 生成 preview/card/view
  └─ 原子提交完整索引
        │
        ▼
/opt/journal/data/photos
        │
        ├─ GET /api/photos
        ├─ GET /api/photos/albums/:albumId
        └─ GET /media/photos/:revision/:photoId/:variant
        │
        ▼
Pinia 会话缓存 → /photos 与 /photos/:albumId → PhotoSwipe
```

Drive 负责内容真相，`photo-source` 只是宿主机同步副本，`data/photos` 只保存可重建的索引和衍生图。

## 5. 依赖与 API 定案

| 包 | 状态 | 用途与约束 |
| --- | --- | --- |
| `sharp` 0.35.3 | 已安装 | 自动旋转、读取方向后的尺寸、生成三类 WebP |
| `file-type` 22.0.2 | 已安装 | 根据文件内容确认 JPEG，不能只看扩展名 |
| `dayjs` 1.11.23 | 已安装 | 解析和格式化 EXIF 日期，不手写日期解析器 |
| `@egjs/grid` 1.18.0 | 已安装 | `JustifiedGrid` 排布详情照片，保持比例且不裁切 |
| `motion-v` 2.4.0 | 待加入 | 连续作品带、进入视口渐显、滚动关联视差和 reduced-motion |
| `photoswipe` 5.4.4 | 待加入 | 使用稳定 v5 原生包和动态加载 Core，不使用旧 Vue 包装层 |
| `exifreader` 4.43.0 | 待加入 | Node 端读取 JPEG EXIF，自带 TypeScript 声明 |

依赖声明写入根 `package.json`，同时更新 `pnpm-lock.yaml`。`motion-v` 只局部导入组件和 hooks，不注册全局插件；PhotoSwipe CSS 跟随照片功能入口加载。

Motion 的 `Ticker` 和 `Carousel` 属于 Motion+，本功能不依赖付费组件。连续作品带使用开源 `motion` 组件的线性循环、重复内容组和 `ResizeObserver` 计算距离实现；禁止使用 `useAnimationFrame`、`requestAnimationFrame` 或任何 RAF 别名。

## 6. Drive 内容契约

### 6.1 固定目录结构

```text
NotiNewsPhotos/
├── 2026 上海街头/
│   ├── DSCF1001.jpg
│   └── DSCF1002.jpeg
└── 川西/
    ├── DSCF2010.jpg
    └── DSCF2028.jpg
```

规则如下：

- 根目录中只能有相册目录，不能直接放文件。
- 相册目录只能位于第一层，照片只能直接位于相册目录内，不能再嵌套目录。
- 相册名取目录名，照片标题取文件名去掉最后一个扩展名后的内容。
- 只接受后期完成的 sRGB JPEG；扩展名仅接受大小写不敏感的 `.jpg` 和 `.jpeg`，文件内容还必须被 `file-type` 识别为 `image/jpeg`。
- 相册不得为空，根目录也必须至少存在一个可发布相册。
- 隐藏文件、快捷方式、符号链接、非 JPEG 和额外目录层级都视为内容错误，整次重建失败。
- 不修改 Drive 中的文件，也不在同步时重命名、转换或整理用户内容。

### 6.2 稳定标识

- `albumId = SHA-256(相册目录相对路径的 UTF-8 字节)`，输出完整 64 位小写十六进制字符串。
- `photoId = SHA-256(照片 POSIX 相对路径的 UTF-8 字节)`，输出完整 64 位小写十六进制字符串。
- 同一路径内容替换时 ID 不变；文件或相册重命名后产生新 ID，旧 ID 随新索引发布而失效。
- API 和图片路由只接受 ID，不接受任何文件路径或文件名作为路径参数。

### 6.3 排序与封面

- 相册内有拍摄时间的照片按拍摄时间升序排列。
- 无拍摄时间的照片排在有时间照片之后，再按文件名做稳定排序。
- 相册封面取拍摄时间最新的照片；若整个相册都没有拍摄时间，取文件名排序后的第一张。
- 相册按自身最新拍摄时间降序排列；没有任何拍摄时间的相册排在后面，再按相册名排序。
- 首页精选在所有相册中按拍摄时间降序取前 12 张；无拍摄时间的照片排在有时间照片之后，再按相册名和文件名排序。
- 12 是首版固定上限，不提供后台配置项或查询参数。

## 7. 公共数据协议

新增 `src/shared/photoLibraryProtocol.ts`，作为服务端返回值和前端 API 类型的单一来源。协议只包含公开展示需要的数据，不包含源路径、原始文件大小、原始 EXIF 对象或 GPS。

```ts
export type PhotoImageVariantName = 'preview' | 'card' | 'view';

export interface PhotoImageVariant {
  url: string;
  width: number;
  height: number;
}

export interface PhotoDisplayMetadata {
  takenAt: string | null;
  camera: string | null;
  lens: string | null;
  focalLength: string | null;
  aperture: string | null;
  shutterSpeed: string | null;
  iso: string | null;
}

export interface PhotoLibraryPhoto {
  id: string;
  albumId: string;
  title: string;
  preview: PhotoImageVariant;
  card: PhotoImageVariant;
  view: PhotoImageVariant;
  metadata: PhotoDisplayMetadata;
}

export interface PhotoAlbumSummary {
  id: string;
  name: string;
  photoCount: number;
  takenAtStart: string | null;
  takenAtEnd: string | null;
  cover: PhotoLibraryPhoto;
}

export interface PhotoLibraryOverview {
  revision: string;
  featured: PhotoLibraryPhoto[];
  albums: PhotoAlbumSummary[];
}

export interface PhotoAlbumDetail {
  revision: string;
  album: Omit<PhotoAlbumSummary, 'cover'>;
  photos: PhotoLibraryPhoto[];
}
```

`takenAt` 使用从 EXIF 拍摄时间规范化得到的 ISO 风格字符串；存在 `OffsetTimeOriginal` 时保留偏移，没有偏移时保留相机本地时间且不在前端擅自转换时区。

## 8. 服务端实施

### 8.1 配置与目录

在 `JournalServerConfig` 增加 `photoSourceDir`，由 `JOURNAL_PHOTO_SOURCE_DIR` 读取。生产 compose 固定设置为 `/photo-source`，宿主机挂载为：

```yaml
- /opt/journal/photo-source:/photo-source:ro
```

衍生数据固定存入现有 `dataDir` 下：

```text
/data/photos/
├── current.json
└── generations/
    └── <revision>/
        ├── index.json
        └── assets/
            └── <photoId>/
                ├── preview.webp
                ├── card.webp
                └── view.webp
```

`current.json` 只保存当前 revision。服务启动时读取当前 marker 和对应 `index.json`；源内容 revision 与当前一致时直接加载，不重复生成图片。

### 8.2 源内容 revision

扫描完成后按相对路径排序，为每张 JPEG 计算 SHA-256 内容摘要，再按“相对路径 + 文件摘要”生成整个照片库的 `revision`。

这样可以同时满足：

- 路径或内容任一变化都会产生新 revision。
- 定时同步没有变化时，重建入口可直接返回 `changed: false`。
- 图片 URL 包含 revision，可以使用不可变缓存，同时照片 ID 仍然只由路径稳定派生。

### 8.3 EXIF 提取

`exifreader` 只在服务端处理源 JPEG。实现建立一个明确的字段映射，不把完整 tags 序列化进索引：

| 展示字段 | EXIF 来源 |
| --- | --- |
| 拍摄日期 | `DateTimeOriginal`，同时读取 `OffsetTimeOriginal` |
| 相机 | `Make` 与 `Model`，去掉重复厂商前缀后组合 |
| 镜头 | `LensModel` |
| 焦段 | `FocalLength` |
| 光圈 | `FNumber` |
| 快门 | `ExposureTime` |
| ISO | `PhotographicSensitivity` |

每个字段缺失时保存 `null`。GPS、作者、版权、序列号、软件信息、缩略图和其他标签一律不进入公共索引。日期解析失败、字段类型不符合预期或 ExifReader 解析异常时直接让该次重建失败；JPEG 完全没有 EXIF 本身不是错误，所有展示字段可以为 `null`。

### 8.4 衍生图规格

所有衍生图先执行 `autoOrient()`，统一输出 WebP，并使用 `withoutEnlargement: true`：

| variant | 规格 | 质量 | 用途 |
| --- | --- | --- | --- |
| `preview` | 宽 64px，等比缩放 | 35 | 模糊占位 |
| `card` | 限制在 1600×1600 内，等比缩放 | 82 | 精选、相册封面、详情网格 |
| `view` | 限制在 3000×3000 内，等比缩放 | 90 | PhotoSwipe 沉浸查看 |

索引记录每个输出文件的实际宽高。PhotoSwipe 使用 `view` 的宽高，不使用源 JPEG 尺寸。Sharp 默认不把源 EXIF 写回衍生图，浏览器获得的 WebP 不携带未公开元数据。

### 8.5 原子重建流程

新增 `JournalPhotoLibraryService`，启动初始化和内部重建入口共用同一条主路径：

1. 读取 `/photo-source` 的两层目录，校验结构、扩展名和实际 MIME。
2. 计算所有文件摘要与照片库 revision。
3. revision 与当前索引一致时加载当前索引并结束，不改文件。
4. 在 `/data/photos/generations/.building-<uuid>` 创建临时生成目录。
5. 顺序处理每张照片：读取 EXIF、读取方向后尺寸、生成三种 WebP、构造公开照片对象。
6. 计算相册范围、封面、排序和精选照片，写入完整 `index.json`。
7. 将临时目录 rename 为正式 revision 目录。
8. 通过同目录临时文件 rename 原子替换 `current.json`。
9. 同步替换内存中的当前索引，再删除旧 generation。

第 8 步完成前，所有公开请求继续读取旧索引。任一步失败都抛出原始错误；只清理本次 `.building-*`，不发布部分相册，也不跳过失败照片。

### 8.6 服务启动

`createJournalServer` 创建 `JournalPhotoLibraryService` 后调用 `initialize()`：

- 当前 marker、index 与源 revision 一致时直接装载。
- 首次部署或源 revision 已变化时走完整重建。
- 源目录不存在、内容不合法或生成失败时 Journal 启动失败，让问题直接出现在容器和部署日志中。

服务不以空照片库、默认索引或禁用照片路由继续启动。首次发布前必须先完成 Drive 授权与源目录预同步。

### 8.7 路由

新增 `src/journal-server/routes/photos.ts`，由 `server.ts` 注册：

| 方法与路径 | 行为 |
| --- | --- |
| `GET /api/photos` | 返回当前 overview，`Cache-Control: public, no-cache` |
| `GET /api/photos/albums/:albumId` | 按 ID 返回相册详情；不存在时 404 |
| `GET /media/photos/:revision/:photoId/:variant` | variant 只允许 `preview/card/view`，通过当前索引解析文件；ID、revision 不匹配时 404 |
| `POST /api/internal/photos/rebuild` | 复用 `JournalAuth.requireInternal`，完成同步后的原子重建 |

图片响应使用 `image/webp`、`Content-Disposition: inline`、range 支持和 `Cache-Control: public, max-age=31536000, immutable`。因为 URL 包含 revision，内容更新后 overview 会返回新 URL；路由不得忽略 revision 后继续提供另一版本的文件。

内部重建响应只返回：

```ts
{
  changed: boolean;
  revision: string;
  albumCount: number;
  photoCount: number;
}
```

### 8.8 服务端文件边界

- `src/shared/photoLibraryProtocol.ts`：公开协议和固定枚举。
- `src/journal-server/photoLibraryService.ts`：扫描、校验、EXIF、衍生图、索引提交和查询。
- `src/journal-server/routes/photos.ts`：HTTP 参数校验、缓存头和响应映射。
- `src/journal-server/config.ts`、`types.ts`、`server.ts`：只接入新配置和服务，不改现有文章/媒体服务。

首版不增加 SQLite 表、repository、队列、任务表或额外状态机。

## 9. 前端实施

### 9.1 路由与公共外壳

`web/src/router.ts` 新增两个懒加载路由：

- `/photos`，name 为 `photos`，组件为 `PhotoLibraryView.vue`。
- `/photos/:albumId`，name 为 `photo-album`，组件为 `PhotoAlbumView.vue`，`albumId` 通过 props 传入。

同时更新：

- `AppRoute` union 和 `parseAppRoute`，albumId 只接受 64 位小写十六进制。
- `useAppRoute.publicShellActive`，让两个页面复用公共头部、搜索框和侧边栏。
- `App.vue` 的照片导航选中态和导航事件。
- `AppRouteViewport.vue` 的照片页面分支与 `layoutReady` 转发。
- `persistentFeedKey`，为 `/photos` 和每个相册保存独立 `.app-scroll` 位置。
- router 的页面标题：首页为“照片墙 · 小明同学”，详情数据加载后为“相册名 · 照片墙 · 小明同学”。

不在照片页创建新的全屏滚动容器，所有滚动动画和位置恢复都以现有 `.app-scroll` 为根。

### 9.2 公共导航

`PublicChannelNavigation.vue` 增加：

- `photosActive: boolean` prop。
- `selectPhotos` emit。
- “照片墙”按钮，位于 `journalChannels` 列表之后、“关于我”之前。
- 移动端 `grid-template-columns` 从 `repeat(4, ...)` 改为 `repeat(5, ...)`。

照片墙不是 Journal channel，不得加入 `JournalChannel` union、频道筛选、标签或 Feed API。

### 9.3 状态模型

新增 setup store `web/src/stores/photoLibrary.ts`：

- `overview` 保存成功读取的首页数据。
- `albumsById` 用 `Map<string, PhotoAlbumDetail>` 保存已读取相册。
- 首页和每个 albumId 各有一个进行中的 Promise，用于合并同一时刻的重复请求。
- `ensureOverview()` 与 `ensureAlbum(albumId)` 命中成功缓存时立即返回，不清空旧内容、不闪 skeleton。
- 请求错误写入对应显式错误状态，页面展示错误，不自动重试、不返回空数组假装成功。
- Store 生命周期跟随当前 Pinia 应用会话；不写 localStorage，也不做后台轮询。

`web/src/api.ts` 只新增 `fetchPhotoLibrary()` 和 `fetchPhotoAlbum(albumId)` 两个 GET 方法，继续使用现有 `requestJson` 错误语义。

### 9.4 组件边界

| 文件 | 单一职责 | 主要契约 |
| --- | --- | --- |
| `PhotoLibraryView.vue` | 首页数据编排与页面状态 | 无业务 props；加载后组合精选和相册区，并 emit `layoutReady` |
| `FeaturedPhotoStrip.vue` | 连续横向精选作品带 | `photos` prop；emit `openPhoto(index)` |
| `PhotoAlbumGrid.vue` | 相册卡片列表 | `albums` prop |
| `PhotoAlbumCard.vue` | 单个相册封面与摘要 | `album` prop；使用 RouterLink 进入详情 |
| `PhotoAlbumView.vue` | 单相册数据编排和标题 | `albumId` prop；组合页头与画廊，并 emit `layoutReady` |
| `PhotoJustifiedGallery.vue` | `JustifiedGrid` 生命周期和 PhotoSwipe 入口 | `photos` prop；布局完成时 emit `layoutReady` |
| `PhotoGalleryItem.vue` | 单张照片的比例、渐进图和滚动动画 | `photo`、`scrollRoot` props；emit `open` |
| `usePhotoLightbox.ts` | PhotoSwipe 实例、dataSource、caption 注册和销毁 | 接收只读照片数组，暴露 `open(index)` 与 `destroy()` |

路由 view 只负责数据和组合，不承载连续滚动算法、JustifiedGrid 实例或 PhotoSwipe DOM 操作。

### 9.5 首页布局

首页宽度继续使用公共 workspace/page gutter 变量，分为：

1. 页面标题与简短说明。
2. 近期精选横向作品带。
3. 相册卡片区。

精选作品带：

- 每张图设置统一视觉高度，宽度按 `card.width / card.height` 计算，因此不裁切。
- 动画状态下渲染两个完全相同的内容组，`ResizeObserver` 测得第一组宽度后，由 `useAnimate` 将轨道从 0 线性移动到负的一组宽度。
- 动画 duration 由距离和固定速度 28px/s 计算，`repeat: Infinity`、`ease: linear`，循环点两组内容完全重合，不出现跳缝。
- 保存 `useAnimate` 返回的 playback controls；指针悬停或轨道内获得键盘焦点时调用 `pause()`，离开后调用 `play()`，从当前位置继续。
- 点击照片打开以当前 12 张精选为 dataSource 的 PhotoSwipe。
- reduced-motion 下只渲染一组静态、可横向浏览的照片，不启动自动移动。

相册卡片：

- 封面容器使用真实宽高比，不固定裁切比例。
- 卡片文字只放在图片下方，显示相册名、照片数和实际存在的日期范围。
- 整张卡片使用 RouterLink，保留浏览器标准打开方式和键盘操作。

### 9.6 相册详情布局

`PhotoJustifiedGallery.vue` 使用本地已解析的 `JustifiedGrid`：

- `gap: 10`。
- `columnRange: [1, 5]`。
- `sizeRange: [160, 320]`。
- `isCroppedSize: false`。
- `stretch: false`。
- `passUnstretchRow: true`。
- `useResizeObserver: true`、`observeChildren: true`、`useTransform: true`。

每个网格 item 使用两层结构：外层只交给 `JustifiedGrid` 设置定位 transform，内层才交给 Motion 做 opacity 和 y 变化，避免两个库争用同一个 `transform`。比例维护目标标记在内层图片表面，初始 aspect-ratio 直接来自 API，图片加载前布局就已稳定。

组件在挂载后创建 grid 并调用布局；`renderComplete` 时通知 route view 恢复滚动位置；卸载时解绑事件并销毁 grid。相册数据在 view 挂载前已经固定，因此不为照片数组增加 watch。

### 9.7 滚动动画

- `PhotoGalleryItem.vue` 使用 `motion` 的 `whileInView` 做一次性渐显与轻微错层，观察根是 `.app-scroll`。
- 奇偶照片只在内层使用相反方向的小幅 y 偏移，最大不超过 18px。
- `useScroll({ container, target })` 和 `useTransform` 只映射轻微视差，不改变布局尺寸。
- `useReducedMotion()` 为 true 时，初始 opacity 直接为 1、y 为 0，并关闭视差。
- 不增加全局滚动 listener，不使用 RAF，不通过 Vue 响应式状态逐帧写 style。

### 9.8 渐进图片

复用 `JournalProgressiveImage.vue`：

- `previewSrc` 使用 `preview.url`。
- 首页和网格的 `src` 使用 `card.url`。
- 精选首屏前几张使用 eager，其余照片和所有相册卡片使用 lazy。
- `fit` 可继续传 `cover`，但容器宽高比与照片相同，因此不会发生实际裁切。
- alt 使用照片标题；相册详情同时提供屏幕阅读器可访问的标题信息。

不为照片墙复制另一套模糊加载组件。

### 9.9 PhotoSwipe

`usePhotoLightbox.ts` 使用稳定 v5 原生 API：

- Lightbox 从 `photoswipe/lightbox` 导入。
- Core 通过 `pswpModule: () => import('photoswipe')` 在首次打开时动态加载。
- dataSource 使用 `view.url`、`view.width`、`view.height`、`card.url` 和 title。
- 每次打开使用数组 index，不把源路径放入 DOM dataset。
- 在 `uiRegister` 注册底部 caption；slide change 时用 DOM `textContent` 构造标题和元数据节点，不拼接 EXIF HTML。
- caption 按固定顺序过滤 `null` 字段；没有值的字段不渲染标签或占位符。
- 页面本身仍保留可访问的照片标题，不能只依赖 Lightbox caption。
- route view 卸载时调用 `destroy()`，避免保留键盘、触摸或窗口事件。

不新增下载按钮，不向 PhotoSwipe 提供源 JPEG URL。

## 10. 宿主机同步与发布资产

### 10.1 一次性 Drive 授权调整

调研记录的当前 remote 是 `notinews-drive:`，已有自有 OAuth 客户端但 scope 为 `drive.file`。实施前在 rndc02 将 remote 的 `scope` 更新为 `drive.readonly` 并完成新的 OAuth 授权，使 rclone 能列出和下载 Drive 网页创建的 `NotiNewsPhotos` 内容。

此操作只改变读取范围，不授予 rclone 上传、重命名或删除 Drive 文件的能力。Google 将 `drive.readonly` 定义为查看和下载所有 Drive 文件；rclone 也明确说明 `drive.file` 看不到其他方式创建的文件。

### 10.2 同步脚本

新增 `scripts/journal-photo-sync`，固定主路径：

1. 使用 root 现有的 rclone config。
2. 将 `notinews-drive:NotiNewsPhotos` 单向 sync 到 `/opt/journal/photo-source`。
3. 显式设置 `--retries 1 --low-level-retries 1`，关闭 rclone 默认的多次重试。
4. 保留 rclone 默认的 delete-after 语义：新文件全部传输成功后才删除本地已不存在的源文件。
5. rclone 成功后从 `/opt/journal/.env` 读取现有 `JOURNAL_INGEST_TOKEN`。
6. 调用本机 `POST http://127.0.0.1:3100/api/internal/photos/rebuild`。

脚本使用 `set -euo pipefail`。rclone 或 HTTP 任一步失败时 oneshot service 失败并进入 systemd 日志；脚本不重试、不继续、不改当前公开索引。

### 10.3 systemd

新增：

- `deploy/journal/journal-photo-sync.service`
- `deploy/journal/journal-photo-sync.timer`

service 为 root oneshot，依赖 `network-online.target` 和 Docker，执行 `/usr/local/sbin/journal-photo-sync`。timer 使用约五分钟周期，禁止并行启动同一 oneshot。timer 只负责周期调度，不承担错误恢复逻辑。

### 10.4 发布脚本与工作流

修改 `deploy/journal/deploy-release`：

- host assets 安装阶段创建 `/opt/journal/photo-source`，权限允许容器只读访问。
- 安装同步脚本、service 和 timer。
- `daemon-reload` 后 enable timer，在新 Journal 容器成功启动后启动 timer。
- compose 变更与其他 host assets 一样由现有 `--install-host-assets` 路径落盘。

修改 `.github/workflows/deploy.yml`：

- Journal path filter 加入 `scripts/journal-photo-sync`。
- Journal host archive 加入同步脚本、service 和 timer。

修改 `deploy/journal/compose.yaml`：

- 新增 `/opt/journal/photo-source:/photo-source:ro`。
- 新增 `JOURNAL_PHOTO_SOURCE_DIR=/photo-source`。

无需修改 OpenResty 配置：公共照片 API 和媒体请求已由 `location /` 代理；内部重建路径也已命中现有 private/no-store 规则。无需修改 Journal Dockerfile：根依赖安装、`src/journal-server` 和 `src/shared` 已包含新服务所需文件。

### 10.5 备份边界

- `/opt/journal/photo-source` 不进入 Journal backup，因为 Drive 是内容源。
- 衍生图和索引位于现有 `/opt/journal/data`，首版沿用当前 backup/restore 行为，不新增第二套备份脚本。
- 恢复后的衍生图仍会在下一次成功同步后按当前 Drive 内容整体重建。

## 11. 首次发布顺序

首次上线必须按以下依赖顺序进行，避免新容器在没有合法照片源时启动：

1. 在 Drive 创建非空 `NotiNewsPhotos` 和至少一个符合契约的相册。
2. 在 rndc02 完成 `drive.readonly` 的重新授权。
3. 在宿主机预先形成完整 `/opt/journal/photo-source` 同步副本。
4. 完成服务端、前端和 host assets 代码实现，形成符合项目格式的一次发布提交。
5. push 到 `main`，沿用现有 GitHub Actions 自动发布路径。
6. 新容器启动时生成或装载首个完整索引；容器成功后启用周期同步。
7. 后续只在 Drive 管理相册和照片，不直接改宿主机源目录或 `/data/photos`。

本文档交付本身不进入发布阶段，也不执行以上外部操作。

## 12. 文件变更清单

### 12.1 新增文件

```text
src/shared/photoLibraryProtocol.ts
src/journal-server/photoLibraryService.ts
src/journal-server/routes/photos.ts
web/src/stores/photoLibrary.ts
web/src/composables/usePhotoLightbox.ts
web/src/components/photos/PhotoLibraryView.vue
web/src/components/photos/FeaturedPhotoStrip.vue
web/src/components/photos/PhotoAlbumGrid.vue
web/src/components/photos/PhotoAlbumCard.vue
web/src/components/photos/PhotoAlbumView.vue
web/src/components/photos/PhotoJustifiedGallery.vue
web/src/components/photos/PhotoGalleryItem.vue
scripts/journal-photo-sync
deploy/journal/journal-photo-sync.service
deploy/journal/journal-photo-sync.timer
```

### 12.2 修改文件

```text
package.json
pnpm-lock.yaml
src/journal-server/types.ts
src/journal-server/config.ts
src/journal-server/server.ts
web/src/types.ts
web/src/api.ts
web/src/router.ts
web/src/app/appRouteTypes.ts
web/src/app/appRoute.ts
web/src/composables/useAppRoute.ts
web/src/App.vue
web/src/components/app/AppRouteViewport.vue
web/src/components/journal/PublicChannelNavigation.vue
deploy/journal/compose.yaml
deploy/journal/deploy-release
.github/workflows/deploy.yml
```

### 12.3 明确不改

```text
src/reminders/recurring.ts
src/journal-server/migrations.ts
src/journal-server/repository.ts
web/vite.config.ts
deploy/journal/Dockerfile
deploy/journal/feeds.xmcloud.buzz.conf
scripts/journal-backup
scripts/restore-journal
```

## 13. 开发阶段拆分

### 阶段 A：协议与照片处理主路径

- 增加三项依赖和共享协议。
- 完成配置、目录扫描、JPEG 校验、ID、revision、EXIF 映射和三类衍生图。
- 完成 generation 与 current marker 的原子提交。
- 完成服务启动装载和内部重建入口。

阶段完成条件：一个合法源目录能生成完整索引；任意非法文件会使整个重建失败，旧 current 不变。

### 阶段 B：公共接口

- 完成 overview、album detail 和固定 variant 图片路由。
- 完成参数 schema、404、缓存头和当前 revision 约束。
- 保证所有图片都只能经索引中的 photoId 解析。

阶段完成条件：公开响应不含源路径、原图 URL、GPS 或未选中的 EXIF。

### 阶段 C：Vue 页面与交互

- 接入两级路由、AppRoute、公共外壳、导航和滚动恢复。
- 完成 Pinia 缓存、首页、相册卡片和 Justified 详情。
- 完成 Motion 动画、reduced-motion 和 PhotoSwipe caption。

阶段完成条件：框架常驻、局部加载、操作即时反馈、已加载状态复用形成一条完整主路径。

### 阶段 D：同步与发布资产

- 完成宿主机脚本、systemd unit、compose 挂载、deploy-release 安装和 workflow 打包。
- 保持现有 Journal 镜像发布方式和服务器对应关系不变。

阶段完成条件：一次成功 rclone sync 只触发一次重建；同步或重建失败直接使 service 失败。

### 阶段 E：首次上线

- 先完成 Drive 内容与授权，再准备宿主机源目录。
- 形成完整发布提交后按现有 main push 流程部署。
- 观察真实 Journal workflow、容器日志和照片同步 service；若失败，只根据真实根因修改并重新发布。

## 14. 验收场景

### 14.1 导航与页面生命周期

- 桌面端顺序为“生活、文章、兴趣、照片墙”，关于我仍固定在底部。
- 移动端五栏宽度一致，照片首页和详情都保持照片墙选中态。
- 从首页进入相册、返回首页后，已加载数据和首页滚动位置恢复，不重新闪现整个框架。
- 相册 A 进入相册 B 时展示 B 的数据，不残留 A 的标题或照片；返回已读相册时直接复用缓存。

### 14.2 图片与动画

- 横图、竖图和方图在精选、封面、详情和 PhotoSwipe 中都保持原始比例。
- 精选轨道连续循环，循环边界无跳缝；hover、focus 和 reduced-motion 行为符合约定。
- 详情动画跟随 `.app-scroll`，外层 grid 定位与内层 Motion transform 不冲突。
- 模糊预览先稳定占位，清晰卡片图加载后渐进替换，PhotoSwipe 使用 view 尺寸。
- PhotoSwipe 支持桌面键盘、移动触摸、缩放和关闭，离开路由后不保留事件。

### 14.3 元数据

- 标题始终来自文件名去扩展名。
- 有 EXIF 的照片只展示实际字段；没有 EXIF 的照片只展示标题。
- GPS、序列号、作者、版权和源路径不出现在 API、HTML 或衍生 WebP 中。
- 日期缺失的照片按约定排在相册末尾，但不会挤掉有日期照片的“最新封面”判断。

### 14.4 Drive 变更

- 新增相册或照片后，新 revision 同时发布索引和全部衍生图。
- 同路径替换 JPEG 后 photoId 不变、revision 和图片 URL 改变。
- 重命名相册或照片后 ID 改变，旧 ID 不再由当前 API 提供。
- 删除相册或照片后，新索引不再引用它，旧 generation 在提交成功后删除。
- 非 JPEG、空相册或多层目录导致重建失败，当前公开版本保持原样且日志明确指出具体相对路径。

### 14.5 发布与运行

- Journal compose 只读挂载源目录，容器不能修改 Drive 同步副本。
- 定时同步没有内容变化时返回 `changed: false`，不重复处理图片。
- rclone、OAuth、JPEG 解析、Sharp 或内部 HTTP 失败时 systemd service 为失败状态，不报告成功。
- 新代码仍通过既有 `main → GitHub Actions → rndc02` 路径发布，不产生第二套部署方案。

## 15. 完成定义

照片墙功能只有在以下条件同时满足时才算开发完成：

- Drive 内容契约、稳定 ID、排序、EXIF 白名单和衍生图规格全部按本文实现。
- 服务端只通过完整索引公开图片，失败不会覆盖当前版本。
- 两个公开路由完整接入 AppRoute、公共外壳、导航和滚动恢复。
- 首页、详情、PhotoSwipe 与 reduced-motion 构成连续可用的主路径。
- 同步脚本、systemd、compose、deploy-release 和 workflow 属于同一批发布变更。
- 没有新增重试、fallback、静默跳过、原图出口、后台编辑器或无关抽象。

## 16. 资料依据

- [指定调研文档](./photo-library.md)
- [Motion for Vue](https://motion.dev/docs/vue)
- [Motion for Vue：滚动动画](https://motion.dev/docs/vue-scroll-animations)
- [Motion for Vue：useScroll](https://motion.dev/docs/vue-use-scroll)
- [Motion for Vue：useReducedMotion](https://motion.dev/docs/vue-use-reduced-motion)
- [Motion for Vue：useAnimate](https://motion.dev/docs/vue-use-animate)
- [PhotoSwipe Getting Started](https://photoswipe.com/getting-started/)
- [PhotoSwipe Data Sources](https://photoswipe.com/data-sources/)
- [PhotoSwipe Caption](https://photoswipe.com/caption/)
- [ExifReader](https://www.npmjs.com/package/exifreader)
- [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [rclone Google Drive](https://rclone.org/drive/)
- [rclone sync](https://rclone.org/commands/rclone_sync/)
- [rclone config reconnect](https://rclone.org/commands/rclone_config_reconnect/)
