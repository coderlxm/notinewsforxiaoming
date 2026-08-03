# Journal 信息流无限滚动设计

## 1. 文档状态

- 状态：已 Review，已实施
- 日期：2026-07-22
- 评估对象：`web/src/components/journal/FeedView.vue`
- 适用范围：公开首页、公开标签信息流、登录后的个人资产信息流
- 结论：可以去掉“加载更早记录”按钮，改成接近小红书的信息流式自动续载；现有 cursor 分页、尾部追加和瀑布流布局已经具备实施基础，不需要修改后端接口和数据库。

## 2. 目标

用户向下浏览记录时，在距离当前信息流底部约 `320px` 处自动读取下一页。新记录继续追加到现有瀑布流末尾，旧卡片、当前位置、筛选条件和详情返回位置保持不变。

交互结果应满足：

1. 页面不再出现“加载更早记录”按钮。
2. 每次只读取一页，当前页完成请求并完成瀑布流排版后，才允许触发下一页。
3. 加载期间只在信息流底部显示紧凑的“正在读取更早记录…”状态，已有卡片保持可见。
4. `nextCursor` 为空时停止监听式加载，并在非空列表末尾显示“已经看到全部记录”。
5. 请求失败时沿用现有页面错误提示并停止继续自动触发，不重试、不静默跳过、不切换回按钮或其他加载通道。

## 3. 当前实现与可行性

### 3.1 数据分页已经适配无限滚动

公开接口 `/api/feed` 每页读取 20 条，个人接口 `/api/me/entries` 每页读取 30 条。两者都返回：

```ts
interface JournalFeed {
  entries: JournalEntry[];
  nextCursor: string | null;
}
```

后端游标由 `pinned + sourceCreatedAt + id` 组成，查询排序也是相同字段的稳定倒序。前端 `loadMorePublic()` 和 `loadMorePrivate()` 已使用当前 `nextCursor` 请求下一页，并通过新数组把结果追加到末尾。

因此无限滚动只改变“何时调用现有 `loadMore()`”，不会改变分页协议、排序方式或数据合并逻辑。

### 3.2 瀑布流已经支持尾部追加

`WaterfallFeed.vue` 通过稳定的 `entry.id` 渲染卡片。发现新数组保留旧数组前缀时，它会：

- 等待 Vue 完成 DOM 更新；
- 调用 `MasonryGrid.syncElements({ direction: 'end' })`；
- 让新批次卡片执行现有淡入动画；
- 在 `renderComplete` 后向上发出 `layout-ready`。

无限滚动仍然走这条尾部追加主路径，不需要改动 masonry 的元素管理方式。

### 3.3 真实滚动容器需要被正确识别

页面不是由 `window` 滚动。`App.vue` 中 `.app-scroll` 才是真实的纵向滚动容器，`FeedView` 位于其中，并由 `KeepAlive` 保留公开页和私人页状态。

无限滚动实现必须以 `.app-scroll` 为滚动父级。不能监听 `window`，也不能通过全局页面高度判断触底，否则在当前布局中不会得到可靠结果。

### 3.4 与现有交互兼容

- 下拉刷新：刷新时替换第一页及 `nextCursor`，无限滚动随后继续使用新游标。
- 筛选：个人筛选替换整个列表及游标，新的筛选结果从第一页重新开始自动续载。
- 标签：公开标签页拥有独立的 `FeedView key` 和分页状态。
- 详情浮层：背景信息流由 `KeepAlive` 保留，关闭浮层后仍回到原位置，已加载页数不会丢失。
- Footer：续载过程中 Footer 会被后续内容向下推；全部加载完成后恢复为稳定的页面末尾。这符合连续信息流的浏览预期。

## 4. 技术选型

### 4.1 采用现有 Vant `List`

项目已经使用并依赖 `vant@4.10.0` 的 `PullRefresh`。本方案在 `FeedView.vue` 中继续具名引入 `List`，用它负责滚动父级识别、底部距离判断和单次 `load` 事件，不新增 npm 依赖。

