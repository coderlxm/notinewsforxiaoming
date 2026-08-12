# P0-04 完整个人数据导出需求

## 1. 文档信息

- 功能名称：完整个人数据导出
- 优先级：P0
- 面向用户：已登录站主
- 产品入口：`/me/settings` 的“数据导出”分区
- 关联调研：`doc/research/notinews-web-feature-benchmark-and-p0.md` 中的 P0-4

## 2. 背景

NotiNews 已经保存短记录、长文章、草稿、不同可见性的内容、原始媒体、媒体预览、站点资料和待处理投稿，但现有 `/rss.xml` 与 `/feed.json` 只服务近期公开内容，不能代表站主拥有的完整档案。

完整导出的价值不是生成另一种阅读页面，而是让站主在一次操作中取得一份结构明确、媒体齐全、能够长期保管的个人档案包。该档案必须真实反映导出时的数据，不能通过省略坏文件、跳过不认识的记录或只导出公开内容来假装成功。

## 3. 目标

1. 已登录站主可以从站点设置发起一次“导出全部数据”。
2. 导出结果为一个 ZIP，包含规范 JSON 清单以及清单引用的全部文件。
3. 公开、口令、私有和草稿内容均以完整内容导出，不按公开阅读权限做脱敏。
4. 短记录和长文章保留原始内容结构、来源信息、时间、频道、标签、状态及资产关系。
5. 原始媒体、媒体预览、文章封面、文章正文图片、头像和待处理投稿媒体都有唯一且可追溯的映射。
6. 导出格式从 `exportVersion: 1` 开始独立版本化，不与数据库表结构直接绑定。
7. 任一必需记录、字段或文件无法读取或写入时，整次导出失败，不交付不完整 ZIP。

## 4. 非目标

本次不包含：

- 将 ZIP 导回 NotiNews。
- PDF、Markdown、CSV、纯文本等派生阅读格式。
- 按日期、标签、频道、公开状态或勾选记录导出。
- 定时备份、云端备份、邮件发送或 Telegram 发送。
- ZIP 加密或给导出包设置密码。
- 导出任务列表、后台队列、进度中心和历史下载记录。
- 导出数据库文件、WAL 文件或服务器整个数据目录。
- 导出管理员密码、Cookie 密钥、Telegram Bot Token、内部 ingest token、第三方 API Key。
- 导出投稿链接令牌、令牌哈希、内容访问口令或内容访问口令哈希。

## 5. 用户主路径

1. 站主登录并进入“站点设置”。
2. 站主打开“数据导出”分区。
3. 页面明确提示：导出包包含私有内容、口令内容、草稿和全部媒体，应作为敏感文件保管。
4. 站主点击“导出全部数据”。
5. 浏览器向站主专用导出地址发起原生下载请求；服务端先生成完整临时归档。
6. 归档完整生成后，浏览器开始接收 ZIP，并使用服务端指定的文件名保存。
7. 生成阶段发生任何错误时，服务端直接返回错误，不开始发送 ZIP；错误不被转成空包或缺文件的包。

本功能只有一个全量导出动作，不增加格式、范围或存储位置选择。

## 6. 导出对象

### 6.1 站点资料

导出当前 `journal_site_profile` 所表达的全部业务资料：

- Bio。
- 关于页介绍。
- 天气开关的当前值。
- 三个频道的公开标签及顺序。
- 全部联系方式，包括未启用项。
- 资料更新时间。
- 头像版本和头像 WebP 原文件。

头像 BLOB 必须写入 ZIP 并由 `manifest.json` 引用，不能只留下当前 HTTP URL。

### 6.2 全部内容记录

导出 `journal_entries` 中的每一条底层记录，不套用公开 feed 的“仅已发布”“仅公开”或媒体组代表项条件。每条记录至少包括：

