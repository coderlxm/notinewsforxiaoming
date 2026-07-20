# Journal 瀑布流视觉重构备用方案：Vue Masonry

## 1. 文档状态

- 状态：待 Review
- 方案性质：`journal-waterfall-layout-redesign.md` 的备用实现
- 唯一差异：使用成熟 Vue masonry 库完成瀑布流排布
- 其余视觉、交互、组件边界和页面范围全部沿用主方案

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

主方案使用 CSS Multi-column；本方案只把 `WaterfallFeed.vue` 的布局引擎替换成 Vue masonry 组件。卡片组件不感知布局引擎，也不出现两套视觉实现。

## 3. 选型结论

采用 `@yeger/vue-masonry-wall`。

截至本方案编写时，官方包提供：

- Vue 3 原生 `MasonryWall` 组件；
- TypeScript 使用示例；
- 基于 `ResizeObserver` 的响应式列计算；
- `column-width`、`gap`、`min-columns`、`max-columns` 等直接匹配本项目的布局参数；
- 通过默认 slot 渲染业务卡片；
- 零外部运行时依赖。

官方资料：

- [GitHub README](https://github.com/DerYeger/yeger/tree/main/packages/vue-masonry-wall)
- [npm package](https://www.npmjs.com/package/@yeger/vue-masonry-wall)

实施时使用当时最新 stable 版本，不在方案中长期锁死具体版本号；实际版本由项目的 `package.json` 与 `pnpm-lock.yaml` 记录。

## 4. 不选择的库

### 4.1 `vue-masonry`

不采用。它最初是 Vue 指令式封装，Vue 3 支持仍依赖全局插件、指令和 redraw 方法，API 形态比当前项目的局部组件与显式数据流更重；其底层还依赖传统 Masonry 实现。

### 4.2 `vue-masonry-css`

不采用。它本质仍是 CSS/列分配方案，且维护时间较早，不能体现本备用方案“用当前 Vue masonry 库管理排布”的差异价值。

### 4.3 自行实现列高算法

不采用。项目约束要求通用能力优先使用成熟 npm 库；手写测量、重排和尺寸监听会让简单视觉重构变成长期维护的布局系统。

## 5. 布局实现

### 5.1 组件接入

`WaterfallFeed.vue` 局部引入 `MasonryWall`，不注册全局 Vue plugin：

```vue
<script setup lang="ts">
import { MasonryWall } from '@yeger/vue-masonry-wall'
import type { JournalEntry } from '../../types'

defineProps<{
  entries: readonly JournalEntry[]
  columnWidth: number
  gap: number
  minColumns: number
  maxColumns: number
}>()

const entryKey = (entry: JournalEntry): number => entry.id
</script>

<template>
  <MasonryWall
    :items="entries"
    :column-width="columnWidth"
    :gap="gap"
    :min-columns="minColumns"
    :max-columns="maxColumns"
    :key-mapper="entryKey"
  >
    <template #default="{ item }">
      <!-- 按 bodyFormat 分发到普通记录卡片或文章卡片 -->
    </template>
  </MasonryWall>
</template>
```

示例只表达组件契约，不把普通记录与文章的完整模板重复写进方案。实际组件继续通过 typed props 和 emits 向上交互。

### 5.2 响应式列数

库根据容器宽度和 `column-width` 自动决定列数，页面仍执行主方案的目标列数：

| 视口 | 目标列数 | `column-width` 设计值 | `gap` |
| --- | ---: | ---: | ---: |
| `>= 1360px` | 4 | 约 `300px` | `20px` |
| `960–1359px` | 3 | 约 `280px` | `18px` |
| `600–959px` | 2 | 约 `260px` | `14px` |
| `< 600px` | 2 | 按容器宽度计算 | `8px` |

`min-columns` 与 `max-columns` 由当前断点明确传入，避免库仅按最小列宽在临界宽度产生与设计不一致的列数。断点状态属于 `WaterfallFeed.vue` 的布局职责，不进入 `FeedView.vue` 的业务数据逻辑。

### 5.3 DOM 与阅读顺序

库按照 `entries` 数组顺序处理卡片，并将下一张卡片放入当前较短列。与 CSS Multi-column 的“先填满整列”不同，本方案更接近视觉上的逐项、由左到右分发：

```text
数据顺序：1 → 2 → 3 → 4 → 5 → 6

┌─────┐  ┌─────┐  ┌─────┐
│  1  │  │  2  │  │  3  │
│     │  ├─────┤  │     │
├─────┤  │  4  │  │     │
│  5  │  │     │  ├─────┤
│     │  ├─────┤  │  6  │
└─────┘  └─────┘  └─────┘
```

这更符合用户从最新记录开始扫视的预期，也是本备用方案相对 CSS Multi-column 的主要收益。

## 6. 卡片高度约束

官方明确说明：库按卡片初始高度分列，不持续处理元素之后发生的动态高度变化。项目中以下场景必须直接在主布局中处理：

### 6.1 图片

- 有 `width / height` 的图片，在媒体容器上使用对应 `aspect-ratio`，使首次排布时高度已确定。
- `<img>` 保留实际宽高信息，并填满比例容器。
- 不额外引入图片加载完成后的重试或二次排布机制。

### 6.2 视频、音频与文件

- 视频使用已有宽高数据确定比例；控件区域使用稳定的固定结构。
- 音频、文件、联系人等非视觉媒体使用明确的卡片模块高度。
- 不让浏览器原生控件加载后改变外层卡片的主要尺寸。

### 6.3 文本与结构化内容

- 信息流正文按主方案限制摘要长度和行数。
- 结构化内容只展示固定数量的关键行。
- 管理菜单使用覆盖层，不撑高卡片。
- 删除二次确认会改变卡片高度；确认态出现时通过不可变数组更新触发布局组件重新分配，而不是直接修改条目内部对象。

### 6.4 内容修改

当前 `useJournalApi` 的 `replaceEntry` 已通过 `map` 生成新数组，分页也通过展开语法生成新数组，符合该库对 items 更新的要求。后续仍保持：

- 新增、删除、编辑后替换整个 `entries` 数组引用；
- 不对传给 masonry 的数组执行 `push`、`pop` 或条目原地修改；
- `keyMapper` 固定使用 `JournalEntry.id`，不用数组索引作为业务 key。

## 7. 组件边界差异

主方案的组件图保持不变，仅明确 `WaterfallFeed.vue` 内部职责：

| 组件 | 本方案职责 |
| --- | --- |
| `FeedView.vue` | 请求数据、管理筛选和导航，向下传递 entries |
| `WaterfallFeed.vue` | 将响应式布局参数传给 `MasonryWall`，按记录类型分发卡片 |
| `EntryCard.vue` | 普通记录内容与管理交互，不测量自身位置 |
| `ArticleCardContent.vue` | 文章摘要或详情呈现，不操作 masonry |
| `MediaGallery.vue` | 提供初始稳定的媒体比例与卡片/详情展示模式 |

不新增 `useMasonry` composable。布局状态只被一个组件使用，抽成 composable 会增加间接层而没有复用收益。

## 8. 状态与交互差异

### 8.1 分页追加

点击“加载更早记录”后，`entries` 以新数组传入。库将新增记录继续分配至当前较短列，加载按钮仍位于整个 masonry 容器之后。

### 8.2 筛选

筛选结果替换完整数组，masonry 直接根据新结果重新分列。筛选器本身不进入 masonry 容器。

### 8.3 往年今日

继续沿用主方案的独立横向卡片带，不使用 `MasonryWall`。该区域记录数量少，且横向浏览语义明确。

### 8.4 详情和编辑

公开详情、登录页与文章编辑页不加载 masonry 组件。只有公开首页和登录后的私有资产主列表使用该依赖。

## 9. 依赖影响

新增一个生产依赖：

```text
@yeger/vue-masonry-wall
```

该依赖只负责布局，不接管媒体加载、请求、卡片状态、滚动分页或动画。项目不同时保留 CSS Multi-column 作为另一套运行时实现，也不增加布局切换开关。

## 10. 相对主方案的取舍

| 维度 | 主方案：CSS Multi-column | 备用方案：Vue Masonry |
| --- | --- | --- |
| 新依赖 | 无 | 1 个 Vue 组件依赖 |
| 条目分发 | 纵向填满一列后换列 | 按数组顺序逐项放入较短列 |
| DOM/数据控制 | 浏览器 CSS 控制 | Vue 组件按 items 控制 |
| 动态列表更新 | 浏览器自然重排 | 必须替换 items 数组引用 |
| 卡片初始高度 | 浏览器持续布局 | 初始高度应稳定 |
| 组件复杂度 | 更低 | `WaterfallFeed.vue` 增加布局参数 |
| 视觉结果 | 与设计目标一致 | 与设计目标一致 |

## 11. 实施拆分差异

整体阶段仍沿用主方案，只替换阶段一中的瀑布流任务：

1. 增加 `@yeger/vue-masonry-wall` 生产依赖。
2. 在 `WaterfallFeed.vue` 局部接入 `MasonryWall`。
3. 将断点对应的列数、列宽和间距集中定义在布局组件。
4. 让媒体卡片在首次排布前具有确定的比例或结构高度。
5. 保持 entries 的不可变数组更新和稳定业务 key。

后续卡片重构、私有资产体验、详情页和编辑页工作与主方案完全相同。

## 12. Review 决策点

该备用方案只需额外确认两个技术取舍：

1. 是否接受新增 `@yeger/vue-masonry-wall` 依赖，以换取更符合数据顺序的短列分配。
2. 是否接受信息流卡片必须在首次排布时具有稳定高度，并按此约束媒体与摘要结构。

## 13. 推荐结论

如果更重视零依赖和浏览器原生布局，继续选择主方案。

如果更重视记录顺序与视觉分发的一致性，并愿意承担一个轻量 Vue 依赖及稳定初始高度约束，选择本备用方案。除布局引擎外，两套方案不应产生任何视觉、交互或业务差异。