选择它的原因：

- 它是 Vue 3 下成熟的无限滚动组件，与现有 Vant 下拉刷新可以直接嵌套使用。
- 它会寻找实际可滚动父元素，能适配当前 `.app-scroll`，无需把滚动 DOM 引用从 `App.vue` 逐层传入。
- `loading`、`finished`、`offset` 和自定义状态插槽正好覆盖本功能需要，不必手写滚动事件节流、触底判定和监听销毁。
- 项目已承担 Vant 依赖成本，新增一个具名组件不会引入第二套交互库。

结构示意：

```vue
<List
  :loading="infiniteLoading"
  :finished="infiniteFinished"
  :offset="320"
  @load="loadMore"
>
  <WaterfallFeed ... />

  <template #loading>
    <JournalLoading variant="inline" label="正在读取更早记录…" />
  </template>
</List>
```

实际模板还需要限制空列表与错误状态下的末尾文案，不能直接无条件显示 `finished-text`。

### 4.2 不采用的方案

| 方案 | 不采用原因 |
| --- | --- |
| 手写 `scroll` 监听 | 需要自行处理滚动父级、阈值、节流、重复触发和生命周期，重复实现成熟库能力 |
| 手写 `IntersectionObserver` 哨兵 | 哨兵在短列表中持续可见时不会自然产生第二次交叉变化，还要额外编排重新观察和瀑布流排版时机 |
| VueUse `useInfiniteScroll` | 当前项目尚未引入 `@vueuse/core`，为一个调用点增加新依赖没有收益；项目已有 Vant 的对应成熟能力 |
| 把触底逻辑放进 `WaterfallFeed` | 会让布局组件同时负责数据请求时机，破坏现有 props down / events up 边界 |
| 保留按钮作为备用入口 | 形成第二条分页入口，且属于项目明确禁止的 fallback；本方案直接替换原交互 |
| 一次读取全部历史记录 | 放大首屏响应和 DOM 数量，失去当前 cursor 分页的价值 |

## 5. 交互设计

### 5.1 自动触发

当信息流末尾进入滚动容器底部上方 `320px` 的预取区时，`List` 发出一次 `load`，调用现有 `FeedView.loadMore()`：

首次进入页面时，`List` 不执行初始化位置检查，并在首批卡片完成 `WaterfallFeed.layout-ready` 前保持禁用。首轮排版完成只开放后续滚动监听，不主动补载第二页，避免把首次读取和“加载更早记录”混成同一个进入状态。刷新、筛选等整表替换同样在新布局完成前关闭触底判断。

```text
接近信息流底部
  → 请求当前 nextCursor 对应的一页
  → entries 尾部追加
  → Vue 创建新卡片 DOM
  → MasonryGrid 同步元素并重新排版
  → WaterfallFeed 发出 layout-ready
  → 本轮无限加载完成
```

`320px` 让下一页在用户真正看到末尾前开始读取，同时不会因为离底部过远而提前加载多页。桌面端和移动端使用同一阈值，保持实现直接。

### 5.2 加载状态

按钮删除后，底部状态改为纯展示区域：

```text
瀑布流最后一批卡片

         ┃ 正在读取更早记录…
```

- 复用 `JournalLoading variant="inline"`，文案使用现有设计中已经定义的“正在读取更早记录…”。
- 状态具有 `role="status"` 和 `aria-live="polite"`，不移动键盘焦点。
- 不遮罩瀑布流，不把 `journal.loadingMore` 传给 `WaterfallFeed.loading`，避免已显示卡片重新进入整页 Loading。

### 5.3 全部加载完成

当 `nextCursor === null` 且当前列表非空时，在底部显示一次低干扰文案：

```text
—— 已经看到全部记录 ——
```

