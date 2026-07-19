<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import type { JournalEntry, JournalVisibility } from '../../types';
import { formatEntryTime, formatStructuredValue } from '../../utils/formatters';
import MediaGallery from './MediaGallery.vue';

const props = withDefaults(defineProps<{
  entry: JournalEntry;
  editable?: boolean;
  busy?: boolean;
  linkable?: boolean;
}>(), {
  editable: false,
  busy: false,
  linkable: true,
});

const emit = defineEmits<{
  viewDetail: [publicId: string];
  selectTag: [tag: string];
  saveContent: [entry: JournalEntry, contentText: string];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  setPinned: [entry: JournalEntry, pinned: boolean];
  deleteEntry: [entry: JournalEntry];
}>();

const editing = shallowRef(false);
const confirmingDeletion = shallowRef(false);
const draft = shallowRef(props.entry.contentText);
const hiddenStructuredKeys = new Set(['entities', 'caption_entities']);

const formattedTime = computed(() => formatEntryTime(props.entry.sourceCreatedAt));
const structuredRows = computed(() => Object.entries(props.entry.structuredContent ?? {})
  .filter(([key]) => !hiddenStructuredKeys.has(key)));
const canSave = computed(() => draft.value !== props.entry.contentText && !props.busy);
const nextVisibility = computed<JournalVisibility>(() =>
  props.entry.visibility === 'public' ? 'private' : 'public',
);
const deletionMessage = computed(() => {
  if (props.entry.assets.length === 0) return '永久删除这条记录？此操作无法撤销。';
  if (props.entry.assets.length === 1) return '永久删除这条记录及其附件？此操作无法撤销。';
  return `永久删除这条记录及其 ${props.entry.assets.length} 个附件？此操作无法撤销。`;
});

watch(() => props.entry.contentText, (contentText) => {
  draft.value = contentText;
  editing.value = false;
});

function cancelEditing(): void {
  draft.value = props.entry.contentText;
  editing.value = false;
}

function startDeletion(): void {
  editing.value = false;
  confirmingDeletion.value = true;
}
</script>

<template>
  <article class="entry" :class="{ 'entry--pinned': entry.pinned }">
    <header class="entry__header">
      <div class="entry__identity">
        <img class="entry__avatar" src="/avatar-ming.png" alt="">
        <div class="entry__identity-copy">
          <strong>小明同学</strong>
          <button
            v-if="linkable && entry.visibility === 'public'"
            class="entry__time entry__time--link"
            type="button"
            @click="emit('viewDetail', entry.publicId)"
          >
            {{ formattedTime }}
          </button>
          <time v-else class="entry__time" :datetime="entry.sourceCreatedAt">{{ formattedTime }}</time>
        </div>
      </div>
      <div class="entry__badges">
        <span v-if="entry.pinned" class="entry__badge" title="已置顶">📌 置顶</span>
        <span class="entry__badge" :title="entry.visibility === 'public' ? '公开记录' : '私有记录'">
          {{ entry.visibility === 'public' ? '🌐 公开' : '🔒 私有' }}
        </span>
      </div>
    </header>

    <div v-if="editing" class="entry__editor">
      <label class="entry__editor-label" :for="`entry-content-${entry.id}`">编辑正文</label>
      <textarea
        :id="`entry-content-${entry.id}`"
        v-model="draft"
        class="entry__textarea"
        rows="6"
        :disabled="busy"
      />
      <div class="entry__editor-actions">
        <button class="button button--quiet" type="button" :disabled="busy" @click="cancelEditing">取消</button>
        <button
          class="button button--primary"
          type="button"
          :disabled="!canSave"
          @click="emit('saveContent', entry, draft)"
        >
          {{ busy ? '保存中…' : '保存正文' }}
        </button>
      </div>
    </div>
    <p v-else-if="entry.contentText" class="entry__content">{{ entry.contentText }}</p>

    <dl v-if="structuredRows.length" class="entry__structured">
      <div v-for="row in structuredRows" :key="row[0]" class="entry__structured-row">
        <dt>{{ row[0] }}</dt>
        <dd>{{ formatStructuredValue(row[1]) }}</dd>
      </div>
    </dl>

    <MediaGallery :assets="entry.assets" />

    <div v-if="entry.tags.length" class="entry__tags" aria-label="标签">
      <button
        v-for="tag in entry.tags"
        :key="tag"
        class="entry__tag"
        type="button"
        @click="emit('selectTag', tag)"
      >
        #{{ tag }}
      </button>
    </div>

    <footer
      v-if="editable"
      class="entry__actions"
      :class="{ 'entry__actions--confirming': confirmingDeletion }"
    >
      <template v-if="!confirmingDeletion">
        <button class="entry__action" type="button" :disabled="busy" @click="editing = true">编辑</button>
        <button
          class="entry__action"
          type="button"
          :disabled="busy"
          @click="emit('setPinned', entry, !entry.pinned)"
        >
          {{ entry.pinned ? '取消置顶' : '置顶' }}
        </button>
        <button
          class="entry__action"
          type="button"
          :disabled="busy"
          @click="emit('setVisibility', entry, nextVisibility)"
        >
          {{ nextVisibility === 'public' ? '设为公开' : '转为私有' }}
        </button>
        <button
          class="entry__action entry__action--danger"
          type="button"
          :disabled="busy"
          @click="startDeletion"
        >
          删除
        </button>
      </template>
      <div v-else class="entry__delete-confirmation" role="alert">
        <p class="entry__delete-message">{{ deletionMessage }}</p>
        <div class="entry__delete-actions">
          <button
            class="button button--quiet"
            type="button"
            :disabled="busy"
            @click="confirmingDeletion = false"
          >
            取消
          </button>
          <button
            class="button entry__delete-button"
            type="button"
            :disabled="busy"
            @click="emit('deleteEntry', entry)"
          >
            {{ busy ? '删除中…' : '确认删除' }}
          </button>
        </div>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.entry {
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.entry--pinned {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-subtle));
}