- 数据源记录 ID 与稳定 `publicId`。
- 来源类型 `telegram` 或 `web`。
- Telegram 来源记录的 `chatId`、`sourceMessageId`、`mediaGroupId` 和原始消息 JSON。
- 内容类型、标题、正文格式、纯文本正文、富文本原始 JSON 和结构化内容 JSON。
- `draft` 或 `published` 发布状态。
- `life`、`article` 或 `interest` 频道。
- `public`、`protected` 或 `private` 可见性。
- 是否配置内容访问口令；不导出口令本身或口令哈希。
- 标签、置顶状态、来源时间、采集时间和更新时间。
- 该底层记录直接拥有的资产，保持原始排序。

Telegram 媒体组不合并成一个不可追溯的新对象。各底层记录和资产保持原关联，`mediaGroupId` 供读取方还原组合关系。

当前源码中，已发布投稿会被转换成普通 `web` 记录，转换后不再保留投稿者信息。导出只能忠实表达现有数据，不能推断或补造已经不存在的投稿来源。

### 6.3 内容资产

导出 `journal_assets` 的全部资产及其现有预览文件：

- Telegram 和 Web 来源的附件。
- 文章封面。
- 文章正文图片。
- 图片与视频预览图。
- 照片、视频、语音、音频、文件等实际存在的原始文件。

每个资产在清单中保留业务元数据、数据库来源 ID、原存储相对路径和 ZIP 内路径。文章富文本保持原始节点结构；正文中使用的运行时资产 ID通过 `sourceAssetId` 与资产清单对应。

`preview_relative_path` 为 `null` 的资产不制造预览；非空时，对应预览文件是导出必需文件。

### 6.4 待处理投稿

导出尚存在于 `journal_contributions` 和 `journal_contribution_assets` 中的全部待处理投稿，包括：

- 投稿记录 ID、稳定 `publicId`、投稿者称呼和正文。
- 提交、创建和更新时间。
- 原始图片或视频、预览图及媒体元数据。

投稿所使用的链接记录、链接 ID、令牌哈希、过期状态和撤销状态不属于个人内容档案，不进入导出包。

## 7. 可见性与内容覆盖规则

| 当前状态 | 导出行为 |
| --- | --- |
| `published + public` | 导出完整正文、富文本与全部资产 |
| `published + protected` | 导出完整正文、富文本与全部资产，并记录 `requiresPassword: true`；不导出口令或哈希 |
| `published + private` | 导出完整正文、富文本与全部资产 |
| `draft + private` | 导出完整草稿正文、标题、标签、时间与已有资产 |
| 私有文章 | 按当前记录状态完整导出文章富文本、封面和正文图片 |
| 待处理投稿 | 完整导出投稿正文和媒体，不导出投稿链接凭据 |

导出是站主私有能力，因此内容不做公开预览式裁剪。内容是否公开仍以清单中的 `visibility` 表达。

## 8. ZIP 文件与目录规范

### 8.1 文件名

文件名统一使用 UTC 时间，避免依赖服务器本地时区：

```text
notinews-full-export-YYYYMMDDTHHmmssZ.zip
```

ZIP 内只有一个同名根目录，不包含 `.zip` 后缀：

```text
notinews-full-export-YYYYMMDDTHHmmssZ/
```

### 8.2 目录结构

```text
notinews-full-export-YYYYMMDDTHHmmssZ/
├── manifest.json
├── profile/
│   └── avatar.webp
└── media/
    ├── entries/
    │   └── {entryPublicId}/
    │       └── {sourceAssetId}/
    │           ├── original
    │           └── preview.webp
    └── pending-contributions/
        └── {contributionPublicId}/
            └── {sourceAssetId}/
                ├── original
                └── preview.webp
```

资产原始文件不根据 MIME 或原文件名猜测扩展名。其可读名称与类型保存在清单的 `originalName` 和 `mimeType` 中；固定的 UUID、数字和固定目录名使 ZIP 路径不受用户文件名影响。

清单中的所有 `archivePath` 均相对 ZIP 根目录，并统一使用 `/` 分隔符。

## 9. `manifest.json` 数据契约

### 9.1 根对象

