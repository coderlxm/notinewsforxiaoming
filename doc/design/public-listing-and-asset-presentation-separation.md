# 公开信息流收录与资产呈现分离方案

## 目标

把当前混在一起的三个概念拆开：

1. **资产保存**：Telegram 或 Web 来源的真实内容是否被完整保存，服务于“我的资产”管理。
2. **访问权限**：内容是私有、口令访问还是公开访问。
3. **公开收录**：内容是否应主动出现在信息流、搜索、归档和订阅源中。

最终效果是：后台不丢管理资产，公开页面不再把文件名、MIME 类型或 Telegram 兼容字段直接堆进卡片，也允许一条内容保持可通过链接访问但不进入公开发现入口。

## 当前问题与根因

截图中的 Telegram 动图并不是“一个视频加一个独立 MP4 文件”。Telegram Bot API 明确说明：当 `Message.animation` 存在时，为了向后兼容，`Message.document` 也会同时存在；Telegram 的 GIF 还会被服务器转换为无声 MPEG-4 视频。因此文件扩展名和 MIME 类型不能代表用户发送时的内容语义，必须优先采用 Telegram 字段语义。[Telegram Bot API](https://core.telegram.org/bots/api)、[Working with GIFs](https://core.telegram.org/api/gifs)

当前实现的问题链如下：

- `telegramContent.ts` 依次读取 `animation` 和 `document`，没有识别两者可能指向同一个 `file_unique_id`。
- `ingest.ts` 因而下载并保存两份资产记录。
- `MediaGallery.vue` 将 `animation` 识别为视频，同时又把 `document` 识别为文件。
- 信息流卡片不区分视觉媒体与管理附件，所以同一动图先显示视频封面，再显示 `video.mp4 / video/mp4` 文件块。

这里包含两个不同问题，不能用一个 CSS 隐藏规则混过去：

- Telegram 兼容字段产生的是**重复来源描述**，应在采集边界去重。
- 真正独立的文件、音频等是**真实资产但不适合信息流卡片**，应保留到资产管理和详情页。

## 核心模型

### 访问权限保持不变

继续使用现有 `visibility`：

- `private`：仅管理员可访问。
- `protected`：管理员或知道口令的人可访问。
- `public`：任何人可访问。

该字段只回答“谁能打开”，不再隐含“是否进入信息流”。

### 新增公开收录状态

在 `journal_entries` 增加：

```text
listing_status = listed | unlisted
```

- `listed`：进入公开信息流和全部公开发现入口。
- `unlisted`：不进入任何公开发现入口；当访问权限为 `public` 或 `protected` 时，仍可通过准确链接打开。

这套语义与常见的“公开但不列出”一致，也避免为了管理一份资产而被迫把内容改成完全私有。

### 公开发现入口必须使用同一条件

以下入口统一要求：

```text
publication_status = published
AND visibility IN (public, protected)
AND listing_status = listed
```

适用位置：

- `/api/feed` 公开瀑布流；
- 标签筛选；
- 搜索；
- 归档月份统计与月份列表；
- RSS 和 JSON Feed；
- 后续如增加 sitemap，也必须复用同一收录条件。

`/api/entries/:publicId` 的准确链接访问不检查 `listing_status`，只检查现有访问权限。这样 `unlisted` 才是真正的“链接可访问但不被发现”，而不是另一种私有状态。

“我的资产”使用的 `/api/me/entries` 和分页表格不增加 `listing_status` 过滤，始终返回全部记录。

## 资产呈现规则

### 不按文件扩展名决定信息流资格

判断优先级固定为：

1. 来源语义，例如 Telegram 的 `animation`、`video`、`document`；
2. 已保存的 `kind`；
3. MIME 类型仅用于区分 sticker 的静态或视频实现，以及响应头，不用于把 `document` 自动升级成视频卡片。

因此：

| 资产语义 | 信息流卡片 | 公开详情 | 我的资产 |
| --- | --- | --- | --- |
| `photo` | 图片封面 | 原图 | 保留 |
| `video` | 视频封面与播放 | 视频播放器 | 保留 |
| `video_note` | 圆形视频呈现 | 视频播放器 | 保留 |
| `animation` | 动图语义呈现，不显示文件名/MIME | 动图语义呈现 | 保留并标记为动图 |
| 静态/视频 `sticker` | 贴纸视觉呈现 | 完整呈现 | 保留 |
| `voice` / `audio` | 不放进瀑布流卡片 | 音频控件 | 保留 |
| `document` | 不放进瀑布流卡片 | 下载附件 | 保留 |
| `paid_photo` / `paid_video` | 默认不公开呈现 | 按现有权限处理 | 保留 |
| 联系人、位置、投票等结构化内容 | 不以原始对象撑开卡片 | 详情页结构化呈现 | 保留 |

一条已收录记录同时包含照片和文档时，信息流只展示照片与正文，文档只在详情页和“我的资产”中出现。

一条已收录记录只有文档但有正文时，信息流可展示纯文本卡片，不展示文件附件。

一条记录既没有正文，也没有可用于卡片的视觉内容时，默认设为 `unlisted`，避免出现只有文件名、MIME 或原始结构数据的公开卡片。

### Telegram 动图使用专用呈现

`animation` 不应复用普通文件块，也不应显示 `video.mp4`。信息流中按 Telegram 动图语义呈现：

- 使用视频文件作为真实载体；
- `muted`、`loop`、`playsinline`；
- 不显示播放器控制条、文件名和 MIME 类型；
- 使用已有视频预览图承担初始封面；
- 卡片仍受当前图片区域最高 `361px` 的约束。

普通 `video` 继续保留点击播放和控制条，两种语义不要仅因为底层都是 MP4 就合并。

## Telegram 采集去重

### 新数据

在 `extractAssets()` 形成下载列表之前完成语义去重：

1. 先读取 `animation`。
2. 再读取 `document`。
3. 当二者的 `file_unique_id` 相同，只保留 `animation`。
4. 当 `file_unique_id` 不同，两者都是独立真实资产，均保留。

去重必须发生在下载之前，避免重复网络请求、重复文件和重复数据库行。不能根据文件名 `video.mp4`、MIME 或大小猜测重复关系。

同样应检查 Telegram 其他明确的兼容字段关系。例如 `venue` 同时携带 `location` 时，结构化内容只保留地点语义中的一份位置数据，不在详情中重复展示。

### 历史数据

只处理能够被数据库事实精确证明的兼容重复：

```text
同一 entry_id
AND 一个 kind = animation
AND 一个 kind = document
AND telegram_file_unique_id 相同
```

对满足该条件的历史记录：

- 保留 `animation` 行及其媒体文件和预览；
- 删除重复的 `document` 行及对应重复文件；
- 重新计算该条记录展示出的资产数量。

不满足完整条件的 MP4 文档一律视为真实独立资产并保留。不得根据扩展名、文件大小相同或哈希猜测后自动删除。

## 默认收录规则

收录状态由服务端在内容创建或访问权限变化时决定，前端不复制判断逻辑。

默认 `listed` 的条件：

- 内容已发布；
- 访问权限为 `public` 或 `protected`；
- 并且满足以下任一条件：
  - 富文本文章；
  - 正文去除首尾空白后非空；
  - 至少有一项信息流视觉资产：照片、普通视频、圆形视频、动图或贴纸。

其他情况默认 `unlisted`。

具体入口行为：

- Telegram `/post`：按上述规则决定 `listed` 或 `unlisted`。
- Telegram `/note`：保存为 `private + unlisted`。
- Web 发布：按上述规则决定默认值，发布界面允许用户明确调整。
- 私有内容转公开：重新根据当前内容给出默认收录值，并在同一次操作中保存。
- 公开内容转私有：同时改为 `unlisted`。

机器人保存结果必须直接说明：

- `已保存为公开动态。`
- 或 `已公开保存，但未收录到信息流；可在“我的资产”中调整。`

不能静默把用户明确 `/post` 的内容隐藏起来。

## 管理端交互

### “访问权限”调整为“访问与展示”

现有弹窗分成两个直接选项：

- 谁能访问：公开 / 加密 / 私有；
- 公开收录：进入信息流 / 仅链接访问。

当选择私有时，公开收录固定为未收录。公开或加密内容可独立切换收录状态。

两个值由一个服务端操作原子保存，避免出现权限已改变但收录状态未改变的中间结果。

### 我的资产表格

现有“状态”列展示组合状态：

- `公开 · 已收录`
- `公开 · 未收录`
- `加密 · 已收录`
- `加密 · 未收录`
- `私有`
- `草稿`

筛选区增加“公开收录：全部 / 已收录 / 未收录”，便于快速找到只保留在管理端的内容。

素材摘要按真实语义显示，例如 `1 个动图`、`2 张图片 · 1 个文件`，不使用 `video.mp4` 作为内容类型。文件名仍可在详情或具体资产信息中查看。

## 数据与协议改动

### 数据库

在 `journal_entries` 增加受约束字段：

```sql
listing_status TEXT NOT NULL DEFAULT 'listed'
  CHECK (listing_status IN ('listed', 'unlisted'))
```

历史记录回填：

- 草稿与私有内容设为 `unlisted`；
- 已发布的公开或加密内容按“默认收录规则”计算；
- 现有正常公开文章、文字、图片、视频和动图保持可发现。

索引中的公开时间线条件加入 `listing_status`，避免公开信息流分页对未收录记录计数。

### 共享协议

增加：

```ts
type JournalListingStatus = 'listed' | 'unlisted'
```

`JournalEntry` 返回 `listingStatus`。管理端更新请求同时提交访问权限和收录状态。公开详情继续返回该字段没有实际展示必要时，也可以在公开序列化时省略，但管理端类型必须完整。

### Repository

提取唯一的“公开可发现”SQL 条件，供以下查询复用：

- `listPublicFeed()`；
- `searchDiscovery()`；
- `getDiscoveryArchiveOverview()`；
- `listDiscoveryArchiveMonth()`；
- RSS/JSON Feed 使用的公开列表。

管理列表 `list()`、`listPage()`、按 ID 查看和删除不应用该条件。

## 前端组件边界

- `FeedView`：只消费服务端已经筛好的收录记录，不在页面级再次猜测是否应显示。
- `EntryCard`：负责正文、状态与卡片结构，不判断扩展名。
- `MediaGallery`：根据 `display=card/detail` 决定呈现层级；卡片只渲染视觉资产，详情渲染全部真实资产。
- `JournalProgressiveAnimation`：专门呈现 Telegram 动图语义。
- `AssetTableView`：始终展示全部记录，并呈现 `listingStatus` 与真实资产摘要。
- “访问与展示”弹窗：通过 typed props / emits 提交一次完整设置，不直接修改父级状态。

不增加全局状态机，不使用生命周期监听去同步收录状态，也不让前端根据 MIME 重新实现服务端规则。

## 实施顺序

1. 修正 Telegram `animation + document` 兼容字段去重，阻止继续产生重复资产。
2. 增加 `listing_status` 数据字段、协议类型和服务端统一收录判定。
3. 让信息流、搜索、归档与订阅源统一应用收录条件。
4. 调整 `MediaGallery` 的 card/detail 呈现边界，并加入动图专用组件。
5. 扩展“访问与展示”弹窗与“我的资产”状态、筛选和素材摘要。
6. 精确清理历史 `file_unique_id` 相同的 animation/document 重复资产。

## 完成判定

- 截图所示 Telegram 动图在信息流中只出现一个动图区域，不再出现 `video.mp4 / video/mp4` 文件块。
- 真正作为文档发送的 MP4 不进入信息流媒体区，但仍在“我的资产”和详情附件中可管理。
- 只有附件且没有正文或视觉内容的记录默认不进入公开发现入口。
- `unlisted + public` 的准确链接可以打开，但不会出现在信息流、标签、搜索、归档、RSS 或 JSON Feed。
- 私有、未收录、草稿以及所有真实附件始终能在“我的资产”中找到。
- 历史兼容重复只在同一条记录且 `telegram_file_unique_id` 完全相同时清理，独立文件不受影响。
