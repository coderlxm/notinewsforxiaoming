# Journal 首页固定侧边栏与内容频道开发方案

## 1. 文档状态

- 状态：已确认并实施
- 需求依据：`doc/design/journal-home-fixed-sidebar-prd.md`
- 实施范围：Journal 服务端、公开信息流、普通内容发布与管理、公开首页外壳
- 首版频道：`life`、`article`、`interest`
- 发布阶段：已纳入本次正式发布

## 2. 实施结论

首版采用一条明确主路径：

1. `journal_entries` 增加唯一频道字段 `channel`；
2. 文章固定写入 `article`，其他入口默认写入 `life`；
3. Web 普通内容可以明确选择 `life` 或 `interest`；
4. 私有管理菜单允许把已发布普通记录移动到生活或兴趣；
5. 公开 Feed 必须携带当前频道，由数据库在游标分页前过滤；
6. `/` 代表生活，文章和兴趣通过 `channel` 查询参数表达；
7. 现有固定身份区下方增加频道导航与信息流两栏，只有信息流容器纵向滚动；
8. 生活和兴趣复用现有瀑布流，文章使用独立的文章摘要网格；
9. RSS、JSON Feed、详情链接和私有资产的全量读取不增加频道过滤。

首版不增加动态频道表、频道后台、二级标签栏、频道缓存或自动分类。

## 3. 当前源码事实

### 3.1 数据与写入入口

当前所有 Journal 内容最终进入 `journal_entries`，但有四条主要写入路径：

| 写入入口 | 当前落库位置 | 首版频道规则 |
| --- | --- | --- |
| Telegram `/post`、`/note` | `JournalRepository.create` | 固定 `life` |
| Web 普通内容和草稿 | `createWebEntry`、`updateWebDraft`、`publishWebDraft` | 用户选择 `life` 或 `interest`，默认 `life` |
| Web 富文本文章 | `createArticle` | 固定 `article` |
| 朋友投稿审核发布 | `publishContribution` | 保持现有流程，固定 `life` |

文章由 `body_format = 'rich'` 和 `content_type = 'article'` 表达；普通内容为 `body_format = 'plain'`。频道不会替代这些字段，只增加公开信息架构维度。

### 3.2 读取与分页

- `/api/feed`、私有资产、RSS 和 JSON Feed 共用 `JournalRepository.list`；
- `list` 当前先拼接数据库条件，再按置顶、发布时间和 ID 生成游标分页；
- 因此频道应作为 `JournalListFilters` 的可选条件加入仓储层；
- 公开 Feed 路由始终传入频道，私有资产和订阅源不传，从而继续读取全部内容。

### 3.3 页面与滚动

- `App.vue` 已经使用 `100dvh` 的两行外壳，身份区在第一行；
- `.app-scroll` 位于第二行，是当前唯一纵向滚动容器；
- 频道导航应作为 `.app-scroll` 的同级区域放入第二行，而不是放进 `FeedView` 内部；
- 这样身份区和侧边栏保持固定，只有信息流与页尾所在的内容区滚动。

### 3.4 路由与返回上下文

- Vue Router 当前只有一个公开列表路由 `/`，标签通过查询参数表达；
- `App.vue` 自己派生 `AppRoute`、维护详情来源和滚动位置；
- 普通记录通过详情浮层保留背景 Feed；文章进入独立详情页；
- 频道必须进入公开路由 key、详情来源和标签跳转，否则从详情返回时会丢失频道。

## 4. 数据模型

### 4.1 共享类型

在服务端共享协议与 Web 类型中增加：

```ts
type JournalChannel = 'life' | 'article' | 'interest';
type JournalPlainChannel = Exclude<JournalChannel, 'article'>;
```

`JournalEntry` 增加：

```ts
channel: JournalChannel;
```

职责约束：

- `channel` 回答公开一级入口；
- `bodyFormat` 继续回答普通记录或富文本文章；
- `contentType` 继续回答文字、图片、视频等载体；
- `tags` 继续回答频道内的细分主题。

### 4.2 数据库迁移

新增 Journal migration `version: 9`：

