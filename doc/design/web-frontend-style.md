# Web 前端设计语言与风格说明

> 本文档描述 `web/` 项目当前实际使用的前端视觉语言与交互风格，供其它模型在修改或新增前端代码时遵循沿用。
> 一切以 `web/src/assets/main.css`、`web/src/assets/contribution.css` 及各组件源码为准，本文档是对既有实现的抽象归纳，不是新设计。

## 1. 总体气质

- **个人日记感**：暖白纸感底色（`paper`）上承载白色卡片，1px 细线边框分隔，整体安静、克制、低对比。
- **编辑排版感**（editorial）：标题、正文阅读使用衬线中文字体；日期、眉题、小字使用窄体（condensed）；大面积留白。
- **单一强调色**：全站只使用一个红色系（pomegranate 石榴红）作为强调色。成功、主按钮、焦点、置顶、激活态全部复用红色系，**禁止引入绿色/蓝色等其它语义色**。危险色（danger）也是同一红色系的深一档。
- **纸面不用阴影**：卡片、表格、面板一律无投影，层级靠边框与底色区分；只有浮层（弹窗、消息、tooltip）才使用柔和低透明度的黑色大阴影。
- **小字号、重字重**：全局字号偏小（0.7–1rem 为主），依靠 650–800 的字重和字距（letter-spacing）表达层级，而不是靠放大字号。
- **中文为主**：界面文案为简体中文，时间统一 `Asia/Shanghai` 时区。

## 2. 设计令牌（CSS 变量，双主题）

所有颜色、字体、尺寸必须通过 `:root` 定义的 CSS 变量引用，禁止在组件里写死颜色；深色模式通过 `@media (prefers-color-scheme: dark)` 覆盖变量实现，组件代码不需要感知主题。

### 2.1 颜色

| 变量 | 浅色值 | 深色值 | 用途 |
|---|---|---|---|
| `--paper` | `#f7f7f5` | `#1d1d1b` | 页面底色（暖白纸感） |
| `--card` | `#ffffff` | `#272725` | 卡片、面板、表单控件底色 |
| `--ink` | `#20201e` | `#f2f1ed` | 主文字 |
| `--graphite` | `#72716c` | `#aaa9a3` | 次要文字（灰石墨） |
| `--pomegranate` | `#c43b46` | `#e45b66` | 强调色基准 |
| `--mist` | `#ecece8` | `#393936` | 细边框、静默表面 |
| `--border-strong` | `#d3d3ce` | `#4b4a46` | 强边框 |
| `--accent-strong` | `#a92d38` | `#f06b75` | 主按钮底、链接文字 |
| `--accent-soft` | `#f8e8e9` | `#43272b` | 强调色的浅底（激活、徽章、成功消息） |
| `--danger` | `#a92d38` | `#f07a82` | 危险操作 |
| `--danger-soft` | `#f8e8e9` | `#47282b` | 危险操作浅底 |
| `--focus` | `#9f2530` | `#f07a82` | 键盘焦点 outline |

语义别名（组件中优先使用语义别名而不是裸色值）：

- `--surface-page` / `--surface-card` / `--surface-muted`
- `--text-primary` / `--text-muted`
- `--border-subtle` / `--border-strong`
- `--accent` / `--accent-strong` / `--accent-soft`

混色使用 `color-mix(in srgb, ...)` 表达（如 hover 底色、混合边框），不写死中间色。

### 2.2 字体

