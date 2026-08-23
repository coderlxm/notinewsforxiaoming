# 照片墙开发实施文档

## 1. 文档定位

本文将 [photo-library.md](./photo-library.md) 中已经确定的产品与视觉方向拆解为可直接执行的开发任务，覆盖 Drive 内容约定、服务端索引与实时图片代理、公共接口、Vue 页面、授权准备、发布范围和验收场景。

用户在 2026-08-23 进一步确认：照片不得在 rndc02 持久化为源文件副本或衍生图，国内访问者也不得直接连接 Google。本文据此替换原调研中的“rclone 落盘同步 + 预生成 WebP”数据链路；两份文档发生冲突时，后续实施以本文为准。

本文描述后续代码实施，并同步记录已经完成的 Drive 实施前准备。照片墙功能尚未存在；当前只完成 Drive 授权、目录和验收内容准备，尚未把照片配置写入 Journal，也未修改线上 Journal 服务。

### 1.1 证据边界

- 产品定位、页面结构、Drive 根目录、动画与图库选型来自指定调研文档。
- “宿主机不持久化任何照片文件、浏览器不直连 Google”来自用户在调研后的明确约束。
- 当前路由、公共页面外壳、局部滚动容器、图片组件、Journal 服务启动方式、Docker 挂载和 GitHub Actions 发布路径来自 2026-08-23 的当前源码。
- 2026-08-23 已在 rndc02 使用现有自有 OAuth 客户端重新完成授权；Google tokeninfo 返回的实际 scope 为 `drive.readonly`，`notinews-drive:` 可以只读列举 `NotiNewsPhotos`。后续 Journal 新链路不在运行时依赖 rclone remote。
- Drive 的媒体流、图片元数据、OAuth 范围和 OpenResty 缓冲行为以 2026-08-23 的官方资料为准。
- 第三方依赖状态以 2026-08-23 的当前 `package.json`、lockfile 和公开包信息为准；待加入的包不得写成当前已安装事实。

### 1.2 已完成的实施前准备

截至 2026-08-23，Drive 侧开发条件已经就绪：