```sql
ALTER TABLE journal_entries
ADD COLUMN channel TEXT NOT NULL DEFAULT 'life';

UPDATE journal_entries
SET channel = 'article'
WHERE body_format = 'rich';

CREATE INDEX idx_journal_entries_public_channel_timeline
ON journal_entries(
  visibility,
  publication_status,
  channel,
  pinned DESC,
  source_created_at DESC,
  id DESC
);
```

迁移结果是确定性的：

- 所有历史文章进入 `article`；
- 所有历史普通记录进入 `life`；
- 不根据标签、正文或媒体生成 `interest`；
- 不修改公开状态、时间、置顶、标签、素材和公开 ID。

数据库字段使用普通 `TEXT`，不增加固定三值的数据库 `CHECK`。写入值由共享 Zod schema 和业务入口校验。这样未来增加频道只需要扩展共享协议和频道配置，不需要为了修改数据库枚举重建 `journal_entries`。

### 4.3 数据一致性

- 创建文章时仓储层显式写入 `article`，不依赖数据库默认值；
- Telegram、朋友投稿和未指定频道的 Web 普通内容显式写入 `life`；
- Web 普通内容只接受 `life` 或 `interest`；
- 富文本文章不提供频道修改入口；
- Telegram 媒体组修改频道时，复用现有 group 更新规则，使同一媒体组的所有底层记录保持相同频道。

## 5. 服务端实现

### 5.1 协议与请求 Schema

`src/shared/journalProtocol.ts` 增加：

- `journalChannelSchema`；
- `journalPlainChannelSchema`；
- `JournalChannel`、`JournalPlainChannel` 类型；
- `JournalEntry.channel`；
- `journalChannelUpdateRequestSchema`。

Web 普通内容创建和草稿更新请求增加 `channel`：

```ts
{
  contentText: string;
  channel: 'life' | 'interest';
  action: 'draft' | 'publish';
  // 其余字段保持现状
}
```

草稿也保存频道，公开时直接沿用当前选择。

### 5.2 仓储层

`JournalRepository` 调整范围：

1. `EntryRow` 增加 `channel`；
2. `toEntry` 输出 `channel`；
3. `CreateWebEntryInput`、`UpdateWebDraftInput`、`PublishWebDraftInput` 增加普通频道；
4. 四条 INSERT 显式写入频道；
5. 草稿保存和发布时同步更新频道；
6. `JournalListFilters` 增加可选 `channel`；
7. `list` 在游标条件之前加入 `e.channel = ?`；
8. 增加 `updatePlainChannel(id, channel)`。

`updatePlainChannel` 的规则：

- 记录不存在时返回未找到；
- `body_format = 'rich'` 时直接拒绝，不允许文章移入普通频道；
- 普通草稿只更新当前 ID；
- 已发布 Telegram 媒体组更新整组；
- 更新 `updated_at`，不修改发布时间和公开链接。

### 5.3 公开 Feed

`/api/feed` 查询结构调整为：

```text
GET /api/feed?channel=life
GET /api/feed?channel=article
GET /api/feed?channel=interest
```

行为：

- 缺少 `channel` 按产品定义解析为 `life`；
- 未知频道由请求 Schema 直接拒绝；
- `tag` 继续可选，但只作用于当前频道；
- 路由把频道传给 `repository.list`；
- 频道条件在分页前执行，游标只描述当前频道中的位置。

RSS 和 JSON Feed 继续调用不带 `channel` 的 `repository.list`，因此保持全量公开时间线。

### 5.4 私有频道修改接口

新增：

```text
PATCH /api/me/entries/:id/channel
```

请求：

```json
{ "channel": "interest" }
```

该接口要求管理员会话，只接受普通频道。成功后返回完整 `JournalEntry`，前端直接替换当前记录。文章请求直接暴露业务错误，不自动改写为其他频道。

### 5.5 各写入路径

#### Telegram

不修改 Bot 命令和 ingest 请求。`JournalRepository.create` 显式写入 `life`，因此 `/note`、`/post` 和媒体组主路径不增加任何用户步骤。

#### Web 普通内容

`JournalWebEntryService` 的创建、保存草稿和发布草稿都接收 `JournalPlainChannel`，并原样传给仓储层。

#### 文章

`JournalArticleService` 的请求和编辑器不增加频道字段。`createArticle` 在仓储层固定写入 `article`，已有文章更新不改变频道。

#### 朋友投稿

