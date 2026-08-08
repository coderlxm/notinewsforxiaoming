# `/me` 资产管理改造开发方案

## 1. 开发目标与范围

本方案承接已确认的《`/me` 资产管理改造方案》，目标是将当前共用无限滚动状态的瀑布、表格两种展示，改造成共享查询条件但数据行为独立的两条主路径：

- 瀑布视图继续使用 cursor 无限滚动，服务连续浏览；
- 表格视图使用服务端页码分页，展示总条数并支持任意页跳转；
- 搜索、筛选和视图切换成为稳定的管理工具栏，不跟随结果区加载；
- 表格每行直接提供编辑入口，并补齐普通已发布记录的编辑主路径；
- 移动端移除页头刷新按钮，保留下拉刷新。

本轮只调整 `/me` 管理路径及其直接依赖的接口、查询和编辑能力。公开 feed、公开详情、投稿、设置和文章公开阅读路径不进入改造范围。

## 2. 已核对的当前实现

### 2.1 前端现状

- `App.vue` 只从 `/me` URL 读取 `view` 和 `entry`，私有 feed 的持久 key 固定为 `private`。
- `FeedView.vue` 同时承担鉴权、页面头部、筛选、往年今日、两种视图、刷新、无限滚动、详情浮层和记录变更。
- `WaterfallFeed.vue` 与 `AssetTableView.vue` 共用 `useJournalApi()` 中的 `entries`、`nextCursor` 和加载状态。
- 外层 Vant `List` 无条件包裹两种私有视图，因此表格仍通过滚动触底追加数据。
- `EntryFilters.vue` 内部保存筛选草稿，并以 350 ms 延迟自动提交。
- `AssetTableView.vue` 当前只有“打开”动作；已发布记录会先进入详情，之后才能通过三点菜单编辑。
- `EntryPublisherView.vue` 与 `/me/entries/:entryId/edit` 已存在，但只允许 Web 草稿。已发布普通记录进入该路由后会显示不可编辑错误。
- `ArticleEditorView.vue` 已经可以编辑已发布文章。
- 私有 `FeedView` 位于 `KeepAlive` 中，进入编辑页后实例会保留；但编辑页“返回我的资产”和普通记录发布完成当前都直接导航到无查询参数的 `/me`，会丢失表格页码。

### 2.2 服务端现状

- `GET /api/me/entries` 固定每次读取 30 条，只接受 cursor 与筛选参数。
- `repository.list()` 使用 `pinned DESC, source_created_at DESC, id DESC` 的稳定顺序和 keyset cursor。
- `JournalFeed` 只有 `entries` 与 `nextCursor`，没有总条数和页码信息。
- 已有正文、频道、可见性、置顶、发布时间等独立更新接口。
- Web 普通记录的媒体增删与保存只支持草稿；`JournalWebEntryService.getDraft()` 明确拒绝已发布记录和非 Web 来源记录。

### 2.3 已安装组件能力

当前项目安装 Element Plus 2.14.3。其 `ElPagination` 已提供 `total`、`page-size`、受控 `current-page`、`pager-count`，并通过 `layout` 支持 `prev`、`pager`、`next`、`jumper` 和 `total`，可以直接覆盖已确认的分页交互，不需要自制分页器。

## 3. 总体技术结构

### 3.1 页面状态分层

`/me` 的状态拆成三层：

1. **查询状态**：`filters`、`assetView`、表格 `page`，由私有页面容器统一持有。
2. **瀑布数据状态**：瀑布 entries、nextCursor、首次加载、加载更多。
3. **表格数据状态**：当前页 entries、page、pageSize、total、当前页加载。

两种结果状态不再共用 entries，也不通过切换 CSS 或组件分支复用已加载结果。它们只共享同一个 `FeedFilters` 值和同一组记录变更动作。

### 3.2 组件图

