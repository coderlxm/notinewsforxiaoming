# Journal 移动端下拉刷新设计

## 1. 文档状态

- 状态：已 Review，已实施
- 日期：2026-07-21
- 范围：公开信息流、带标签的公开信息流、登录后的个人资产信息流
- 实施边界：只刷新当前信息流数据，不刷新浏览器页面，不修改后端接口、数据库、Telegram Bot 或部署结构
- 产品定位：个人信息流的高频移动端操作，不扩展成通用手势系统

## 2. 目标

在移动端用户已经位于信息流顶部时，继续向下拉动页面，显示与当前“纸张 / 档案 / 红色书脊”视觉一致的刷新提示；越过阈值后松手，只重新读取当前信息流，待数据请求和瀑布流排版均完成后平滑收起提示。

需要同时满足：

1. 下拉动作不会触发浏览器整页刷新，固定个人信息栏、当前导航、登录态和 `KeepAlive` 缓存保持不变。
2. 刷新过程中已有卡片继续可见，不退回“正在整理记录…”的首次进入画布，也不出现空白态。
3. 公开信息流和个人资产使用完全一致的交互；公开标签和个人筛选条件保持不变。
4. 瀑布流完成真实排版后才结束刷新视觉，不通过延时或帧等待猜测完成时机。
5. 不加入重试、自动刷新、成功 Toast、震动反馈或失败兜底。

## 3. 这类功能通常如何工作

下拉刷新不是普通的 `scroll` 监听，而是一段受约束的触摸交互：

```text
手指按下
  → 确认内部滚动容器 scrollTop === 0
  → 识别主要方向为向下
  → 内容跟随手指下移，并对距离施加阻尼
  → 未越过阈值时松手：回到原位，不发请求
  → 越过阈值时松手：固定刷新头部，发起一次信息流请求
  → 请求完成且瀑布流完成排版：内容回到原位
```

只有“滚动容器在顶部 + 主要方向向下”同时成立时，组件才接管触摸移动。正常向上滚动、页面中部滚动和横向手势都继续交给浏览器。

当前项目的真实滚动容器是 `App.vue` 中的 `.app-scroll`，而不是 `window`。它已经配置 `overscroll-behavior-y: contain`，会阻断滚动链和浏览器原生的整页下拉刷新，正好为应用内刷新提供了稳定边界。[MDN 对 `overscroll-behavior` 的说明](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overscroll-behavior)

## 4. 当前项目适配判断

### 4.1 可以直接复用的能力

- `FeedView.vue` 已区分公开列表、私人列表和详情页，刷新入口可以准确限制在列表场景。
- `useJournalApi()` 已有 `loadPublic()` 和私人信息流读取主路径，不需要新建 HTTP 接口。
- `WaterfallFeed.vue` 已在 `MasonryGrid` 的 `renderComplete` 后发出 `layout-ready`，可以作为刷新真正完成的事件。
- `App.vue` 已缓存公开和私人两个 `FeedView`，下拉刷新只替换组件内数据，不会破坏信息流返回位置。
- 现有 `JournalLoading.vue` 已提供与站点一致的紧凑档案加载标记，可直接用于刷新中的视觉。

### 4.2 必须避免的旧问题

接口响应结束时，`entries` 虽然已经替换，但 `MasonryGrid` 仍可能在同步元素和计算位置。如果此时立即收起刷新区域，用户会先看到刷新结束，再看到卡片重新排版，形成一次跳动。

因此刷新完成条件必须是：

```text
请求已结束
AND
新的非空 entries 已触发 WaterfallFeed.layout-ready
```

空数据或请求错误没有瀑布流排版任务，请求结束后即可收起。这里复用真实的 `layout-ready` 事件，不使用 `requestAnimationFrame`、定时器或固定等待时长。

## 5. 技术选型

### 5.1 采用 Vant `PullRefresh`

建议新增当前最新稳定版 `vant@4.10.0`，只按需引入 `PullRefresh` 组件逻辑，不全局注册 Vant，也不引入它的其余 UI 风格。

选择依据：