朋友投稿页面和审核表单不增加频道选择。审核发布 INSERT 显式写入 `life`；如需归入兴趣，发布后通过现有私有详情管理入口移动。

## 6. Web 频道配置

新增 `web/src/journalChannels.ts`，作为公开导航和频道展示的唯一前端配置：

```ts
interface PublicChannelDefinition {
  slug: JournalChannel;
  label: string;
  order: number;
  layout: 'waterfall' | 'article-grid';
}

export const publicChannels = [
  { slug: 'life', label: '生活', order: 10, layout: 'waterfall' },
  { slug: 'article', label: '文章', order: 20, layout: 'article-grid' },
  { slug: 'interest', label: '兴趣', order: 30, layout: 'waterfall' },
] as const;
```

该配置负责：

- 桌面侧边栏顺序；
- 移动频道栏顺序；
- 当前频道中文标题；
- 当前频道使用哪一种 Feed 渲染器；
- 普通内容可选择的频道集合。

首版使用文字导航，不新增图标依赖。未来图标可作为配置字段加入。

服务端仍在共享协议中维护合法值，因为当前 Web 不直接复用服务端源码。两端定义各自承担 API 边界校验，首版不为消除这三个字符串而调整构建边界。

## 7. 路由与 URL 状态

### 7.1 公开路由模型

`AppRoute` 的公开分支调整为：

```ts
{
  name: 'public';
  key: string;
  channel: JournalChannel;
  tag: string;
}
```

解析规则：

- 没有 `channel`：`life`；
- `channel=article`：文章；
- `channel=interest`：兴趣；
- 显式 `channel=life` 也可解析，但生成站内链接时省略；
- 其他字符串：进入现有 404，不回退到生活。

### 7.2 URL 生成

新增统一的 `publicFeedPath(channel, tag?)`：

- 生活无标签：`/`；
- 生活带标签：`/?tag=旅行`；
- 文章：`/?channel=article`；
- 兴趣标签：`/?channel=interest&tag=摄影`。

侧边栏切换频道时清除当前标签，并从目标频道顶部开始。卡片标签点击和“清除标签”必须保留当前频道。

### 7.3 组件 key 与缓存

公开 Feed key 包含 `channel` 和 `tag`：

```text
public:<channel>:<tag>
```

公开 Feed 不放入频道级 `KeepAlive`。频道切换会卸载当前公开 Feed，并重新读取目标频道第一页，符合首版“不缓存三个频道列表”的要求。

私有 Feed 保留现有缓存行为，不因公开频道拆分创建多份私有状态。

### 7.4 详情返回

- 从普通记录 Feed 打开详情浮层时，`OverlayContext.origin` 保存频道和标签；
- 关闭浮层继续显示原 Feed，不重建列表；
- 从文章频道打开文章详情时，浏览器返回恢复文章频道 URL；
- 从 Feed 离开到文章详情时记录当前滚动位置，返回且布局完成后恢复；
- 直接打开普通记录详情时，根据详情返回的 `entry.channel` 构造背景 Feed；
- 直接打开详情后的返回入口使用该记录频道，而不是无条件返回生活。

## 8. 页面外壳与滚动区域

### 8.1 App 结构

在身份区与现有 `.app-scroll` 之间增加第二层布局容器：

```text
app-shell
├─ profile-bar
└─ app-main
   ├─ PublicChannelNavigation
   └─ app-scroll
      ├─ FeedView / 其他页面
      └─ site-footer
```

只有公开列表或保留公开背景 Feed 的普通详情浮层显示 `PublicChannelNavigation`。私有资产、编辑器、投稿审核、文章独立详情和设置页保持单栏。

### 8.2 桌面端 CSS

公开列表时：

```css
.app-main--public {
  display: grid;
  grid-template-columns: 216px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}
```

- 频道导航不设置纵向滚动；首版内容可以完整容纳；
- `.app-scroll` 保持 `overflow-y: auto`；
- 页面根元素和 `.app-main` 保持 `overflow: hidden`；
- 侧边栏右侧使用轻分隔和留白，不增加卡片容器；
- 侧边栏内部使用上下两段布局，主频道位于顶部，底部区域首版为空且不渲染占位文案。

### 8.3 移动端 CSS

移动端 `app-main--public` 改为两行：