| 变量 | 字体栈 | 用途 |
|---|---|---|
| `--font-sans` | `Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | UI 控件、一般文字 |
| `--font-serif` | `"Noto Serif SC", "Songti SC", STSong, serif` | 名字、标题、正文阅读、纯文字卡片、短文本海报 |
| `--font-condensed` | `"Arial Narrow", "Roboto Condensed", Arial, sans-serif` | 日期时间、小字元信息、眉题 |

- 全局 `font-synthesis: none; text-rendering: optimizeLegibility;`
- 数字（时间、计数、大小）用 `font-variant-numeric: tabular-nums` 对齐。
- 界面文案默认 sans；进入"阅读"语境的正文、标题、名字切换到 serif；元信息与日期用 condensed。

### 2.3 尺寸与圆角

| 令牌 | 值 | 说明 |
|---|---|---|
| `--radius-card` | `12px` | 卡片、面板、消息圆角 |
| `--radius-media` | `10px` | 图片、媒体圆角 |
| 表单控件 / 按钮 / 小项 | `8px`（contribution 页为 9–10px） | 控件级圆角 |
| 徽章 / 胶囊选择器 | `999px` | pill 形状 |
| `--workspace-width` | `1920px` | 桌面内容最大宽度 |
| `--reading-width` | `820px` | 阅读宽度参考 |
| `--editor-width` / `--editor-workspace-width` | `780px` / `1120px` | 编辑器宽度 |

### 2.4 间距（响应式分档）

| 令牌 | 桌面 (≥1360) | 平板 (960–1359) | 小屏 (600–959) | 手机 (≤599) |
|---|---|---|---|---|
| `--workspace-gutter` | 24px | 24px | 20px | 10px |
| `--page-gutter` | 32px | 28px | 20px | 10px |
| `--waterfall-gap` | 20px | 18px | 14px | 8px |

组件内部间距一律使用 `rem`（0.2–1.5rem 之间的小档位），避免硬编码 px。

## 3. 动效语言

| 令牌 | 值 |
|---|---|
| `--ease-card` | `cubic-bezier(0.22, 1, 0.36, 1)`（偏"出"的缓动，所有主动画使用） |
| 微交互（按钮、边框、hover） | 140–180ms ease |
| 内容进入 / 布局过渡 | 240–260ms + `--ease-card` |
| 浮层进出 | 160–220ms |
| 加载骨架 | 呼吸动画 1600ms ease-in-out 无限（opacity 1 ↔ 0.42，可加 200ms 阶梯延迟） |

典型运动模式：

- 卡片 hover：`translateY(-2px)` + 边框加深（`--border-subtle` → `--border-strong`）；按钮 hover 上浮 `-1px`。
- 瀑布流新卡片进入：`opacity 0 → 1` + `translateY(14px) scale(0.98) → 0/1`，260ms，最多前 6 张按 35ms 阶梯延迟，`fill: backwards`。
- 浮层打开：面板 `translateY(8px) scale(0.985)` + 透明度 220ms，backdrop 透明度 160ms；关闭反向、更快（160ms）。
- 移动端顶栏收起：`grid-template-rows 1fr → 0fr` + 内容 `translateY(-0.75rem)` 淡出。
- 长 bio 文本横向滚动：mask 渐隐两端 + 线性平移（时长按溢出长度计算，`--profile-bio-duration`）。

**硬约束**：

- 全局必须带 `@media (prefers-reduced-motion: reduce)` 覆盖，将过渡/动画时长压到 0.01ms、位移归零。
- 严禁使用 `requestAnimationFrame`、`watch`（指 Vue `watch` 之外的监听方案时同样避免）以外的重动画手段；保持动画全部可由 CSS/WAAPI 表达。

## 4. 布局骨架

- **整体结构**：`profile-bar`（顶部身份栏，桌面常驻）+ `app-main`（内容区）。`app-main--public` 为 `224px 侧栏 + 内容` 双栏；小屏（≤799px）侧栏变为底部通栏 tab 导航（4 等分）。
- **页面滚动**：应用级滚动容器（隐藏滚动条，`overscroll-behavior-y: contain`），浮层内部自滚动。
- **公开页**：左侧 `PublicChannelNavigation`（频道列表，激活项左侧 0.35rem 圆角竖条 marker 变红 + `--surface-muted` 底）；顶部身份栏含圆形头像、衬线名字、可滚动 bio、下划线式导航（激活项 2px 红色下划线）。
- **瀑布流**：MasonryGrid，列数随容器宽度分档 —— `720 / 980 / 1240 / 1560` 对应 `2 / 3 / 4 / 5 / 6` 列（低于 720 为 2 列，`container-type: inline-size` 实现）。
- **表格视图**（桌面默认）：Element Plus `ElTable` 通过 CSS 变量主题化（表头 `--surface-muted` 混合底、hover 行红色软底、去 `::before` 顶部线、无阴影、细边框），行高 5rem、表头 2.75rem、小字号（0.7–0.76rem）。
- **详情浮层**：原生 `<dialog>` + `Teleport`。桌面：居中面板（上限 1440×880，四周留 24px），backdrop 为 `rgb(22 22 20 / 68%)`（深色模式更深），面板 14px 圆角 + `0 30px 80px` 大阴影；带媒体时采用"媒体舞台 + 内容栏"两栏（62fr/38fr，按首图宽高比动态算尺寸）。小屏（≤959px）变为全屏纵向滚动，面板去圆角去边框。
- **移动端顶栏隐藏**：滚动超过阈值向下收、向上弹回（距离阈值 112px 收 / 64px 显）。

## 5. 组件风格约定

### 5.1 卡片（记录卡 / 文章卡）

- 白底、`1px solid var(--border-subtle)`、`--radius-card`、内边距 `0.9rem`（详情态 1.5rem，手机 0.65rem）。
- hover：边框加深 + 上浮 2px；整卡可点击（点击区域过滤按钮等交互元素）。
- 置顶卡：边框混入 50% 强调色。
- 纯文字短卡（≤36 字）：底色混入 42% 的 `--accent-soft`，正文切衬线并放大。
- 头部为 `CardDateSpine`（品牌元素，见下）+ 可选操作菜单，左右两端对齐。
- 正文摘要截断规则：72 字符后加 `…`。

### 5.2 日期脊柱 CardDateSpine（品牌性组件）

- 左侧 `3px` 红色竖条 + `--surface-muted` 底 + 圆角小片。
- 内容为压缩字体：大写月份（`0.62rem / 800 / 0.08em` 字距，红色）+ 大号日期数字（`1.05rem / 800`）。
- 右侧元信息：时间、年份、置顶标记（📌）、公开/私有状态，全部 condensed 小字，用 1px 细边框分隔分组。
- hover 时底色变 `--accent-soft`。

### 5.3 文字海报 JournalTextPoster

- 4:5 纸张质感：米白底 `#edeae1`（深色 `#1d201e`）叠加两层低透明度径向光晕 + 左上 145° 白色高光渐变。
- 巨幅装饰字符（`?` 或 `“`）沉底右侧，`rgba(墨色 5%)` 衬线 40rem 级字号。
- 红色眉题 `PUBLIC NOTE / PRIVATE NOTE`（condensed、0.16em 字距、800）+ 40×2px 红色短横线。
- 正文：衬线、700、负字距 `-0.035em`、按字数三档字号（≤30 / ≤70 / 更长），行数 clamp。
- 页脚：署名 + 日期，condensed 灰字。