```json
{
  "format": "notinews-personal-export",
  "exportVersion": 1,
  "generatedAt": "2026-08-12T04:55:30.000Z",
  "sourceDatabaseSchemaVersion": 14,
  "counts": {
    "entries": 0,
    "entryAssets": 0,
    "pendingContributions": 0,
    "pendingContributionAssets": 0,
    "files": 0,
    "bytes": 0
  },
  "profile": {},
  "entries": [],
  "pendingContributions": []
}
```

- `format` 固定为 `notinews-personal-export`。
- `exportVersion` 从 `1` 开始；字段删除、改名、类型改变或语义不兼容时必须提升版本。
- `generatedAt` 是本次数据库快照形成时间，采用 ISO 8601 UTC。
- `sourceDatabaseSchemaVersion` 只用于追溯来源，不用于决定如何读取导出包。
- `counts` 必须与清单和 ZIP 中的实际对象一致。

### 9.2 文件引用

头像、原始媒体和预览图统一使用以下结构：

```json
{
  "archivePath": "media/entries/{entryPublicId}/{sourceAssetId}/original",
  "byteSize": 123456
}
```

`byteSize` 是归档时实际文件大小，不以数据库中的历史记录值代替。

### 9.3 站点资料

```json
{
  "bio": "...",
  "aboutIntro": "...",
  "weatherEnabled": true,
  "channelTags": {
    "life": [],
    "article": [],
    "interest": []
  },
  "contactItems": [],
  "avatarRevision": 1,
  "avatar": {
    "archivePath": "profile/avatar.webp",
    "byteSize": 12345
  },
  "updatedAt": "2026-08-12T04:55:30.000Z"
}
```

### 9.4 内容记录

```json
{
  "sourceEntryId": 1,
  "publicId": "00000000-0000-0000-0000-000000000000",
  "source": {
    "kind": "telegram",
    "telegram": {
      "chatId": "123",
      "messageId": 100,
      "mediaGroupId": null,
      "rawMessage": {}
    }
  },
  "contentType": "photo",
  "title": null,
  "bodyFormat": "plain",
  "contentText": "...",
  "richBody": null,
  "structuredContent": null,
  "publicationStatus": "published",
  "channel": "life",
  "visibility": "protected",
  "access": {
    "requiresPassword": true
  },
  "tags": [],
  "pinned": false,
  "sourceCreatedAt": "2026-08-12T04:55:30.000Z",
  "capturedAt": "2026-08-12T04:55:31.000Z",
  "updatedAt": "2026-08-12T04:55:31.000Z",
  "assets": []
}
```

- `source.kind = web` 时 `source.telegram` 为 `null`。
- `visibility = protected` 时 `access` 固定为 `{ "requiresPassword": true }`；其他可见性为 `null`。
- `richBody` 保留文章当前存储的 Tiptap JSON，不转为 HTML 或 Markdown。
- `structuredContent` 和 `rawMessage` 保留数据库中的完整 JSON，不使用公开 API 的裁剪结果。

### 9.5 内容资产

```json
{
  "sourceAssetId": 10,
  "sourceKind": "telegram",
  "role": "attachment",
  "kind": "photo",
  "telegram": {
    "fileId": "...",
    "fileUniqueId": "..."
  },
  "originalName": "image.jpg",
  "mimeType": "image/jpeg",
  "recordedByteSize": 123456,
  "width": 1200,
  "height": 800,
  "duration": null,
  "sortOrder": 0,
  "sourceRelativePath": "assets/2026/08/{publicId}/{uuid}",
  "file": {
    "archivePath": "media/entries/{publicId}/10/original",
    "byteSize": 123456
  },
  "previewSourceRelativePath": "assets/2026/08/{publicId}/{uuid}.preview.webp",
  "preview": {
    "archivePath": "media/entries/{publicId}/10/preview.webp",
    "byteSize": 12345
  }
}
```

- Web 资产的 `telegram` 为 `null`。
- `recordedByteSize` 可以为 `null`，`file.byteSize` 必须来自实际文件。
- 没有预览的资产，其 `previewSourceRelativePath` 与 `preview` 都为 `null`。
- `role` 保留 `attachment`、`cover`、`inline`，不另建文章媒体格式。

