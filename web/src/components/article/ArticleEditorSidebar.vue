<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import type { JournalAsset, JournalEntry, JournalVisibility } from '../../types';
import { parseTagsInput, tagsInputToString } from '../../types';
import { copyEntryAccessLink } from '../../utils/accessLink';
import { showMessage } from '../../utils/message';
import AiSuggestionButton from '../ui/AiSuggestionButton.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import EntryVisibilityField from '../publisher/EntryVisibilityField.vue';
import ArticleMediaPanel from './ArticleMediaPanel.vue';

type SavingAction = 'content' | 'access' | null;

const props = defineProps<{
  article: JournalEntry | null;
  actionBusy: boolean;
  assets: readonly JournalAsset[];
  canSave: boolean;
  canSaveAccess: boolean;
  canGenerateTags: boolean;
  hasExistingPassword: boolean;
  isEditing: boolean;
  mediaBusy: boolean;
  mediaBusyLabel: string | null;
  previewing: boolean;
  savingAction: SavingAction;
  tagSuggestionBusy: boolean;
}>();

const emit = defineEmits<{
  generateTags: [];
  saveAccessSettings: [];
  removeAsset: [asset: JournalAsset];
  uploadCover: [file: File];
  viewArticle: [];
}>();

const tags = defineModel<string[]>('tags', { default: () => [] });
const visibility = defineModel<JournalVisibility>('visibility', { required: true });
const accessPassword = defineModel<string>('accessPassword', { default: '' });
const aiGenerated = defineModel<boolean>('aiGenerated', { default: false });
const tagsInput = shallowRef(tagsInputToString(tags.value));
const tagInputFull = computed(() => parseTagsInput(tagsInput.value).length === 20);

watch(tags, (next) => {
  const text = tagsInputToString(next);
  if (text !== tagsInput.value) tagsInput.value = text;
});

function commitTagsInput(): string[] {
  const committedTags = parseTagsInput(tagsInput.value);
  tags.value = committedTags;
  return committedTags;
}

function requestTagSuggestions(): void {
  if (commitTagsInput().length === 20) return;
  emit('generateTags');
}

async function copyAccessLink(): Promise<void> {
  if (!props.article) return;
  try {
    await copyEntryAccessLink(props.article.publicId);
    showMessage({ message: '访问链接已复制', type: 'success' });
  }
  catch (reason) {
    showMessage({
      message: reason instanceof Error ? reason.message : String(reason),
      type: 'error',
    });
  }
}
</script>

<template>
  <aside class="editor-sidebar">
    <section class="editor-sidebar__section">
      <h2 class="editor-sidebar__title">文章设置</h2>

      <div class="editor-sidebar__settings">
        <label class="editor-sidebar__ai-generated" :class="{ 'editor-sidebar__ai-generated--on': aiGenerated }">
          <input v-model="aiGenerated" type="checkbox">
          <span>
            <strong>AI 生成内容</strong>
            <small>AI 完成主要正文撰写时开启</small>
          </span>
        </label>

        <div class="field">
          <div class="editor-sidebar__field-heading">
            <label class="field__label" for="article-editor-tags">标签（逗号分隔，最多 20 个）</label>
            <AiSuggestionButton
              label="AI 生成标签"
              busy-label="生成中…"
              :disabled="!canGenerateTags || tagInputFull"
              :busy="tagSuggestionBusy"
              @generate="requestTagSuggestions"
            />
          </div>
          <input
            id="article-editor-tags"
            v-model="tagsInput"
            type="text"
            placeholder="例如：生活, 随笔"
            @blur="commitTagsInput"
            @keydown.enter.prevent="commitTagsInput"
          >
        </div>

        <EntryVisibilityField
          v-if="article"
          :key="article.updatedAt"
          v-model="visibility"
          v-model:access-password="accessPassword"
          :disabled="actionBusy"
          :has-existing-password="hasExistingPassword"
        />
        <div v-else class="editor-sidebar__visibility">
          <span>可见范围</span>
          <strong class="editor-sidebar__visibility-value">保存后设置</strong>
        </div>

        <div class="editor-sidebar__actions">
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
            :disabled="actionBusy"
            @click="emit('viewArticle')"
          >
            {{ article.visibility !== 'private' ? '查看文章' : (previewing ? '收起预览' : '预览文章') }}
          </button>
          <button
            v-if="article"
            class="button button--quiet"
            type="button"
            :disabled="!canSaveAccess"
            :aria-busy="savingAction === 'access'"
            @click="emit('saveAccessSettings')"
          >
            <JournalLoading
              v-if="savingAction === 'access'"
              variant="inline"
              label="保存中…"
            />
            <template v-else>保存访问权限</template>
          </button>
          <button
            v-if="article?.visibility === 'protected'"
            class="button button--quiet"
            type="button"
            :disabled="actionBusy"
            @click="copyAccessLink"
          >
            复制访问链接
          </button>
        </div>
      </div>
    </section>

    <ArticleMediaPanel
      v-if="article"
      :assets="assets"
      :busy="mediaBusy"
      :busy-label="mediaBusyLabel"
      @upload-cover="emit('uploadCover', $event)"
      @remove-asset="emit('removeAsset', $event)"
    />
  </aside>
</template>

<style scoped>
.editor-sidebar {
  display: grid;
  align-content: start;
  gap: 1rem;
  min-width: 0;
}

.editor-sidebar__section {
  display: grid;
  gap: 0.3rem;
}

.editor-sidebar__settings {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.editor-sidebar__title {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.editor-sidebar__ai-generated {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.65rem;
  background: var(--surface-card);
  cursor: pointer;
}

.editor-sidebar__ai-generated--on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.editor-sidebar__ai-generated input {
  flex: none;
  margin: 0.18rem 0 0;
  accent-color: var(--accent);
}

.editor-sidebar__ai-generated span {
  display: grid;
  gap: 0.18rem;
}

.editor-sidebar__ai-generated strong {
  font-size: 0.86rem;
}

.editor-sidebar__ai-generated small {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.45;
}

.editor-sidebar__visibility {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.editor-sidebar__field-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.editor-sidebar__visibility-value {
  color: var(--text-primary);
  font-weight: 650;
}

.editor-sidebar__actions {
  display: grid;
  gap: 0.55rem;
}

.editor-sidebar__actions .button {
  width: 100%;
}
</style>