```text
频道栏（固定在滚动容器外）
信息流滚动容器
```

- 同一个 `PublicChannelNavigation` 组件通过 CSS 改为横向三等分；
- 不渲染第二份移动导航；
- 频道栏位于 `.app-scroll` 外，因此不会随信息流离开视口；
- 首版三个频道不启用横向滚动和折叠菜单。

### 8.4 滚动位置规则

现有 `feedScrollPositions` 调整为区分两类跳转：

- 频道 A → 频道 B：目标位置固定为顶部，不读取此前频道 B 的位置；
- Feed → 详情 → 原 Feed：保存并恢复原频道位置；
- 私有资产相关滚动恢复保持现状。

滚动仍通过现有 `.app-scroll` DOM 引用和路由完成事件处理，不增加新的 `watch`，也不引入动画帧调度。

## 9. 前端组件拆分

### 9.1 组件图

```text
App.vue
├─ Profile Bar
└─ Public workspace
   ├─ PublicChannelNavigation.vue
   └─ FeedView.vue
      ├─ Public intro / weather
      ├─ WaterfallFeed.vue                 生活、兴趣
      └─ PublicArticleFeed.vue             文章
         ├─ ArticleCardContent.vue         复用摘要卡片
         └─ JournalArticleFeedPlaceholder.vue

EntryPublisherView.vue
└─ EntryChannelField.vue                   生活、兴趣选择

私有记录卡片 / 详情
└─ CardActionMenu.vue                      移动到其他普通频道
```

### 9.2 组件职责与契约

#### `PublicChannelNavigation.vue`

- props：当前 `channel`；
- emit：`select(channel)`；
- 从 `publicChannels` 渲染导航；
- 使用 `aria-current="page"` 标识当前频道；
- 负责桌面侧栏和移动横栏的视觉，不读取路由、不请求数据。

#### `FeedView.vue`

- 新增公开 `channel` prop；
- 首次加载、刷新、加载更早内容都显式传入频道；
- 根据频道配置选择瀑布流或文章网格；
- 公开标题、空状态和标签跳转使用当前频道；
- 继续作为唯一的 Feed 数据与业务动作编排层。

#### `PublicArticleFeed.vue`

- 只接收文章 entries、loading 和当前 mutation 状态；
- 使用普通 CSS Grid，不创建第二套瀑布流实例；
- 宽屏三列、中等屏两列、移动端一列；
- 每项复用 `ArticleCardContent display="summary"`；
- 通过 `onMounted` 和 `onUpdated` 报告布局完成，衔接现有分页状态；
- 不持有请求、频道或路由状态。

#### `JournalArticleFeedPlaceholder.vue`

- 骨架列数与文章网格断点一致；
- 还原封面、标题和摘要的实际占位；
- 不复用瀑布流骨架。

#### `EntryChannelField.vue`

- `v-model`：`JournalPlainChannel`；
- props：`disabled`；
- 视觉结构与现有发布范围字段一致；
- 只展示生活与兴趣，不展示文章。

### 9.3 Vue 数据流

- URL 是公开频道唯一状态源；
- `App.vue` 从路由派生频道，通过 prop 传给导航与 `FeedView`；
- 导航只发出选择事件，由 `App.vue` 更新 URL；
- `FeedView` 把频道传给 composable，composable 传给 API；
- 频道修改使用 props down、events up 的既有卡片事件链；
- 不增加 Pinia 频道 Store，也不把 URL 与本地 ref 双向同步。

## 10. 普通内容发布与管理

### 10.1 发布页面

`EntryPublisherView.vue` 增加：

```ts
const channel = shallowRef<JournalPlainChannel>('life');
```

行为：

- 新建默认生活；
- 打开草稿后从 `entry.channel` 初始化；
- 保存草稿和公开发布都发送频道；
- 频道字段与发布范围互不影响；
- 发布成功仍回到私有资产页。

### 10.2 API composable

- `publishEntry`、`updateDraft` 增加 `channel`；
- `useEntryPublisher` 的输入类型增加频道；
- `JournalEntry` 返回后继续作为单一真实状态。

### 10.3 已发布普通记录管理

`CardActionMenu` 增加频道信息和 `setChannel` 事件。普通已发布记录的菜单列出除当前频道外的其他普通频道：