```text
FeedView
├── PrivateAssetHeader
├── OnThisDay
├── AssetManagementToolbar
│   ├── 常驻搜索
│   ├── 详细筛选
│   └── AssetViewSwitch
└── 结果区
    ├── PrivateWaterfallResults
    │   └── WaterfallFeed
    └── PrivateAssetTableResults
        ├── AssetTableView
        └── ElPagination
```

组件职责与契约：

- `FeedView.vue`：保留公共/私有 feed 的入口编排与鉴权；私有模式下组合工具栏和当前结果区，不再直接实现表格分页。
- `PrivateAssetHeader.vue`：展示标题和页面级动作；发出 refresh、createEntry、createArticle、openSettings、logout 事件。移动端通过组件样式隐藏 refresh。
- `AssetManagementToolbar.vue`：持有筛选表单草稿，接收已应用 filters 和当前 view；发出 applyFilters、changeView。搜索延迟提交继续使用现有 `useDebounceFn`。
- `PrivateWaterfallResults.vue`：管理私有瀑布首次读取、加载更多及对应加载状态；向下传递现有卡片操作事件。
- `PrivateAssetTableResults.vue`：接收当前 page 和 filters，管理页数据请求；将分页变化向上发出，数据内容传给 `AssetTableView`。
- `AssetTableView.vue`：只负责表格列和行操作，不再接收全局首次加载状态，也不触发 feed 布局完成回调。

不新增全局 store。上述状态只服务 `/me`，用页面内 composable 和显式 props/emits 即可。

## 4. URL 与导航状态

### 4.1 URL 规则

私有路由扩展为：

```text
/me?view=table&page=3
/me?view=waterfall
```

规则如下：

- `view` 继续只允许 `table | waterfall`。
- `page` 只允许正整数；缺省为 1。
- `view=waterfall` 时不写 `page`。
- `view=table&page=1` 可省略 `page`，由路由层归一为 1。
- `entry` 详情浮层参数与当前 view、page 同时保留，例如 `/me?view=table&page=3&entry=42`。
- 搜索和详细筛选本轮不写 URL，继续由保活的私有页面实例持有；视图切换期间保持同一份 filters。

### 4.2 `App.vue` 调整

私有 `AppRoute` 增加 `page: number`。`privateFeedPath()` 改为接收一个明确的参数对象：

```ts
interface PrivateFeedLocation {
  assetView: AssetView;
  page: number;
  entryId?: number;
}
```

所有 `/me` 路径生成统一经过该函数，覆盖：

- 切换视图；
- 表格翻页；
- 从表格打开详情；
- 关闭详情；
- 删除详情中的记录；
- 编辑页返回。

私有 feed 的缓存 key 仍保持 `private`，避免每次翻页重建整个页面。页面变化由 `page` prop 驱动表格结果区请求。滚动位置缓存 key 也保持 `private`；表格翻页后由表格结果区回到自身顶部，不把不同页分别保存成多个 feed。

### 4.3 编辑页返回语境

表格行进入编辑页时，将当前 `currentRoute.fullPath` 写入 router history state 的 `journalReturnPath`，不把完整返回地址拼进公开可见的查询参数。

`ArticleEditorView.vue` 和 `EntryPublisherView.vue` 的“返回我的资产”统一按以下规则导航：

- history state 存在 `journalReturnPath`：返回该 `/me` 地址；
- 从其他入口直接打开编辑页：返回 `/me`。

保存内容后不自动离开编辑页；用户点击返回时回到原表格页。普通记录从编辑页完成首次发布后，也返回原管理语境，不再无条件进入无参数 `/me`。

## 5. 服务端分页设计

### 5.1 新接口

新增独立接口，保留现有 cursor 接口语义不变：

```http
GET /api/me/entries/page?page=3&pageSize=30&visibility=public&query=旅行
```

查询参数：

```ts
{
  page: number;       // 正整数
  pageSize: 30;       // 本轮固定只接受 30
  visibility?: 'private' | 'public';
  query?: string;
  tag?: string;
  contentType?: string;
  from?: string;
  to?: string;
}
```

响应：