- Google Drive 已创建唯一照片根目录 `NotiNewsPhotos`，固定 folderId 为 `1TswxfDr5IhcLLXQ_soMSmBN0UEQoHs1U`。
- rndc02 上的现有 OAuth grant 已由 `drive.file` 调整为 `drive.readonly`，并已确认能够只读发现和列举该根目录。
- 根目录下已创建 `验收样片` 相册，没有把照片直接放在根目录。
- 相册内已有横图 `unsplash-mountain-lake.jpg`（1800×1112）和竖图 `unsplash-city-street.jpg`（1400×2100），可直接覆盖首页、相册详情和 PhotoSwipe 的首轮验收。
- 两张样片分别来自 Unsplash 的 [山景横图](https://unsplash.com/photos/landscape-photography-of-mountain-and-lake-EKIyHUrUHWU) 和 [城市竖图](https://unsplash.com/photos/city-street-during-day-5Rb7pMMNYbk)；上传通过用户登录的 Google Drive 网页完成，没有扩大服务端 OAuth 的只读权限。
- rndc02 没有建立照片同步目录，也没有持久化这两张源图或其衍生图。

代码实施时只需把现有 OAuth client ID、client secret、refresh token 和上述 folderId 接入 Journal 的四个环境变量；不需要再次调整授权范围或重新准备验收相册。

## 2. 交付目标

### 2.1 用户可见结果

- 公开侧边栏在“兴趣”后新增“照片墙”，桌面端位于“关于我”上方。
- 移动端公共底部导航由四栏变为五栏，照片墙拥有独立选中态。
- `/photos` 展示近期精选照片的连续横向作品带和按最新拍摄时间排列的相册。
- `/photos/:albumId` 展示相册标题、拍摄时间范围、照片数量和保持原始比例的 Justified 画廊。
- 首页精选照片和详情照片都能打开 PhotoSwipe；详情查看支持触摸、键盘切换和缩放。
- 沉浸查看底部只显示照片实际具有的标题、拍摄日期、相机、镜头、焦段、光圈、快门和 ISO。
- 已读取的首页与相册数据在当前浏览器会话内复用，路由切换只更新 `.app-scroll` 内容区。
- 浏览器只请求 `feeds.xmcloud.buzz` 的同源接口和图片 URL，不请求任何 Google 域名。

### 2.2 内容管理结果

- Google Drive 的 `NotiNewsPhotos` 是唯一照片内容源，第一层子目录就是相册。
- Journal 使用 Drive API 元数据在内存中建立公开索引；索引超过五分钟后，由下一次首页或相册请求同步刷新。
- 图片请求由 Journal 通过 Drive API 实时取得 JPEG 流，在内存中生成对应 WebP 后直接返回浏览器。
- rndc02 不保存源 JPEG、Drive 同步副本、WebP 衍生图或照片缩略图；现有 `/data` 持久卷不承载照片墙图片。
- Journal 不公开 Drive fileId、Google URL、OAuth 信息、GPS 或原始 JPEG 下载入口。
- Drive 索引刷新、媒体读取或 Sharp 转换失败时直接报错，不返回旧索引、默认图片或替代来源假装成功。

### 2.3 明确不做

- 不新增后台相册编辑器、上传页或数据库管理页。
- 不支持 RAW、ARW、HEIC、PNG、视频、评论、点赞、原图下载或多用户权限。
- 不增加重试、替代来源、静默跳过、默认成功或错误后的自动降级。
- 不把 Google Drive、`thumbnailLink`、`webContentLink` 或 Google 重定向暴露给浏览器。
- 不在宿主机同步、挂载或缓存照片文件，不预生成衍生图。
- 不改 Telegram bot、Lu Dashboard、Journal 文章数据模型或 SQLite migration。

## 3. 当前实现基线

实施必须基于下列当前事实，不重新设计应用框架：

- Journal 前端位于 `web/`，使用 Vue 3.5、Pinia、Vue Router 5 和 Vite 8。
- `App.vue` 常驻承载顶部资料栏与公共导航；内容区在 `AppRouteViewport.vue` 的 `.app-scroll` 内独立滚动。
- Vue Router 之外还有 `AppRoute` 映射、路由 key、公开外壳判断和滚动位置恢复链，照片路由必须同时接入这几层。
- `JournalProgressiveImage.vue` 已提供模糊预览到清晰图的渐进显示，可直接用于照片墙。
- `@egjs/grid` 1.18.0 已安装并在项目中使用，本地类型声明确认导出 `JustifiedGrid`。
- `sharp` 0.35.3 和 `dayjs` 1.11.23 已安装；图片实时转换继续复用当前 Sharp。
- `file-type` 22.0.2 虽已安装，但新链路以 Drive `mimeType` 和 Sharp 解码结果为准，不为照片墙调用本地文件 API。
- `motion-v`、`photoswipe` 和 `googleapis` 尚未写入根依赖，也未出现在当前 lockfile；`exifreader` 不再需要。
- Journal 容器当前挂载 `/opt/journal/data:/data`；该挂载继续服务现有 Journal 数据，但照片墙不在其中写入图片或索引。
- 当前 OpenResty 通用 `location /` 已代理 Journal，且没有忽略上游 `X-Accel-Buffering` 响应头。
- 现有发布由 `main` push 触发 GitHub Actions，Journal image 上传到 rndc02，再由 `deploy/journal/deploy-release` 激活。

## 4. 总体架构

索引链路：

```text
Google Drive / NotiNewsPhotos
        │
        │ Drive files.list，只读取目录、校验值和 imageMediaMetadata
        ▼
JournalPhotoLibraryService
        │
        ├─ 校验两层目录与 JPEG MIME
        ├─ 生成公开 ID、排序、相册和精选摘要
        └─ 原子替换进程内只读索引
        │
        ├─ GET /api/photos
        └─ GET /api/photos/albums/:albumId
```

图片链路：

```text
国内访问者
        │
        │ GET https://feeds.xmcloud.buzz/media/photos/...
        ▼
Journal 同源图片接口
        │
        │ 服务端 files.get({ alt: 'media' })
        ▼
Google Drive JPEG Readable stream
        │
        │ Sharp 内存流：autoOrient → resize → WebP
        ▼
Journal → OpenResty 无缓冲转发 → 访问者浏览器
```

浏览器与 Google 之间没有连接、重定向或第三方图片地址。Google 连接只发生在 rndc02 上。整个链路不创建源文件、临时照片文件或 WebP 文件；宿主机仅保留既有服务数据、OAuth 配置和普通日志。

## 5. 依赖与 API 定案

| 包 | 状态 | 用途与约束 |
| --- | --- | --- |
| `sharp` 0.35.3 | 已安装 | 从 Drive Readable stream 自动旋转、等比缩放并把 WebP 直接写入 HTTP 响应 |
| `dayjs` 1.11.23 | 已安装 | 解析和格式化 Drive `imageMediaMetadata.time`，不手写日期解析器 |
| `@egjs/grid` 1.18.0 | 已安装 | `JustifiedGrid` 排布详情照片，保持比例且不裁切 |
| `googleapis` 176.0.0 | 待加入 | 官方 Node.js 客户端，管理 OAuth2、Drive v3 元数据请求和媒体 Readable stream |
| `motion-v` 2.4.0 | 待加入 | 连续作品带、进入视口渐显、滚动关联视差和 reduced-motion |
| `photoswipe` 5.4.4 | 待加入 | 使用稳定 v5 原生包和动态加载 Core，不使用旧 Vue 包装层 |

依赖声明写入根 `package.json`，同时更新 `pnpm-lock.yaml`。不加入 `exifreader`，因为展示所需字段由 Drive `imageMediaMetadata` 提供；不加入另一套 HTTP、OAuth、图片缩放或缓存库。

`googleapis` 的请求显式关闭客户端重试。Drive 元数据请求、媒体读取或 token 刷新失败时直接向当前主路径抛错，不自动再次请求。

`motion-v` 只局部导入组件和 hooks，不注册全局插件；PhotoSwipe CSS 跟随照片功能入口加载。Motion 的 `Ticker` 和 `Carousel` 属于 Motion+，本功能不依赖付费组件。连续作品带使用开源 `motion` 组件的线性循环、重复内容组和 `ResizeObserver` 计算距离实现；禁止使用 `useAnimationFrame`、`requestAnimationFrame` 或任何 RAF 别名。

## 6. Drive 内容契约

### 6.1 固定目录结构

```text
NotiNewsPhotos/
└── 验收样片/
    ├── unsplash-city-street.jpg
    └── unsplash-mountain-lake.jpg
```

规则如下：

- `JOURNAL_PHOTO_DRIVE_ROOT_FOLDER_ID` 精确指定 `NotiNewsPhotos`，服务不通过同名搜索猜测根目录。
- 根目录中只能有相册目录，不能直接放文件。
- 相册目录只能位于第一层，照片只能直接位于相册目录内，不能再嵌套目录。
- 相册名取目录名，照片标题取文件名去掉最后一个扩展名后的内容。
- 只接受后期完成的 sRGB JPEG；扩展名仅接受大小写不敏感的 `.jpg` 和 `.jpeg`，Drive `mimeType` 必须为 `image/jpeg`，`capabilities.canDownload` 必须为 true。
- 每张照片必须具有 Drive fileId、`md5Checksum`、宽度和高度；其他展示元数据可以缺失。
- 相册不得为空，根目录也必须至少存在一个可发布相册。
- Drive shortcut、非 JPEG、根目录文件和额外目录层级都视为内容错误，整次索引刷新失败。
- 服务只读取 Drive，不上传、重命名、删除或整理任何文件。
- 不在索引刷新时下载图片正文。文件内容损坏或 Sharp 无法解码会在对应图片请求中直接暴露。

### 6.2 稳定标识与内容版本

- `albumId = SHA-256(Drive folderId 的 UTF-8 字节)`，输出完整 64 位小写十六进制字符串。
- `photoId = SHA-256(Drive fileId 的 UTF-8 字节)`，输出完整 64 位小写十六进制字符串。
- `contentRevision = SHA-256(Drive fileId + ':' + md5Checksum)`，只用于该照片的三个媒体 URL。
- 相册或照片重命名时 Drive ID 不变，因此公开 ID 不变；标题和相册名随下一次索引刷新更新。
- 同一个 Drive 文件替换内容时 photoId 不变、contentRevision 改变；删除后重新上传得到新的 Drive ID，也得到新的 photoId。
- Drive fileId、folderId 和 `md5Checksum` 只保存在服务端内存索引中，不进入公共 JSON、HTML 或日志。
- API 和媒体路由只接受公开哈希 ID，不接受 Drive ID、路径或文件名作为路径参数。

### 6.3 排序与封面

- 相册内有拍摄时间的照片按拍摄时间升序排列。
- 无拍摄时间的照片排在有时间照片之后，再按文件名做稳定排序。
- 相册封面取拍摄时间最新的照片；若整个相册都没有拍摄时间，取文件名排序后的第一张。
- 相册按自身最新拍摄时间降序排列；没有任何拍摄时间的相册排在后面，再按相册名排序。
- 首页精选在所有相册中按拍摄时间降序取前 12 张；无拍摄时间的照片排在有时间照片之后，再按相册名和文件名排序。
- 12 是首版固定上限，不提供后台配置项或查询参数。

## 7. 公共数据协议

新增 `src/shared/photoLibraryProtocol.ts`，作为服务端返回值和前端 API 类型的单一来源。协议只包含公开展示需要的数据，不包含 Drive ID、校验值、源文件大小、OAuth 信息或 GPS。

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

overview 的 `revision` 由完整 Drive 元数据快照生成，用于判断索引是否变化；每个 variant URL 内部使用该照片自己的 `contentRevision`，因此其他相册变化不会让未修改照片的浏览器缓存失效。

`takenAt` 由 Drive `imageMediaMetadata.time` 规范化为 ISO 风格字符串。Drive 没有提供时保存 `null`；前端不擅自补时区。

## 8. 服务端实施

### 8.1 配置与内存边界

在 `JournalServerConfig` 增加：

| 环境变量 | 用途 |
| --- | --- |
| `JOURNAL_PHOTO_DRIVE_CLIENT_ID` | 现有自有 Google OAuth 客户端 ID |
| `JOURNAL_PHOTO_DRIVE_CLIENT_SECRET` | 同一 OAuth 客户端 secret |
| `JOURNAL_PHOTO_DRIVE_REFRESH_TOKEN` | 使用 `drive.readonly` 新授权得到的 refresh token |
| `JOURNAL_PHOTO_DRIVE_ROOT_FOLDER_ID` | `NotiNewsPhotos` 的固定 Drive folderId |

值只写入 rndc02 现有 `/opt/journal/.env`，仓库中的 `.env.example` 只增加占位名称。服务使用这些值创建一个 OAuth2Client 和一个 Drive v3 client。

照片库索引只存在于 Journal 进程内存：

- `currentIndex` 保存当前完整只读快照。
- `refreshedAt` 记录成功刷新时间。
- `pendingRefresh` 合并同一时刻的重复元数据刷新请求。
- 不在 `/data`、`/tmp` 或其他宿主机路径写入索引和图片。

### 8.2 Drive 元数据读取

新增 `JournalPhotoDriveClient`，只提供两项业务能力：

1. 列出固定根目录和每个相册的直接子项。
2. 按服务端持有的 Drive fileId 打开 JPEG Readable stream。

元数据读取使用 `files.list` 的父目录条件和明确的 `fields`，只请求：

- `id`、`name`、`mimeType`、`parents`。
- `md5Checksum`、`modifiedTime`、`size`、`capabilities.canDownload`。
- `imageMediaMetadata` 中除 `location` 之外的展示字段、宽高和 rotation。

分页属于一次完整列表读取的一部分，必须读取到 `nextPageToken` 为空后再构建索引。不得请求或保存 `imageMediaMetadata.location`，不得读取整个 Drive，也不得用文件名搜索替代固定根 folderId。

所有 Drive 请求显式关闭重试。OAuth、分页或字段错误直接抛出；不返回空目录或旧元数据假装成功。

### 8.3 展示元数据映射

| 展示字段 | Drive `imageMediaMetadata` 来源 |
| --- | --- |
| 拍摄日期 | `time` |
| 相机 | `cameraMake` 与 `cameraModel`，去掉重复厂商前缀后组合 |
| 镜头 | `lens` |
| 焦段 | `focalLength` |
| 光圈 | `aperture` |
| 快门 | `exposureTime` |
| ISO | `isoSpeed` |

每个展示字段缺失时保存 `null`。GPS 字段根本不请求；作者、版权、序列号、软件信息和 Drive 其他属性不进入公开索引。

`width`、`height` 和 `rotation` 用于得到自动旋转后的展示比例。宽高、`md5Checksum` 或下载能力缺失属于内容错误，整次索引刷新失败。

### 8.4 索引 revision 与 variant 尺寸

索引扫描完成后，按 Drive ID 排序，以相册 ID、照片 ID、父子关系、名称、MIME、`md5Checksum`、`modifiedTime` 和选中的图片元数据生成全局 `revision`。图片正文不参与该步骤。

三个 variant 的公开宽高由旋转后的源宽高和固定约束提前计算，使用与 Sharp 相同的等比缩放和 `withoutEnlargement` 语义：

| variant | 规格 | WebP 质量 | 用途 |
| --- | --- | --- | --- |
| `preview` | 宽 64px，等比缩放 | 35 | 模糊占位 |
| `card` | 限制在 1600×1600 内，等比缩放 | 82 | 精选、相册封面、详情网格 |
| `view` | 限制在 3000×3000 内，等比缩放 | 90 | PhotoSwipe 沉浸查看 |

variant URL 固定为 `/media/photos/:contentRevision/:photoId/:variant`。URL 只表达公开内容版本，不包含 Drive 信息。

### 8.5 索引刷新主路径

`JournalPhotoLibraryService.refresh()` 固定执行：

1. 用 root folderId 读取第一层子项，校验根目录只有非空相册目录。
2. 读取每个相册的直接子项，拒绝目录、shortcut 和非 JPEG。
3. 校验必要字段并映射照片元数据、公开 ID、contentRevision 和 variant 尺寸。
4. 计算相册日期范围、封面、照片排序和首页精选。
5. 计算全局 revision，并在所有步骤成功后一次性替换 `currentIndex` 和 `refreshedAt`。

刷新不创建 generation、marker、JSON 文件或图片目录。任一步失败都让当前调用报错；不能用旧索引完成这个已到期的 API 请求，也不能发布部分相册。内存中的上一份完整对象不被半成品修改，已经打开页面持有的公开数据不被服务端主动改写。

`ensureCurrent()` 的行为保持短而明确：

- 没有索引时调用 `refresh()`。
- 索引成功时间未超过五分钟时直接返回当前对象。
- 超过五分钟时等待一次新的 `refresh()`，成功后返回新对象，失败则当前 API 请求失败。
- 同一时刻只有一个 `pendingRefresh`，其他首页或相册请求等待同一个结果；这只合并并发请求，不重试失败请求。

不增加后台轮询、systemd timer、rclone sync 或定时任务。没有访问时无需刷新；下一次公开数据请求会取得当前 Drive 状态。

### 8.6 图片实时转换主路径

媒体请求的固定主路径如下：

1. 校验 `contentRevision`、`photoId` 和 `variant` 格式。
2. 只通过当前内存索引把公开 photoId 解析为内部 Drive fileId。
3. 要求请求的 contentRevision 与当前照片一致，否则返回 404。
4. 使用 Drive `files.get({ fileId, alt: 'media' })` 取得服务端 Readable stream，不把 Google 响应重定向给浏览器。
5. 将输入流直接交给 Sharp，执行 `autoOrient()`、对应尺寸的 `resize({ fit: 'inside', withoutEnlargement: true })` 和 WebP 编码。
6. 将 Sharp 输出直接 pipeline 到 Fastify 响应；客户端中断时终止上游 Drive 流和 Sharp 流。

该路径不使用 `thumbnailLink`、`webContentLink`、Drive 公开分享链接或本地文件。Sharp 不保留源 EXIF，公开 WebP 不携带 GPS 或其他未选择元数据。

每次没有命中访问者浏览器缓存的图片请求都会重新读取 Drive 并转换；服务端不增加磁盘缓存、内存图片缓存、预热、队列、重试或降级图。该成本是“宿主机零图片持久化”的直接取舍。

### 8.7 服务启动

`createJournalServer` 创建 `JournalPhotoDriveClient` 和 `JournalPhotoLibraryService` 后调用 `initialize()`，首次从 Drive 建立完整内存索引。

OAuth 无效、根目录不存在、目录不合法或元数据读取失败时 Journal 启动失败，让问题直接出现在容器和部署日志中。服务不以空照片库、默认索引或禁用照片路由继续启动。首次发布前必须先准备 Drive 内容和 `drive.readonly` 授权。

### 8.8 路由

新增 `src/journal-server/routes/photos.ts`，由 `server.ts` 注册：

| 方法与路径 | 行为 |
| --- | --- |
| `GET /api/photos` | 调用 `ensureCurrent()` 后返回 overview，`Cache-Control: public, no-cache` |
| `GET /api/photos/albums/:albumId` | 调用 `ensureCurrent()` 后按 ID 返回相册详情；不存在时 404 |
| `GET /media/photos/:contentRevision/:photoId/:variant` | variant 只允许 `preview/card/view`，解析当前索引后实时代理和转换 |

图片响应设置：

- `Content-Type: image/webp`。
- `Content-Disposition: inline`。
- `Cache-Control: public, max-age=31536000, immutable`。
- `X-Content-Type-Options: nosniff`。
- `X-Accel-Buffering: no`，让当前 OpenResty 通用代理同步向客户端转发，不把大响应写入代理临时文件。

实时转换结果没有预先存在的文件大小，不实现 byte range。PhotoSwipe 通过普通完整图片响应加载 `view` 版本。

API、HTML 和图片响应都不得出现 Google URL。Drive API 的 3xx、认证响应或下载地址只能由 Journal 的服务端客户端处理，不能透传为浏览器跳转。

### 8.9 服务端文件边界

- `src/shared/photoLibraryProtocol.ts`：公开协议和固定枚举。
- `src/journal-server/photoDriveClient.ts`：OAuth2、Drive list 和媒体 Readable stream 边界。
- `src/journal-server/photoLibraryService.ts`：目录契约、元数据映射、索引刷新、排序和查询。
- `src/journal-server/routes/photos.ts`：HTTP 参数校验、缓存头、无缓冲媒体 pipeline 和响应映射。
- `src/journal-server/config.ts`、`types.ts`、`server.ts`：只接入新配置和服务，不改现有文章/媒体服务。

首版不增加 SQLite 表、repository、磁盘存储类、后台任务、队列或额外状态机。

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

- `previewSrc` 使用同源 `preview.url`。
- 首页和网格的 `src` 使用同源 `card.url`。
- 精选首屏前几张使用 eager，其余照片和所有相册卡片使用 lazy，避免同时触发过多实时转换。
- `fit` 可继续传 `cover`，但容器宽高比与照片相同，因此不会发生实际裁切。
- alt 使用照片标题；相册详情同时提供屏幕阅读器可访问的标题信息。

前端不接收 Google URL，也不为照片墙复制另一套模糊加载组件。

### 9.9 PhotoSwipe

`usePhotoLightbox.ts` 使用稳定 v5 原生 API：

- Lightbox 从 `photoswipe/lightbox` 导入。
- Core 通过 `pswpModule: () => import('photoswipe')` 在首次打开时动态加载。
- dataSource 使用同源 `view.url`、`view.width`、`view.height`、`card.url` 和 title。
- 每次打开使用数组 index，不把 Drive ID 或源信息放入 DOM dataset。
- 在 `uiRegister` 注册底部 caption；slide change 时用 DOM `textContent` 构造标题和元数据节点，不拼接元数据 HTML。
- caption 按固定顺序过滤 `null` 字段；没有值的字段不渲染标签或占位符。
- 页面本身仍保留可访问的照片标题，不能只依赖 Lightbox caption。
- route view 卸载时调用 `destroy()`，避免保留键盘、触摸或窗口事件。

不新增下载按钮，不向 PhotoSwipe 提供源 JPEG、Drive fileId 或 Google URL。

## 10. Drive 授权与发布准备

### 10.1 一次性 Drive 授权调整

该步骤已于 2026-08-23 完成。rndc02 上现有自有 OAuth 客户端的 grant 已由 `drive.file` 调整为 `drive.readonly`；实际 token scope 已通过 Google tokeninfo 确认为 `drive.readonly`，并已确认能够发现通过 Drive 网页创建和上传的 `NotiNewsPhotos` 内容。

`drive.readonly` 允许查看和下载所有 Drive 文件，但不允许 Journal 上传、重命名或删除文件。应用只使用固定 root folderId，业务代码不会遍历或公开其他目录。

新链路直接使用 Google Drive API，不读取 rclone config，也不依赖 `notinews-drive:`。现有 rclone remote 不需要为照片墙修改或删除。

现有授权产物保存在 rndc02 的 `notinews-drive:` rclone 配置中。代码实施时将下列值接入 `/opt/journal/.env`，Journal 运行时不读取 rclone config：

- OAuth client ID。
- OAuth client secret。
- 新的 refresh token。
- `NotiNewsPhotos` folderId：`1TswxfDr5IhcLLXQ_soMSmBN0UEQoHs1U`。

这些值不写入仓库、部署归档、API 响应或日志。

### 10.2 环境与容器

- `deploy/journal/.env.example` 增加四个照片 Drive 环境变量占位符。
- `deploy/journal/compose.yaml` 已通过 `/opt/journal/.env` 向容器提供变量，无需增加照片目录、volume 或额外容器。
- `/opt/journal/data:/data` 保持现状，但照片服务不得调用现有 storage 在其中写入任何图片或索引。
- Journal Dockerfile 已安装根依赖并包含 `src/journal-server`、`src/shared`，无需增加 Drive CLI、rclone 或系统图片工具。

### 10.3 OpenResty 与国内访问链路

无需修改 `deploy/journal/feeds.xmcloud.buzz.conf`。当前通用代理未配置 `proxy_ignore_headers X-Accel-Buffering`，会处理 Journal 返回的 `X-Accel-Buffering: no`，从而关闭该媒体响应的代理缓冲和临时文件写入。

所有公开图片 URL 都是 `https://feeds.xmcloud.buzz/media/photos/...`。浏览器不接收 Google URL、不跟随 Google 重定向，也不需要具备访问 Google 的网络能力；只有 rndc02 需要访问 Google Drive API。

### 10.4 发布资产边界

本次不新增宿主机照片脚本、systemd unit、目录或挂载，因此：

- `deploy/journal/deploy-release` 不变。
- `.github/workflows/deploy.yml` 的 Journal host archive 不变。
- `deploy/journal/compose.yaml` 不变。
- `scripts/journal-backup` 和 `scripts/restore-journal` 不变。
- 不新增照片备份；Drive 是唯一照片内容源，Journal 没有可备份的照片副本。

发布仍沿用现有 `main → GitHub Actions → rndc02` 路径，不产生第二套部署机制。

## 11. 首次发布顺序

首次上线按以下依赖顺序进行：

1. 已完成：在 Drive 创建非空 `NotiNewsPhotos` 和符合契约的 `验收样片` 相册。
2. 已完成：记录固定 root folderId `1TswxfDr5IhcLLXQ_soMSmBN0UEQoHs1U`。
3. 已完成：取得并确认 `drive.readonly` 授权；代码实施时把现有授权信息和 root folderId 写入 rndc02 现有 `/opt/journal/.env`。
4. 完成服务端和前端代码实现，形成符合项目格式的一次发布提交。
5. push 到 `main`，沿用现有 GitHub Actions 自动发布路径。
6. 新容器启动时直接从 Drive 建立首个内存索引；成功后对外提供照片页面和实时媒体流。
7. 后续只在 Drive 网页管理相册和照片，不在宿主机创建或维护照片目录。

本文档修改本身不进入发布阶段，也不执行以上外部操作。

## 12. 文件变更清单

### 12.1 新增文件

```text
src/shared/photoLibraryProtocol.ts
src/journal-server/photoDriveClient.ts
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
deploy/journal/.env.example
```

### 12.3 明确不改

```text
src/reminders/recurring.ts
src/journal-server/migrations.ts
src/journal-server/repository.ts
web/vite.config.ts
deploy/journal/Dockerfile
deploy/journal/compose.yaml
deploy/journal/deploy-release
deploy/journal/feeds.xmcloud.buzz.conf
.github/workflows/deploy.yml
scripts/journal-backup
scripts/restore-journal
```

## 13. 开发阶段拆分

### 阶段 A：Drive 边界与内存索引

- 增加 `googleapis` 和共享协议。
- 完成 OAuth 配置、固定根目录读取、两层内容契约和字段白名单。
- 完成公开 ID、contentRevision、元数据映射、排序、封面和精选索引。
- 完成五分钟按需刷新、并发请求合并和服务启动初始化。

阶段完成条件：合法 Drive 目录可以形成完整内存索引；到期刷新失败直接使当前 API 请求失败，不返回旧索引或部分相册。

### 阶段 B：公共接口与实时图片流

- 完成 overview、album detail 和固定 variant 图片路由。
- 完成 Drive Readable stream → Sharp → Fastify response 的无落盘主路径。
- 完成同源 URL、公开 ID 解析、404、不可变缓存头和 `X-Accel-Buffering: no`。
- 保证 API、HTML、响应头和重定向都不暴露 Google URL、Drive ID、GPS 或 OAuth 信息。

阶段完成条件：一次未缓存图片访问只通过 rndc02 读取 Drive、实时生成 WebP 并返回，宿主机不产生照片文件。

### 阶段 C：Vue 页面与交互

- 接入两级路由、AppRoute、公共外壳、导航和滚动恢复。
- 完成 Pinia 缓存、首页、相册卡片和 Justified 详情。
- 完成 Motion 动画、reduced-motion 和 PhotoSwipe caption。

阶段完成条件：框架常驻、局部加载、操作即时反馈、已加载状态复用形成一条完整主路径。

### 阶段 D：授权与发布准备

- 已完成 `drive.readonly` 授权、root folderId 和非空验收相册准备。
- 代码实施时将四项实际配置写入 rndc02 现有 `.env`，仓库只更新 `.env.example`。
- 保持 compose、host assets、OpenResty 文件和现有发布流程不变。

阶段完成条件：新容器具备只读列举和下载固定照片目录的授权，浏览器端不需要 Google 网络连接。

### 阶段 E：首次上线

- 形成完整发布提交后按现有 main push 流程部署。
- 新容器启动时直接建立 Drive 内存索引，不执行源目录预同步或衍生图预生成。
- 观察真实 Journal workflow、容器日志和媒体请求；若失败，只根据真实根因修改并重新发布。

## 14. 验收场景

### 14.1 导航与页面生命周期

- 桌面端顺序为“生活、文章、兴趣、照片墙”，关于我仍固定在底部。
- 移动端五栏宽度一致，照片首页和详情都保持照片墙选中态。
- 从首页进入相册、返回首页后，已加载数据和首页滚动位置恢复，不重新闪现整个框架。
- 相册 A 进入相册 B 时展示 B 的数据，不残留 A 的标题或照片；返回已读相册时直接复用缓存。

### 14.2 图片与动画

- 首轮验收直接使用 `验收样片` 中 1800×1112 横图和 1400×2100 竖图，确认两种比例贯穿精选、详情和 PhotoSwipe 主路径。
- 横图、竖图和方图在精选、封面、详情和 PhotoSwipe 中都保持自动旋转后的原始比例。
- 精选轨道连续循环，循环边界无跳缝；hover、focus 和 reduced-motion 行为符合约定。
- 详情动画跟随 `.app-scroll`，外层 grid 定位与内层 Motion transform 不冲突。
- 模糊 preview 先稳定占位，card 加载后渐进替换，PhotoSwipe 使用 view 尺寸。
- PhotoSwipe 支持桌面键盘、移动触摸、缩放和关闭，离开路由后不保留事件。

### 14.3 元数据与隐私

- 标题始终来自 Drive 文件名去扩展名。
- 有 Drive 图片元数据的照片只展示实际字段；缺失字段不显示标签或占位符。
- GPS、Drive ID、校验值、OAuth 信息和 Google URL 不出现在 API、HTML、响应头或公开 WebP 中。
- 日期缺失的照片按约定排在相册末尾，但不会挤掉有日期照片的“最新封面”判断。

### 14.4 Drive 变更

- 新增相册或照片后，第一个命中过期索引的公开数据请求一次性取得新结果。
- 同一个 Drive 文件替换 JPEG 后 photoId 不变、contentRevision 和三个图片 URL 改变。
- 重命名相册或照片后公开 ID 不变，展示名称更新。
- 删除相册或照片后新索引不再引用它，旧媒体 URL 不再由当前索引解析。
- 非 JPEG、空相册、shortcut 或额外目录层级导致索引刷新失败，当前到期请求明确报错。

### 14.5 零持久化与访问链路

- 照片功能不创建 `/opt/journal/photo-source`、`/data/photos`、generation、WebP 或缩略图文件。
- 首页、相册和 PhotoSwipe 的所有图片请求都指向 `feeds.xmcloud.buzz`，浏览器没有到 Google 域名的连接。
- 每个媒体响应携带 `X-Accel-Buffering: no`，OpenResty 不把照片流写入代理临时文件。
- 未命中访问者缓存时，Journal 从 Drive 读取一次 JPEG 流并实时返回对应 WebP；不读取替代来源。
- Drive、OAuth 或 Sharp 失败时当前请求失败，不返回默认图、旧衍生图或 Google 直链。

### 14.6 发布与运行

- Journal 启动必须成功读取固定 Drive 目录；授权或内容不合法时容器启动失败。
- 照片功能不依赖 rclone remote、宿主机照片任务或额外 volume。
- 新代码仍通过既有 `main → GitHub Actions → rndc02` 路径发布，不产生第二套部署方案。
- Journal 现有文章数据、备份、恢复和其他媒体路径不因照片墙改变。

## 15. 完成定义

照片墙功能只有在以下条件同时满足时才算开发完成：

- Drive 内容契约、公开 ID、排序、元数据白名单和三种实时 variant 全部按本文实现。
- 宿主机不持久化任何照片源文件、同步副本、索引文件或衍生图。
- 所有公开图片都由 Journal 同源流式代理，国内访问者不直接连接 Google。
- 两个公开路由完整接入 AppRoute、公共外壳、导航和滚动恢复。
- 首页、详情、PhotoSwipe 与 reduced-motion 构成连续可用的主路径。
- 授权、配置和发布继续沿用现有个人项目的最短路径，没有引入同步目录、后台任务或新部署系统。
- 没有新增重试、fallback、静默跳过、Google 直链、原图出口、后台编辑器或无关抽象。

## 16. 资料依据

- [指定调研文档](./photo-library.md)
- [Google Drive API：File 资源与 imageMediaMetadata](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
- [Google Drive API：下载与内存流](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
- [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google APIs Node.js Client](https://www.npmjs.com/package/googleapis)
- [NGINX proxy buffering 与 X-Accel-Buffering](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering)
- [Motion for Vue](https://motion.dev/docs/vue)
- [Motion for Vue：滚动动画](https://motion.dev/docs/vue-scroll-animations)
- [Motion for Vue：useScroll](https://motion.dev/docs/vue-use-scroll)
- [Motion for Vue：useReducedMotion](https://motion.dev/docs/vue-use-reduced-motion)
- [Motion for Vue：useAnimate](https://motion.dev/docs/vue-use-animate)
- [PhotoSwipe Getting Started](https://photoswipe.com/getting-started/)
- [PhotoSwipe Data Sources](https://photoswipe.com/data-sources/)
- [PhotoSwipe Caption](https://photoswipe.com/caption/)