```text
移动到生活
移动到兴趣
```

当前只有两个普通频道，因此实际只出现一个“移动到……”选项。菜单由普通频道配置循环产生，未来增加普通频道时不复制命令分支。

事件沿现有路径传递：

```text
CardActionMenu
→ EntryCard / JournalDetailContent
→ WaterfallFeed / JournalDetailOverlay
→ FeedView
→ useJournalApi.setChannel
→ PATCH /api/me/entries/:id/channel
```

草稿通过“继续编辑”进入发布页修改频道，不在卡片菜单重复提供频道动作。文章不显示频道移动项。

## 11. API 与状态变化汇总

### 11.1 响应变化

所有 `JournalEntry` 响应新增：

```json
{ "channel": "life" }
```

涉及公开 Feed、私有 Feed、详情、文章、Bot ingest 结果和投稿发布结果。调用方继续消费完整对象。

### 11.2 新增或调整的请求

| 请求 | 变化 |
| --- | --- |
| `GET /api/feed` | 增加频道查询；缺省为生活 |
| `POST /api/me/entries` | 增加普通频道 |
| `PATCH /api/me/entries/:id/draft` | 增加普通频道 |
| `PATCH /api/me/entries/:id/channel` | 新增普通记录频道修改 |
| 文章 API | 请求不变，响应增加频道 |
| Telegram ingest | 请求不变，响应增加频道 |
| 投稿发布 | 请求不变，默认写入生活 |

## 12. 文件改动范围

### 12.1 新增

- `web/src/journalChannels.ts`
- `web/src/components/journal/PublicChannelNavigation.vue`
- `web/src/components/article/PublicArticleFeed.vue`
- `web/src/components/article/JournalArticleFeedPlaceholder.vue`
- `web/src/components/publisher/EntryChannelField.vue`

### 12.2 服务端与共享协议

- `src/shared/journalProtocol.ts`
- `src/journal-server/types.ts`
- `src/journal-server/migrations.ts`
- `src/journal-server/repository.ts`
- `src/journal-server/routes/publicFeed.ts`
- `src/journal-server/routes/privateEntries.ts`
- `src/journal-server/webEntryService.ts`

文章 Service、Bot handler 和 ingest 请求不需要增加频道参数；频道由仓储写入规则确定。

### 12.3 Web 数据与路由

- `web/src/types.ts`
- `web/src/api.ts`
- `web/src/composables/useJournalApi.ts`
- `web/src/composables/useEntryPublisher.ts`
- `web/src/router.ts`：路由表不增加页面，只保留 `/` 并使用查询参数
- `web/src/App.vue`
- `web/src/components/journal/FeedView.vue`

### 12.4 Web 发布与管理

- `web/src/components/publisher/EntryPublisherView.vue`
- `web/src/components/journal/CardActionMenu.vue`
- `web/src/components/journal/EntryCard.vue`
- `web/src/components/journal/JournalDetailContent.vue`
- `web/src/components/journal/JournalDetailOverlay.vue`
- `web/src/components/journal/WaterfallFeed.vue`

`AssetTableView.vue` 首版不增加频道列。表格通过现有“打开”入口进入详情后管理频道，避免扩大私有资产表格需求。

## 13. 实施顺序

### 阶段一：建立频道数据事实

1. 增加共享频道 schema 和 `JournalEntry.channel`；
2. 增加 migration 9、历史归属和索引；
3. 修改仓储行类型、序列化和四条 INSERT；
4. 让普通草稿保存、发布和频道修改完整落库；
5. 保证文章固定 `article`，其他未选择入口固定 `life`。

这一阶段完成后，所有新旧记录都有确定频道，但公开页面仍可保持旧布局。

### 阶段二：打通频道 API 与管理

1. `/api/feed` 增加频道过滤；
2. 增加私有频道修改接口；
3. Web API、类型和 composable 传递频道；
4. 发布页增加生活/兴趣选择；
5. 已发布普通记录菜单增加移动频道动作。

### 阶段三：公开首页外壳

1. 增加前端频道配置和导航组件；
2. `AppRoute` 解析频道，未知值进入 404；
3. 建立 `app-main` 两栏/两行布局；
4. 把导航放在滚动容器外；
5. 调整公开 Feed key、标签 URL、详情来源与滚动恢复。

