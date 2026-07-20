# 前端 VueUse 等效简化 Review 报告

<!-- Review date: 2026-07-20 -->

## 一、Review 范围

本次检查覆盖 `web/src` 下全部 Vue SFC、前端 composable、请求层和工具函数，目标只有两个：

1. 找出现有手写浏览器能力中，可以由 VueUse 等效替换并实际减少代码的部分。
2. 给后续 VueUse 使用建立明确边界，避免因为“库里有同名函数”就持续扩张依赖和抽象。

本次不调整业务交互、请求协议、错误呈现、组件拆分和视觉样式。

## 二、结论

建议新增唯一顶层依赖 `@vueuse/core`，但当前只批准两个函数、三个调用点：

| VueUse 函数 | 现有位置 | 结论 |
| --- | --- | --- |
| `useEventListener` | `web/src/App.vue` 的 `popstate` 监听 | 采用 |
| `useFileDialog` | `web/src/components/article/ArticleMediaPanel.vue` 的封面选择 | 采用 |
| `useFileDialog` | `web/src/components/article/RichTextEditor.vue` 的正文图片选择 | 采用 |

除此之外，当前前端没有值得引入 VueUse 的等效简化点。现有 Vue 原生 `computed`、`watch`、`defineModel`、生命周期钩子，以及平台原生 `URL`、`URLSearchParams`、`Intl`、`FormData` 和 `fetch` 都应继续保留。

截至 2026-07-20，VueUse 最新 stable release 为 `14.3.0`；`@vueuse/core` 的 peer dependency 是 `vue ^3.5.0`，与项目当前的 `vue ^3.5.40` 匹配。包声明了 `sideEffects: false`，本项目使用具名导入即可让构建工具只保留实际使用的函数。

依赖范围固定为：

```text
@vueuse/core: ^14.3.0
```

不同时引入 `@vueuse/integrations`、`@vueuse/components`、自动导入插件或其他 VueUse 子包。

官方依据：

