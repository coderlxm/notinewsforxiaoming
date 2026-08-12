# P0-04 完整个人数据导出开发设计

## 1. 设计结论

采用“数据库一次性快照 → 全量文件预检 → 服务端临时 ZIP 流式生成 → 完成后再以文件流响应 → 立即清理”的单路径实现。

关键决定如下：

1. 新增站主专用 `GET /api/me/export`，不复用公开 feed，也不通过公开权限 DTO 导出。
2. Repository 在一个同步只读事务中取出站点资料、全部内容底层行、全部内容资产、全部待处理投稿和投稿资产。
3. 导出 DTO 独立于 `JournalEntry`。它保留媒体组底层行、Telegram 原始 JSON、资产存储映射等当前 API DTO 会裁剪或合并的信息。
4. ZIP 先写入权限受限的临时文件；归档完整关闭后才设置下载响应，保证生成错误仍能由现有错误处理器返回，而不会得到半个有效响应。
5. ZIP 生成和 HTTP 发送都使用 Node Stream，媒体文件不整体读入内存。
6. 使用成熟 ZIP 库，不手写 ZIP 格式。当前依赖声明和锁文件中没有 ZIP 归档库，开发时新增 `archiver` 8.x 与匹配的 `@types/archiver` 8.x。
7. 任一归档 warning 或错误均直接失败；不接受 Archiver 示例中对 `ENOENT` warning 的跳过写法。

## 2. 当前实现证据

### 2.1 数据库

`src/journal-server/migrations.ts` 当前最高 `user_version` 为 14，相关表为：

- `journal_entries`
- `journal_assets`
- `journal_site_profile`
- `journal_contributions`
- `journal_contribution_assets`
- `journal_contribution_links`

导出包含前五张表表达的业务内容，但不包含 `journal_contribution_links`。后者保存投稿访问控制信息，不是个人内容档案。

`journal_entries` 同时承载：

- Telegram 短记录。
- Web 短记录与草稿。
- Web 富文本文章。
- 公开、口令和私有内容。

Telegram 媒体组由多条底层记录构成，`JournalRepository.toEntry()` 和公开/私有列表只在产品展示层选取代表项并聚合媒体。完整导出不能复用该展示结果，否则会失去非代表行的 `public_id`、原始消息和资产所有权。

### 2.2 文件存储

`JournalStorage` 将正式资产保存到：

```text
{dataDir}/assets/{year}/{month}/{publicId}/{uuid-or-normalized-file}
```

预览路径为原始路径追加 `.preview.webp`。文章封面和正文图片也进入 `journal_assets`，用 `role = cover | inline` 区分。待处理投稿资产在正式数据目录使用同样的相对路径模型。

`JournalStorage.absoluteAssetPath()` 已负责把业务相对路径限定在 `{dataDir}/assets` 内，导出服务应复用它，不重新拼接不受约束的绝对路径。

### 2.3 鉴权与页面

- 当前站主接口统一使用 `JournalAuth.requireAdmin`。
- `/me/settings` 的 `SiteProfileSettingsView.vue` 已以 Element Plus tabs 组织“公开资料”“联系方式”“频道标签”“投稿链接”。
- 数据导出适合增加第五个独立分区，不并入公开资料表单，也不进入其“保存修改”状态。

## 3. 模块边界

```text
SettingsDataExportPanel
        │ native download request
        ▼
GET /api/me/export ── requireAdmin
        │
        ▼
JournalExportService.createArchive()
        │
        ├── JournalRepository.createFullExportSnapshot()
        ├── JournalStorage.absoluteAssetPath()
        ├── fs stat/read streams
        └── Archiver ZIP stream → temporary file
        │
        ▼
Fastify reply.send(fs.createReadStream(temporaryZip))
        │
        └── response finish/close → remove temporary export
```

职责划分：

