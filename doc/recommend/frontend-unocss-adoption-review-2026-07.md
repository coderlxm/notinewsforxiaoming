# 前端 UnoCSS 引入必要性 Review 报告

<!-- Review date: 2026-07-20 -->

## 一、Review 范围

本次检查覆盖 `web/src` 下全部 Vue SFC、全局样式、现有 Vite 配置，以及已完成 Review 的 Journal 瀑布流视觉方案，目标是判断 UnoCSS 能否在当前项目中实际降低样式维护成本，并为未来样式能力扩张建立统一边界。

本报告只评估样式工程方案，不改动现有页面实现、视觉效果、组件结构或依赖。

## 二、结论

**当前不建议引入 UnoCSS。**

UnoCSS 本身是成熟、活跃且适配 Vite/Vue 的方案。截至 2026-07-20，官方最新 stable release 为 `v66.7.5`，Vite 插件可以直接由 `unocss/vite` 接入。但当前项目没有出现 UnoCSS 最擅长解决的“跨大量组件反复拼装原子布局、手写 utility 持续膨胀”问题。

当前前端的样式主路径已经清楚：

- `main.css` 保存设计 token、基础元素规则和少量共享语义组件；
- 每个 Vue SFC 使用 `<style scoped>` 保存组件视觉；
- 模板使用 `entry__header`、`article-card__actions`、`rich-editor__toolbar` 等语义类；
- 深色模式、焦点样式和减少动效统一由 CSS 变量及媒体查询控制；
- Tiptap 富文本依赖 `:deep()`、后代选择器和伪元素，仍必须由 CSS 表达。

此时加入 UnoCSS，只能替换部分 `display`、`gap`、`padding`、宽度和响应式声明，无法删除卡片、媒体、富文本和交互状态样式。结果会从“一套 CSS 规则”变成“模板原子类 + scoped CSS + UnoCSS 配置”三处共同维护，标准化收益不足以覆盖新增复杂度。

因此，本项目当前的标准不是“统一改用 UnoCSS”，而是：**继续使用 CSS 变量 + 全局语义基础类 + SFC scoped CSS，并只合并已经发生的语义重复。**

官方依据：

