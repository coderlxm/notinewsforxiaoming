# Journal Web 图片拖拽选择改造方案

## 1. 背景

当前 Web 普通内容发布页通过 `EntryImagePicker.vue` 选择图片：

- 使用隐藏的原生 `<input type="file">`；
- 点击“选择图片”打开系统文件选择器；
- 选择后加入本地待发布列表并显示预览；
- 点击“保存草稿”或“发布”时，才与正文一起提交；
- 支持 JPEG、PNG、WebP、GIF，最多 10 张，每张不超过 20 MB。

这条主路径已经满足发布和草稿编辑，但电脑端整理历史图片时，需要反复点击按钮和文件选择器，操作不够直接。本次将图片选择区改造成一个可以点击、也可以接收文件拖入的容器。

## 2. 目标与范围

### 2.1 目标

- 图片区整体成为清晰可见的文件接收容器；
- 桌面端支持将一张或多张图片拖入容器；
- 点击容器仍可打开系统文件选择器；
- 拖拽和点击选择复用完全相同的数量、格式和大小规则；
- 使用 VueUse 管理拖拽区域和文件选择器；
- 保留现有预览、移除、保存草稿和发布流程。

### 2.2 本次不做

- 不修改服务端接口、图片存储和缩略图生成；
- 不在选择图片后立即上传；
- 不修改单图 20 MB 和单条内容 10 张的限制；
- 不增加拖拽排序；
- 不自动压缩、转换或跳过不合规图片；
- 不对重复文件做静默去重；
- 不改造文章封面 `ArticleMediaPanel.vue`；
- 不改造富文本正文图片 `RichTextEditor.vue`。

普通内容、文章封面和正文内嵌图片是三条不同业务路径。本次需求直接对应普通内容发布页已有的 `EntryImagePicker.vue`，先保持最小改动范围。

## 3. 交互设计

### 3.1 默认状态

图片标题和规则说明下方展示一个横向占满表单的虚线边框容器：

```text
┌──────────────────────────────────────┐
│             拖拽图片到这里             │
│              或点击选择                │
│       JPEG / PNG / WebP / GIF         │
└──────────────────────────────────────┘
```

容器本身是可操作元素，不再单独保留右上角“选择图片”按钮。点击容器或通过键盘聚焦后按 Enter、Space，均打开系统文件选择器。

规则说明继续明确：

- 最多 10 张；
- 每张不超过 20 MB；
- 支持 JPEG、PNG、WebP、GIF。

“拖拽上传”在界面文案中表达为“拖拽图片到这里”，避免让用户误以为文件已经上传到服务器。图片只有在保存草稿或发布时才提交。

### 3.2 拖入状态

图片文件进入容器范围时：

- 边框由灰色变为主题色；
- 背景使用浅主题色；
- 主文案变为“松开以添加图片”；
- 不增加动画和浮层。

文件离开或完成放置后，容器恢复默认状态。

Safari 在拖动阶段不能可靠判断文件 MIME 类型，因此拖入高亮只代表容器可以接收放置；实际格式校验统一发生在文件放入后。

### 3.3 达到数量上限

现有资产和本地待发布图片合计达到 10 张时：

- 容器显示“已达到 10 张上限”；
- 点击和键盘操作不再打开文件选择器；
- 拖入状态不激活；
- 已选图片仍可移除，移除后容器恢复可用。

保存或发布期间沿用相同行为，容器显示禁用状态。

### 3.4 文件接收规则

点击选择和拖拽放置都调用同一个 `addImages(selectedFiles)`：

1. 没有文件时不修改状态；
2. 合计超过 10 张时，拒绝本次全部文件并显示现有数量错误；
3. 存在不支持的 MIME 类型时，拒绝本次全部文件并显示具体文件名；
4. 存在超过 20 MB 的文件时，拒绝本次全部文件并显示具体文件名；
5. 全部符合规则后，按本次文件顺序追加到待发布列表。

不裁剪文件、不跳过错误文件，也不把部分文件悄悄加入列表。错误继续显示在图片区内，并在下一次选择或放置时清空后重新判断。

### 3.5 预览区域

选择成功后继续使用现有缩略图网格：

- 服务端草稿图片排在前面；
- 新加入的本地图片按选择顺序追加；
- 每张图片保留“移除”操作；
- 新图片的顺序继续作为最终附件顺序；
- 桌面端自适应列数，移动端保持两列。

拖拽文件只负责把图片加入列表，不赋予缩略图排序能力。

### 3.6 移动端

移动端主要使用点击选择：

- 容器保持整行可点击；
- 主文案改为“点击选择图片”；
- 辅助文案仍说明格式、数量和大小；
- 不额外显示“拖拽”提示，避免呈现一个移动端基本无法使用的动作。

## 4. 技术方案

### 4.1 依赖结论

项目已经安装 `@vueuse/core@14.3.0`，不需要新增依赖。

采用：

- `useDropZone`：绑定图片接收容器，提供 `isOverDropZone` 和 `onDrop`；
- `useFileDialog`：替换隐藏的原生文件输入和 `useTemplateRef<HTMLInputElement>`；
- Vue `useTemplateRef`：获取拖拽容器元素。

