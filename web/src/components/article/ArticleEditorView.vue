<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue';
import { useArticleEditor } from '../../composables/useArticleEditor';
import type { JournalAsset, JournalEntry, JournalRichDocument, JournalVisibility } from '../../types';
import ArticleMediaPanel from './ArticleMediaPanel.vue';
import ArticleMetaForm from './ArticleMetaForm.vue';
import ArticleCardContent from './ArticleCardContent.vue';
import RichTextEditor from './RichTextEditor.vue';

const props = withDefaults(defineProps<{
  articleId?: number;
}>(), {
  articleId: undefined,
});

const emit = defineEmits<{
  navigate: [path: string];
}>();

const editor = useArticleEditor();

const title = shallowRef('');
const tags = shallowRef<string[]>([]);
const richBody = shallowRef<JournalRichDocument>({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});
const previewing = shallowRef(false);
const initializedArticleId = shallowRef<number | null>(null);

const isEditing = computed(() => props.articleId !== undefined);
const article = computed(() => editor.article.value);
const assets = computed<JournalAsset[]>(() => article.value?.assets ?? []);
const previewEntry = computed<JournalEntry | null>(() => article.value === null
  ? null
  : {
      ...article.value,
      title: title.value.trim(),
      tags: tags.value,
      richBody: richBody.value,
    });

function hasArticleBody(document: JournalRichDocument): boolean {
  const visit = (nodes: JournalRichDocument['content']): boolean => nodes.some((node) => {
    if (node.type === 'image') return true;
    if (node.text?.trim()) return true;
    return node.content ? visit(node.content) : false;
  });
  return visit(document.content);
}

const canSave = computed(() => {
  if (isEditing.value && article.value === null) return false;
  const trimmed = title.value.trim();
  if (trimmed.length < 1 || trimmed.length > 120) return false;
  if (!hasArticleBody(richBody.value)) return false;
  return !editor.saving.value && !editor.uploading.value;
});
const nextVisibility = computed<JournalVisibility>(() =>
  article.value?.visibility === 'public' ? 'private' : 'public',
);

watch(article, (entry) => {
  if (!entry) return;
  if (initializedArticleId.value === entry.id) return;
  initializedArticleId.value = entry.id;
  title.value = entry.title ?? '';
  tags.value = [...entry.tags];
  if (entry.richBody) richBody.value = entry.richBody;
}, { immediate: true });

onMounted(() => {
  if (props.articleId !== undefined) void editor.load(props.articleId);
});

async function save(): Promise<void> {
  if (isEditing.value && article.value === null) return;
  const input = {
    title: title.value.trim(),
    richBody: richBody.value,
    tags: tags.value,
  };
  if (article.value === null) {
    const created = await editor.create(input);
    if (created) emit('navigate', `/me/articles/${created.id}/edit`);
    return;
  }
  await editor.save(input);
}

async function uploadCover(file: File): Promise<void> {
  await editor.uploadAsset(file, 'cover');
}

async function uploadInline(file: File): Promise<{ id: number; url: string } | null> {
  return editor.uploadAsset(file, 'inline');
}

async function removeAsset(asset: JournalAsset): Promise<void> {
  await editor.removeAsset(asset.id);
}

async function changeVisibility(): Promise<void> {
  if (!article.value) return;
  await editor.setVisibility(nextVisibility.value);
}

function viewArticle(entry: JournalEntry): void {
  if (entry.visibility === 'public') {
    emit('navigate', `/p/${encodeURIComponent(entry.publicId)}`);
    return;
  }
  previewing.value = !previewing.value;
}
</script>

<template>
  <main class="editor-view">
    <div class="editor-view__heading">
      <button class="text-button" type="button" @click="emit('navigate', '/me')">← 返回我的资产</button>
      <span>{{ isEditing ? '编辑文章' : '写文章' }}</span>
    </div>

    <p v-if="editor.error.value" class="notice notice--error" role="alert">{{ editor.error.value }}</p>
    <p v-if="editor.loading.value" class="notice" role="status">正在读取文章…</p>

    <form class="editor-view__form" @submit.prevent="save">
      <ArticleMetaForm v-model:title="title" v-model:tags="tags" />
      <RichTextEditor
        v-model="richBody"
        :assets="assets"
        :disabled="editor.saving.value || editor.uploading.value"
        :images-enabled="article !== null"
        :upload-image="uploadInline"
      />
      <div class="editor-view__actions">
        <button
          class="button button--primary"
          type="submit"
          :disabled="!canSave"
        >
          {{ editor.saving.value ? '保存中…' : (isEditing ? '保存修改' : '保存文章') }}
        </button>
        <button
          v-if="article"
          class="button button--quiet"
          type="button"
          :disabled="editor.saving.value || editor.uploading.value"
          @click="article && viewArticle(article)"
        >
          {{ article.visibility === 'public' ? '查看文章' : (previewing ? '收起预览' : '预览文章') }}
        </button>
        <button
          v-if="article"
          class="button button--quiet"
          type="button"
          :disabled="editor.saving.value || editor.uploading.value"
          @click="changeVisibility"
        >
          {{ nextVisibility === 'public' ? '设为公开' : '转为私有' }}
        </button>
      </div>
    </form>

    <ArticleMediaPanel
      v-if="article"
      :assets="assets"
      :busy="editor.uploading.value"
      @upload-cover="uploadCover"
      @remove-asset="removeAsset"
    />

    <section v-if="previewEntry && previewing" class="editor-view__preview" aria-label="文章预览">
      <ArticleCardContent :entry="previewEntry" :linkable="false" display="full" />
    </section>
  </main>
</template>

<style scoped>
.editor-view {
  display: grid;
  gap: 1rem;
  width: min(100%, var(--content-width));
  margin: 0 auto;
  padding: 1.3rem 0 4rem;
}

.editor-view__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.15rem;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.editor-view__form {
  display: grid;
  gap: 1rem;
}

.editor-view__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.editor-view__preview {
  margin-top: 0.5rem;
}

.notice {
  padding: 0 0.15rem;
}

@media (max-width: 720px) {
  .editor-view__heading,
  .notice {
    margin-right: 1rem;
    margin-left: 1rem;
  }
}
</style>
