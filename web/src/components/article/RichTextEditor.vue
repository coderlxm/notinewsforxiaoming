<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import { Editor, EditorContent, useEditor } from '@tiptap/vue-3';
import { FileHandler } from '@tiptap/extension-file-handler';
import Placeholder from '@tiptap/extension-placeholder';
import { createJournalRichTextExtensions } from '../../../../src/shared/journalRichText';
import type { JournalAsset, JournalRichDocument } from '../../types';

const props = withDefaults(defineProps<{
  assets?: readonly JournalAsset[];
  disabled?: boolean;
  imagesEnabled?: boolean;
  uploadImage: (file: File) => Promise<{ id: number; url: string } | null>;
}>(), {
  assets: () => [],
  disabled: false,
  imagesEnabled: false,
});

const model = defineModel<JournalRichDocument>({ required: true });
const inlineAssets = computed(() => props.assets.filter((asset) => asset.role === 'inline'));
const selectedAssetId = shallowRef('');
const imageAlt = shallowRef('');

const editor = useEditor({
  editable: !props.disabled,
  extensions: [
    ...createJournalRichTextExtensions(),
    Placeholder.configure({ placeholder: '在这里写下你的文章…' }),
    FileHandler.configure({
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      consumePasteEvent: true,
      onPaste: (editorInstance, files) => {
        const file = files[0];
        if (file) void handleFile(file, editorInstance);
      },
      onDrop: (editorInstance, files, position) => {
        const file = files[0];
        if (file) void handleFile(file, editorInstance, position);
      },
    }),
  ],
  content: model.value,
  onUpdate: ({ editor }) => {
    model.value = editor.getJSON() as JournalRichDocument;
  },
  onSelectionUpdate: ({ editor }) => syncImageAlt(editor),
});

watch(() => props.disabled, (disabled) => {
  editor.value?.setEditable(!disabled);
});

watch(model, (next) => {
  if (!editor.value) return;
  if (editor.value.isFocused) return;
  const current = JSON.stringify(editor.value.getJSON());
  if (current === JSON.stringify(next)) return;
  editor.value.commands.setContent(next, { emitUpdate: false });
});

const busy = shallowRef(false);
const fileInput = shallowRef<HTMLInputElement | null>(null);

function run(editorInstance: Editor | null | undefined, command: string): void {
  if (!editorInstance) return;
  const chain = editorInstance.chain().focus();
  switch (command) {
    case 'undo': chain.undo().run(); break;
    case 'redo': chain.redo().run(); break;
    case 'paragraph': chain.setParagraph().run(); break;
    case 'h2': chain.toggleHeading({ level: 2 }).run(); break;
    case 'h3': chain.toggleHeading({ level: 3 }).run(); break;
    case 'bold': chain.toggleBold().run(); break;
    case 'italic': chain.toggleItalic().run(); break;
    case 'strike': chain.toggleStrike().run(); break;
    case 'code': chain.toggleCode().run(); break;
    case 'bulletList': chain.toggleBulletList().run(); break;
    case 'orderedList': chain.toggleOrderedList().run(); break;
    case 'blockquote': chain.toggleBlockquote().run(); break;
    case 'codeBlock': chain.toggleCodeBlock().run(); break;
    case 'hr': chain.setHorizontalRule().run(); break;
    case 'hardBreak': chain.setHardBreak().run(); break;
    case 'link': promptLink(editorInstance); break;
    default: break;
  }
}

function promptLink(editorInstance: Editor): void {
  const previous = editorInstance.getAttributes('link').href;
  const href = window.prompt('链接地址（http://、https:// 或 mailto:）', previous ?? 'https://');
  if (href === null) return;
  try {
    const url = new URL(href);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      window.alert('仅支持 http、https 和 mailto 链接。');
      return;
    }
  } catch {
    window.alert('请输入合法链接。');
    return;
  }
  if (href === '') {
    editorInstance.chain().focus().unsetLink().run();
    return;
  }
  editorInstance.chain().focus().extendMarkRange('link').setLink({ href }).run();
}