不使用 `useDraggable`。它用于移动页面元素，不负责接收系统文件。

### 4.2 组件边界

| 组件 | 职责 | 变化 |
| --- | --- | --- |
| `EntryPublisherView.vue` | 管理正文、可见性、草稿和发布提交 | 不变 |
| `EntryImagePicker.vue` | 接收、校验、预览和移除普通内容图片 | 内部改用 VueUse，并增加拖拽容器 |
| `useEntryPublisher.ts` | 将正文和图片交给现有 API | 不变 |

`EntryImagePicker.vue` 仍只有图片选择这一项职责，暂不拆出新的业务 composable或子组件。

对外契约保持不变：

```ts
const files = defineModel<File[]>({ required: true });

defineProps<{
  existingAssets: readonly JournalAsset[];
  disabled: boolean;
}>();

defineEmits<{
  removeExisting: [assetId: number];
}>();
```

父组件不需要知道文件来自点击还是拖拽。

### 4.3 VueUse 接入

组件内部使用一个容器引用：

```ts
const dropZone = useTemplateRef<HTMLElement>('dropZone');
```

文件选择器配置：

```ts
const { open, onChange } = useFileDialog({
  accept: 'image/jpeg,image/png,image/webp,image/gif',
  multiple: true,
  reset: true,
});

onChange((selectedFiles) => {
  addImages([...(selectedFiles ?? [])]);
});
```

拖拽区域配置：

```ts
const { isOverDropZone } = useDropZone(dropZone, {
  multiple: true,
  onDrop(droppedFiles) {
    if (droppedFiles === null) return;
    addImages(droppedFiles);
  },
});
```

`useDropZone` 不配置 `dataTypes` 白名单。当前 VueUse 实现会在不符合白名单时直接停止触发 `onDrop`，组件将拿不到具体文件，也就无法显示原有的文件名错误。拖入的真实文件统一交给 `addImages` 校验，文件选择器的 `accept` 只负责限定系统选择界面的默认范围。

容器样式只依赖：

- `isOverDropZone`；
- `disabled`；
- 当前图片是否已达到上限。

可用状态从现有数据派生，不新增同步状态：

```ts
const imageCount = computed(() => props.existingAssets.length + files.value.length);
const pickerDisabled = computed(() => props.disabled || imageCount.value >= 10);
```

点击容器时仅在 `pickerDisabled` 为 `false` 时调用 `open()`。拖拽放置后仍由 `addImages` 执行真实业务校验。

### 4.4 本地预览

本次保留现有预览 URL 管理方式：

- `watch(files)` 为新增文件创建 `URL.createObjectURL`；
- 移除文件时释放对应 URL；
- 组件卸载时释放剩余 URL。

VueUse 的 `useObjectUrl` 面向单个响应式对象。当前组件需要维护可追加、可移除的多文件列表，若为了使用它拆成逐项子组件，会扩大本次改造范围，但不会改善拖拽主路径。因此本次只让 VueUse负责文件选择和拖拽接收。

### 4.5 样式结构

新增样式状态：

- `.image-picker__drop-zone`：默认容器；
- `.image-picker__drop-zone--over`：文件悬停；
- `.image-picker__drop-zone--disabled`：提交中或达到上限；
- `.image-picker__drop-title`：主要操作文案；
- `.image-picker__drop-hint`：格式和限制说明。

容器使用现有主题变量：

- 默认边框：`var(--border-strong)`；
- 悬停边框：`var(--accent)`；
- 悬停背景：`var(--accent-soft)`；
- 正文：`var(--text-primary)`；
- 辅助文字：`var(--text-muted)`。

不增加全局 CSS 变量，样式继续放在组件的 scoped style 中。

## 5. 数据流

```text
点击容器 ── useFileDialog ─┐
                           ├─ addImages ─ 校验 ─ 更新 v-model<File[]>
拖入文件 ── useDropZone ───┘                         │
                                                     ├─ 本地预览
                                                     └─ 保存草稿/发布时统一提交
```

服务端草稿已有图片仍通过 `existingAssets` 输入；删除已有图片仍通过 `removeExisting` 事件交给父组件记录。改造不会改变草稿编辑的数据语义。

## 6. 文件改动范围

仅修改：

- `web/src/components/publisher/EntryImagePicker.vue`

不修改：

- `EntryPublisherView.vue`；
- `useEntryPublisher.ts`；
- `web/src/api.ts`；
- Journal 服务端上传接口；
- 文章相关上传组件；
- 数据库结构。

## 7. 完成标准

- 点击图片容器可以多选图片；
- 桌面端可以将一张或多张图片拖入容器；
- 两种入口遵守同一套 10 张、20 MB 和 MIME 类型规则；
- 无效的一批文件不会被部分加入；
- 拖入过程有明确高亮，放置或移出后恢复；
- 达到上限或提交期间不能继续选择；
- 已有草稿图片、新图片预览和移除行为保持一致；
- 保存草稿和发布的数据提交方式不变；
- 移动端容器不强调拖拽，保持点击选择主路径。