```ts
interface JournalPage {
  entries: JournalEntry[];
  page: number;
  pageSize: number;
  total: number;
}
```

没有结果时返回 `entries: []`、`total: 0` 和请求页码。服务端不静默改写超出总页数的 page；前端根据明确的 total 更新 URL 到仍存在的末页并重新发起对应页请求。

### 5.2 协议与类型

- `src/shared/journalProtocol.ts` 新增 `journalPageSchema` 与 `JournalPage`。
- `web/src/types.ts` 增加对应的 `JournalPage` 接口。
- `web/src/api.ts` 新增 `fetchPrivateTablePage({ page, pageSize, filters })`，复用现有 `appendFilterParams()`。
- 现有 `JournalFeed`、`fetchPrivateFeed()` 和公开 feed 协议保持不变。

### 5.3 Repository 查询

`JournalListFilters` 中继续保留 cursor 列表所需字段；新增 `JournalPageFilters`，包含相同筛选字段以及 page、pageSize。

为了保证 cursor 与页码结果的筛选语义完全一致，将当前 `list()` 内构造 WHERE 条件的部分提取为 repository 私有方法，返回：

```ts
{ conditions: string[]; parameters: unknown[] }
```

随后：

- `list()` 在共享条件后追加 cursor 条件，继续执行 keyset 查询；
- `listPage()` 使用相同条件执行 `COUNT(*)`；
- `listPage()` 使用相同排序执行 `LIMIT ? OFFSET ?`；
- `offset = (page - 1) * pageSize`；
- 结果查询和总数查询都保留 `groupRepresentativeCondition('e')`，确保媒体组代表记录不会被重复计数。

排序固定为：

```sql
ORDER BY e.pinned DESC, e.source_created_at DESC, e.id DESC
```

本轮不新增数据库迁移。现有 timeline、content type 和 channel timeline 索引继续服务主排序及部分筛选；关键词和 JSON 标签筛选的总数查询成本与数据规模一起观察，但不为尚未发生的性能问题预建搜索系统或额外索引。

## 6. 前端数据层

### 6.1 保留 `useJournalApi()` 的职责

`useJournalApi()` 继续管理：

- 公共 feed；
- 私有瀑布 feed；
- 私有详情与往年今日；
- 记录变更请求；
- 鉴权状态。

将现有笼统的 `loading` 在调用侧按业务动作使用，不再让它直接控制整个私有页面的工具栏和两种结果区。

### 6.2 新增 `usePrivateAssetTable()`

新增 `web/src/composables/usePrivateAssetTable.ts`，仅负责表格分页数据：

```ts
entries: readonly Ref<JournalEntry[]>;
page: readonly Ref<number>;
pageSize: 30;
total: readonly Ref<number>;
loading: readonly Ref<boolean>;
error: readonly Ref<string | null>;
load(options: { page: number; filters: FeedFilters }): Promise<void>;
replaceEntry(entry: JournalEntry): void;
removeEntry(id: number): void;
clear(): void;
```

entries 使用根数组替换，页面数字、总数、loading 和 error 使用 `shallowRef`。composable 只接受已应用 filters，不持有筛选表单草稿，也不自行读取路由。

### 6.3 记录变更同步

`useJournalApi()` 的变更方法改为在成功时返回更新后的 `JournalEntry`，删除成功时返回删除结果；错误仍通过现有 error 暴露，不吞错。

`FeedView` 作为变更协调者：

- 频道等行内更新成功后，同时更新瀑布、往年今日、详情和当前表格页中同 id 记录；
- 删除后从当前表格页移除记录，并重新读取当前页以获得正确 total 和补齐该页行数；
- 若删除后当前 page 大于新的末页，更新 URL 到新的末页，由 page 变化触发一次明确请求；
- 从独立编辑页返回时，私有 `FeedView` 的 `onActivated` 根据当前 view 只刷新对应结果区，同时刷新往年今日。

不加入请求重试、旧数据回退或静默忽略。

## 7. 私有页面与加载边界