- [UnoCSS v66.7.5 release](https://github.com/unocss/unocss/releases/tag/v66.7.5)
- [UnoCSS Vite 插件](https://unocss.dev/integrations/vite)
- [`preset-mini` 官方文档](https://unocss.dev/presets/mini)
- [`preset-wind3` 官方文档](https://unocss.dev/presets/wind3)
- [`preset-wind4` 官方文档](https://unocss.dev/presets/wind4)
- [UnoCSS 静态提取规则与限制](https://unocss.dev/guide/extracting)

## 三、现有样式基线

### 3.1 规模

当前前端包含 13 个 Vue SFC：

- `web/src/assets/main.css`：184 行；
- 全部 SFC 的 scoped style 内容：1,439 行；
- 所有 SFC 均使用 `<style scoped>`；
- 当前没有 `uno.config.ts`、UnoCSS Vite 插件、UnoCSS 虚拟样式入口或相关依赖。

1,439 行样式并不都代表可由 utility 删除的重复。大量内容是卡片状态、富文本节点、媒体类型、响应式布局和组件特有视觉。单纯按 CSS 行数判断是否引入 utility framework 会高估收益。

### 3.2 已有标准化能力

`main.css` 已承担一套小而完整的设计系统：

| 能力 | 当前实现 |
| --- | --- |
| 字体 | `--font-sans`、`--font-serif` |
| 页面宽度 | `--content-width` |
| 圆角 | `--radius-card`、`--radius-media` |
| 色彩 | surface、text、border、accent、danger、focus token |
| 阴影 | `--shadow-card` |
| 深色模式 | `prefers-color-scheme: dark` 下替换 token |
| 减少动效 | `prefers-reduced-motion: reduce` |
| 表单基础 | input、textarea、select、`.field` |
| 操作基础 | `.button`、`.text-button`、`.notice` 及 modifier |

这些 token 已直接服务现有 CSS，且深色模式只替换变量，不要求模板同时维护 `dark:` 类。把同一份值再录入 UnoCSS theme 会产生两个 token 来源；把所有视觉值写成任意值 utility，则会绕过现有 token 标准。

### 3.3 重复的真实类型

目前最明显的重复有两组：

1. `EntryCard.vue` 与 `ArticleCardContent.vue` 的卡片外壳、作者信息、徽标、标签、操作区和删除确认样式相似。
2. `RichTextEditor.vue` 与 `RichArticleRenderer.vue` 的段落、标题、列表、引用、代码块、链接、图片和分隔线排版相似。

这两组都是“相同业务语义重复”，不是“缺少原子类”：

- 卡片重复应由共享卡片语义基础样式或真实组件边界消除；
- 富文本重复应由共享 rich-content stylesheet 消除；
- UnoCSS shortcuts 只是把这些组件规则搬到 `uno.config.ts`，没有删除语义职责；
- 富文本的 `:deep(.ProseMirror ...)`、伪元素和嵌套节点也不能用普通 utility 完整表达。

## 四、候选方案对比

| 方案 | 当前收益 | 新增成本 | 结论 |
| --- | --- | --- | --- |
| 保持现有 CSS 架构 | 语义清楚、局部作用域明确、token 单一来源 | 需要主动合并真实重复 | 采用 |
| UnoCSS + `preset-mini` | 可减少部分布局与间距声明 | 新增插件、配置、全局生成样式和模板类；复杂 CSS 仍保留 | 当前不采用；未来首选候选 |
| UnoCSS + `preset-wind3` | Tailwind/Windi 兼容 utility 更完整 | 暴露的能力远超项目需要，更易无边界扩张 | 不采用 |
| UnoCSS + `preset-wind4` | 提供 Wind4 theme、properties 和 base layers | 与现有 CSS 变量、全局基础规则和 cascade 责任重叠 | 不采用 |
| 自建 CSS utility 集 | 无构建依赖 | 会手写维护 UnoCSS 已成熟解决的能力 | 禁止 |

如果未来真实达到 utility-first 的准入条件，`preset-mini` 比 Wind3/Wind4 更适合本项目。官方将它定义为只包含最必要 utility 的基础预设，并排除了 `container`、animation、gradient 等更复杂、偏框架化的能力。它更符合本项目“只解决已发生问题”的原则。

## 五、当前不引入 UnoCSS 的原因

### 5.1 不能删除一类完整职责

上一份 [VueUse Review](./frontend-vueuse-adoption-review-2026-07.md) 批准 VueUse，是因为它能完整删除事件监听生命周期和隐藏文件 input 两类浏览器胶水。

UnoCSS 在当前页面中做不到相同级别的职责替换。即使模板改用 `grid`、`flex`、`gap-*`、`p-*` 等 utility，以下 CSS 仍会存在：

- 卡片 pinned、editing、confirming、danger 等状态；
- 复杂的 hover、focus、disabled 和伪元素；
- 媒体画廊的比例、对象填充和不同媒体类型；
- Tiptap `.ProseMirror` 深层节点排版；
- 全局 theme token、深色模式与减少动效；
- 瀑布流布局中的自定义属性、负 margin 和分段列宽。

这不是净替换，只是新增第二种写法。

### 5.2 模板可读性会下降

当前模板类名直接表达业务结构，例如：

```text
article-card__delete-confirmation
media-panel__cover-empty
rich-editor__asset-picker
```

它们让模板保持短，视觉细节集中在同一个 SFC 的 style block。若把十余个布局、间距、边框、颜色和响应式 utility 放入每个元素，模板会同时承担结构和视觉实现；对这个以业务主路径为核心的个人项目，阅读成本高于少写几行 CSS 的收益。

### 5.3 shortcuts 不会解决标准化问题

UnoCSS shortcuts 可以把多个 utility 合并为一个类，但这会重新得到 `.button`、`.card` 一类语义类，只是定义位置由 CSS 移到 TypeScript 配置。

当前 `.button` 和 `.notice` 已经是清楚、可直接调试的 CSS。为它们创建 shortcuts 会形成平行组件系统；动态 shortcuts 和 custom rules 还会继续扩大配置职责。官方 shortcuts 能力成熟，但当前项目没有使用它的必要性。

参考：[UnoCSS shortcuts](https://unocss.dev/config/shortcuts)

### 5.4 预设层会与现有基础样式重叠

`preset-mini` 默认开启 preflight。`preset-wind4` 还会生成 theme、properties 和 base layers，并可内置 reset。项目已经明确管理 `box-sizing`、body margin、表单字体、focus-visible、色彩 token 和深色模式。

引入预设默认层会增加 cascade 决策；关闭 preflight 虽能避免冲突，但 UnoCSS 此时只剩部分 utility 价值，更不足以支撑当前接入成本。Wind4 的 CSS 变量和 `@property` 能力也会与现有 token 系统形成两套变量语义。

### 5.5 静态提取会新增一条编码约束

UnoCSS 按源码中的静态 token 生成 CSS，运行时拼接的 `p-${size}` 一类 class 不会被识别。项目当前的 Vue `:class` 都是明确的语义类映射，不存在提取问题；引入后必须额外约束所有 utility 保持静态字面量，并防止通过 safelist 为动态写法兜底。

这项约束本身可管理，但只有在 utility 已提供明显收益时才值得承担。

### 5.6 瀑布流重构不改变结论

[Journal 瀑布流备用方案](../design/journal-waterfall-layout-vue-masonry-alternative.md) 会增加响应式列宽、间距和卡片视觉调整，但其核心样式包含：

- `--waterfall-gap` 单一间距变量；
- 根据断点调整卡片百分比宽度；
- 负 margin 与左右 padding 配对；
- 由 `MasonryGrid` 读取真实元素宽度。

这是一段布局算法契约，保留在 `.waterfall` / `.waterfall__item` CSS 中比拆成多个任意值 utility 更清楚。未来视觉重构会增加组件样式规模，但不会自然转化为 UnoCSS 的必要性。

### 5.7 CSS 产物大小不是当前问题

UnoCSS 的按需生成可以控制未使用 utility 不进入产物，这是它的重要优势。但当前项目没有引入大体量 CSS framework，也没有维护海量未使用 selector。现有样式都与 13 个实际组件直接关联，因此不能仅凭按需生成能力推导出当前会获得有意义的体积收益。

## 六、当前样式标准

后续前端页面继续遵守以下规则：

1. **CSS 变量是唯一设计 token 来源**：颜色、字体、圆角、阴影和内容宽度等跨组件 token 统一放在 `main.css`，不在组件中重复定义同义 token；没有真实复用时不预建完整 spacing scale。
2. **共享类必须有业务语义**：只把 `.button`、`.notice`、共享 card shell、rich content 等真实复用的视觉职责放入全局样式。
3. **组件视觉就近维护**：只服务一个组件的规则继续放在该 SFC 的 `<style scoped>` 中。
4. **不手写 utility framework**：不新增 `.flex`、`.mt-2`、`.gap-4`、`.text-muted` 之类只映射单项 CSS 属性的全局类。
5. **重复发生后再抽取**：同一语义规则已经出现在多个组件，且后续需要共同变化时才合并；相似但业务含义不同的样式不强行共用。
6. **断点按页面布局契约定义**：瀑布流、单栏详情和编辑器各自保留明确 media query，不创建与当前页面无关的完整响应式刻度。
7. **状态写成显式 modifier**：继续使用 `--active`、`--pinned`、`--danger`、`--confirming` 等可读状态类，不把状态映射成动态拼接的视觉 token。
8. **复杂内容使用 CSS 选择器**：Tiptap、原生媒体控件、伪元素和嵌套内容不抽象成模板 utility。

## 七、现阶段更有效的收敛动作

### 7.1 合并富文本排版

`RichTextEditor.vue` 与 `RichArticleRenderer.vue` 中共同的 `.ProseMirror` 子节点排版应在真正修改该区域时合并为一份共享 rich-content 样式。编辑器空态、toolbar、选中态等仍留在编辑器组件中。

该动作可以直接删除重复 CSS，并保证编辑态与展示态正文排版同步；它比引入 `preset-typography` 更合适，因为当前富文本结构、颜色 token、图片圆角和代码块视觉都已有项目规则。

### 7.2 收敛卡片公共外壳

Journal 视觉重构落地时，可把 `EntryCard.vue` 与 `ArticleCardContent.vue` 已经一致的 card shell、identity、badge、tag 和 action 基础视觉收敛成共享语义层。正文、文章标题、富文本、编辑区等差异继续留在各自组件。

不要为了复用 CSS 创建不承载业务职责的多层 Vue 包装组件，也不要把这些语义类转写成 UnoCSS shortcuts。

### 7.3 保持 `main.css` 小而明确

`main.css` 只接受以下内容：

- design tokens；
- 浏览器基础元素规则；
- 跨多个组件稳定复用的语义视觉；
- 全局可访问性和用户偏好媒体查询。

单页面布局和一次性视觉不得继续上移。这样可以防止“不引入 UnoCSS”演变为无边界的全局 CSS。

## 八、未来重新评估的准入条件

只有同时满足以下条件，才重新评估 UnoCSS：

1. 已经出现至少三个互不从属的页面或功能区，反复书写相同的布局、间距和响应式组合。
2. 这些重复主要是原子布局，不是卡片、编辑器、媒体等业务语义样式。
3. 现有 CSS 已开始产生手写 utility、同义 spacing 值或断点漂移，单靠 token 和共享语义类不能直接消除。
4. 用一个真实页面做迁移草案后，能删除一组完整布局职责，且模板、CSS、配置三者的总代码与认知成本确实下降。
5. 引入不要求 custom rules、dynamic shortcuts、safelist 或多个 preset 才能覆盖主路径。

页面数量增长、CSS 行数增长或新设计出现，本身都不是准入理由。必须先证明增长形成的是 UnoCSS 可删除的重复。

## 九、未来若获准引入时的固定边界

若后续 Review 满足上述条件，第一版只允许以下最小配置方向：

| 项目 | 固定边界 |
| --- | --- |
| 依赖 | 只增加顶层开发依赖 `unocss`，使用实施时最新 stable |
| Vite 模式 | 官方默认 `global` 模式 |
| preset | 只使用 `presetMini({ preflight: false, dark: 'media' })` |
| utility 范围 | 只允许布局、间距、尺寸和简单响应式排列 |
| token | 继续以 `main.css` 的 CSS 变量为唯一来源 |
| 组件视觉 | 卡片、按钮、表单、媒体和富文本继续使用语义 CSS |
| class 写法 | 只写静态、完整的 utility 字面量 |
| 禁止项 | Attributify、Icons、Typography、Web Fonts、shortcuts、custom rules、transformers、safelist、runtime、自动导入 |

不使用 Wind3，是因为项目不需要 Tailwind/Windi 的完整兼容词汇；不使用 Wind4，是因为它的 theme、properties、base layers 与当前样式基础重叠。关闭 preflight 是为了保留现有浏览器基础规则的唯一所有权。

这套边界的目的不是提前为 UnoCSS 预留入口，而是确保将来即使引入，也只能解决已确认的布局重复，不能扩张成第二套设计系统。

## 十、最终决策

当前决策记录如下：

```text
UnoCSS：不引入
现行标准：CSS variables + global semantic primitives + SFC scoped CSS
当前优先事项：合并富文本排版与卡片公共语义，禁止手写 utility 集
重新评估条件：出现跨页面、可由原子 utility 完整删除的真实布局重复
未来首选 preset：preset-mini，关闭 preflight，严格限制为布局职责
```

UnoCSS 是合格的未来候选，但不是当前项目的必要依赖。现在最有效的标准化动作，是继续收紧现有 CSS 的职责边界并消除已经发生的语义重复，而不是增加一套新的样式表达方式。