function openFilePicker(): void {
  fileInput.value?.click();
}

function insertImage(
  editorInstance: Editor,
  asset: { id: number; url: string },
  alt: string,
  position?: number,
): void {
  const content = {
    type: 'image',
    attrs: {
      src: asset.url,
      'data-asset-id': String(asset.id),
      alt,
    },
  };
  const chain = editorInstance.chain().focus();
  if (position === undefined) chain.insertContent(content).run();
  else chain.insertContentAt(position, content).run();
}

async function handleFile(
  file: File,
  editorInstance: Editor | null | undefined,
  position?: number,
): Promise<void> {
  if (props.disabled || !editorInstance) return;
  if (!props.imagesEnabled) {
    window.alert('请先保存文章，再上传文中图片。');
    return;
  }
  busy.value = true;
  try {
    const asset = await props.uploadImage(file);
    if (!asset) return;
    insertImage(editorInstance, asset, file.name, position);
  } finally {
    busy.value = false;
  }
}

function insertSelectedAsset(): void {
  const asset = inlineAssets.value.find((item) => String(item.id) === selectedAssetId.value);
  if (!asset || !editor.value) return;
  insertImage(editor.value, asset, asset.originalName ?? '');
  selectedAssetId.value = '';
}

function syncImageAlt(editorInstance: Editor): void {
  imageAlt.value = editorInstance.isActive('image')
    ? String(editorInstance.getAttributes('image').alt ?? '')
    : '';
}

function applyImageAlt(): void {
  if (!editor.value?.isActive('image')) return;
  editor.value.chain().focus().updateAttributes('image', { alt: imageAlt.value }).run();
}

function onFileChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (file) void handleFile(file, editor.value);
}

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<template>
  <div class="rich-editor">
    <div class="rich-editor__toolbar" role="toolbar">
      <button type="button" :disabled="disabled" @click="run(editor, 'undo')">撤销</button>
      <button type="button" :disabled="disabled" @click="run(editor, 'redo')">重做</button>
      <span class="rich-editor__sep" />
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('paragraph')" @click="run(editor, 'paragraph')">正文</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('heading', { level: 2 })" @click="run(editor, 'h2')">H2</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('heading', { level: 3 })" @click="run(editor, 'h3')">H3</button>
      <span class="rich-editor__sep" />
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('bold')" @click="run(editor, 'bold')">粗体</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('italic')" @click="run(editor, 'italic')">斜体</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('strike')" @click="run(editor, 'strike')">删除线</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('code')" @click="run(editor, 'code')">代码</button>
      <span class="rich-editor__sep" />
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('bulletList')" @click="run(editor, 'bulletList')">无序</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('orderedList')" @click="run(editor, 'orderedList')">有序</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('blockquote')" @click="run(editor, 'blockquote')">引用</button>
      <button type="button" :disabled="disabled" :aria-pressed="editor?.isActive('codeBlock')" @click="run(editor, 'codeBlock')">代码块</button>
      <button type="button" :disabled="disabled" @click="run(editor, 'hr')">分隔线</button>
      <button type="button" :disabled="disabled" @click="run(editor, 'hardBreak')">换行</button>
      <span class="rich-editor__sep" />
      <button type="button" :disabled="disabled" @click="run(editor, 'link')">链接</button>
      <button type="button" :disabled="disabled || busy || !imagesEnabled" @click="openFilePicker">上传并插入图片</button>
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        @change="onFileChange"
      >
    </div>
    <div v-if="imagesEnabled && inlineAssets.length" class="rich-editor__asset-picker">
      <select v-model="selectedAssetId" :disabled="disabled || busy" aria-label="选择已上传图片">
        <option value="">选择已上传图片</option>
        <option v-for="asset in inlineAssets" :key="asset.id" :value="String(asset.id)">
          {{ asset.originalName ?? `图片 ${asset.id}` }}
        </option>
      </select>
      <button class="button button--quiet" type="button" :disabled="disabled || busy || !selectedAssetId" @click="insertSelectedAsset">
        插入正文
      </button>
    </div>
    <label v-if="editor?.isActive('image')" class="rich-editor__alt-field">
      <span>图片替代文字</span>
      <input v-model="imageAlt" type="text" maxlength="200" :disabled="disabled" @change="applyImageAlt">
    </label>
    <EditorContent :editor="editor" class="rich-editor__content" />
  </div>
