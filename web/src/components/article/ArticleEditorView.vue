<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import JournalLoading from '../ui/JournalLoading.vue';
import { useDeferredLoading } from '../../composables/useDeferredLoading';
import { useArticleEditor } from '../../composables/useArticleEditor';
import { useTagSuggestions } from '../../composables/useTagSuggestions';
import type { JournalAsset, JournalEntry, JournalRichDocument, JournalVisibility } from '../../types';
import { showMessage } from '../../utils/message';
import ArticleCardContent from './ArticleCardContent.vue';
import ArticleEditorSidebar from './ArticleEditorSidebar.vue';
import ArticleTitleField from './ArticleTitleField.vue';
import RichTextEditor from './RichTextEditor.vue';

const props = withDefaults(defineProps<{
  articleId?: number;
}>(), {
  articleId: undefined,
});

const editor = useArticleEditor();
const tagSuggestions = useTagSuggestions();
const router = useRouter();

const title = shallowRef('');
const tags = shallowRef<string[]>([]);
const richBody = shallowRef<JournalRichDocument>({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});
const previewing = shallowRef(false);
const selectedVisibility = shallowRef<JournalVisibility>('private');
const accessPassword = shallowRef('');
const initializedArticleId = shallowRef<number | null>(null);
const savingAction = shallowRef<'content' | 'access' | null>(null);
const mediaAction = shallowRef<'cover-upload' | 'inline-upload' | 'delete' | null>(null);
let terminalErrorMessage: ReturnType<typeof showMessage> | null = null;

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

