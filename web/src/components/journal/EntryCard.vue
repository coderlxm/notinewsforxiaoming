<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';
import type { JournalEntry, JournalVisibility } from '../../types';
import { formatStructuredValue } from '../../utils/formatters';
import CardActionMenu from './CardActionMenu.vue';
import CardDateSpine from './CardDateSpine.vue';
import MediaGallery from './MediaGallery.vue';
import PublishedTimeDialog from './PublishedTimeDialog.vue';

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
  openEntry: [entry: JournalEntry];
  selectTag: [tag: string];
  saveContent: [entry: JournalEntry, contentText: string];
  setPublishedTime: [entry: JournalEntry, sourceCreatedAt: string];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  setPinned: [entry: JournalEntry, pinned: boolean];
  deleteEntry: [entry: JournalEntry];
}>();

const editing = shallowRef(false);
const confirmingDeletion = shallowRef(false);
const editingPublishedTime = shallowRef(false);
const draft = shallowRef(props.entry.contentText);
const hiddenStructuredKeys = new Set(['entities', 'caption_entities']);

const isDetail = computed(() => !props.linkable);
const normalizedContent = computed(() => props.entry.contentText.replace(/\s+/g, ' ').trim());
const displayedContent = computed(() => {
  if (isDetail.value || normalizedContent.value.length <= 72) return isDetail.value
    ? props.entry.contentText
    : normalizedContent.value;
  return `${normalizedContent.value.slice(0, 72)}…`;
});
const isShortText = computed(() =>
  !isDetail.value
  && props.entry.assets.length === 0
  && normalizedContent.value.length > 0
  && normalizedContent.value.length <= 36,
);
const structuredRows = computed(() => Object.entries(props.entry.structuredContent ?? {})
  .filter(([key]) => !hiddenStructuredKeys.has(key)));
const displayedStructuredRows = computed(() => isDetail.value
  ? structuredRows.value
  : structuredRows.value.slice(0, 3));
const cardVisualLimit = computed(() => props.linkable ? 5 : undefined);
const cardLinkable = computed(() => props.linkable);
const canSave = computed(() => draft.value !== props.entry.contentText && !props.busy);
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

function startEditing(): void {
  confirmingDeletion.value = false;
  editingPublishedTime.value = false;
  editing.value = true;
}

function startDeletion(): void {
  editing.value = false;
  editingPublishedTime.value = false;
  confirmingDeletion.value = true;
}

function startPublishedTimeEditing(): void {
  editing.value = false;
  confirmingDeletion.value = false;
  editingPublishedTime.value = true;
}

function openEntry(): void {
  if (cardLinkable.value) emit('openEntry', props.entry);
}

function handleCardClick(event: MouseEvent): void {
  if (editing.value || confirmingDeletion.value) return;
  if ((event.target as Element).closest('button, a, input, textarea, select, audio, video')) return;
  openEntry();
}
</script>

<template>
  <article
    class="entry"
    :class="{
      'entry--pinned': entry.pinned,
      'entry--detail': isDetail,
      'entry--short': isShortText,
      'entry--linkable': cardLinkable && !editing && !confirmingDeletion,
    }"
    @click="handleCardClick"
  >
    <header class="entry__header">
      <CardDateSpine
        :source-created-at="entry.sourceCreatedAt"
        :pinned="entry.pinned"
        :visibility="entry.visibility"
        :show-status="editable"
        :linkable="cardLinkable"
        @open="openEntry"
      />
      <CardActionMenu
        v-if="editable && !confirmingDeletion"
        :busy="busy"
        :busy-label="editingPublishedTime ? '正在修改发布时间…' : undefined"
        :pinned="entry.pinned"
        :visibility="entry.visibility"
        @edit="startEditing"
        @edit-published-time="startPublishedTimeEditing"
        @set-pinned="emit('setPinned', entry, $event)"
        @set-visibility="emit('setVisibility', entry, $event)"
        @request-delete="startDeletion"
      />
    </header>

    <MediaGallery
      v-if="entry.assets.length"
      :assets="entry.assets"
      :display="isDetail ? 'detail' : 'card'"
      :max-visuals="cardVisualLimit"
      @open="openEntry"
    />

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
          :aria-busy="busy"
          @click="emit('saveContent', entry, draft)"
        >
          <JournalLoading v-if="busy" variant="inline" label="保存中…" />
          <template v-else>保存正文</template>
        </button>
      </div>
    </div>
    <p v-else-if="displayedContent" class="entry__content">{{ displayedContent }}</p>

    <dl v-if="displayedStructuredRows.length" class="entry__structured">
      <div v-for="row in displayedStructuredRows" :key="row[0]" class="entry__structured-row">
        <dt>{{ row[0] }}</dt>
        <dd>{{ formatStructuredValue(row[1]) }}</dd>
      </div>
    </dl>

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

    <footer v-if="editable && confirmingDeletion" class="entry__delete-confirmation" role="alert">
      <p class="entry__delete-message">{{ deletionMessage }}</p>
      <div class="entry__delete-actions">
        <button class="button button--quiet" type="button" :disabled="busy" @click="confirmingDeletion = false">
          取消
        </button>
        <button
          class="button entry__delete-button"
          type="button"
          :disabled="busy"
          :aria-busy="busy"
          @click="emit('deleteEntry', entry)"
        >
          <JournalLoading v-if="busy" variant="inline" label="删除中…" />
          <template v-else>确认删除</template>
        </button>
      </div>
    </footer>

    <PublishedTimeDialog
      v-if="editingPublishedTime"
      :source-created-at="entry.sourceCreatedAt"
      :busy="busy"
      @close="editingPublishedTime = false"
      @save="emit('setPublishedTime', entry, $event)"
    />
  </article>