### 7.1 鉴权阶段

私有页面首次进入仍先确认会话：

- 未登录：只呈现登录区域；
- 登录成功：页面头部、往年今日容器、管理工具栏立即进入稳定布局；
- 当前视图结果区独立读取数据。

登录动作不再以表格/瀑布共用 entries 作为完成标志。登录成功后根据当前 view 调用相应数据入口。

### 7.2 工具栏

将 `EntryFilters.vue` 和 `AssetViewSwitch.vue` 组合进 `AssetManagementToolbar.vue`：

- 桌面第一行：关键词搜索，右侧视图切换；
- 桌面第二行：可见性、格式、标签、日期与清空；
- 移动端第一行：常驻搜索与视图切换；
- 移动端详细条件由原筛选折叠交互承载。

工具栏不接收 loading，不因数据请求禁用或隐藏。筛选输入经过 350 ms 延迟后发出完整 `FeedFilters`；筛选改变时：

- 表格 view：先将 URL page 归 1，再读取第 1 页；
- 瀑布 view：清空旧 cursor 结果并读取首批；
- 视图切换：保留 filters，表格从第 1 页进入，瀑布读取首批。

不使用 `watch`。筛选、视图和分页均通过用户事件调用明确动作；工具栏直接以页面容器持有的查询对象作为 `v-model` 契约，不再维护需要监听 props 同步的第二份筛选状态。浏览器前进/后退造成的 page 变化由页面注册并在卸载时移除的 router afterEach 回调处理。整个改造不引入任何 RAF。

### 7.3 结果区

- 瀑布首次读取：只在瀑布范围内显示 `JournalWaterfallPlaceholder`。
- 瀑布加载更多：保留已有卡片，只在底部显示加载提示。
- 表格首次读取或筛选替换：保留表格外框与表头，tbody 区域显示 `JournalAssetTablePlaceholder`。
- 表格翻页：分页条保持可见并禁用交互，表格主体进入加载态。
- 空状态与错误状态都位于当前结果区内。
- 私有工具栏和页面头部不再等待 `layoutReady`。

Vant `List` 只包裹公共 feed 和瀑布结果，表格分支移到其外。`AssetTableView` 删除 `onMounted/onUpdated -> layoutReady`，因为表格不再参与无限滚动布局结算。

## 8. 表格视图实现

### 8.1 表格列

保留并调整为以下顺序：

1. 时间
2. 内容
3. 所属板块
4. 状态
5. 类型
6. 素材
7. 操作

操作列在右侧固定，桌面显示：

- `编辑` 或草稿的 `继续编辑`；
- `查看`；
- `•••`。

所属板块继续使用现有 `AssetTableChannelCell` 行内修改。状态只展示。三点菜单复用 `CardActionMenu` 的低频动作能力，但表格行包装组件只接入删除、置顶、可见性和发布时间；频道不在菜单重复出现。

### 8.2 新增行操作组件

新增 `AssetTableActions.vue`，输入：

```ts
entry: JournalEntry;
busy: boolean;
```

发出：

```ts
edit: [entry: JournalEntry];
view: [entry: JournalEntry];
editPublishedTime: [entry: JournalEntry];
setPinned: [entry: JournalEntry, pinned: boolean];
setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
deleteEntry: [entry: JournalEntry];
```

表格本身只向上转发，不直接调用 router 或 API。

### 8.3 分页器

`PrivateAssetTableResults.vue` 使用已安装的 `ElPagination`：

```vue
<ElPagination
  :current-page="page"
  :page-size="30"
  :total="total"
  :pager-count="7"
  layout="total, prev, pager, next, jumper"
  :disabled="loading"
  @current-change="emit('changePage', $event)"
/>
```

不开放 page size 切换，保证 URL、接口和页面密度只有一个明确值。总数为 0 时保留“共 0 条”的结果信息，隐藏无意义的页码跳转区域。

### 8.4 移动端