- [VueUse v14.3.0 release](https://github.com/vueuse/vueuse/releases/tag/v14.3.0)
- [`@vueuse/core` package metadata](https://github.com/vueuse/vueuse/blob/main/packages/core/package.json)
- [`useEventListener` 官方文档](https://vueuse.org/core/useeventlistener/)
- [`useFileDialog` 官方文档](https://vueuse.org/core/usefiledialog/)

## 三、前端职责边界

与本次 VueUse 选型直接相关的组件职责如下：

| 文件 | 当前职责 | VueUse 边界 |
| --- | --- | --- |
| `App.vue` | 解析轻量路由、写入 History、响应浏览器前进后退 | 只接管事件监听的注册与释放，不接管路由状态 |
| `ArticleMediaPanel.vue` | 展示文章资产并选择封面文件 | 只接管文件选择器，不接管上传请求 |
| `RichTextEditor.vue` | 管理 Tiptap 编辑器、选择或上传正文图片 | 只接管工具栏文件选择器，不接管粘贴、拖放和上传状态 |
| `useArticleEditor.ts` | 文章请求、业务状态和错误呈现 | 不使用 VueUse 异步状态封装 |
| `useJournalApi.ts` | 信息流、鉴权、分页和条目变更 | 不使用 VueUse 请求、分页或全局状态封装 |
| `api.ts` | HTTP 状态判断与 `JournalRequestError` 协议 | 不使用 VueUse `useFetch` |

VueUse 只替换通用浏览器胶水，不进入业务数据层。

## 四、建议采用的等效替换

### 4.1 `App.vue`：用 `useEventListener` 收口 `popstate` 生命周期

当前代码手动维护完全配对的监听和清理：

```ts
onMounted(() => window.addEventListener('popstate', synchronizeLocation));
onUnmounted(() => window.removeEventListener('popstate', synchronizeLocation));
```

建议改为：

```ts
import { useEventListener } from '@vueuse/core';
import { computed, shallowRef } from 'vue';

useEventListener(window, 'popstate', synchronizeLocation);
```

收益：

- 删除 `onMounted` / `onUnmounted` 和成对的浏览器 API。
- 监听器随组件 scope 自动释放，不再要求调用方保持回调引用和 options 完全一致。
- `synchronizeLocation`、`navigate`、History 写入和滚动行为全部不变。

这里不改用 `useBrowserLocation` 或 `useUrlSearchParams`。当前 `App.vue` 同时解析 pathname 和 query，并在 `pushState` 后立即同步本地 route；替换成更高层的响应式 location API 不能完整删除当前轻量路由逻辑，反而会形成两套状态来源。

### 4.2 `ArticleMediaPanel.vue`：用 `useFileDialog` 删除隐藏 input 和 DOM ref

当前组件自行维护：

- `shallowRef<HTMLInputElement | null>`；
- `.click()`；
- `Event` 到 `HTMLInputElement` 的断言；
- `files?.[0]`；
- `target.value = ''`；
- 模板中的隐藏 `<input type="file">`。

这些都属于 `useFileDialog` 的直接职责。等效接入应固定以下参数：

```ts
const { open: openCoverDialog, onChange: onCoverChange } = useFileDialog({
  accept: 'image/jpeg,image/png,image/webp,image/gif',
  multiple: false,
  reset: true,
});

onCoverChange((files) => {
  const file = files?.item(0);
  if (file) emit('uploadCover', file);
});
```

模板按钮使用 `@click="openCoverDialog()"`，不要写成 `@click="openCoverDialog"`，避免 Vue 把点击事件对象作为 `open()` 的局部 options 参数传入。

`multiple: false` 保持当前单文件语义；`reset: true` 等效于现有的 `target.value = ''`，允许连续选择同一文件。上传仍由父组件处理，文件选择器不增加校验、重试或替代上传路径。

### 4.3 `RichTextEditor.vue`：正文工具栏复用同一文件选择标准

该组件存在与封面选择相同的隐藏 input、DOM ref、`.click()` 和 change event 解析。建议使用同样的 `useFileDialog` options，并在 `onChange` 中继续进入已有 `handleFile(file, editor.value)` 主路径：

```ts
const { open: openImageDialog, onChange: onImageChange } = useFileDialog({
  accept: 'image/jpeg,image/png,image/webp,image/gif',
  multiple: false,
  reset: true,
});

onImageChange((files) => {
  const file = files?.item(0);
  if (file) void handleFile(file, editor.value);
});
```

只替换工具栏的浏览器文件选择器。Tiptap `FileHandler` 的粘贴和拖放处理仍保留，因为它们属于编辑器事件，不是 `useFileDialog` 的能力范围。

当前只有两个相同配置的图片选择点，不新增 `useArticleImageDialog` 包装 composable。两个组件直接调用成熟 API 更短；若以后出现必须共享的业务规则，再抽承载该规则的项目级封装。

## 五、明确不采用的 VueUse 候选

### 5.1 不用 `useFetch` / `useAsyncState`

`api.ts` 已统一处理：

- `credentials: 'same-origin'`；
- 非 2xx 响应体读取；
- `JournalRequestError` 的 status 与 message；
- JSON 与无响应请求的差异。

`useJournalApi.ts` 和 `useArticleEditor.ts` 又包含鉴权状态、游标分页、条目替换、上传后刷新等业务过程。VueUse 的通用异步状态无法删除这些规则，还会在现有错误模型外再增加一层状态与执行语义，因此不采用。

### 5.2 不用 `useConfirmDialog` / `useToggle`

`EntryCard.vue`、`ArticleCardContent.vue` 和 `ArticleEditorView.vue` 中的布尔状态只有直接赋值与一次切换：

- `confirmingDeletion`；
- `editing`；
- `previewing`。

当前 `shallowRef(false)` 加显式赋值比 composable 返回的一组控制方法更直观。删除确认也是卡片内联状态，不是 Promise 式模态流程；引入 `useConfirmDialog` 会增加抽象而不减少业务代码。

### 5.3 不用 `useBrowserLocation` / `useUrlSearchParams`

项目没有 Vue Router，而是在 `App.vue` 中维护一条很短的 pathname + query 路由主路径。VueUse 的 location 或 query composable 只能覆盖其中一部分，不能同时替代 route union、pathname 匹配、History 写入和组件 key，因此不采用。

### 5.4 不用 `useWindowScroll` / `useScroll`

`navigate()` 只在导航完成后执行一次：

```ts
window.scrollTo({ top: 0, behavior: 'smooth' });
```

这里不需要持续追踪 scroll position。引入响应式滚动状态会增加监听和 ref，代码也更长。

### 5.5 不用 `watchImmediate` / `watchArray` 等 watcher sugar

现有 watcher 数量少，且条件明确：

- `ArticleEditorView.vue` 的 `{ immediate: true }` 直接表达初始化语义；
- `EntryFilters.vue` 明确列出六个需要同步的字段；
- Tiptap 组件需要在 watcher 内执行编辑器命令。

这些写法已经是标准 Vue API。只为省一个 options 对象或 getter 改成 VueUse，不构成净简化。

### 5.6 不用 VueUse 的 `useVModel`、`templateRef` 和 `tryOnBeforeUnmount`

项目运行 Vue 3.5：

- 双向组件契约继续使用原生 `defineModel`；
- 真正需要模板 ref 时使用原生 `useTemplateRef`；
- Tiptap 实例销毁继续使用原生 `onBeforeUnmount`。

Vue 已提供等效的一等 API 时，不增加 VueUse 同类封装。

### 5.7 不用数组、日期和无限滚动 composable

- `computed + Array.map/filter/find` 已足够表达媒体分组和资产查找，不改用 `useArrayMap`、`useArrayFilter` 等响应式包装。
- `Intl.DateTimeFormat` / `Intl.NumberFormat` 是当前纯函数格式化工具，不改成 `useDateFormat`。
- 当前“加载更早记录”是明确按钮交互且后端采用 cursor，不改用 `useInfiniteScroll` 或 `useOffsetPagination`。

## 六、VueUse 标准化准入规则

后续新增 VueUse 用法必须同时满足以下条件：

1. **有现存手写目标**：先指出要删除的浏览器 API、监听清理、计时器或 DOM 胶水，不能为了未来可能需要而预埋 composable。
2. **必须等效**：不能改变交互触发时机、请求顺序、错误暴露、数据来源或用户可见行为。
3. **必须净简化**：替换后要删除一段完整职责，而不是把一行原生 API 改成一行 VueUse API。
4. **Vue 原生优先**：`computed`、`watch`、`defineModel`、`useTemplateRef` 和生命周期钩子已经清楚时继续使用 Vue。
5. **平台 API 优先**：`URL`、`URLSearchParams`、`Intl`、`FormData` 等纯、短、无生命周期负担的能力继续直接使用。
6. **只用 core 白名单**：当前白名单只有 `useEventListener`、`useFileDialog`。新增函数必须先更新本报告或后续同类 review 记录依据。
7. **不引入隐藏行为**：禁止通过 VueUse 增加 retry、fallback、轮询、缓存、自动持久化、自动同步或全局状态。
8. **不做全局自动导入**：所有 VueUse 函数都从 `@vueuse/core` 具名显式导入，让依赖在文件内可见。
9. **不默认再封装**：直接调用已经足够短时不创建 `useXxx` 包装层；只有封装承载真实业务规则或消除已经发生的重复时才提取。
10. **不替换业务 composable**：`useJournalApi`、`useArticleEditor` 继续表达项目业务，VueUse 只作为其内部可选的通用浏览器原语。

## 七、建议落地顺序

1. 在生产依赖中增加 `@vueuse/core ^14.3.0`。
2. 先替换 `App.vue` 的 `popstate` 注册与清理。
3. 再替换 `ArticleMediaPanel.vue` 和 `RichTextEditor.vue` 的隐藏文件 input。
4. 保持其他前端文件不变，不顺手扩张到异步请求、布尔状态、路由、watcher 或数组工具。

这次引入的目标不是让项目“VueUse 化”，而是把两类已经存在的通用浏览器胶水交给成熟库，并用白名单阻止后续无边界扩张。
