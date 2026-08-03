# Journal 瀑布流视觉重构备用方案：Vue 接入 MasonryGrid

## 1. 文档状态

- 状态：已 Review
- Review 日期：2026-07-20
- 方案性质：`journal-waterfall-layout-redesign.md` 的备用实现
- Review 结论：不再采用 `@yeger/vue-masonry-wall`，改用 `@egjs/grid` 的 `MasonryGrid`
- 唯一实现差异：由成熟布局库完成瀑布流定位与布局位移动画，并为分页新增卡片提供入场动画；其余视觉、交互、组件边界和页面范围继续沿用主方案

这里的“最佳选择”指最适合当前 Journal 混合内容流的方案，不以依赖最小或功能最多单独决定。当前列表同时包含图片、视频、音频、富文本摘要和私有管理交互，布局引擎必须满足：

- Vue 继续按 `entries` 顺序渲染卡片，不把条目重组为按列 DOM；
- 图片加载、正文编辑和删除确认造成高度变化后，布局能按主路径重新计算；
- 分页、筛选和条目更新后仍保留稳定业务 key 与组件实例；
- 分页追加时新卡片有轻量错峰入场，已有卡片按新位置平滑让位；
- 接入逻辑集中在 `WaterfallFeed.vue`，不扩散到卡片和数据请求层。

## 2. 与主方案的关系

本方案完整继承 [Journal 瀑布流视觉重构方案](./journal-waterfall-layout-redesign.md) 的以下内容：

- “个人生活档案”而非社交平台的产品定位；
- 宽画布与响应式 4 / 3 / 2 / 2 列布局；
- 日期书脊视觉签名；
- 普通记录、媒体记录和富文本文章的卡片体系；
- 私有管理菜单、筛选工具条与往年今日横向卡片带；
- 公开详情和文章编辑保持单栏；
- 色彩、字体、圆角、动效与可访问性规则；
- 不修改后端接口和数据模型。

主方案使用 CSS Multi-column；本方案只把 `WaterfallFeed.vue` 的布局引擎替换成 `MasonryGrid`。卡片组件不感知布局引擎，也不出现两套视觉实现。

如果不要求卡片按数据顺序逐项进入当前最短列，主方案仍然更短、更适合本项目。本备用方案只在 Review 明确要求这种视觉分发方式时启用。

## 3. 选型结论

采用 `@egjs/grid` 的 `MasonryGrid`，不采用 `@egjs/vue-grid` 封装。

截至 2026-07-20，官方 stable 版本为 `1.18.0`。核心库提供：

- TypeScript 类型与 ESM 模块；
- 按输入顺序逐项放入当前较短列的 `MasonryGrid`；
- `useResizeObserver` 与 `observeChildren`，可观察容器和卡片本身的尺寸变化；
- `syncElements()`，在 Vue 完成新增、删除或替换 DOM 后同步布局条目；
- `useTransform`，用可动画的 `transform` 替代 `left / top` 写入布局位置；
- `renderComplete` 事件及其 `mounted` 列表，可准确识别本次首次参与布局的卡片；
- `column`、`columnSize`、`gap`、`align` 等布局参数；
- 保留容器直属子元素的 DOM 顺序，只通过定位样式完成排布。

官方资料：