.entry__header,
.entry__identity,
.entry__badges,
.entry__actions,
.entry__editor-actions,
.entry__tags {
  display: flex;
  align-items: center;
}

.entry__header {
  justify-content: space-between;
  gap: 0.75rem;
}

.entry__identity {
  min-width: 0;
  gap: 0.65rem;
}

.entry__avatar {
  width: 2.45rem;
  height: 2.45rem;
  flex: none;
  border-radius: 50%;
}

.entry__identity-copy {
  display: grid;
  min-width: 0;
  gap: 0.08rem;
}

.entry__identity-copy strong {
  font-size: 0.92rem;
}

.entry__time {
  color: var(--text-muted);
  font: inherit;
  font-size: 0.76rem;
}

.entry__time--link {
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.entry__time--link:hover {
  color: var(--accent-strong);
  text-decoration: underline;
}

.entry__badges {
  justify-content: flex-end;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.entry__badge {
  padding: 0.28rem 0.48rem;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 0.7rem;
  white-space: nowrap;
}

.entry__content {
  margin: 1rem 0 0;
  color: var(--text-primary);
  font-size: 1rem;
  line-height: 1.72;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.entry__structured {
  display: grid;
  gap: 0.45rem;
  margin: 0.9rem 0 0;
  padding: 0.8rem;
  border-radius: 0.9rem;
  background: var(--surface-muted);
}

.entry__structured-row {
  display: grid;
  grid-template-columns: minmax(5rem, 0.35fr) minmax(0, 1fr);
  gap: 0.8rem;
}

.entry__structured-row dt {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.entry__structured-row dd {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.entry__tags {
  gap: 0.35rem;
  margin-top: 0.85rem;
  flex-wrap: wrap;
}

.entry__tag,
.entry__action {
  border: 0;
  background: transparent;
  color: var(--accent-strong);
  cursor: pointer;
}

.entry__tag {
  padding: 0.2rem 0.15rem;
  font-size: 0.84rem;
}

.entry__tag:hover,
.entry__action:hover:not(:disabled) {
  text-decoration: underline;
}

.entry__actions {
  gap: 1rem;
  margin-top: 0.9rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
}

.entry__action {
  padding: 0;
  font-size: 0.8rem;
}

.entry__action:disabled {
  cursor: wait;
  opacity: 0.5;
}

.entry__action--danger {
  color: var(--danger);
}

.entry__actions--confirming {
  display: block;
}

.entry__delete-confirmation {
  display: grid;
  gap: 0.65rem;
  width: 100%;
  padding: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--danger) 32%, transparent);
  border-radius: 0.8rem;
  background: var(--danger-soft);
  color: var(--danger);
}

.entry__delete-message {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
}

.entry__delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
}

.entry__delete-button {
  background: var(--danger);
  color: #fff;
}

.entry__editor {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
}

.entry__editor-label {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.entry__textarea {
  width: 100%;
  resize: vertical;
}

.entry__editor-actions {
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (max-width: 520px) {
  .entry {
    padding: 1rem 0;
    border-right: 0;
    border-left: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .entry__header,
  .entry__content,
  .entry__structured,
  .entry__tags,
  .entry__actions,
  .entry__editor {
    margin-right: 1rem;
    margin-left: 1rem;
  }

  .entry__structured-row {
    grid-template-columns: 1fr;
    gap: 0.15rem;
  }
}
</style>