空列表继续只显示现有空状态，不再叠加“已经看到全部记录”。详情页、登录页和未认证的私人页不创建无限滚动区域。

### 5.4 请求失败

分页请求失败时：

- `useJournalApi()` 继续把原始错误写入 `journal.error`；
- `FeedView` 顶部现有 `notice--error` 直接显示错误；
- 当前无限加载停止，不因哨兵仍在底部而自动再次请求；
- 不显示“已加载全部”，也不加入点击重试、自动重试或“加载更早”备用按钮。

用户执行页面已有的刷新动作或重新应用筛选时，新的主路径请求会清空旧错误并重建第一页和游标，之后无限滚动自然恢复。

## 6. 状态设计

### 6.1 不能只使用网络请求状态

现有 `journal.loadingMore` 在 HTTP 请求完成后立即变回 `false`。此时 Vue 和 `MasonryGrid` 可能还没有完成新增卡片的高度计算。如果立刻让 `List` 再次检查底部，它可能基于旧高度连续触发下一页。

因此 `FeedView` 需要一个很小的本地状态 `paginationLayoutPending`，把“本轮正在加载”定义为：

```ts
const infiniteLoading = computed(() =>
  initialLoadPending.value
  || listReplacing.value
  || refreshing.value
  || journal.loadingMore.value
  || paginationLayoutPending.value
);
```

流程如下：

1. `loadMore()` 开始时把 `paginationLayoutPending` 设为 `true`。
2. 现有 journal 方法发起请求并追加数据。
3. 有新卡片时，等待 `WaterfallFeed.layout-ready` 后设回 `false`。
4. 请求失败或响应没有追加卡片时，请求结束后直接设回 `false`，同时由错误状态阻止再次自动触发。

这不是新的分页状态机，只是把一次加载的结束点从“HTTP 返回”延长到“新增卡片排版完成”。它复用项目已有的真实布局完成事件，不使用定时器，不使用 `requestAnimationFrame`。

### 6.2 完成与停止条件

建议在 `FeedView.vue` 中用 computed 集中表达：

```ts
const paginationFailed = computed(() => journal.error.value !== null);
const infiniteFinished = computed(() =>
  journal.nextCursor.value === null || paginationFailed.value
);
```

`paginationFailed` 只负责停止 Vant `List` 再次发出 `load`；末尾“已经看到全部记录”的显示条件仍必须是 `nextCursor === null && entries.length > 0`，不能把错误伪装成全部加载完成。

现有 `useJournalApi.loadMorePublic()` 和 `loadMorePrivate()` 继续保留 `nextCursor === null` 的业务边界，不新增重试、去重数组或默认成功结果。

## 7. Vue 组件边界

| 组件 | 调整后的职责 |
| --- | --- |
| `App.vue` | 继续提供 `.app-scroll`、路由和滚动位置恢复，不感知分页触发 |
| `FeedView.vue` | 使用 Vant `List` 编排无限加载，管理请求到布局完成之间的短状态 |
| `WaterfallFeed.vue` | 继续渲染稳定 keyed 卡片、同步 `MasonryGrid` 并发出 `layout-ready` |
| `useJournalApi.ts` | 继续持有 entries、cursor、请求状态和错误，不改变公开 API |
| 后端 feed routes / repository | 继续提供现有 cursor 分页，不调整 limit 和 SQL |

不新增 `useInfiniteScroll` composable。该行为只有一个调用点，且滚动识别已经由 Vant `List` 封装；再抽一层只会增加间接关系。

## 8. 与 KeepAlive 和滚动恢复的关系

`FeedView` 被 `KeepAlive` 缓存时，已加载的 `entries`、`nextCursor` 和 Vant `List` DOM 都会保留。打开卡片详情浮层不会销毁背景信息流，因此关闭详情不应重新从第一页读取。