- Repository 只负责形成同一数据库时间点的原始业务快照并解析受 schema 约束的 JSON 字段。
- Export Service 负责导出格式、ZIP 路径、文件预检、临时文件生命周期和归档生成。
- Route 负责站主鉴权、HTTP headers、文件流响应和响应后的清理。
- 前端只提供明确入口与敏感性说明，不承担压缩、内容转换或大文件缓冲。

## 4. 数据库快照设计

### 4.1 新增内部类型

在导出模块定义只供服务端使用的原始快照类型，不扩大现有公开 `journalProtocol.ts`：

```ts
interface JournalFullExportSnapshot {
  generatedAt: string;
  sourceDatabaseSchemaVersion: number;
  profile: JournalExportProfileRecord;
  entries: JournalExportEntryRecord[];
  pendingContributions: JournalExportContributionRecord[];
}
```

`JournalExportEntryRecord` 对应单条 `journal_entries`，其 `assets` 只包含 `entry_id` 直接关联的 `journal_assets`，不调用 `representativeRow()` 或 `assetsFor()` 的媒体组聚合逻辑。

### 4.2 查询边界

新增 `JournalRepository.createFullExportSnapshot(generatedAt)`，在一个 `better-sqlite3` 同步只读事务内完成：

1. 读取 `PRAGMA user_version`。
2. 读取唯一站点资料行和头像 BLOB。
3. 读取全部 `journal_entries`，按 `source_created_at ASC, id ASC` 排序。
4. 读取全部 `journal_assets`，按 `entry_id ASC, sort_order ASC, id ASC` 排序，并按 `entry_id` 放入记录。
5. 读取全部 `journal_contributions`，按 `submitted_at ASC, id ASC` 排序。
6. 读取全部 `journal_contribution_assets`，按 `contribution_id ASC, sort_order ASC, id ASC` 排序，并放入投稿。
7. 将数据库 JSON 文本解析为对象或数组；任一 JSON 不符合当前协议 schema 时抛出错误。

不使用分页、游标或现有列表筛选。数据量增长影响内存的部分主要是 JSON 元数据；媒体文件始终不进入快照内存。

站点资料不存在时直接失败。`journal_assets` 或 `journal_contribution_assets` 指向不存在父记录的状态虽然受外键约束，但若真实数据出现该异常，也直接失败。

### 4.3 一致性定义

数据库事务结束时，快照内的所有结构化数据属于同一个数据库时间点。事务结束后发生的新增或正文修改不改变本次快照。

媒体文件由应用以新路径写入，正式落盘后不会原地覆盖，因此快照之后读取对应路径可以视为读取该版本资产。若并发删除使文件在读取前消失，导出失败；不重新查询数据库、不重取文件，也不生成缺失资产的包。

该边界保证应用主路径上的“一个逻辑快照或完整失败”。服务器外部直接修改数据目录不属于应用事务能力；一旦造成无法读取、类型异常或大小不一致，仍按完整失败处理。

## 5. 导出协议

### 5.1 版本

导出协议常量：

```ts
const journalExportFormat = 'notinews-personal-export';
const journalExportVersion = 1;
```

数据库 schema 版本只写入 `sourceDatabaseSchemaVersion` 供追溯。读取导出包的程序必须以 `format + exportVersion` 判断格式，不能以 SQLite `user_version` 解析。

字段删除、改名、类型改变、枚举语义改变或新增必填字段时提升 `exportVersion`。增加不影响旧读取方的可选字段可以保持当前版本。

### 5.2 服务端 manifest 类型

```ts
interface JournalExportFileReference {
  archivePath: string;
  byteSize: number;
}

interface JournalExportManifest {
  format: 'notinews-personal-export';
  exportVersion: 1;
  generatedAt: string;
  sourceDatabaseSchemaVersion: number;
  counts: {
    entries: number;
    entryAssets: number;
    pendingContributions: number;
    pendingContributionAssets: number;
    files: number;
    bytes: number;
  };
  profile: {
    bio: string;
    aboutIntro: string;
    weatherEnabled: boolean;
    channelTags: JournalChannelTags;
    contactItems: JournalSiteContactItem[];
    avatarRevision: number;
    avatar: JournalExportFileReference;
    updatedAt: string;
  };
  entries: JournalExportEntry[];
  pendingContributions: JournalExportContribution[];
}
```

