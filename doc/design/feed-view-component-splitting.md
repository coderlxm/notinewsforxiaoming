# FeedView 组件拆分方案

## 现状与膨胀原因

`web/src/components/journal/FeedView.vue` 当前共 1130 行，其中脚本约 590 行、模板约 267 行、样式约 272 行。

它膨胀得快，并不是某一段代码写得特别冗长，而是同一个路由组件同时承担了三条业务路径：

1. 公开信息流：频道标签、分页、下拉刷新、文章流和瀑布流。
2. 公开详情：公开内容、口令内容解锁、详情返回和 robots 元信息。
3. 私有资产：登录、筛选、瀑布流、表格、分页、编辑入口和全部内容变更操作。

除此之外，它还负责详情弹窗、路由跳转、两种资产视图的加载状态复用、错误消息、列表布局完成信号以及滚动恢复所需的事件。

当前路由中的 `/`、`/me` 和 `/p/:publicId` 都指向 `FeedView`，`App.vue` 再通过 `mode`、`detailId` 和其他属性决定实际行为。每增加一个公开信息流、详情或资产管理功能，代码都会自然追加到这个文件，因此增长速度会越来越快。

## 拆分目标

- `FeedView.vue` 只作为现有页面接口的薄门面，保留当前 props 和 emits，避免同时改造 `App.vue`、路由、KeepAlive key 和滚动恢复逻辑。
- 公开信息流、公开详情和私有资产各自拥有独立状态与生命周期，不再共享一个大型条件分支。
- 样式跟随实际组件移动，避免类似标签栏移动端布局的问题继续堆积在总页面样式中。
- 不引入通用状态机、全局 Pinia 页面状态、provide/inject 或万能 `useFeed` 抽象。
- 不改变现有请求方式、路由表现、弹窗入口和已加载状态复用规则。

## 目标结构

```text
web/src/components/journal/
├── FeedView.vue
├── public-feed/
│   ├── PublicFeedView.vue
│   ├── PublicFeedHeader.vue
│   └── PublicFeedResults.vue
├── public-detail/
│   └── PublicEntryDetailView.vue
└── private-feed/
    └── PrivateAssetFeedView.vue
```

现有的 `PrivateAssetHeader`、`PrivateWaterfallResults`、`PrivateAssetTableResults`、`PublicChannelTagNavigation`、`JournalDetailOverlay` 等组件继续复用，不做重复包装。

## 组件职责与接口

### FeedView.vue

只判断当前属于哪条业务路径并转发现有接口：

- `mode === 'private'`：渲染 `PrivateAssetFeedView`。
- `mode === 'public' && detailId !== undefined`：渲染 `PublicEntryDetailView`。
- 其他公开模式：渲染 `PublicFeedView`。

它不再创建 `useJournalApi`、`usePrivateAssetTable`，也不再拥有加载、分页、登录或内容变更状态。目标控制在约 100 至 150 行。

### PublicFeedView.vue

负责公开信息流这一条完整主路径：

- 根据 `channel` 和 `initialTag` 加载公开内容。
- 管理刷新、加载更多、布局完成和已解锁条目替换。
- 处理从信息流打开普通条目或口令条目。
- 在信息流仍作为背景时承载 `JournalDetailOverlay`。
- 组合 `PublicFeedHeader` 和 `PublicFeedResults`。

保留的输入：`channel`、`initialTag`、overlay 相关属性、`revealedPublicEntries`。

向上发出的事件：`layoutReady`、`openEntry`、`closeOverlay`、`removeDeletedOverlay`。

### PublicFeedHeader.vue

只负责公开信息流顶部工具条：

- 标签导航。
- 归档入口。
- 刷新按钮及旋转状态。
- 桌面、平板和手机布局。

输入为标签列表、当前标签、刷新中状态和刷新禁用状态；输出为选择标签、打开归档和刷新三个事件。

当前 `FeedView` 中 `feed__public-*` 的模板与样式全部迁入该组件，使响应式布局与其 DOM 结构保持在同一个文件中。

### PublicFeedResults.vue

只负责公开列表呈现：