跨公开标签或公开 / 私人信息流切换时，`App.vue` 仍按 route key 保存 `.app-scroll.scrollTop`，并在 `WaterfallFeed.layout-ready` 后恢复位置。无限滚动不新增自己的滚动位置副本，避免两个来源同时控制滚动。

被缓存的 FeedView 不在可见布局中时，不会产生用户滚动；重新激活后，现有 `WaterfallFeed.onActivated()` 会重新排版。`List` 随当前滚动位置继续判断是否接近末尾即可。

## 9. 性能边界

无限滚动会让当前会话中已经浏览过的卡片持续保留在 DOM。这个代价与手动点击分页时完全相同，只是触发方式不同。

本项目是单用户个人信息流，当前每批 20 / 30 条，第一版不引入虚拟列表、页淘汰、滚动锚点补偿或卡片回收。这些能力会与不等高 masonry、详情返回和现有入场动画形成明显复杂度，不属于本次真实需求。

如果以后真实出现长时间连续浏览导致的明确卡顿，再以实际数据量和设备表现单独评估瀑布流虚拟化；本次方案不预埋相关抽象。

## 10. 文件改动范围

### `web/src/components/journal/FeedView.vue`

- 从 `vant` 具名引入 `List`。
- 删除“加载更早记录”按钮及 `.button--more` 样式。
- 用 `List` 包裹 `WaterfallFeed`、空状态和底部状态插槽。
- 增加 `paginationLayoutPending`、`infiniteLoading`、`infiniteFinished` 等局部状态。
- 让 `loadMore()` 连接现有 journal 请求与 `layout-ready` 完成事件。
- 在 `handleLayoutReady()` 中同时处理下拉刷新结束和分页排版结束。
- 增加与站点视觉一致的底部 loading / finished scoped 样式。

### 其他文件

- `WaterfallFeed.vue`：无需修改，继续复用现有 `layout-ready`。
- `useJournalApi.ts`：无需修改，继续复用现有 cursor、追加和错误暴露逻辑。
- `App.vue`：无需修改，Vant `List` 直接识别现有 `.app-scroll`。
- 后端、数据库和 API 类型：无需修改。
- `package.json` / lockfile：无需修改，Vant 已存在。

## 11. 实施顺序

1. 在 `FeedView.vue` 中把现有按钮替换为 Vant `List`，先接通 `loading`、`finished`、`offset` 和 `load`。
2. 增加请求到 masonry `layout-ready` 之间的 pending 状态，保证一次只处理一页。
3. 接入现有 `JournalLoading` 与末尾文案，并删除旧按钮样式。
4. 收敛空列表、已到底和请求错误三种互斥展示条件。
5. 保持刷新、筛选、标签切换、详情浮层和滚动恢复的现有数据路径不变。

## 12. 完成标准

- 公开首页、公开标签页和已登录私人页都在接近底部时自动加载下一页。
- 页面中不再出现“加载更早记录”按钮。
- 同一时刻最多存在一个下一页请求，masonry 排版完成前不会连续请求后续页。
- 追加时旧卡片不消失，新卡片继续使用现有尾部入场动画。
- 刷新和筛选后从新的第一页游标继续自动加载。
- 打开并关闭详情后，已加载内容与滚动位置保持不变。
- `nextCursor` 为空时停止加载，只在非空列表末尾显示“已经看到全部记录”。
- 请求错误直接显示现有错误信息并停止自动触发，不出现自动重试、备用按钮或成功假象。

## 13. 与既有设计文档的关系

本方案通过 Review 并实施后，应覆盖以下既有文档中“保留明确点击加载”和“加载按钮位于 masonry 之后”的旧结论：

- `doc/design/journal/journal-waterfall-layout-redesign.md`
- `doc/design/journal/journal-waterfall-layout-vue-masonry-alternative.md`
- `doc/recommend/frontend-vueuse-adoption-review-2026-07.md`

它不改变这些文档中的 cursor 分页、稳定 key、尾部追加动画、下拉刷新和 masonry 生命周期设计。