</template>

<style scoped>
.entry {
  display: grid;
  gap: 0.85rem;
  padding: 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  transition: border-color 180ms ease, transform 180ms ease;
}

.entry--linkable:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
}

.entry--linkable {
  cursor: pointer;
}

.entry--pinned {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-subtle));
}

.entry--short {
  background: color-mix(in srgb, var(--accent-soft) 42%, var(--surface-card));
}

.entry--detail {
  gap: 1rem;
  padding: 1.5rem;
}

.entry__header,
.entry__editor-actions,
.entry__tags,
.entry__delete-actions {
  display: flex;
  align-items: center;
}

.entry__header {
  min-width: 0;
  justify-content: space-between;
  gap: 0.5rem;
}

.entry__content {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.94rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.entry--short .entry__content {
  font-family: var(--font-serif);
  font-size: clamp(1.08rem, 1.4vw, 1.3rem);
  font-weight: 650;
  line-height: 1.55;
}

.entry--detail .entry__content {
  font-size: 1rem;
  line-height: 1.78;
}

.entry__structured {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: var(--surface-muted);
}

.entry__structured-row {
  display: grid;
  grid-template-columns: minmax(4.5rem, 0.35fr) minmax(0, 1fr);
  gap: 0.7rem;
}

.entry__structured-row dt {
  color: var(--text-muted);
  font-size: 0.76rem;
}

.entry__structured-row dd {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.entry__tags {
  gap: 0.15rem;
  flex-wrap: wrap;
}

.entry__tag {
  min-height: 2.5rem;
  padding: 0.45rem 0.35rem;
  border: 0;
  background: transparent;
  color: var(--accent-strong);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}

.entry__tag:hover {
  text-decoration: underline;
}

.entry__tag:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.entry__delete-confirmation {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--danger) 32%, transparent);
  border-radius: 0.75rem;
  background: var(--danger-soft);
  color: var(--danger);
}

.entry__delete-message {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
}

.entry__delete-actions,
.entry__editor-actions {
  justify-content: flex-end;
  gap: 0.55rem;
}

.entry__delete-actions .button,
.entry__editor-actions .button {
  min-height: 2.5rem;
}

.entry__delete-button {
  background: var(--danger);
  color: #fff;
}

.entry__editor {
  display: grid;
  gap: 0.5rem;
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

@media (max-width: 599px) {
  .entry {
    gap: 0.65rem;
    padding: 0.65rem;
    border-radius: 0.65rem;
  }

  .entry--detail {
    gap: 0.9rem;
    padding: 1rem;
    border-radius: var(--radius-card);
  }

  .entry__structured {
    padding: 0.6rem;
  }

  .entry__structured-row {
    grid-template-columns: 1fr;
    gap: 0.12rem;
  }

  .entry__tags {
    gap: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .entry {
    transition: none;
  }

  .entry--linkable:hover {
    transform: none;
  }
}
</style>
