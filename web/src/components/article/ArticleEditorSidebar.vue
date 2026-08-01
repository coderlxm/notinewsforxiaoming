<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import type { JournalAsset, JournalEntry, JournalVisibility } from '../../types';
import { parseTagsInput, tagsInputToString } from '../../types';
import JournalLoading from '../ui/JournalLoading.vue';
import ArticleMediaPanel from './ArticleMediaPanel.vue';

type SavingAction = 'content' | 'publish' | 'privatize' | null;

const props = defineProps<{
  article: JournalEntry | null;
  actionBusy: boolean;
  assets: readonly JournalAsset[];
  canSave: boolean;
  isEditing: boolean;
  mediaBusy: boolean;
  mediaBusyLabel: string | null;
  nextVisibility: JournalVisibility;
  previewing: boolean;
  savingAction: SavingAction;
  visibilityLoadingLabel: string;
}>();

const emit = defineEmits<{
  changeVisibility: [];
  removeAsset: [asset: JournalAsset];
  uploadCover: [file: File];
  viewArticle: [];
}>();

const tags = defineModel<string[]>('tags', { default: () => [] });
const tagsInput = shallowRef(tagsInputToString(tags.value));

watch(tags, (next) => {
  const text = tagsInputToString(next);
  if (text !== tagsInput.value) tagsInput.value = text;
});

function commitTagsInput(): void {
  tags.value = parseTagsInput(tagsInput.value);
}
</script>

<template>
  <aside class="editor-sidebar">
    <section class="editor-sidebar__section">
      <h2 class="editor-sidebar__title">文章设置</h2>

      <div class="editor-sidebar__settings">
        <label class="field">
          <span class="field__label">标签（逗号分隔，最多 20 个）</span>
          <input
            v-model="tagsInput"
            type="text"
            placeholder="例如：生活, 随笔"
            @blur="commitTagsInput"
            @keydown.enter.prevent="commitTagsInput"
          >
        </label>

        <div class="editor-sidebar__visibility">
          <span>可见范围</span>
          <strong class="editor-sidebar__visibility-value">
            {{ article ? (article.visibility === 'public' ? '公开' : '私有') : '保存后设置' }}
          </strong>
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
            {{ article.visibility === 'public' ? '查看文章' : (previewing ? '收起预览' : '预览文章') }}
          </button>
          <button
            v-if="article"
            class="button button--quiet"
            type="button"
            :disabled="actionBusy"
            :aria-busy="savingAction === 'publish' || savingAction === 'privatize'"
            @click="emit('changeVisibility')"
          >
            <JournalLoading
              v-if="savingAction === 'publish' || savingAction === 'privatize'"
              variant="inline"
              :label="visibilityLoadingLabel"
            />
            <template v-else>{{ nextVisibility === 'public' ? '设为公开' : '转为私有' }}</template>
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

.editor-sidebar__visibility {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-muted);
  font-size: 0.8rem;
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