### 9.6 待处理投稿

```json
{
  "sourceContributionId": 1,
  "publicId": "00000000-0000-0000-0000-000000000000",
  "senderName": "...",
  "contentText": "...",
  "submittedAt": "2026-08-12T04:55:30.000Z",
  "createdAt": "2026-08-12T04:55:30.000Z",
  "updatedAt": "2026-08-12T04:55:30.000Z",
  "assets": []
}
```

投稿资产使用与内容资产相同的文件引用规则，同时保留 `sourceName`、`mimeType`、尺寸、时长、排序和原存储相对路径。

## 10. 权限与隐私

- 导出地址必须沿用当前站主会话的 `requireAdmin` 鉴权。
- 未登录请求返回未授权，不得生成临时 ZIP，也不得返回任何数量或文件信息。
- 响应必须禁止共享缓存和浏览器缓存复用。
- 导出包本身不加密，因此设置页必须在操作前明确敏感性。
- 清单保留内容业务数据和来源信息，但排除所有认证、授权和第三方服务密钥。
- 口令内容的正文与媒体完整导出；`protected` 状态保留，但密码无法从当前数据恢复，且密码哈希不作为个人内容携带。

## 11. 一致性与失败规则

1. 数据库清单必须来自同一个只读快照，不能一边分页查询一边拼接不同时间点的数据。
2. 快照形成后新增或更新的内容不属于本次导出；这是正常的快照边界。
3. 资产文件在应用中按不可变文件处理。若快照引用的文件在归档前或归档中消失、无法读取或大小异常，整次导出失败。
4. 临时 ZIP 完整关闭前不得向客户端发送成功响应头或任何 ZIP 字节。
5. 任一 ZIP 库 `warning`、流错误、JSON 解析错误、schema 错误或文件系统错误都必须使整次导出失败。
6. 禁止跳过坏记录、缺失媒体或预览；禁止只写错误清单后继续；禁止产出“部分成功”的 ZIP。
7. 失败产生的临时文件必须删除。成功 ZIP 在响应完成或连接中断后从服务端删除，不形成服务器备份。
8. 浏览器传输中断属于明确的下载失败，服务端不得将其记为可恢复成功，也不自动重试。

## 12. 完成标准

- 站主设置中存在独立“数据导出”分区，文案明确告知敏感范围。
- 只有已登录站主可以触发全量导出。
- 下载文件与 ZIP 根目录符合统一 UTC 命名规则。
- `manifest.json` 的 `format`、`exportVersion`、数据库来源版本、时间和计数完整。
- 数据库中的每条内容记录都在清单中出现，包括草稿、私有、口令和公开内容。
- 每条记录保留当前来源、原始 JSON、正文、富文本、标签、频道、状态、时间和资产归属。
- 文章封面、正文图片、所有附件和已有预览均存在于 ZIP，并可由清单唯一定位。
- 站点资料、头像和全部待处理投稿进入导出包。
- 管理凭据、第三方密钥、投稿链接凭据和内容访问口令哈希不进入导出包。
- 任何必需文件或记录异常时不提供 ZIP，不静默省略，也不自动再次执行。

## 13. 当前事实依据

- `src/journal-server/migrations.ts`：当前业务表和数据库 schema 版本。
- `src/journal-server/repository.ts`：内容、媒体组、资产、站点资料与待处理投稿的当前映射行为。
- `src/journal-server/storage.ts`：资产位于 `dataDir/assets/...`，并使用原文件与 `.preview.webp` 路径对。
- `src/journal-server/auth.ts`：站主 Cookie 鉴权和口令哈希均不属于可公开数据。
- `src/journal-server/routes/privateEntries.ts`、`routes/privateContributions.ts`、`routes/siteProfile.ts`：现有站主专用 API 边界。
- `web/src/components/settings/SiteProfileSettingsView.vue`：当前设置页使用分区标签组织站主操作。