### 阶段四：频道内容布局

1. 生活和兴趣接入现有瀑布流；
2. 增加文章网格和匹配骨架；
3. 接入频道标题、空状态、刷新和无限分页；
4. 保持天气、详情、RSS 和 JSON Feed 原有行为。

### 阶段五：发布准备

1. 按产品验收标准覆盖三频道的首屏、分页、空状态和详情返回；
2. 核对四条写入入口的频道结果；
3. 确认历史迁移后文章与普通记录数量符合确定规则；
4. 形成一次包含数据库、服务端和 Web 的完整发布提交；
5. 沿用项目现有 main push 与 GitHub Actions 自动部署流程。

## 14. 关键验收场景

### 14.1 数据

- 历史富文本文章均为 `article`；
- 历史普通内容均为 `life`；
- 新 Telegram 记录均为 `life`；
- Web 普通草稿能保存并保持生活或兴趣；
- 文章无法通过普通管理接口移动频道；
- Telegram 媒体组移动频道后整组一致。

### 14.2 公开读取

- `/` 只出现生活；
- 文章和兴趣频道只出现本频道记录；
- 每个频道连续加载更早内容时没有其他频道数据；
- 当前频道内标签筛选不跨频道；
- RSS 和 JSON Feed 仍包含全部公开频道。

### 14.3 布局与滚动

- 桌面端身份区和侧边栏固定，只有右侧内容滚动；
- 移动端身份区和频道栏固定，只有下方内容滚动；
- 页面不存在外层与信息流两条纵向滚动条；
- 频道切换从顶部开始；
- 从详情返回恢复原频道和原位置；
- 文章骨架列数与文章卡片列数一致；
- 瀑布流骨架继续与生活和兴趣的真实列数一致。

### 14.4 扩展性

- 桌面侧栏和移动频道栏使用同一组件和同一配置；
- 频道渲染器由配置决定；
- 增加第四个频道不需要复制 `FeedView`；
- 侧边栏结构保留底部区域，但首版没有空入口；
- Feed 顶部仍有明确位置可在后续接入频道标签栏。

## 15. 风险与控制

### 15.1 频道过滤与游标

频道必须在游标分页前进入 SQL 条件。若在前端过滤，页面会出现少项、提前结束或跨频道混入。本方案只允许数据库过滤主路径。

### 15.2 公开 Feed 缓存

当前 `KeepAlive` 同时包裹公开与私有 Feed。若直接把频道加入 key，会保留多个频道实例，与首版规则冲突。实施时应把公开 Feed 从频道级缓存中移出，只保留详情上下文和私有 Feed 所需状态。

### 15.3 双滚动容器

侧边栏不能作为 `.app-scroll` 子元素，也不能给 Feed 内部再设置独立固定高度和滚动。正确结构是侧边栏与唯一 `.app-scroll` 并列。

### 15.4 文章与兴趣语义

频道是互斥一级归属。即使文章内容谈论摄影，它仍属于文章频道；摄影作为标签保留，未来由文章频道内标签栏继续细分。首版不允许同一记录复制到文章和兴趣两个频道。

### 15.5 新频道扩展

数据库不锁死枚举，但服务端协议与前端配置仍必须同步增加新标识。未知值必须暴露错误，不能自动显示到生活或从公开页面消失后假装成功。

## 16. 首版明确不实现

- “全部”公开入口；
- 频道内标签栏；
- 频道管理后台；
- 自动兴趣分类；
- 每个频道的独立列表缓存；
- 频道内容数量；
- 侧边栏“关于我”真实内容；
- 私有资产表格频道列；
- Telegram 频道选择按钮或新命令；
- 朋友投稿审核页频道选择；
- 多频道归属或内容副本。

## 17. Review 后即可实施的固定口径

- `/` 是生活，不存在首版“全部”；
- 频道状态由 URL 表达；
- 频道是独立字段，不复用标签或内容类型；
- 文章固定文章频道；
- 普通内容默认生活，可调整为兴趣；
- 公开分页由服务端按频道过滤；
- 桌面侧栏和移动频道栏位于滚动容器外；
- 生活与兴趣使用瀑布流，文章使用摘要网格；
- 底部扩展区与顶部标签栏只保留结构空间，不提前实现内容。