- [GitHub README](https://github.com/naver/egjs-grid)
- [MasonryGrid API 与源码](https://github.com/naver/egjs-grid/blob/main/src/grids/MasonryGrid.ts)
- [Grid 的尺寸观察与 `syncElements()` 实现](https://github.com/naver/egjs-grid/blob/main/src/Grid.ts)
- [Grid API：`useTransform`、`syncElements()` 与 `renderComplete`](https://naver.github.io/egjs-grid/release/latest/doc/Grid.html)
- [npm package](https://www.npmjs.com/package/@egjs/grid)

实施时使用当时最新 stable 版本，不在方案中长期锁死具体版本号；实际版本由项目的 `package.json` 与 `pnpm-lock.yaml` 记录。

## 4. 选型复核

### 4.1 候选对比

| 候选 | DOM / 键盘顺序 | 动态高度 | Vue 接入 | 当前项目结论 |
| --- | --- | --- | --- | --- |
| `@egjs/grid` | 保持 `entries` 对应的直属子元素顺序 | 可观察子元素并重排 | 在一个 SFC 内管理实例生命周期 | 采用 |
| `@yeger/vue-masonry-wall` | 先按最短列分配，再按列容器渲染 DOM | 官方明确不处理布局后的高度变化 | Vue 3 `items` 组件 API 最简洁 | 不采用 |
| `@egjs/vue-grid` | 保持 slot 子元素顺序 | 底层能力完整 | Vue 2 / Vue 3 兼容封装，API 偏命令式 | 不采用 |
| `vue-waterfall-plugin-next` | 由组件自行分列 | 主要围绕图片加载设计 | 自带图片懒加载、动画和全局样式 | 不采用 |
| `vue-masonry` | 保持原始子元素 | 依赖 redraw 与底层 Masonry | 全局 plugin、指令和事件总线 | 不采用 |
| CSS Grid Lanes | 原生保持文档顺序 | 浏览器原生处理 | 无 Vue 接入 | 暂不采用，尚非 Baseline |

### 4.2 为什么替换 `@yeger/vue-masonry-wall`

`@yeger/vue-masonry-wall` 仍是维护活跃、体积小、Vue 3 API 清晰的组件；当前版本也与项目的 Vue 3.5 匹配。它不是质量差，而是其明确取舍不适合这条信息流。

官方实现以“列”为外层 `v-for`，再在各列中渲染条目。输入顺序 `1 → 2 → 3 → 4 → 5 → 6` 经过短列分配后，DOM 可能成为 `1 → 5 → 2 → 4 → 3 → 6`。视觉上它体现了逐项短列分配，但屏幕阅读和 Tab 顺序已经不是 `entries` 顺序。

此外，该库只观察 masonry 容器宽度，官方明确说明不处理卡片完成首次排布后的动态高度变化。当前项目的图片加载、原生媒体控件、正文编辑和卡片内删除确认都可能改变高度，要求所有卡片预先固定高度会反向限制真实业务交互。

当 `items` 数组引用变化时，该库会清空列并从第一项重新分配。条目跨列时也会跨父容器重新挂载，不适合把私有卡片的临时编辑或菜单状态留在组件本地。

因此，`@yeger/vue-masonry-wall` 是“静态展示卡片”的更轻选择，不是当前“可交互个人档案卡片”的最佳选择。

参考：

- [`@yeger/vue-masonry-wall` README 的动态高度限制](https://github.com/DerYeger/yeger/tree/main/packages/vue-masonry-wall#limitations)
- [按列渲染的组件源码](https://github.com/DerYeger/yeger/blob/main/packages/vue-masonry-wall/src/masonry-wall.vue)
- [W3C：DOM 顺序应与视觉顺序保持可理解的一致性](https://www.w3.org/WAI/WCAG22/Techniques/css/C27)

### 4.3 为什么直接使用 core，而不是 `@egjs/vue-grid`

`@egjs/vue-grid` 与 core 同源，但当前封装同时兼容 Vue 2 和 Vue 3，peer 范围为 `vue >= 2`，内部包含 Vue 3 VNode 兼容处理，并没有提供本项目需要的 `items` 数据契约。

直接在 `WaterfallFeed.vue` 中管理 `MasonryGrid` 实例，只需要挂载、同步元素、响应布局完成事件和销毁四个动作。布局测量、短列分配、尺寸观察和定位仍全部由成熟库负责，不在项目中手写 masonry 算法；组件只在 `renderComplete` 后编排新增卡片的入场动画，同时继续使用 Vue 3 Composition API、typed props 和稳定 `:key`。

### 4.4 为什么暂不使用 CSS Grid Lanes

CSS Grid Lanes 已进入 Safari 26.4，但截至本次 Review，MDN 仍将其标记为 Limited availability，Chromium 官方资料仍属于早期开发测试范围。项目又明确不保留运行时 fallback，因此当前不能把它作为跨浏览器主实现。

参考：

- [MDN Masonry / Grid Lanes 状态](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Masonry_layout)
- [WebKit：Safari 26.4 的 CSS Grid Lanes](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/)
- [Chrome：CSS Masonry 开发测试说明](https://developer.chrome.com/blog/masonry-update)

## 5. 布局实现

### 5.1 组件接入

`WaterfallFeed.vue` 直接引入 `MasonryGrid`。Vue 继续渲染完整条目列表，布局库只读取并定位容器的直属 `.waterfall__item`：

```vue
<script setup lang="ts">
import { MasonryGrid } from '@egjs/grid'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import type { JournalEntry } from '../../types'

const props = defineProps<{
  entries: readonly JournalEntry[]
}>()

const gridElement = useTemplateRef<HTMLDivElement>('grid')
let masonry: MasonryGrid
let animateNextMountedBatch = false

onMounted(() => {
  masonry = new MasonryGrid(gridElement.value!, {
    align: 'start',
    gap: 0,
    useTransform: true,
    useResizeObserver: true,
    observeChildren: true,
  })

  masonry.on('renderComplete', ({ mounted }) => {
    if (!animateNextMountedBatch) return
    animateNextMountedBatch = false

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    mounted.forEach((item, index) => {
      const card = item.element!.firstElementChild as HTMLElement

      card.animate(
        [
          { opacity: 0, transform: 'translateY(14px) scale(0.98)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        {
          duration: 260,
          delay: Math.min(index, 6) * 35,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'backwards',
        },
      )
    })
  })

  masonry.renderItems()

  watch(
    () => props.entries,
    (entries, previousEntries) => {
      animateNextMountedBatch =
        entries.length > previousEntries.length &&
        previousEntries.every((entry, index) => entry.id === entries[index]?.id)

      masonry.syncElements({ direction: 'end' })
    },
    { flush: 'post' },
  )
})

onBeforeUnmount(() => masonry.destroy())
</script>

<template>
  <div ref="grid" class="waterfall">
    <div v-for="entry in entries" :key="entry.id" class="waterfall__item">
      <div class="waterfall__card">
        <!-- 按 bodyFormat 分发到普通记录卡片或文章卡片 -->
      </div>
    </div>
  </div>
</template>
```

示例表达布局生命周期、分页追加识别、动画和 DOM 契约，不重复卡片模板与事件转发。实际组件继续通过 typed props 和 emits 向上交互。

`animateNextMountedBatch` 只在新数组完整保留旧数组前缀且长度增加时开启，因此筛选、删除、排序和普通编辑不会误触发“加载更多”入场动画。这个判断依赖现有数据层始终替换 `entries` 数组引用，不增加新的分页状态来源。

### 5.2 响应式列数与间距

列数和间距继续遵守主方案：

| 视口 | 目标列数 | 视觉间距 |
| --- | ---: | ---: |
| `>= 1360px` | 4 | `20px` |
| `960–1359px` | 3 | `18px` |
| `600–959px` | 2 | `14px` |
| `< 600px` | 2 | `8px` |

不在 JavaScript 中再维护一套断点状态。`.waterfall__item` 通过现有 CSS media query 设置 `25% / 33.333% / 50% / 50%` 宽度；左右 padding 和底部 padding 形成对应间距。`MasonryGrid` 使用第一张卡片的实际列宽自动计算列数，容器宽度变化时由其 `ResizeObserver` 重新排布。

```css
.waterfall {
  --waterfall-gap: 20px;
  margin-inline: calc(var(--waterfall-gap) / -2);
}

.waterfall__item {
  box-sizing: border-box;
  width: 25%;
  padding: 0 calc(var(--waterfall-gap) / 2) var(--waterfall-gap);
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.waterfall__card {
  width: 100%;
}

@media (max-width: 1359px) {
  .waterfall {
    --waterfall-gap: 18px;
  }

  .waterfall__item {
    width: 33.333%;
  }
}

@media (max-width: 959px) {
  .waterfall {
    --waterfall-gap: 14px;
  }

  .waterfall__item {
    width: 50%;
  }
}

@media (max-width: 599px) {
  .waterfall {
    --waterfall-gap: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .waterfall__item {
    transition: none;
  }
}
```

布局库的 `gap` 固定为 `0`，避免 CSS 与 JavaScript 分别保存同一份间距值。

### 5.3 布局位移与分页入场动画

动画分成两个互不覆盖的层级：

| DOM 层级 | transform 所有者 | 动画职责 |
| --- | --- | --- |
| `.waterfall__item` | `MasonryGrid` | 根据布局结果写入 `translate(x, y)`，CSS transition 平滑移动到新位置 |
| `.waterfall__card` | 页面入场动画 | 新增批次从轻微下移、缩小和透明状态进入 |

`useTransform: true` 是必要配置。它让布局库以 `transform: translate(...)` 写入位置，已有卡片在分页追加、媒体高度变化或响应式重排时即可通过 `.waterfall__item` 的 transform transition 平滑让位。

新卡片不能在 `.waterfall__item` 上执行 `translateY()` 或 `scale()`，否则会覆盖布局库写入的定位 transform。因此模板固定保留 `.waterfall__item > .waterfall__card` 两层结构，入场动画只作用于内层。

分页动画参数固定为：

- 时长 `260ms`；
- easing `cubic-bezier(0.22, 1, 0.36, 1)`；
- 起始状态 `opacity: 0`、`translateY(14px)`、`scale(0.98)`；
- 同批卡片每张错开 `35ms`，最多累计 `210ms`，避免大批分页产生过长等待；
- 首屏、筛选、删除、排序和普通编辑不执行新增批次动画；
- 用户启用 `prefers-reduced-motion: reduce` 时不调用 Web Animations API，同时由 media query 关闭外层 transition，布局立即完成。

`renderComplete.mounted` 是动画目标的唯一来源，不重新查询整个容器，也不自行比较 DOM 节点。它只包含本次首次参与 Grid 渲染的 item；`animateNextMountedBatch` 再把触发范围限制为数组尾部追加。外层位移仍由库和 CSS 完成，内层入场使用浏览器原生 `Element.animate()`，不引入 GSAP、Motion 或第二个动画系统。

不使用 Vue `<TransitionGroup>`。它同样会尝试用 transform 做列表位移动画，与 `MasonryGrid` 对直属 item 的 transform 所有权重叠；本方案由 Grid 负责位置，由内层 Web Animation 负责新卡片视觉进入，职责只有一套。

### 5.4 DOM、阅读与视觉顺序

Vue 的直属子元素始终按 `entries` 顺序存在：

```text
DOM / 数据 / Tab：1 → 2 → 3 → 4 → 5 → 6
```

`MasonryGrid` 不移动这些节点，只计算每个节点的视觉位置。视觉上前三项进入首行的三列，后续条目按输入顺序进入当时较短的列：

```text
┌─────┐  ┌─────┐  ┌─────┐
│  1  │  │  2  │  │  3  │
│     │  ├─────┤  │     │
├─────┤  │  4  │  │     │
│  5  │  │     │  ├─────┤
│     │  ├─────┤  │  6  │
└─────┘  └─────┘  └─────┘
```

瀑布流的空间位置不可能形成严格等高“行”，但时间顺序、屏幕阅读顺序和键盘顺序都保持为原始数据顺序。不使用正数 `tabindex` 人工修补焦点顺序。

## 6. 动态高度

### 6.1 图片

- 有 `width / height` 的图片继续设置 `aspect-ratio`，减少首次绘制位移。
- 尺寸为空的历史资产可按图片加载后的真实高度展示；`observeChildren` 会触发布局更新。
- `<img>` 继续保留 `loading="lazy"`，不为了布局提前请求整页图片。
- 不增加图片加载重试、固定比例兜底或二次发送通道。

### 6.2 视频、音频与文件

- 视频优先使用已有宽高确定比例，原生控件完成加载后发生的尺寸变化由子元素观察处理。
- 音频、文件、联系人等非视觉媒体继续使用当前明确的卡片模块结构。
- 布局库只响应真实尺寸变化，不接管媒体加载状态。

### 6.3 文本与管理交互

- 信息流正文仍按主方案限制摘要长度和行数。
- 结构化内容只展示固定数量的关键行。
- 管理菜单仍使用覆盖层，不主动撑高卡片。
- 正文编辑或删除确认如果改变卡片高度，`MasonryGrid` 直接按新高度重排，不要求伪造一次 `entries` 更新。

### 6.4 内容修改

当前 `useJournalApi` 的 `replaceEntry` 已通过 `map` 生成新数组，分页通过展开语法生成新数组，删除通过 `filter` 生成新数组。`WaterfallFeed.vue` 只观察数组引用，通过 post-flush watcher 在 Vue 完成 keyed DOM 更新后调用一次 `syncElements()`：

- 新增、删除、编辑后继续替换整个 `entries` 数组引用；
- 不对传给布局组件的数组执行 `push`、`pop` 或条目原地修改；
- Vue `:key` 固定使用 `JournalEntry.id`，不用数组索引；
- 卡片自身高度变化由 `observeChildren` 处理，不进入数据状态。

## 7. 组件边界差异

主方案的组件图保持不变，仅明确 `WaterfallFeed.vue` 内部职责：

| 组件 | 本方案职责 |
| --- | --- |
| `FeedView.vue` | 请求数据、管理筛选和导航，向下传递 entries |
| `WaterfallFeed.vue` | 渲染稳定 keyed 子节点，管理 `MasonryGrid` 的挂载、同步、布局完成事件、动画触发和销毁 |
| `EntryCard.vue` | 普通记录内容与管理交互，不测量自身位置 |
| `ArticleCardContent.vue` | 文章摘要或详情呈现，不操作 masonry |
| `MediaGallery.vue` | 提供媒体卡片与详情展示，保留真实尺寸语义 |

不新增 `useMasonry` composable。布局实例只被一个组件使用，抽成 composable 会增加间接层而没有复用收益。

## 8. 状态与交互差异

### 8.1 分页追加

点击“加载更早记录”后，Vue 按稳定 key 追加直属子节点；组件先确认本次更新是保留旧数组前缀的尾部追加，再由 `syncElements()` 识别新增节点并重新排布。

重排过程中，如果已有卡片的位置发生变化，则通过外层 item 的 transform transition 平滑移动；`renderComplete.mounted` 返回的新卡片通过内层 card 执行淡入、上浮和轻微缩放，并按批次索引做最多 210ms 的短错峰。加载按钮仍位于整个 masonry 容器之后。

### 8.2 筛选

筛选结果替换完整数组。Vue 先完成节点增删，布局库再同步当前直属子元素；已有卡片可以平滑移动，但不把筛选结果误判成分页批次，不执行新增卡片入场动画。筛选器本身不进入 masonry 容器。

### 8.3 条目交互

菜单、编辑和删除确认仍由卡片自身管理。卡片不会因为短列重新计算而被搬入另一组 Vue 父节点，因此本地交互状态不因普通重排被销毁。

### 8.4 往年今日

继续沿用主方案的独立横向卡片带，不使用 `MasonryGrid`。该区域记录数量少，且横向浏览语义明确。

### 8.5 详情和编辑

公开详情、登录页与文章编辑页不创建 masonry 实例。只有公开首页和登录后的私有资产主列表使用该依赖。

## 9. 依赖影响

新增一个顶层生产依赖：

```text
@egjs/grid
```

该包当前包含 `@egjs/children-differ`、`@egjs/component` 和 `@egjs/imready` 三个直接运行时依赖。它比 `@yeger/vue-masonry-wall` 更重，但这些依赖直接服务元素同步、事件与媒体就绪测量，不把无关的无限滚动、虚拟列表或懒加载 UI 带入项目。

动画不增加生产依赖：已有卡片的位置变化由 CSS transition 完成，新增卡片入场使用浏览器原生 `Element.animate()`。`@egjs/grid` 只提供可动画的 transform 位置和本次 mounted item 列表，不将其描述为独立动画框架。

项目不同时安装 `@egjs/vue-grid`，不保留 CSS Multi-column 作为运行时 fallback，也不增加布局切换开关。

## 10. 相对主方案的取舍

| 维度 | 主方案：CSS Multi-column | 备用方案：`@egjs/grid` |
| --- | --- | --- |
| 新顶层依赖 | 无 | 1 个 |
| 条目分发 | 纵向填满一列后换列 | 按数组顺序逐项放入较短列 |
| DOM / 数据顺序 | 保持 `entries` 顺序 | 保持 `entries` 顺序 |
| 动态高度 | 浏览器自然布局 | `ResizeObserver` 触发重排 |
| 列表更新 | 浏览器自然重排 | Vue 更新后调用 `syncElements()` |
| 分页追加动画 | 新卡片可做入场，列重排由浏览器立即完成 | 新卡片错峰入场，发生位置变化的已有卡片通过 transform 平滑移动 |
| 卡片本地状态 | 保留 | 保留 |
| 组件复杂度 | 更低 | `WaterfallFeed.vue` 管理布局实例和动画触发 |
| 视觉结果 | 纵向列式阅读 | 更接近逐项、由左到右分发 |

## 11. 实施拆分差异

整体阶段仍沿用主方案，只替换阶段一中的瀑布流任务：

1. 增加 `@egjs/grid` 生产依赖。
2. 在 `WaterfallFeed.vue` 局部创建并销毁 `MasonryGrid`。
3. 使用直属 `.waterfall__item` 和稳定 `JournalEntry.id` key 渲染卡片。
4. 用 CSS media query 定义 4 / 3 / 2 / 2 列宽与间距，布局库不保存第二份断点配置。
5. 在 `entries` 引用变化后的 post-flush watcher 中调用 `syncElements()`。
6. 启用 `useTransform`，在 `.waterfall__item` 上定义布局位移 transition。
7. 仅在数组尾部追加时开启动画标记，并在 `renderComplete.mounted` 中对内层 `.waterfall__card` 执行原生入场动画。
8. 启用容器与子元素尺寸观察，让媒体和卡片交互的真实高度进入主布局计算。

后续卡片重构、私有资产体验、详情页和编辑页工作与主方案完全相同。

## 12. Review 决策点

该备用方案只需额外确认两个技术取舍：

1. 是否明确要求卡片按数据顺序逐项进入较短列；若不要求，继续使用更短的 CSS Multi-column 主方案。
2. 若要求，是否接受 `@egjs/grid` 更高的依赖和实例生命周期成本，以换取稳定 DOM 顺序、动态高度重排、分页追加动画和卡片状态保留。

## 13. 推荐结论

默认继续推荐 CSS Multi-column 主方案，因为它最符合个人工具的短主路径。

如果 Review 明确要求瀑布流按 `entries` 顺序逐项进入当前较短列，并要求分页追加时已有卡片平滑让位、新卡片错峰入场，则采用本备用方案，并选择 `@egjs/grid`，不再选择 `@yeger/vue-masonry-wall`。后者更轻、更贴近纯 Vue 组件写法，但其按列重组 DOM、首次高度约束和数组更新时整墙重建，与当前可交互混合卡片流及其动画需求不匹配。
