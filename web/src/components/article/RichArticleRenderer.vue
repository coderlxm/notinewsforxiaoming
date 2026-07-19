<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import { createJournalRichTextExtensions } from '../../../../src/shared/journalRichText';
import type { JournalRichDocument } from '../../types';

const props = defineProps<{
  document: JournalRichDocument | null;
}>();

const editor = shallowRef<Editor | null>(null);

function buildEditor(document: JournalRichDocument | null): Editor {
  return new Editor({
    editable: false,
    extensions: createJournalRichTextExtensions(),
    content: document ?? { type: 'doc', content: [] },
  });
}

editor.value = buildEditor(props.document);

watch(() => props.document, (next) => {
  if (!editor.value) {
    editor.value = buildEditor(next);
    return;
  }
  editor.value.commands.setContent(next ?? { type: 'doc', content: [] }, false);
});

onBeforeUnmount(() => {
  editor.value?.destroy();
  editor.value = null;
});
</script>

<template>
  <div class="rich-article">
    <EditorContent :editor="editor" />
  </div>
</template>

<style scoped>
.rich-article {
  font-family: var(--font-serif);
  font-size: 1.02rem;
  line-height: 1.78;
  color: var(--text-primary);
}

.rich-article :deep(.ProseMirror) {
  min-height: 0;
  padding: 0;
}

.rich-article :deep(.ProseMirror p) {
  margin: 0.85rem 0;
}

.rich-article :deep(.ProseMirror h2) {
  margin: 1.6rem 0 0.8rem;
  font-size: 1.4rem;
  font-weight: 700;
}

.rich-article :deep(.ProseMirror h3) {
  margin: 1.3rem 0 0.7rem;
  font-size: 1.15rem;
  font-weight: 700;
}

.rich-article :deep(.ProseMirror ul),
.rich-article :deep(.ProseMirror ol) {
  margin: 0.8rem 0;
  padding-left: 1.6rem;
}

.rich-article :deep(.ProseMirror li) {
  margin: 0.25rem 0;
}

.rich-article :deep(.ProseMirror blockquote) {
  margin: 1rem 0;
  padding: 0 0 0 1rem;
  border-left: 3px solid var(--border-strong);
  color: var(--text-muted);
}

.rich-article :deep(.ProseMirror pre) {
  margin: 1rem 0;
  padding: 0.85rem 1rem;
  border-radius: 0.7rem;
  background: var(--surface-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
  overflow-x: auto;
}

.rich-article :deep(.ProseMirror code) {
  padding: 0.1rem 0.3rem;
  border-radius: 0.35rem;
  background: var(--surface-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
}

.rich-article :deep(.ProseMirror pre code) {
  padding: 0;
  background: transparent;
}

.rich-article :deep(.ProseMirror a) {
  color: var(--accent-strong);
  text-decoration: underline;
}

.rich-article :deep(.ProseMirror img) {
  display: block;
  max-width: 100%;
  margin: 1rem 0;
  border-radius: 0.7rem;
}

.rich-article :deep(.ProseMirror hr) {
  margin: 1.4rem 0;
  border: 0;
  border-top: 1px solid var(--border-subtle);
}
</style>
