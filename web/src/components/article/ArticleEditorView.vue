<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import JournalLoading from '../ui/JournalLoading.vue';
import { useDeferredLoading } from '../../composables/useDeferredLoading';
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

const editor = useArticleEditor();
const router = useRouter();

const title = shallowRef('');
const tags = shallowRef<string[]>([]);
const richBody = shallowRef<JournalRichDocument>({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});
const previewing = shallowRef(false);
const initializedArticleId = shallowRef<number | null>(null);
const savingAction = shallowRef<'content' | 'publish' | 'privatize' | null>(null);
const mediaAction = shallowRef<'cover-upload' | 'inline-upload' | 'delete' | null>(null);

const isEditing = computed(() => props.articleId !== undefined);
const article = computed(() => editor.article.value);
const awaitingArticle = computed(() =>
  isEditing.value && article.value === null && editor.error.value === null,
);
const deferredLoading = useDeferredLoading(awaitingArticle);
const formAvailable = computed(() => !isEditing.value || article.value !== null);
const mediaPanelBusyLabel = computed(() => {
  if (mediaAction.value === 'cover-upload') return '上传中…';
  if (mediaAction.value === 'delete') return '删除中…';
  return null;
});
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
const visibilityLoadingLabel = computed(() =>
  savingAction.value === 'publish' ? '正在设为公开…' : '正在转为私有…',
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
  savingAction.value = 'content';
  try {
    const input = {
      title: title.value.trim(),
      richBody: richBody.value,
      tags: tags.value,
    };
    if (article.value === null) {
      const created = await editor.create(input);
      if (created) await router.push({ name: 'article-edit', params: { articleId: created.id } });
      return;
    }
    await editor.save(input);
  } finally {
    savingAction.value = null;
  }
}

async function uploadCover(file: File): Promise<void> {
  mediaAction.value = 'cover-upload';
  try {
    await editor.uploadAsset(file, 'cover');
  } finally {
    mediaAction.value = null;
  }
}

async function uploadInline(file: File): Promise<{ id: number; url: string } | null> {
  mediaAction.value = 'inline-upload';
  try {
    return await editor.uploadAsset(file, 'inline');
  } finally {
    mediaAction.value = null;
  }
}

async function removeAsset(asset: JournalAsset): Promise<void> {
  mediaAction.value = 'delete';
  try {
    await editor.removeAsset(asset.id);
  } finally {
    mediaAction.value = null;
  }
}

async function changeVisibility(): Promise<void> {
  if (!article.value) return;
  const visibility = nextVisibility.value;
  savingAction.value = visibility === 'public' ? 'publish' : 'privatize';
  try {
    await editor.setVisibility(visibility);
  } finally {
    savingAction.value = null;
  }
}

function viewArticle(entry: JournalEntry): void {
  if (entry.visibility === 'public') {
    void router.push({ name: 'detail', params: { publicId: entry.publicId } });
    return;
  }
  previewing.value = !previewing.value;
}
</script>

<template>
  <main class="editor-view">
    <div class="editor-view__heading">
      <button class="text-button" type="button" @click="router.push({ name: 'private' })">← 返回我的资产</button>
      <span>{{ isEditing ? '编辑文章' : '写文章' }}</span>
    </div>

    <p v-if="editor.error.value && formAvailable" class="notice notice--error" role="alert">{{ editor.error.value }}</p>

    <div class="editor-view__stage" :class="{ 'editor-view__stage--reading': !formAvailable }" :aria-busy="awaitingArticle">
      <Transition name="editor-stage" mode="out-in">
        <JournalLoading v-if="deferredLoading.visible.value" key="loading" variant="reading" label="正在打开文章…" />
        <p v-else-if="editor.error.value && !formAvailable" key="error" class="notice notice--error" role="alert">{{ editor.error.value }}</p>
        <form v-else-if="formAvailable" key="form" class="editor-view__form" @submit.prevent="save">
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
              :aria-busy="savingAction === 'content'"
            >
              <JournalLoading v-if="savingAction === 'content'" variant="inline" label="保存中…" />
              <template v-else>{{ isEditing ? '保存修改' : '保存文章' }}</template>
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
              :aria-busy="savingAction === 'publish' || savingAction === 'privatize'"
              @click="changeVisibility"
            >
              <JournalLoading
                v-if="savingAction === 'publish' || savingAction === 'privatize'"
                variant="inline"
                :label="visibilityLoadingLabel"
              />
              <template v-else>{{ nextVisibility === 'public' ? '设为公开' : '转为私有' }}</template>
            </button>
          </div>
        </form>
        <div v-else key="reserve" class="editor-view__reading-reserve" aria-hidden="true"></div>
      </Transition>
    </div>

    <ArticleMediaPanel
      v-if="article"
      :assets="assets"
      :busy="editor.uploading.value"
      :busy-label="mediaPanelBusyLabel"
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
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--editor-width));
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

.editor-view__stage {
  display: grid;
}

.editor-view__stage--reading,
.editor-view__reading-reserve {
  min-height: clamp(20rem, 48vh, 34rem);
}

.editor-view__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.editor-view__preview {
  margin-top: 0.5rem;
}

.editor-stage-enter-active {
  transition: opacity var(--dur-content-enter) var(--ease-card), transform var(--dur-content-enter) var(--ease-card);
}

.editor-stage-leave-active {
  transition: opacity var(--dur-loading-exit) var(--ease-card);
}

.editor-stage-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.editor-stage-leave-to {
  opacity: 0;
}

.notice {
  padding: 0 0.15rem;
}

</style>