- Vant 4 面向 Vue 3 移动 Web，`PullRefresh` 已包含顶部判断、方向锁定、触摸阻止、阻尼、触发阈值、受控 Loading 和自定义状态插槽。[Vant PullRefresh 文档](https://vant-ui.github.io/vant/#/en-US/pull-refresh)
- npm 当前稳定版本为 `4.10.0`，支持 Tree Shaking，并有较大的现有使用面。[Vant npm 页面](https://www.npmjs.com/package/vant)
- 组件通过 `touchmove` 驱动 `translate3d`，只在顶部向下手势时 `preventDefault`；源码没有依赖 RAF，符合项目硬约束。[PullRefresh 源码](https://github.com/youzan/vant/blob/main/packages/vant/src/pull-refresh/PullRefresh.tsx)
- 支持 `pulling`、`loosing`、`loading` 插槽，可以完全沿用项目视觉，不显示 Vant 默认 Spinner 和默认文案。

Vant 的组件样式入口会连带加载全局 `base.css`，其中包含 `body` 字体、链接和 focus 等基础重置，不适合当前已有完整视觉系统的项目。因此这里只引入组件逻辑：

```ts
import { PullRefresh } from 'vant';
```

`JournalPullRefresh.vue` 用 scoped `:deep()` 补齐 PullRefresh 所需的 root overflow、track transition 和 head positioning 三组结构样式，再使用项目自己的颜色和动效 token。锁文件记录实际安装的稳定版本；业务组件不使用 `app.use()`。

### 5.2 不采用的方案

| 方案 | 不采用原因 |
| --- | --- |
| 浏览器原生下拉刷新 | 只能刷新整个页面，无法只刷新当前信息流；当前 `.app-scroll` 也不是页面根滚动容器 |
| VueUse `usePointerSwipe` | 它会设置 `touch-action: pan-y` 以保留纵向原生滚动，浏览器接管纵向手势时可能产生 `pointercancel`；适合识别 swipe，不适合承担自定义纵向拉动。[VueUse 文档](https://vueuse.org/core/usepointerswipe/) / [源码](https://github.com/vueuse/vueuse/blob/main/packages/core/usePointerSwipe/index.ts) |
| `vue-easy-pull-refresh` | 默认包含内容重新挂载、队列、父级 overflow 修改和多层动画，超出本项目需要；生态和维护面也明显小于 Vant。[项目源码](https://github.com/prochorz/vue-easy-pull-refresh/blob/main/src/vue-easy-pull-refresh.vue) |
| `pulltorefreshjs` | 最近发布距今较久，并会注入自身结构和样式；与当前 Vue 状态和档案视觉的结合成本更高。[npm 页面](https://www.npmjs.com/package/pulltorefreshjs) |
| 手写完整触摸状态机 | 成熟组件已经覆盖方向、阻尼、阈值和滚动冲突，项目只需保留业务刷新逻辑 |

## 6. 交互范围

### 6.1 启用场景

- `/`：刷新最新公开记录。
- `/?tag=...`：刷新当前标签的公开记录，标签不清除。
- `/me` 且已登录：刷新当前筛选条件下的个人信息流，筛选面板和登录态不变化。

### 6.2 禁用场景

- 公开记录 / 文章详情。
- 新建文章和编辑文章。
- 私人页面尚未登录时。
- 首次读取、切换私人筛选条件或正在加载更早记录时。

详情和编辑器继续使用现有进入 Loading；下拉刷新不能变成任意页面的刷新手势。

### 6.3 私人页面的数据范围

私人页面下拉时只重新请求当前筛选后的主信息流，不重新请求“那年今日”。原因是“那年今日”是独立档案区域，下拉刷新的用户意图是更新下面的信息流；同时新记录通常不会改变往年同日数据。

为保持语义清楚，`useJournalApi()` 新增一个 `refreshPrivateFeed(filters)`：复用 `fetchPrivateFeed()`、列表替换、游标更新、身份判断和现有错误暴露，但不调用 `fetchOnThisDay()`。首次进入私人页仍使用原有 `loadPrivate()`，行为不变。

## 7. 视觉设计

### 7.1 整体形态

刷新头部位于固定个人信息栏下方、信息流标题上方，只在向下拉动时从内容背后露出。最大常驻高度为 `50px`，触发距离为 `64px`。

```text
固定个人信息栏
────────────────────────────────
            ┃  下拉刷新
────────────────────────────────
PUBLIC NOTES
瀑布流卡片……
```

- `┃` 使用现有石榴红书脊色。
- 文案使用现有次级文字色、紧凑字号和字距，不新增彩色圆形 Spinner。
- 内容整体跟随 Vant track 做 `translate3d`，不改变瀑布流宽度和卡片位置计算，也不逐帧修改容器高度。
- 松手回弹使用 `220ms`，缓动沿用站点的 `cubic-bezier(0.22, 1, 0.36, 1)`。

### 7.2 状态文案

| Vant 状态 | 视觉 | 文案 |
| --- | --- | --- |
| `normal` | 不占据可见空间 | 无 |
| `pulling` | 静态红色书脊 | 下拉刷新 |
| `loosing` | 书脊颜色增强 | 松开，看看新记录 |
| `loading` | 复用 `JournalLoading variant="inline"` | 正在整理新记录… |

不配置 `success-text` 或 `success` 插槽。刷新完成后直接柔和收起，同时卡片已经排版完成；不额外停留“刷新成功”，也不增加人为等待。

### 7.3 手动刷新入口

下拉手势是移动端快捷方式，同时增加一个低干扰的“刷新”文本按钮，调用完全相同的刷新方法：

- 公开页：与 `PUBLIC NOTES` 同行，右侧显示“刷新”。
- 私人页：放入现有“写文章 / 退出登录”操作区。
- 刷新中按钮禁用，并显示紧凑的“刷新中…”状态。

这样鼠标、键盘和不熟悉下拉手势的用户也能只刷新信息流。微软的 Pull-to-refresh 指南同样建议为非触摸输入保留另一种刷新入口。[Microsoft Pull-to-refresh 指南](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/pull-to-refresh)

### 7.4 减少动态效果

在 `prefers-reduced-motion: reduce` 下：

- Vant track 的回弹时长覆盖为 `0ms`。
- `JournalLoading` 继续遵守现有减少动态效果规则。
- 状态文案和信息流更新仍完整保留。

该覆盖使用 CSS 媒体查询，不读取帧、不增加动画循环控制逻辑。

## 8. 数据与状态流程

### 8.1 公开信息流

```text
PullRefresh 触发 refresh
  → refreshing = true，已有卡片保持显示
  → journal.loadPublic({ tag: initialTag })
  → entries 与 nextCursor 替换为最新第一页
  → WaterfallFeed 同步元素
  → MasonryGrid renderComplete
  → FeedView 收到 layout-ready
  → refreshing = false，刷新头部收起
```

### 8.2 私人信息流

```text
PullRefresh 触发 refresh
  → refreshing = true，筛选和“那年今日”保持原状
  → journal.refreshPrivateFeed(filters)
  → 当前筛选的 entries 与 nextCursor 替换
  → 等待同一 layout-ready
  → refreshing = false
```

### 8.3 请求错误

```text
请求失败
  → useJournalApi 继续把原始错误写入 journal.error
  → 已有 entries 不伪造、不清空
  → 刷新头部收起
  → 现有 notice--error 明确展示错误
```

不重试、不静默吞错、不用成功状态掩盖失败。

### 8.4 与加载更早记录的关系

下拉刷新永远请求第一页，并用最新第一页替换当前列表，因此 `nextCursor` 也回到最新第一页对应的游标。它不是“在顶部追加若干条”，否则已加载的分页数据容易与新游标发生重复或顺序错乱。

## 9. Vue 组件设计

### 9.1 新增 `JournalPullRefresh.vue`

位置：`web/src/components/ui/JournalPullRefresh.vue`

职责：

- 局部封装 Vant `PullRefresh`。
- 提供 `v-model` 的 `refreshing` 状态。
- 接收 `disabled`。
- 渲染项目自己的 `pulling`、`loosing`、`loading` 插槽内容。
- 只向上发出 `refresh`，不请求数据、不知道公开或私人模式。
- 用 scoped `:deep()` 覆盖必要的 Vant token 和 transition，不引入全局主题。

建议接口：

```ts
const refreshing = defineModel<boolean>({ required: true });

defineProps<{
  disabled: boolean;
}>();

defineEmits<{
  refresh: [];
}>();
```

### 9.2 `FeedView.vue`

新增最少的业务状态：

- `refreshing`：控制刷新头部及手动刷新按钮。
- `refreshRequestComplete`：标记接口已经结束、正在等待瀑布流 `layout-ready`。

新增方法：

- `refreshFeed()`：按 `mode` 调用公开或私人刷新主路径。
- `handleLayoutReady()`：继续向 `App.vue` 发出原有事件；若当前刷新请求也已完成，则结束刷新视觉。

`WaterfallFeed` 的 `loading` 仍只接收 `initialLoadPending || listReplacing`，不能加入 `refreshing`。这是保证刷新时旧卡片持续可见的关键。

手动“刷新”按钮也调用 `refreshFeed()`，不再建立第二套请求逻辑。

### 9.3 `useJournalApi.ts`

- `loadPublic()` 不变，继续作为公开信息流刷新主路径。
- 新增 `refreshPrivateFeed(filters)`，只读取私人主信息流。
- 提取一个短小的内部 `replacePrivateFeed(filters)` 供 `loadPrivate()` 与 `refreshPrivateFeed()` 复用，避免复制 entries、cursor 和认证态更新。
- 现有错误暴露方式不变，不新增返回默认值或异常兜底。

### 9.4 `WaterfallFeed.vue`

`MasonryGrid.syncElements()` 只在 DOM 元素发生增删或换序时触发重新排版。刷新后卡片 ID 和顺序完全相同时，必须改用 Grid 自带的 `updateItems()` 重新测量当前元素并取得真实 `renderComplete`；否则刷新视觉没有可靠的完成事件。

- 元素序列变化：继续使用现有 `syncElements()`。
- 元素序列不变：使用 `updateItems(getItems())`。
- 两条路径最终都由 `renderComplete → layout-ready` 结束，不增加超时或帧等待。

### 9.5 无需修改

- `App.vue`：内部滚动容器、KeepAlive 和位置记忆逻辑保持原状。
- 后端 API：刷新仍调用现有第一页列表接口。
- Telegram Bot、数据库和部署配置：均不涉及。

## 10. 文件变更范围

| 文件 | 变更 |
| --- | --- |
| `package.json` | 新增 `vant@4.10.0` 运行依赖 |
| `pnpm-lock.yaml` | 记录依赖版本 |
| `web/src/components/ui/JournalPullRefresh.vue` | 新增局部下拉刷新外观与 Vant 适配 |
| `web/src/components/journal/FeedView.vue` | 接入刷新、手动入口和 layout-ready 完成条件 |
| `web/src/components/journal/WaterfallFeed.vue` | 保证元素序列未变化时仍重新测量并发出排版完成事件 |
| `web/src/composables/useJournalApi.ts` | 新增只刷新私人主信息流的方法 |

初版不扩大到其他页面，也不新增 Store、全局事件总线、缓存层或后台刷新机制。

## 11. 交互验收清单

- 位于公开信息流顶部时下拉，能看到档案风格提示；未越过阈值松手不发请求。
- 越过阈值后松手只刷新当前公开信息流，页面个人信息栏和导航不重载。
- 标签页刷新后仍保留当前标签。
- 私人页刷新后仍保留筛选条件、登录态和“那年今日”内容。
- 页面不在顶部时向下滚动，不触发刷新。
- 横向手势、详情页、文章编辑器和登录页不触发刷新。
- 刷新过程中旧卡片持续可见，不出现首次读取 Loading、空白画布或容器高度跳变。
- 数据请求结束但瀑布流尚未排版完成时，刷新提示不提前收起。
- 刷新完成后卡片已经处于正确瀑布流位置，刷新头部平滑收起。
- 请求失败时展示现有明确错误，旧卡片保留，不自动重试。
- 公开页和私人页的“刷新”按钮与下拉手势使用同一逻辑。
- 深色与浅色模式下书脊、文案和背景都使用现有颜色 token。
- 减少动态效果开启后不执行回弹动画，功能和状态播报仍可用。

## 12. 最终建议

首版按本方案一次落地公开和私人两条链路。核心不是“给页面加一个下拉动画”，而是把刷新结束准确绑定到当前项目已有的 `MasonryGrid renderComplete`，保证请求、布局和视觉结束是同一个完成点。

Vant 只负责成熟的触摸行为，项目继续负责数据范围、错误呈现和档案视觉；这能在不引入复杂架构的前提下，得到接近原生信息流应用的稳定体验。
