# Journal Web 剪贴板图片粘贴方案

## 1. 背景

当前 Web 普通内容发布页已经支持三种图片操作：

- 点击图片容器，打开系统文件选择器；
- 将图片文件拖入容器；
- 从草稿和待发布列表中预览、移除图片。

很多临时图片来自截图工具、聊天软件或浏览器复制，图片已经位于系统剪贴板。当前仍需先保存为本地文件，再通过选择或拖拽加入发布内容，操作路径较长。

本次增加剪贴板图片入口：在发布内容或编辑草稿页面按下 `Ctrl + V` 或 `Command + V`，直接把剪贴板中的图片加入待发布列表。

## 2. 目标与范围

### 2.1 目标

- 发布内容页面支持粘贴剪贴板中的一张或多张图片；
- 正文输入框获得焦点时也可以粘贴图片；
- 图片粘贴、点击选择和拖拽复用同一个 `addImages` 主路径；
- 继续遵守 JPEG、PNG、WebP、GIF、单图 20 MB、单条 10 张的现有规则；
- 粘贴后立即出现在现有本地预览网格；
- 只在保存草稿或发布时提交图片，不增加提前上传；
- 使用 VueUse 管理粘贴事件的注册和组件卸载清理。

### 2.2 本次不做

- 不读取用户未主动粘贴的剪贴板内容；
- 不申请 Clipboard API 读取权限；
- 不解析剪贴板中的 HTML；
- 不根据剪贴板文字或 HTML 下载远程图片 URL；
- 不将 TIFF、BMP、SVG 等格式自动转换为 PNG；
- 不压缩图片；
- 不对重复图片做静默去重；
- 不提供单独的“读取剪贴板”按钮；
- 不改造文章封面和富文本正文图片；
- 不修改服务端上传接口、资产存储或数据库。

本次只接收浏览器在 `paste` 事件中提供的真实图片 `File`。如果某个复制来源只提供文本、HTML 或图片地址，不将其解释为本地图片。

## 3. 用户交互

### 3.1 使用方式

用户进入：

```text
/me/entries/new
/me/entries/:entryId/edit
```

复制图片后，可以在页面任意位置按：

```text
Windows / Linux：Ctrl + V
macOS：Command + V
```

如果剪贴板包含图片文件：

1. 浏览器粘贴默认行为被阻止；
2. 图片进入现有统一校验；
3. 校验通过后追加到待发布图片列表；
4. 页面直接显示图片预览；
5. 用户继续编辑正文、保存草稿或发布。

不新增确认弹框、成功提示或上传进度。预览图片出现就是操作结果。

### 3.2 正文输入框中的粘贴

监听范围是当前发布页面，而不是图片容器的焦点状态。因此正文输入框获得焦点时：

- 剪贴板只有文字：不处理事件，正文按浏览器原有行为粘贴文字；
- 剪贴板包含图片：将图片加入图片列表，不把图片来源 URL 或 HTML 插入正文；
- 剪贴板同时包含图片和文字表示：以图片粘贴为本次用户意图，不额外写入文字表示。

这样用户无需先点击图片容器，就可以直接使用截图工具后连续粘贴。

### 3.3 多图与顺序

如果一次粘贴包含多张图片：

- 按 `clipboardData.items` 中的原始顺序加入；
- 粘贴图片追加在当前本地图片之后；
- 服务端草稿已有图片仍排在本地图片之前；
- 粘贴顺序继续作为最终附件顺序。

粘贴图片与点击、拖拽选择的图片不做去重。

### 3.4 错误表现

粘贴图片调用现有 `addImages(selectedFiles)`，继续采用整批拒绝：

- 加入后超过 10 张：显示“每条内容最多选择 10 张图片”；
- 存在不支持的图片 MIME：显示具体文件名和格式错误；
- 存在超过 20 MB 的图片：显示具体文件名和大小错误；
- 浏览器提供图片项但无法取得文件：显示“无法读取剪贴板图片”；
- 保存或发布期间粘贴图片：显示“保存或发布期间不能添加图片”。

不裁剪、不跳过其中的错误图片，也不把一批图片中的一部分悄悄加入列表。

如果剪贴板没有图片文件，组件不显示图片错误，也不阻止正常的文字粘贴。

### 3.5 界面文案

桌面端图片容器主文案调整为：

```text
拖拽图片到这里，点击选择，或直接粘贴
```

辅助文案保留“图片将在保存草稿或发布时上传”。

图片规则说明增加快捷键提示：

```text
支持 JPEG、PNG、WebP、GIF，最多 10 张，每张不超过 20 MB；可使用 Ctrl / Command + V 粘贴。
```

移动端仍以“点击选择图片”为主，不强调键盘快捷键。剪贴板图片粘贴能力由浏览器实际提供的粘贴事件决定。