</template>

<style scoped>
.rich-editor {
  display: grid;
  gap: 0.6rem;
}

.rich-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.7rem;
  background: var(--surface-card);
  overflow-x: auto;
}

.rich-editor__toolbar button {
  padding: 0.3rem 0.5rem;
  border: 0;
  border-radius: 0.45rem;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.78rem;
}

.rich-editor__toolbar button:hover:not(:disabled) {
  background: var(--surface-muted);
}

.rich-editor__toolbar button[aria-pressed="true"] {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
}

.rich-editor__toolbar button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.rich-editor__asset-picker,
.rich-editor__alt-field {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.rich-editor__asset-picker select,
.rich-editor__alt-field input {
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: var(--surface-card);
  color: var(--text-primary);
}

.rich-editor__asset-picker select {
  flex: 1;
}

.rich-editor__alt-field span {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.rich-editor__alt-field input {
  flex: 1;
}

.rich-editor__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.2rem;
  background: var(--border-subtle);
}

.rich-editor__content {
  padding: 0.85rem 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.7rem;
  background: var(--surface-card);
  min-height: 18rem;
}

.rich-editor__content :deep(.ProseMirror) {
  min-height: 16rem;
  font-family: var(--font-serif);
  font-size: 1.02rem;
  line-height: 1.78;
  outline: none;
}

.rich-editor__content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--text-muted);
  float: left;
  pointer-events: none;
  height: 0;
}

.rich-editor__content :deep(.ProseMirror p) {
  margin: 0.85rem 0;
}

.rich-editor__content :deep(.ProseMirror h2) {
  margin: 1.4rem 0 0.7rem;
  font-size: 1.3rem;
  font-weight: 700;
}

.rich-editor__content :deep(.ProseMirror h3) {
  margin: 1.2rem 0 0.6rem;
  font-size: 1.1rem;
  font-weight: 700;
}

.rich-editor__content :deep(.ProseMirror ul),
.rich-editor__content :deep(.ProseMirror ol) {
  margin: 0.7rem 0;
  padding-left: 1.5rem;
}

.rich-editor__content :deep(.ProseMirror blockquote) {
  margin: 0.9rem 0;
  padding: 0 0 0 0.85rem;
  border-left: 3px solid var(--border-strong);
  color: var(--text-muted);
}

.rich-editor__content :deep(.ProseMirror pre) {
  margin: 0.9rem 0;
  padding: 0.75rem 0.9rem;
  border-radius: 0.6rem;
  background: var(--surface-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
}

.rich-editor__content :deep(.ProseMirror code) {
  padding: 0.1rem 0.3rem;
  border-radius: 0.3rem;
  background: var(--surface-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
}

.rich-editor__content :deep(.ProseMirror pre code) {
  padding: 0;
  background: transparent;
}

.rich-editor__content :deep(.ProseMirror a) {
  color: var(--accent-strong);
  text-decoration: underline;
}

.rich-editor__content :deep(.ProseMirror img) {
  display: block;
  max-width: 100%;
  margin: 0.9rem 0;
  border-radius: 0.6rem;
}

.rich-editor__content :deep(.ProseMirror hr) {
  margin: 1.2rem 0;
  border: 0;
  border-top: 1px solid var(--border-subtle);
}

@media (max-width: 620px) {
  .rich-editor__toolbar {
    flex-wrap: nowrap;
    overflow-x: auto;
  }
}
</style>