- 表格设置明确的内容最小宽度并横向滚动，不把列改造成卡片。
- 操作列固定在右侧，编辑入口始终可达。
- 分页器使用较小的 pager count，但仍保留 total 和 jumper；布局允许换行，不横向挤压表格。
- 页头 refresh 按钮在 `max-width: 599px` 隐藏，下拉刷新继续作用于当前 view。

## 9. 普通记录完整编辑路径

### 9.1 编辑入口分流

表格点击编辑时：

- `bodyFormat === 'rich'`：进入现有 `article-edit`；
- `bodyFormat === 'plain'`：进入 `entry-edit`；
- 草稿按钮文案为“继续编辑”，已发布记录为“编辑”。

### 9.2 `EntryPublisherView` 扩展

普通记录编辑页支持三种状态：

- 新建 Web 记录；
- 编辑 Web 草稿；
- 编辑已发布普通记录。

已发布普通记录进入后初始化正文、频道、可见性和发布时间。操作区从“保存草稿 / 发布”切换为单一“保存修改”，保存后停留在当前编辑页。

附件边界：

- Web 来源记录：沿用现有附件新增和删除能力；
- Telegram 来源记录：附件作为原始采集结果只读展示，本轮不提供替换或删除；
- 两类记录都允许编辑正文、频道、可见性和发布时间；
- 置顶仍属于三点菜单快捷管理，不塞入编辑表单。

### 9.3 统一更新接口

新增：

```http
PATCH /api/me/entries/:id
```

请求按来源区分：

```ts
{
  contentText: string;
  channel: JournalPlainChannel;
  visibility: JournalVisibility;
  sourceCreatedAt: string;
  uploadId?: string;
  removedAssetIds?: number[];
}
```

服务端读取目标记录并要求 `bodyFormat === 'plain'`。Web 来源接收 uploadId 和 removedAssetIds，复用现有媒体数量、正文非空和存储提交规则；Telegram 来源不接受媒体变化字段，只更新业务字段。更新在 repository 中一次事务完成，返回完整 `JournalEntry`。

现有草稿更新接口继续只服务“保存草稿 / 首次发布”，不改变其稳定语义。已发布记录不伪装成草稿调用该接口。

### 9.4 Repository 与服务职责

- 将 `getDraft()` 收窄命名为只服务草稿路径。
- 在 `JournalWebEntryService` 增加已发布 Web 普通记录更新方法，复用现有媒体校验和文件落盘/删除主路径。
- Telegram 普通记录的业务字段更新放在 repository 的明确方法中，不经过 Web 媒体服务。
- 更新 sourceCreatedAt 后，表格和瀑布中的排序位置可能变化；返回 `/me` 时重新读取当前视图，不在本地猜测新位置。

## 10. 刷新行为

桌面页头刷新和移动端下拉刷新调用同一个 view-aware 动作：

- 瀑布：从首批重新读取，重置 nextCursor；
- 表格：重新读取当前 page，并刷新 total；
- 两者都同时刷新往年今日；
- 搜索、筛选、view 和 page 不变化；
- 加载反馈只出现在当前结果区，页头按钮只显示自身进行中状态。

移动端不渲染页头刷新按钮，但不删除刷新方法，因为下拉刷新仍需使用。

## 11. 文件变更清单

### 11.1 新增文件

- `web/src/components/journal/PrivateAssetHeader.vue`
- `web/src/components/journal/AssetManagementToolbar.vue`
- `web/src/components/journal/PrivateWaterfallResults.vue`
- `web/src/components/journal/PrivateAssetTableResults.vue`
- `web/src/components/journal/AssetTableActions.vue`
- `web/src/composables/usePrivateAssetTable.ts`

### 11.2 修改文件