## 4. 技术方案

### 4.1 VueUse 选型

使用：

```ts
useEventListener(document, 'paste', handlePaste);
```

`useEventListener` 在组件挂载后注册事件，并在组件卸载时自动移除。`EntryImagePicker.vue` 只存在于普通内容发布和草稿编辑页面，因此监听器不会影响信息流、详情、文章编辑器或其他页面。

不使用 `useClipboardItems`。它面向异步 Clipboard API：

- 需要调用 `navigator.clipboard.read()`；
- 读取受浏览器权限控制；
- 更适合主动点击“读取剪贴板”；
- 不是响应用户标准粘贴快捷键的最短主路径。

本需求只需处理用户主动触发的 `paste` 事件，不需要后台读取剪贴板。

### 4.2 组件边界

| 组件 | 职责 | 变化 |
| --- | --- | --- |
| `EntryPublisherView.vue` | 管理正文、可见性、草稿和发布 | 不变 |
| `EntryImagePicker.vue` | 接收、校验、预览和移除普通内容图片 | 增加页面级粘贴监听和文案 |
| `useEntryPublisher.ts` | 提交正文和图片 | 不变 |

`EntryImagePicker.vue` 对父组件的契约保持不变：

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

父组件不需要区分图片来自文件选择、拖拽还是剪贴板。

### 4.3 粘贴事件处理

在组件内部新增：

```ts
useEventListener(document, 'paste', handlePaste);
```

事件处理主路径：

```ts
function handlePaste(event: ClipboardEvent): void {
  if (event.clipboardData === null) return;

  const clipboardImages = [...event.clipboardData.items]
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'));

  if (clipboardImages.length === 0) return;

  event.preventDefault();
  if (props.disabled) {
    selectionError.value = '保存或发布期间不能添加图片。';
    return;
  }

  const files: File[] = [];
  for (const item of clipboardImages) {
    const file = item.getAsFile();
    if (file === null) {
      selectionError.value = '无法读取剪贴板图片。';
      return;
    }
    files.push(file);
  }
  addImages(files);
}
```

关键行为：

- 先确认存在图片，再调用 `preventDefault()`；
- 纯文本粘贴完全交还给浏览器；
- 使用 `item.type.startsWith('image/')` 只提取图片文件项；
- 图片文件项无法读取时整批报错，不跳过其中某一项；
- 实际允许格式仍由 `addImages` 中的现有 MIME 白名单判断；
- `getAsFile()` 返回的原始 `File` 直接进入现有预览和提交链路；
- 不创建新的文件封装，不修改文件名、MIME 或二进制内容。

### 4.4 与现有入口的关系

```text
点击选择 ── useFileDialog ─┐
                           │
拖入图片 ── useDropZone ───┼─ addImages ─ 校验 ─ v-model<File[]>
                           │                         │
粘贴图片 ── paste event ───┘                         ├─ 本地预览
                                                     └─ 保存草稿/发布时统一提交
```

三种入口只负责取得 `File[]`，数量、格式、大小、预览和提交顺序仍只有一套业务实现。

## 5. 浏览器行为边界

### 5.1 可以覆盖

- 系统截图后直接粘贴；
- 截图工具“复制到剪贴板”后粘贴；
- 应用将图片二进制写入剪贴板后粘贴；
- 浏览器复制图片且粘贴事件提供图片文件项。

### 5.2 不在本次范围

- 剪贴板只包含图片 URL；
- 剪贴板只包含带 `<img>` 的 HTML；
- 复制来源只提供平台私有剪贴板格式；
- 浏览器没有向页面暴露图片 `File`。

这些情况没有可直接提交的本地图片文件。主动解析 HTML、请求远程地址或转换私有格式会形成另一条下载与安全主路径，不纳入本次快捷粘贴。

## 6. 文件改动范围

仅修改：

- `web/src/components/publisher/EntryImagePicker.vue`

不修改：

- `EntryPublisherView.vue`；
- `useEntryPublisher.ts`；
- `web/src/api.ts`；
- Journal 服务端；
- 数据库；
- 文章相关上传组件。

## 7. 完成标准

- 在发布内容和编辑草稿页面按 Ctrl/Command+V 可以加入剪贴板图片；
- 正文聚焦时粘贴图片仍加入图片列表；
- 纯文本粘贴继续写入正文，不被图片组件拦截；
- 多张剪贴板图片按原顺序追加；
- 粘贴图片遵守现有数量、格式和大小规则；
- 无效的一批图片不会被部分加入；
- 粘贴后复用现有预览、移除、保存草稿和发布流程；
- 发布页面之外不注册图片粘贴行为；
- 不触发 Clipboard API 权限申请；
- 不改变任何服务端接口。