### 5.4 按钮

- 基础：`min-height 2.25rem`、圆角 8px、`0.8rem / 650` 字重、hover 上浮 1px。
- `--primary`：`--accent-strong` 红底白字；`--quiet`：白底 + 细边框；`text-button`：无框红字，hover 下划线。
- 禁用：`cursor: wait` + `opacity 0.55`（提交类可更低），不做其它装饰。
- 危险按钮：`--danger` 底白字。
- 触控目标不低于 2.5rem；图标按钮 44px 见方（contribution 页）。

### 5.5 表单

- 标签：`0.72rem / 650` 灰色，与控件间距 0.3–0.5rem。
- 控件：白底、`1px --border-subtle`、圆角 8px、内边距 `0.62rem 0.72rem`；focus 边框变强调色；`min-width: 0` 防溢出。
- 胶囊选择（radio/多选）：隐藏原生 input，外观为 pill（圆角 999px 细边框），选中态 `--accent-soft` 底 + 红色文字 + 700 字重。

### 5.6 徽章 / 状态

- 一律 `border-radius: 999px` 胶囊。
- 计数徽章：`--accent-soft` 底、红字、`0.65–0.72rem / 700`。
- 状态徽章（草稿/公开/私有）：`--surface-muted` 底、灰字，可带 0.8rem 线条图标。
- 标签 `#tag`：无框红字，hover 下划线，触控高度 ≥2.5rem。