`JournalExportEntry` 保留：

- `sourceEntryId`、`publicId`。
- Web/Telegram 来源判别；Telegram 专属的 chat、message、media group 和 raw message。
- 原始内容字段和业务状态。
- `access: { requiresPassword: true } | null`，不包含 `access_password_hash` 或 `access_revision`。
- 嵌套的原始资产关系。

`JournalExportAsset` 保留：

- `sourceAssetId`、来源、角色、种类、排序和媒体元数据。
- Telegram 资产的 `fileId` 与 `fileUniqueId`；Web 资产为 `null`。
- 数据库记录的 `recordedByteSize`。
- `sourceRelativePath` 和 `previewSourceRelativePath`。
- 实际 ZIP 文件引用 `file` 与可空 `preview`。

`JournalExportContribution` 不包含 `link_id`。投稿资产使用独立的 `sourceAssetId` 命名空间，并映射到 `media/pending-contributions/...`。

使用现有 Zod 4 定义 manifest schema，并在写入 ZIP 前对最终对象执行一次严格解析。不能直接对数据库行 `JSON.stringify()`，否则内部字段或凭据会随表结构变化意外进入导出。

### 5.3 ID 与引用

- `publicId` 是记录和投稿跨导出的稳定标识。
- `sourceEntryId` 与 `sourceAssetId` 保留来源数据库追溯能力，但不承诺未来导入时复用相同数值。
- 富文本正文保持 `/media/{sourceAssetId}` 与 `data-asset-id` 的当前原始值；同一条记录的资产列表提供该 ID 到 `archivePath` 的明确映射。
- 媒体组通过 Telegram `mediaGroupId` 表达，不额外生成新组 ID。

### 5.4 路径生成

路径只使用数据库验证过的 UUID、正整数和固定英文片段：

```text
profile/avatar.webp
media/entries/{publicId}/{sourceAssetId}/original
media/entries/{publicId}/{sourceAssetId}/preview.webp
media/pending-contributions/{publicId}/{sourceAssetId}/original
media/pending-contributions/{publicId}/{sourceAssetId}/preview.webp
```

原文件名不进入 ZIP path，避免重名、路径分隔符和不同操作系统编码问题。`originalName` 或 `sourceName` 只作为 JSON 数据保存。

## 6. 文件预检

Export Service 在建立 ZIP 前遍历快照中的每个必需文件：

1. 使用 `JournalStorage.absoluteAssetPath(relativePath)` 获得受资产根目录限制的绝对路径。
2. 对原文件和所有非空预览路径读取文件状态。
3. 要求目标是普通文件，并记录实际 `byteSize`。
4. 数据库 `byte_size` 非空时，要求它与实际原文件大小一致。
5. 检查所有生成的 ZIP 内路径唯一。
6. 头像直接来自快照 BLOB，其实际大小为 Buffer 长度。

任一步失败都在 ZIP 响应开始前抛出错误。预检不是用来跳过问题，也不修改数据库或补做预览。

## 7. ZIP 流式生成

### 7.1 依赖判断

当前项目：

- 运行时固定 Node.js `>=24 <25`。
- `package.json` 与 `pnpm-lock.yaml` 中没有 ZIP 写入库，当前本地依赖图不能直接解析 `archiver`。
- Node 核心模块提供流、临时文件、路径、权限和压缩原语，但没有面向业务使用的 ZIP 容器写入 API；不应手写 ZIP header、central directory 或 ZIP64。

建议新增：

- `archiver` 8.x 作为生产依赖。
- `@types/archiver` 8.x 作为开发依赖，与 TypeScript 6 配套。

Archiver 8.0.0 官方发布说明要求 Node 18+，与本项目 Node 24 相容；官方 API 提供 ESM `ZipArchive`、`append`、`file`、`finalize()` 和 `forceZip64`。实现以 8.x 当前导出形式为准，不沿用旧版 CommonJS 默认导入示例。

