# 主题模式控制与圆形揭示动画开发方案

> 当前阶段：实现中  
> 文档日期：2026-08-12  
> 产出范围：开发方案与本轮实现保持一致

## 1. 方案结论

在主应用 Header 最右侧增加一个始终可见的透明图标按钮。按钮只显示当前保存偏好对应的图标，每次点击按固定顺序循环切换：

- 细线太阳：亮色模式。
- 细线月亮：暗色模式。
- 细线桌面设备：跟随系统。

循环顺序固定为 `light → dark → auto → light`。控件不弹出悬浮窗、不同时展示三个选项，也不使用可见文字。

三态通过现有 `@vueuse/core` 的 `useColorMode()` 管理，以 `light | dark | auto` 保存用户偏好，以 `data-theme="light|dark"` 表达当前真正生效的主题。页面颜色继续复用现有 CSS 变量，不重做视觉主题。

真正切换亮暗配色时，沿用 Anthony Fu、VitePress 和 WICG 已验证的 View Transition 模型：在状态改变前读取当前 SVG 图标的几何中心，等待根快照进入 `ready`，再用 Web Animations 和 `clip-path: circle(...)` 驱动当前方向的可见快照。进入亮色时新亮色从图标向外展开；进入暗色时旧亮色向图标收拢，逐步露出暗色。

该方案不对全部 DOM 节点逐个执行背景色过渡，也不引入动画库。浏览器只合成旧、新两张页面快照，主路径短，复杂内容和媒体较多时也更容易保持自然连贯。

## 2. 当前源码事实

### 2.1 Header

当前主应用 Header 位于 `web/src/App.vue`：

- `profile-bar > header.profile` 在所有主应用路由上存在。
- `.profile` 当前为“头像、名称简介、管理导航”三列结构。
- Header 会在移动端或平板向下滚动时收起，向上滚动时恢复。
- P0-03 会进一步把公开页面 Header 调整为“身份、居中搜索、右侧操作”结构。

因此主题控件应成为独立的 `profile__actions` 最末项，而不是塞进某个页面标题或某一条管理导航中。这样它在公开页、详情、搜索、归档、私有资料库、编辑器和设置页上位置一致，也不会改变当前 Header 的收起机制。

### 2.2 当前主题实现

当前主题完全依赖系统偏好：

- `web/src/assets/main.css` 在 `:root` 声明亮色变量，并用 `@media (prefers-color-scheme: dark)` 覆盖暗色变量。
- `web/index.html` 声明 `<meta name="color-scheme" content="light dark">`。
- 七个 Journal 组件另有局部 `@media (prefers-color-scheme: dark)` 样式。
- 当前没有可持久化的显式主题状态，也没有手动切换入口。

只在根节点增加一个 `dark` class 不足以完成本功能：如果组件局部样式仍直接读取系统媒体查询，用户选择“亮色”时，系统暗色样式仍会覆盖这些组件。所有主应用暗色选择器必须一次性改为读取同一个显式生效主题。

### 2.3 已有依赖与本地解析状态

- `@vueuse/core ^14.3.0` 已安装；本地类型和实现均包含 `useColorMode()` 的 `store`、`system`、`state`、`attribute`、`storageKey`、`disableTransition` 与 `onChanged`。
- `web/src/components/about/AboutContactIcon.vue` 与 `AboutNavigationIcon.vue` 已使用 Tabler 风格的 24 × 24 内联 SVG、圆角端点和 `2px` 细描边；主题控件沿用这套项目内视觉语言。
- `@element-plus/icons-vue ^2.3.2` 虽已安装，但其主题图标风格与当前 Header 不匹配，本控件明确不使用该库。
- 当前 TypeScript 6 的 `lib.dom.d.ts` 已包含 `Document.startViewTransition()` 和 `ViewTransition` 类型，不需要增加全局类型补丁或 `@ts-expect-error`。

本功能不新增 npm 依赖。

## 3. 外部实现依据

### 3.1 Anthony Fu 的圆形主题过渡

Anthony Fu 当前站点的主题切换源码包含以下关键做法：