- Vant 无限列表容器。
- 文章流与瀑布流二选一。
- 空状态、分页加载状态和列表结束文案。

公开列表中的卡片不提供管理操作，因此不再转发编辑、置顶、删除、修改频道等私有事件，只保留加载更多、布局完成、打开条目和选择标签。

### PublicEntryDetailView.vue

负责直接访问 `/p/:publicId` 的详情主路径：

- 加载普通详情或口令详情预览。
- 解锁口令内容。
- 管理受保护详情的 robots 元信息。
- 呈现文章详情或普通记录详情。
- 处理返回信息流。

它不再携带公开列表、私有资产或表格相关状态。

### PrivateAssetFeedView.vue

负责私有资产的完整主路径：

- 登录状态和登录操作。
- 筛选条件。
- 瀑布流与表格的已加载状态复用。
- 私有列表刷新、分页和直接详情加载。
- 新建、编辑和发布时间弹窗入口。
- 内容、可见性、置顶、频道和删除操作。
- 私有资产详情弹窗。

它直接组合已有的私有资产子组件，不再经过额外的纯转发组件。

## 状态归属

| 状态 | 新归属 |
| --- | --- |
| 公开列表、公开 cursor、公开刷新 | `PublicFeedView` |
| 公开标签和频道布局 | `PublicFeedView` |
| 公开详情、口令预览、解锁 | `PublicEntryDetailView` |
| 登录、私有筛选、私有 cursor | `PrivateAssetFeedView` |
| 表格页数据与页码 | `PrivateAssetFeedView` 继续调用 `usePrivateAssetTable` |
| 瀑布流/表格已加载标记 | `PrivateAssetFeedView` |
| 私有内容变更状态 | `PrivateAssetFeedView` |
| 页面路由背景、KeepAlive 和滚动位置 | 继续由 `App.vue` 管理 |

每条路径各自创建 `useJournalApi`，因为同一时刻它们本来就是由不同路由组件实例承载。不要为了共享代码把 API 状态提升到全局，也不要把三条路径重新塞进一个大型 composable。

## 实施顺序

### 第一阶段：提取独立公开 UI

先提取 `PublicFeedHeader` 和 `PublicFeedResults`。这两块边界明确，没有私有资产状态，可以立即减少模板和样式体积，并让标签栏响应式样式就近维护。

### 第二阶段：分离公开详情

将 `detailId`、详情加载、口令解锁、robots 元信息和详情模板迁入 `PublicEntryDetailView`。公开详情和信息流从此不再共享初始加载分支。

### 第三阶段：分离私有资产

将登录、筛选、双视图加载、表格分页和内容变更操作整体迁入 `PrivateAssetFeedView`。这些逻辑互相依赖，应作为一条完整主路径移动，不宜拆成许多小 composable。

### 第四阶段：收薄 FeedView

把剩余公开列表状态迁入 `PublicFeedView`，最终让 `FeedView` 只负责选择三个子页面并转发当前接口。

## 明确不做的拆分

- 不创建同时兼容公开和私有模式的 `useFeedController`。两条路径的加载、权限和列表行为不同，强行复用只会把条件分支从组件移动到 composable。
- 不把每个按钮或空状态拆成单独组件。
- 不修改 `useJournalApi` 的业务边界；它仍负责 API 数据和请求状态，页面组件负责业务编排。
- 不在本次结构调整中更改 `App.vue` 的缓存、背景路由和弹窗历史逻辑。
- 不新增 watch；现有生命周期逻辑只按所属业务路径迁移。

## 预期结果

完成后文件规模大致为：

- `FeedView.vue`：100 至 150 行。
- `PublicFeedView.vue`：200 至 300 行。
- `PublicFeedHeader.vue`：120 至 180 行。
- `PublicFeedResults.vue`：120 至 180 行。
- `PublicEntryDetailView.vue`：180 至 260 行。
- `PrivateAssetFeedView.vue`：350 至 500 行。

私有页面仍会是其中最大的组件，但其内容属于同一条资产管理主路径，且已有 Header、Toolbar、Waterfall 和 Table 子组件承接展示职责。后续只有当某一段私有业务再次形成独立主路径时，再针对真实增长点继续拆分。