资料：

- [Archiver 8 Quickstart](https://www.archiverjs.com/docs/quickstart/)
- [Archiver API](https://www.archiverjs.com/docs/archiver/)
- [Archiver 8.0.0 release](https://github.com/archiverjs/node-archiver/releases/tag/8.0.0)
- [`@types/archiver` 8.0.0](https://www.npmjs.com/package/@types/archiver)

### 7.2 临时文件

- 在操作系统临时目录下为单次请求创建权限为 `0700` 的独立目录。
- ZIP 临时文件使用独占创建并限制为 `0600`。
- 文件名和 ZIP 根目录在请求开始时由同一个 UTC 时间戳生成。
- 临时路径永不写入 manifest，也不返回给前端。

### 7.3 归档过程

1. 创建 `ZipArchive`，开启 ZIP64；媒体、WebP 和视频条目使用 STORE，避免对已压缩文件重复消耗 CPU。
2. 先注册目标文件流、archive 的 `error` 和 `warning` 监听，再加入任何条目。
3. 所有 warning 都转换为归档失败，包括 `ENOENT`，不采用库文档中“记录后继续”的示例策略。
4. 头像从 Buffer 追加；原始媒体和预览使用 `fs.createReadStream()` 或库的延迟文件流加入，不整体读取。
5. 条目按站点资料、内容时间/ID、资产排序、投稿时间/ID的稳定顺序加入。
6. `manifest.json` 使用 UTF-8、两个空格缩进并追加换行。
7. 调用并等待 `finalize()`，同时等待临时目标文件流真正关闭。只有二者均成功才认为 ZIP 完整。
8. 取得临时 ZIP 的实际体积供下载响应使用。

ZIP 自带的 CRC 用于发现压缩包条目损坏。P0 不额外读取所有媒体生成另一套 SHA-256 清单，避免为了当前没有导入或外部校验主路径而重复整批文件 I/O。

### 7.4 失败清理

归档服务使用单一 `try/finally` 管理临时目录：

- 创建或归档阶段失败：关闭相关流并删除本次临时目录，然后把原错误抛给 Fastify。
- 归档成功：把临时文件所有权交给路由，直到 HTTP 响应结束。
- 不把异常转为成功对象，不保留坏 ZIP，不启动第二次归档。

这里的清理只回收本次导出的敏感临时文件，不是业务 fallback。

## 8. HTTP 路由

新增 `src/journal-server/routes/export.ts`：

```text
GET /api/me/export
preHandler: auth.requireAdmin
```

处理顺序：

1. 等待 `JournalExportService.createArchive()` 完整返回。
2. 设置：
   - `Content-Type: application/zip`
   - `Content-Disposition: attachment; filename="notinews-full-export-...Z.zip"`
   - `Content-Length: {temporaryZipByteSize}`
   - `Cache-Control: private, no-store`
   - `X-Content-Type-Options: nosniff`
3. 使用 `reply.send(fs.createReadStream(temporaryZipPath))` 发送已完成文件。
4. 在响应完成、连接关闭或文件流错误后删除本次临时目录。

Fastify 5 官方支持把 Node Readable 作为预序列化 payload 发送。Route 必须返回 `reply.send(stream)`，不使用 `reply.raw` 绕开现有生命周期。参考 [Fastify Reply Streams](https://fastify.dev/docs/latest/Reference/Reply/#streams)。

因为 ZIP 在响应前已经完整落盘，文件缺失、JSON 错误和归档错误都能进入现有全局错误处理器。响应开始后的网络中断只影响传输，浏览器不会得到有效完成的 ZIP；服务端仍删除临时文件。

## 9. 前端设计

### 9.1 设置入口

在 `SiteProfileSettingsView.vue` 的 `settingsSections` 增加：

```ts
{ name: 'data', label: '数据导出' }
```

新增 `SettingsDataExportPanel.vue`，内容保持单一：

- 标题“完整数据导出”。
- 说明 ZIP 包含站点资料、全部记录、文章、草稿、待处理投稿和媒体。
- 醒目提示导出包包含私有及口令内容，文件本身不加密。
- 一个“导出全部数据”动作。

该分区没有可编辑字段，不参与 `hasUnsavedChanges`，也不显示公开资料表单的“保存修改”栏。

### 9.2 下载方式

使用浏览器原生 attachment 下载，而不是通过 `fetch().blob()` 把完整个人媒体包缓存到页面内存：

- 操作由真实链接指向 `/api/me/export`，沿用同源 Cookie。
- 链接由用户点击直接发起，浏览器按 `Content-Disposition` 处理下载。
- 可以在新的浏览上下文打开，使生成错误能直接显示真实服务端响应，同时保留站点设置页面。
- 不显示伪造的百分比进度或“已成功”提示；文件真正交给浏览器后，由浏览器展示下载状态。

未登录时沿现有设置页会话判断隐藏可操作面板；即使直接访问地址，服务端仍执行最终鉴权。

## 10. 错误语义

| 阶段 | 行为 |
| --- | --- |
| 站主会话无效 | 返回现有 401，不创建导出 |
| 数据库 JSON 或协议字段不合法 | 500，整次失败 |
| 站点资料缺失 | 500，整次失败 |
| 原始媒体或声明存在的预览缺失 | 500，整次失败 |
| 文件无法读取或记录大小与实际不符 | 500，整次失败 |
| ZIP warning、error 或目标流错误 | 500，删除临时文件，整次失败 |
| HTTP 发送中断 | 中止下载并删除服务端临时文件，不自动重新生成 |

不增加重试、缺文件占位符、错误清单、部分下载或静默跳过。

## 11. 预计修改文件

### 新增

- `src/journal-server/exportProtocol.ts`：导出 DTO、Zod schema、版本常量和 ZIP 路径生成。
- `src/journal-server/exportService.ts`：预检、临时 ZIP 流式生成和生命周期。
- `src/journal-server/routes/export.ts`：站主下载路由。
- `web/src/components/settings/SettingsDataExportPanel.vue`：设置页导出入口和敏感性提示。

### 修改

- `src/journal-server/repository.ts`：原始全量快照查询与内部 record 类型。
- `src/journal-server/server.ts`：构造导出服务并注册路由。
- `web/src/components/settings/SiteProfileSettingsView.vue`：增加“数据导出”分区并排除通用保存栏。
- `package.json`：加入 Archiver 运行时与类型依赖。
- `pnpm-lock.yaml`：记录解析后的依赖版本。

不需要数据库迁移，也不修改现有公开/私有 feed、文章编辑器、媒体读取路由或权限模型。

## 12. 实施拆分

### 第一步：冻结导出协议

- 建立 `exportVersion = 1` 的严格 DTO。
- 定义文件路径和口令、令牌排除规则。
- Repository 返回同一事务内的完整原始快照。

### 第二步：归档服务

- 引入 Archiver 8 依赖。
- 实现资产路径预检、实际大小收集和计数。
- 实现 ZIP64 临时归档、所有 warning 失败和临时文件清理。

### 第三步：站主路由

- 注册 `/api/me/export` 与 `requireAdmin`。
- 等待完整 ZIP 后设置下载 headers，并以文件流返回。
- 将响应完成和中断都连接到临时文件清理。

### 第四步：设置页面

- 增加独立数据导出 tab 和说明面板。
- 使用浏览器原生下载动作，不把媒体包放入 Vue state。

## 13. 完成后的主路径

```text
站主进入设置
  → 打开数据导出
  → 阅读敏感性说明并点击导出
  → 服务端鉴权
  → 在一个事务中形成数据库快照
  → 预检快照引用的全部文件
  → 流式写完临时 ZIP
  → 浏览器接收完整 ZIP
  → 服务端删除临时 ZIP
```

这条路径之外不建立导出历史、任务恢复、自动重跑或其他格式分支。