### 5.7 消息 / 反馈

- Element Plus `el-message` 全量主题化：白底卡片（成功 = `--accent-soft` 红系底，错误 = `--danger-soft`）、细边框、12px 圆角、`0 10px 24px` 柔和阴影、内容 `0.82rem / 650`。
- **成功也用红色系**，不用绿色；这符合"单一强调色"约束。
- 加载态：骨架卡片复用"日期脊柱 + 三行灰条"图形，加呼吸动画；loading 标签小灰字。内联加载为红色竖条 + 文字。

### 5.8 筛选器

- 一条细边框卡片。桌面为内嵌面板（浅混色底 `--surface-muted 34%` 卡片底），小屏收成可展开的工具栏行。
- 摘要行：无筛选显示"全部记录"，有筛选显示前两项 + `等 N 项`。

### 5.9 其它

- 删除确认：内联展开块而非弹窗 —— `--danger-soft` 底、危险色文字、危险底确认按钮 + quiet 取消按钮，并排右对齐。
- 头像：圆形 + `box-shadow: 0 0 0 3px` 卡片色（contribution 页）或 1px 细环（顶栏）。
- 空态 / 404：居中排列，`404` 用衬线 4rem 红色。
- 骨架占位（skeleton）：`--surface-muted` 底 + 呼吸动画，圆形/条形分别对应头像与文字行。

## 6. 图标

- 使用 Element Plus 图标库（`@element-plus/icons-vue`）。
- 常规为 0.8–1.4rem 线条图标，`stroke-width 1.8`、`stroke-linecap: round`、无填充（手写 SVG 时遵循此规范）。
- 图标颜色继承文字色，激活/强调场景继承红色。

## 7. 响应式断点

| 断点 | 行为 |
|---|---|
| `max-width: 1359px` | 页边距、瀑布流间距收缩 |
| `max-width: 959px` | 详情浮层变全屏纵向滚动；媒体两栏变单列；面板去圆角 |
| `max-width: 799px` | 公开页侧栏变为底部 tab 导航 |
| `max-width: 599px` | 卡片内边距/圆角再收缩（0.65rem / 0.65rem），结构化键值表改单列，隐藏部分状态信息 |
| `max-width: 520px` | contribution 页再收缩 |

原则：**桌面优先内容密度，移动端保留完整功能但压缩视觉层级**（不删功能，只降间距、隐藏次要元信息）。

## 8. 无障碍基线

- 所有可交互元素 `:focus-visible` 提供 `2px` 实线 outline（`--focus` 色）+ `2px` offset。
- 加载中状态用 `role="status"` + `aria-live`；浮层用原生 `dialog` + `aria-modal` + `aria-labelledby`。
- 移动端顶栏隐藏时不影响键盘可达性；隐藏元素用可见性/不透明度方案。
- 尊重 `prefers-reduced-motion`（见第 3 节硬约束）。
- 触控目标：按钮、标签等交互元素最小 2.25–2.5rem。

## 9. 代码风格约束（实现侧）

- 样式写在组件 `<style scoped>` 中；跨组件复用令牌放 `:root` 变量；全局覆盖（element-plus 主题化、focus、表单基础样式）集中在 `main.css` / `contribution.css`。
- 类名使用 `块__元素--修饰` 的 BEM 风格命名。
- 颜色只引用语义别名，禁止组件内写死 hex；混色用 `color-mix`。
- 字体切换规则：UI → sans；标题/正文阅读/海报 → serif；时间元信息 → condensed。
- 卡片类元素默认无阴影；阴影只出现在浮层与海报。
- 禁止引入新的强调色；一切成功/激活/焦点/危险都走红色系令牌。
- 新组件优先复用既有组件（DateSpine、JournalLoading、MediaGallery、胶囊、卡片骨架等），不复制样式实现。