function hasArticleText(document: JournalRichDocument): boolean {
  const visit = (nodes: JournalRichDocument['content']): boolean => nodes.some((node) => {
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
const canGenerateTags = computed(() => {
  const titleLength = title.value.trim().length;
  return titleLength > 0
    && titleLength <= 120
    && hasArticleText(richBody.value)
    && tags.value.length < 20;
});
const hasExistingPassword = computed(() => article.value?.visibility === 'protected');
const accessSettingsValid = computed(() =>
  selectedVisibility.value !== 'protected'
  || /^\d{6}$/.test(accessPassword.value)
  || (hasExistingPassword.value && accessPassword.value === ''),
);
const canSaveAccess = computed(() => article.value !== null
  && accessSettingsValid.value
  && (selectedVisibility.value !== article.value.visibility || accessPassword.value !== '')
  && !editor.saving.value
  && !editor.uploading.value);

watch(article, (entry) => {
  if (!entry) return;
  if (initializedArticleId.value === entry.id) return;
  initializedArticleId.value = entry.id;
  title.value = entry.title ?? '';
  tags.value = [...entry.tags];
  selectedVisibility.value = entry.visibility;
  accessPassword.value = '';
  if (entry.richBody) richBody.value = entry.richBody;
}, { immediate: true });

watch(() => editor.error.value, (error) => {
  if (!error) {
    terminalErrorMessage?.close();
    terminalErrorMessage = null;
    return;
  }
  if (isEditing.value && article.value === null) {
    terminalErrorMessage?.close();
    terminalErrorMessage = showMessage({ message: error, type: 'error', duration: 0 });
    return;
  }
  showMessage({ message: error, type: 'error' });
});

onBeforeUnmount(() => terminalErrorMessage?.close());

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

async function saveAccessSettings(): Promise<void> {
  if (!article.value) return;
  savingAction.value = 'access';
  try {
    const updated = await editor.setVisibility(
      selectedVisibility.value,
      accessPassword.value || undefined,
    );
    if (!updated) return;
    selectedVisibility.value = updated.visibility;
    accessPassword.value = '';
    showMessage({ message: '访问权限已保存', type: 'success' });
  } finally {
    savingAction.value = null;
  }
}

async function generateTags(): Promise<void> {
  try {
    const suggestions = await tagSuggestions.generate({
      kind: 'article',
      title: title.value.trim(),
      richBody: richBody.value,
      existingTags: [...tags.value],
    });
    const mergedTags = [...tags.value];
    const existingTags = new Set(mergedTags);
    for (const tag of suggestions) {
      if (mergedTags.length === 20) break;
      if (existingTags.has(tag)) continue;
      existingTags.add(tag);
      mergedTags.push(tag);
    }
    const addedCount = mergedTags.length - tags.value.length;
    if (addedCount === 0) {
      showMessage({ message: '没有新的标签可补充', type: 'info' });
      return;
    }
    tags.value = mergedTags;
    showMessage({ message: `已补充 ${addedCount} 个标签`, type: 'success' });
  }
  catch (reason) {
    showMessage({
      message: reason instanceof Error ? reason.message : String(reason),
      type: 'error',
    });
  }
}

function viewArticle(entry: JournalEntry): void {
  if (entry.visibility !== 'private') {
    void router.push({ name: 'detail', params: { publicId: entry.publicId } });
    return;
  }
  previewing.value = !previewing.value;
}

function viewCurrentArticle(): void {
  if (article.value) viewArticle(article.value);
}

function returnToAssets(): void {
  const state = window.history.state as { journalReturnPath?: string } | null;
  void router.push(state?.journalReturnPath ?? '/me');
}
</script>

<template>
  <main class="editor-view">
    <div class="editor-view__heading">
      <button class="text-button" type="button" @click="returnToAssets">← 返回我的资产</button>
      <span>{{ isEditing ? '编辑文章' : '写文章' }}</span>
    </div>

    <div class="editor-view__stage" :class="{ 'editor-view__stage--reading': !formAvailable }" :aria-busy="awaitingArticle">
      <Transition name="editor-stage" mode="out-in">
        <JournalLoading v-if="deferredLoading.visible.value" key="loading" variant="reading" label="正在打开文章…" />
        <form v-else-if="formAvailable" key="form" class="editor-view__form" @submit.prevent="save">
          <div class="editor-view__manuscript">
            <ArticleTitleField v-model="title" />
            <RichTextEditor
              v-model="richBody"
              :assets="assets"
              :disabled="editor.saving.value || editor.uploading.value"
              :images-enabled="article !== null"
              :upload-image="uploadInline"
            />
          </div>
          <ArticleEditorSidebar
            v-model:tags="tags"
            v-model:visibility="selectedVisibility"
            v-model:access-password="accessPassword"
            :article="article"
            :action-busy="editor.saving.value || editor.uploading.value"
            :assets="assets"
            :can-save="canSave"
            :can-save-access="canSaveAccess"
            :can-generate-tags="canGenerateTags"
            :has-existing-password="hasExistingPassword"
            :is-editing="isEditing"
            :media-busy="editor.uploading.value"
            :media-busy-label="mediaPanelBusyLabel"
            :previewing="previewing"
            :saving-action="savingAction"
            :tag-suggestion-busy="tagSuggestions.busy.value"
            @generate-tags="generateTags"
            @save-access-settings="saveAccessSettings"
            @remove-asset="removeAsset"
            @upload-cover="uploadCover"
            @view-article="viewCurrentArticle"
          />
        </form>
        <div v-else key="reserve" class="editor-view__reading-reserve" aria-hidden="true"></div>
      </Transition>
    </div>

    <section v-if="previewEntry && previewing" class="editor-view__preview" aria-label="文章预览">
      <ArticleCardContent :entry="previewEntry" :linkable="false" display="full" />
    </section>
  </main>
</template>

<style scoped>
.editor-view {
  display: grid;
  gap: 1rem;
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--editor-workspace-width));
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
  grid-template-columns: minmax(0, var(--editor-width)) minmax(18rem, 1fr);
  gap: 1rem;
  align-items: start;
}

.editor-view__stage {
  display: grid;
}

.editor-view__manuscript {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.editor-view__stage--reading,
.editor-view__reading-reserve {
  width: min(100%, var(--editor-width));
  min-height: clamp(20rem, 48vh, 34rem);
  margin: 0 auto;
}

.editor-view__preview {
  width: min(100%, var(--editor-width));
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

@media (max-width: 1180px) {
  .editor-view {
    width: min(calc(100% - (var(--page-gutter) * 2)), var(--editor-width));
  }

  .editor-view__form {
    grid-template-columns: minmax(0, 1fr);
  }
}

</style>