- `web/src/App.vue`：私有路由 page、统一路径生成、编辑返回语境和事件连接。
- `web/src/types.ts`：表格页响应类型。
- `web/src/api.ts`：表格分页请求与普通记录统一更新请求。
- `web/src/composables/useJournalApi.ts`：变更结果向协调层返回；保留瀑布职责。
- `web/src/composables/useEntryPublisher.ts`：已发布普通记录保存动作。
- `web/src/components/journal/FeedView.vue`：私有页面编排、结果分支和加载边界。
- `web/src/components/journal/EntryFilters.vue`：筛选表单内容迁入或收敛为工具栏内部子组件。
- `web/src/components/journal/AssetViewSwitch.vue`：作为工具栏子组件调整布局样式。
- `web/src/components/journal/AssetTableView.vue`：操作列、固定列、移除无限滚动布局信号。
- `web/src/components/publisher/EntryPublisherView.vue`：已发布普通记录编辑状态和返回路径。
- `web/src/components/article/ArticleEditorView.vue`：返回原管理路径。
- `src/shared/journalProtocol.ts`：JournalPage 与普通记录更新请求 schema。
- `src/journal-server/types.ts`：页码查询类型。
- `src/journal-server/repository.ts`：共享筛选条件、listPage、普通记录更新。
- `src/journal-server/routes/privateEntries.ts`：分页路由和统一更新路由。
- `src/journal-server/webEntryService.ts`：已发布 Web 普通记录及媒体更新主路径。

不修改 `src/reminders/recurring.ts`，不新增数据库迁移，不引入新依赖。

## 12. 实施顺序

### 阶段一：接口与查询能力

1. 增加 JournalPage 协议与前后端类型。
2. 提取 repository 共享筛选条件。
3. 增加 `listPage()` 的 total 与分页结果查询。
4. 注册私有表格分页路由并接入前端 API。

### 阶段二：页面状态拆分

1. 增加 `usePrivateAssetTable()`。
2. 扩展 `/me` 路由解析和 `privateFeedPath()` 的 page 状态。
3. 将私有瀑布与表格从同一个 Vant `List` 中拆开。
4. 将工具栏从结果加载状态中独立出来。

### 阶段三：表格管理交互

1. 增加表格分页器与移动端横向布局。
2. 增加 `AssetTableActions` 并接入编辑、查看、更多操作。
3. 将表格变更结果同步到当前页和其他已存在的私有记录集合。
4. 完成删除后 total、末页和 URL 的连续状态。

### 阶段四：完整编辑主路径

1. 增加普通已发布记录统一更新协议和服务方法。
2. 扩展 `EntryPublisherView` 的已发布编辑状态。
3. 接通 Web 媒体可编辑、Telegram 媒体只读的来源边界。
4. 统一文章与普通记录编辑页的返回管理语境。

### 阶段五：响应式与状态收尾

1. 移动端移除页头刷新按钮。
2. 统一筛选、翻页、刷新和视图切换的局部加载呈现。
3. 收敛空状态、总数文案、分页禁用态和固定操作列样式。

## 13. 完成后的主路径

### 表格管理

```text
进入 /me?view=table&page=N
→ 工具栏立即稳定呈现
→ 请求筛选后的第 N 页与总条数
→ 翻页或任意页跳转更新 URL
→ 只替换表格行
→ 编辑后返回原页
→ 重新读取该页与总数
```

### 瀑布浏览

```text
进入 /me?view=waterfall
→ 工具栏立即稳定呈现
→ 请求首批 cursor 数据
→ 触底追加更早记录
→ 筛选变化后重置瀑布结果
```

### 行级编辑

```text
表格点击编辑
→ 文章进入文章编辑器
→ 普通记录进入普通记录编辑器
→ 保存后停留编辑页
→ 返回原 view/page
→ 当前结果区重新读取真实排序与总数
```

## 14. 明确不进入本轮的实现

- 批量选择、批量删除或批量改状态；
- 自定义 page size；
- 自定义列、列排序或保存视图；
- 搜索条件 URL 化；
- Telegram 原始附件替换或删除；
- 新全文搜索服务或为未来规模预建索引；
- 自动刷新、轮询、请求重试、旧数据回退或静默容错；
- 公开 feed 和公开详情的分页方式调整。