- 用点击事件的 `clientX/clientY` 作为圆心。
- 用 `Math.hypot()` 计算圆形覆盖视口所需的最大半径。
- 在 `document.startViewTransition()` 回调中改变主题，并等待 Vue 完成 DOM 更新。
- 根据切换方向选择 `::view-transition-new(root)` 或 `::view-transition-old(root)` 作为动画层。
- 在 CSS 中关闭浏览器默认交叉淡化并调整新旧快照层级。
- 用户偏好减少动态效果时不启动全屏动画。

源码依据：

- [Anthony Fu `toggleDark()`](https://github.com/antfu/antfu.me/blob/main/src/logics/index.ts)
- [Anthony Fu View Transition CSS](https://github.com/antfu/antfu.me/blob/main/src/styles/main.css)
- [Anthony Fu 主题按钮](https://github.com/antfu/antfu.me/blob/main/src/components/ToggleTheme.vue)

本项目复用其快照方向与圆形揭示机制，但不复制 UnoCSS 结构、图标来源或二态数据模型；NotiNews 使用自己的三态循环按钮、既有细线 SVG 语言、设计 token 和 Header 布局，并把圆心从指针落点固定为当前 SVG 图标中心。

### 3.2 当前公开 API

- [VueUse `useColorMode`](https://vueuse.org/core/usecolormode/) 明确区分保存偏好的 `store`、系统状态 `system` 和最终生效状态 `state`，支持把 `auto` 持久化。
- [MDN `document.startViewTransition()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) 将同文档 View Transition 标为 Baseline 2025，当前最新主流浏览器已具备该能力。

## 4. 功能边界

本方案包含：

- 主应用全部路由共用的亮色、暗色、跟随系统三态。
- Header 右上角单图标三态循环按钮。
- 模式偏好持久化与跨主应用页面复用。
- 跟随系统时响应系统偏好变化。
- 首屏主题预设，避免应用挂载后再突然换色。
- 主应用现有暗色选择器统一迁移。
- 页面主题围绕当前图标中心完成圆形明暗揭示。

本方案不包含：

- 重做亮、暗两套颜色设计。
- 自定义强调色、定时主题、护眼模式或按页面分别保存主题。
- 把主题偏好同步到服务端或用户账户。
- 为独立的朋友投稿入口增加第二个主题选择按钮；该入口当前是单独的 HTML/CSS 应用，不共享主应用 Header。
- 兼容不具备当前 View Transitions 基线的旧浏览器。

## 5. 交互与视觉结构

### 5.1 Header 位置

`App.vue` 将现有右侧区域收拢为：

```text
profile__actions
├── profile__nav（符合当前身份时显示）
└── ThemeModeControl（始终显示）
```

布局规则：

- 宽屏位于 Header 最右侧，排在全部站主管理入口之后。
- 公开匿名访问时，右侧仍保留主题按钮；若 P0-03 已完成，它同时构成居中搜索栏的真实右侧锚点。
- 窄屏保持 44 × 44 像素透明点击区域，视觉上只显示细线 SVG 图标。
- 控件随现有 `profile-bar` 一起收起和恢复，不增加第二个固定层。

### 5.2 入口按钮

入口按钮只显示一个图标：

| 保存偏好 | 显示图标 | 含义 |
| --- | --- | --- |
| `light` | 细线太阳 | 固定亮色 |
| `dark` | 细线月亮 | 固定暗色 |
| `auto` | 细线桌面设备 | 跟随系统 |

入口不绘制圆形底色或外边框，只保留透明点击热区和当前主题文字色。Hover 仅提高图标不透明度并切到项目强调色，focus 使用现有 `--focus`。不使用文字按钮，也不照搬 Antfu 站点图标。

虽然视觉上不显示文字，按钮仍提供动态 `aria-label`，同时说明当前模式和下一次点击的目标模式，例如“当前为暗色模式，切换为跟随系统”。SVG 图标使用 `aria-hidden="true"`，避免屏幕阅读器重复播报。

### 5.3 三态循环行为

- 每次点击只前进一个状态：亮色 → 暗色 → 跟随系统 → 亮色。
- 按钮图标始终读取保存偏好 `mode.store`，不读取最终解析状态。
- 点击前先读取当前 SVG 图标包围盒中心，再写入下一模式，保证圆心不会因图标替换而偏移。
- `selectMode()` 在业务入口同步检查动画锁；动画期间同时禁用按钮，直到当前 View Transition 完成。锁不依赖 Vue 下一轮 DOM 更新，连续点击不会进入第二次根快照。
- 如果模式前进但最终亮暗结果没有变化，只替换保存偏好和图标，不启动页面 View Transition。
- 不提供悬浮层、下拉菜单、长按菜单或第二套入口。

## 6. 状态模型

### 6.1 类型与含义

```ts
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';
```

状态只有两层：

| 状态 | 来源 | 用途 |
| --- | --- | --- |
| `mode.store` | localStorage | 用户明确选择，决定按钮图标和下一循环状态 |
| `mode.state` | `store + system` | 当前真正渲染的亮色或暗色 |

持久化键固定为 `notinews-theme-mode`。首次访问没有保存值时为 `auto`。

组件不得把 `state` 反推回 `store`。例如系统当前为暗色且用户选择 `auto` 时，入口必须显示桌面设备图标，不能因为最终呈现为暗色而改显示月亮。

### 6.2 VueUse 配置

`web/src/theme/useJournalTheme.ts` 只创建一份主题状态：

```ts
const mode = useColorMode({
  selector: 'html',
  attribute: 'data-theme',
  storageKey: THEME_STORAGE_KEY,
  initialValue: 'auto',
  disableTransition: false,
  onChanged: applyResolvedTheme,
});
```

主题状态直接归属唯一的 `ThemeModeControl` 组件作用域，不使用 `createGlobalState()` 或 detached scope。VueUse 14.3.0 的 `createGlobalState()` 会创建无法由业务侧停止的内部 detached scope；开发环境多次 HMR 后，旧 `useColorMode()` 可能继续响应同一主题存储键，导致一次点击创建多份根 View Transition。组件作用域销毁时，由 Vue 自动停止 `useColorMode()` 的 watcher 和存储事件监听，并通过 `onScopeDispose()` 取消尚未释放的圆形揭示动画。

关键约束：

- 不使用已废弃的 `emitAuto`；UI 直接读取 `mode.store`。
- `data-theme` 只写最终 `light` 或 `dark`，不会写 `auto`。
- `disableTransition` 必须为 `false`，避免 VueUse 在切换时临时向整个页面注入禁用 transition 的样式，与本功能动画争用。
- 不新增项目级 `watch`；系统偏好和 localStorage 更新使用 VueUse 已提供的状态能力。
- 不建立 Pinia store，主题是浏览器本地外观状态，不需要进入业务数据层。

### 6.3 循环切换路径

用户点击主题按钮时：

1. 在状态变化前读取当前 SVG 图标的包围盒中心，保存为本次页面揭示圆心。
2. 根据 `light → dark → auto → light` 计算下一保存偏好。
3. 写入 `mode.store`。
4. 如果下一偏好解析后的亮暗结果没有变化，只更新按钮图标。
5. 如果最终亮暗结果变化，由 `onChanged` 启动一次页面主题 View Transition。
6. `selectMode()` 启动动画前同步锁定入口，并在当前 transition 的 `finished` 完成后解锁；按钮的 `disabled` 状态同步呈现该锁，但不承担并发控制，避免已排队的连续点击创建第二个根快照。

跟随系统模式下，系统偏好后来改变时仍由同一个 `onChanged` 入口切换主题。此时没有新的点击事件，圆心继续使用 Header 当前 SVG 图标中心。

## 7. 首屏主题与页面元信息

只依赖 Vue 应用挂载后再写 `data-theme` 会造成首屏先显示系统主题或亮色、随后跳到已保存主题。应在 `web/index.html` 的应用模块之前加入最短的阻塞式主题预设脚本：

1. 读取 `notinews-theme-mode`，没有保存值时按 `auto` 处理。
2. `auto` 使用 `matchMedia('(prefers-color-scheme: dark)')` 解析。
3. 在应用与样式首次呈现前写入 `document.documentElement.dataset.theme`。
4. 同步写入根节点 `color-scheme` 和 `meta[name="theme-color"]` 对应值。

应用挂载后的 `useColorMode()` 会接管持续状态。`onChanged` 发现根节点已是同一 resolved theme 时只确认属性和元信息，不启动首屏动画。

若 P0-01 的动态页面文档服务已落地，服务端仍以构建后的 `index.html` 为模板，必须保留这段客户端预设脚本；服务端不能根据自己的系统主题猜测访问者外观偏好。

## 8. CSS 主题迁移

### 8.1 全局变量

`web/src/assets/main.css` 改为显式主题选择器：

```css
:root {
  color-scheme: light;
  /* 现有亮色变量 */
}

:root[data-theme='dark'] {
  color-scheme: dark;
  /* 现有暗色变量，数值保持不变 */
}
```

本功能不调整现有 `--paper`、`--card`、`--ink`、`--accent` 等实际色值，只改变它们由谁触发。

### 8.2 组件局部暗色规则

以下主应用文件中的 `@media (prefers-color-scheme: dark)` 必须改为读取 `html[data-theme='dark']`：

- `web/src/components/journal/JournalDetailPeek.vue`
- `web/src/components/journal/JournalMediaStage.vue`
- `web/src/components/journal/JournalDetailOverlay.vue`
- `web/src/components/journal/ProtectedEntryCard.vue`
- `web/src/components/journal/JournalTextPoster.vue`
- `web/src/components/journal/CardStatusIndicator.vue`
- `web/src/components/journal/JournalDetailContent.vue`

这些文件使用 scoped style，根选择器必须写成 `:global(html[data-theme='dark']) ...`，否则 Vue 的 scoped 属性会错误要求 `<html>` 具有组件 scope 标记。

`web/src/assets/contribution.css` 暂不迁移。它属于独立投稿页面，并继续按该页面当前系统主题行为工作。

## 9. 页面主题圆形揭示

### 9.1 快照层级

在 `main.css` 中关闭浏览器默认根交叉淡化：

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
```

层级沿用 Antfu 与 VitePress 的方向模型：

- 进入亮色：新亮色快照在上方，从图标中心的小圆扩展到全屏。
- 进入暗色：旧亮色快照在上方，从全屏圆收缩到图标中心，逐步露出下方暗色。

通过 `html[data-theme='dark']::view-transition-old/new(root)` 交换新旧快照层级，确保实际执行动画的快照始终可见。

### 9.2 圆心和半径

用户主动切换时，在模式状态改变前读取当前 SVG 图标的 `getBoundingClientRect()`，圆心取 SVG 包围盒中心，而不是 44 × 44 点击热区中心、整个 Header 或指针落点。这样键盘、触控和鼠标点击得到同一视觉结果，并确保圆形明确从用户看到的图标位置发生。

圆心和覆盖半径统一转换为相对于根快照的百分比，不依赖设备像素比或 transition 次序：

```ts
const width = window.innerWidth;
const height = window.innerHeight;
const radius = Math.hypot(
  Math.max(origin.x, width - origin.x),
  Math.max(origin.y, height - origin.y),
);
const radiusReference = Math.hypot(width, height) / Math.SQRT2;
const xPercent = origin.x / width * 100;
const yPercent = origin.y / height * 100;
const radiusPercent = radius / radiusReference * 100;
```

CSS `circle()` 的横纵圆心百分比分别相对快照宽高解析，半径百分比相对快照的标准化对角线解析。即使浏览器在首次或后续 View Transition 中采用不同的内部快照缩放，圆心和半径也会随同一个参考盒等比变化。该半径仍精确覆盖离圆心最远的视口角落，不使用固定的 `150vmax` 猜测。

### 9.3 明暗方向与节奏

`transition.ready` 后，只对当前方向真正可见的根快照执行一次 Web Animation：

| 目标 | 动画对象 | `clip-path` |
| --- | --- | --- |
| 亮色 | `::view-transition-new(root)` | `circle(0)` → `circle(radius)` |
| 暗色 | `::view-transition-old(root)` | `circle(radius)` → `circle(0)` |

统一参数：

- 时长 `400ms`。
- 缓动使用 Antfu 当前实现的标准 `ease-out`，不再自定义长时缓动曲线。
- 动画填充模式为 `forwards`。
- 不增加 blur、背景缩放或多层阴影。
- 保留 Web Animation 句柄；当前 View Transition 完成后立即 `cancel()`，释放根伪元素上的填充效果。HMR 销毁旧主题作用域时执行同一释放动作。

圆形边界本身负责空间上的明暗扩散，不叠加 brightness、opacity 或全站颜色 transition，避免点击后先停顿、突然加速或尾程拖长。

### 9.4 减少动态效果

当 `prefers-reduced-motion: reduce` 生效时：

- 不启动根 View Transition。
- 直接应用目标主题。

这是主题功能的明确无动态交互，不是动画失败后的替代通道。

## 10. 单图标循环控制

主题按钮自身不创建悬浮层，也不启动第二个 View Transition：

- 按钮保持 44 × 44 透明点击热区，不显示包裹图标的圆圈、底色或边界。
- SVG 为 24 × 24 坐标系的项目内联组件，使用 `fill="none"`、`stroke="currentColor"`、`stroke-width="2"`、圆角端点和圆角连接。
- 三种图标分别为太阳、月亮与桌面设备，路径采用项目 About 图标已经使用的 Tabler 视觉语言并保留 MIT 版权说明。
- 点击后图标直接替换为下一保存偏好；页面的圆形揭示承担主要状态反馈，不额外叠加旋转、弹跳或文字提示。
- 动画期间 `selectMode()` 同步拒绝后续点击，按钮同时禁用，完成后恢复点击。

控件不增加遮罩、背景模糊、Tooltip 或可见文案，避免一个轻量外观设置打断阅读。

## 11. Vue 组件边界

### 11.1 `ThemeModeControl.vue`

单一职责：

- 渲染当前模式入口图标。
- 计算下一循环模式。
- 在点击前取得当前 SVG 图标的几何中心。
- 把下一模式与圆心交给 `useJournalTheme()`。

组件使用 `<script setup lang="ts">`、`computed()` 和 `useTemplateRef()`。不读取路由、不操作业务 store，也不处理页面颜色变量。

### 11.2 `ThemeModeIcon.vue`

单一职责：

- 接收 `ThemeMode`。
- 按当前保存偏好渲染太阳、月亮或桌面设备内联 SVG。
- 统一三种图标的 24 × 24 画布、描边和可访问性属性。

### 11.3 `useJournalTheme.ts`

单一职责：

- 创建 `useColorMode()` 状态。
- 保存本次动画圆心。
- 在 `onChanged` 内同步根属性、浏览器主题色和 View Transition。
- 依赖 `ThemeModeControl` 的组件作用域约束监听生命周期，HMR 或组件销毁时停止旧实例与活动动画。
- 暴露 `storedMode`、`resolvedTheme`、`transitioning` 与 `selectMode()`。

类型放入 `web/src/theme/types.ts`，存储键、亮暗页面色和动画参数放入 `web/src/theme/constants.ts`，避免组件与首屏逻辑各自定义不同值。

## 12. 与 P0-03 Header 搜索的融合

若按 P0-03 方案实施居中搜索，Header 最终关系为：

```text
profile__identity      PublicHeaderSearch      profile__actions
                                                ├── profile__nav
                                                └── ThemeModeControl
```

为保持搜索栏视觉居中：

- 中央列仍由 P0-03 的对称外侧轨道决定。
- `profile__actions` 的实际宽度纳入右侧轨道计算。
- 匿名公开页面不再需要虚构空白右侧轨道，因为主题入口已经提供真实右侧内容。
- 中等宽度进入 P0-03 的两行布局时，搜索栏占第二行；身份与右侧操作留在第一行。
- 单一主题按钮宽度固定，不会随模式改变或推动搜索栏。

## 13. 预计修改文件

### 13.1 新增

- `web/src/components/ui/ThemeModeControl.vue`
- `web/src/components/ui/ThemeModeIcon.vue`
- `web/src/theme/useJournalTheme.ts`
- `web/src/theme/types.ts`
- `web/src/theme/constants.ts`

### 13.2 修改

- `web/index.html`
- `web/src/App.vue`
- `web/src/assets/main.css`
- `web/src/components/journal/JournalDetailPeek.vue`
- `web/src/components/journal/JournalMediaStage.vue`
- `web/src/components/journal/JournalDetailOverlay.vue`
- `web/src/components/journal/ProtectedEntryCard.vue`
- `web/src/components/journal/JournalTextPoster.vue`
- `web/src/components/journal/CardStatusIndicator.vue`
- `web/src/components/journal/JournalDetailContent.vue`

本方案不修改服务端、数据库、路由、业务协议、`package.json` 或锁文件。

## 14. 实施顺序

1. 建立 `ThemeMode`、常量和 `useJournalTheme()`，固定三态、存储键与 resolved theme 语义。
2. 在 `index.html` 接入首屏主题预设和浏览器主题色。
3. 把全局变量与七个 Journal 组件的暗色规则迁移到 `data-theme`。
4. 完成根 View Transition 层级、圆形半径、方向和动画节奏。
5. 完成 `ThemeModeIcon.vue` 的三枚项目风格内联 SVG，以及 `ThemeModeControl.vue` 的单按钮循环和动态无障碍名称。
6. 把控件接入 `App.vue` 的 `profile__actions`，同时兼容当前 Header 与 P0-03 居中搜索布局。
7. 收拢 SVG 圆心坐标、窄屏尺寸、reduced-motion 和动画期间禁用状态。

## 15. 主要约束

### 15.1 单一主题事实来源

主应用只能由 `html[data-theme]` 控制最终亮暗主题。不得保留一部分组件读系统媒体查询、另一部分读 class 或 data attribute 的混合状态。

### 15.2 不把 `auto` 当作视觉主题

`auto` 是保存偏好，不是一套第三种颜色。CSS 永远只接收 `light` 或 `dark`，系统偏好变化只重新解析 resolved theme。

### 15.3 不叠加全站颜色 transition

根快照已经承担完整过渡。给每个卡片、文字和边框增加颜色 transition 会造成双重动画和重绘，不属于本方案。

### 15.4 不使用 RAF 和直接 watch

动画由 View Transitions 和 Web Animations 驱动。实现不得增加 `requestAnimationFrame`、`cancelAnimationFrame`、RAF 别名或项目代码中的 `watch`。

### 15.5 错误直接暴露

本方案以 Baseline 2025/2026 的当前浏览器能力为运行前提，不实现旧浏览器动画模拟、动画库替代、自动重试或静默跳过异常。

## 16. 完成判定

- Header 右上角始终只有图标形式的主题入口，没有可见文字。
- 入口图标准确表达保存偏好，而不是只表达当前系统解析结果。
- 每次点击按亮色、暗色、跟随系统的固定顺序循环，并在后续访问中保持。
- 选择 `auto` 后，系统主题变化会更新整个主应用。
- 首次呈现直接使用已保存或系统解析后的正确主题，不出现挂载后的整页跳色。
- 所有主应用暗色局部样式都服从 `data-theme`，手动亮色不会残留系统暗色组件。
- 不出现悬浮选择窗、下拉菜单或三个并列选项。
- 亮暗切换从点击前的当前 SVG 图标中心发生，亮色逐渐提亮、暗色逐渐压暗。
- 动画期间 Header、内容滚动、详情层和媒体布局不发生几何位移。
- 减少动态效果偏好下不执行全屏圆形动画。
- 未新增依赖、路由、服务端状态、`watch`、RAF、重试或降级分支。
