<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';
import type { JournalEntry, JournalPlainChannel } from '../../types';
import { formatStructuredValue } from '../../utils/formatters';
import { stripJournalTags } from '../../utils/journalText';
import CardActionMenu from './CardActionMenu.vue';
import CardDateSpine from './CardDateSpine.vue';
import JournalTextPoster from './JournalTextPoster.vue';
import MediaGallery from './MediaGallery.vue';
import PublishedTimeDialog from './PublishedTimeDialog.vue';
import AccessSettingsDialog from './AccessSettingsDialog.vue';
import type { AccessSettingsInput } from './accessSettings';

const props = withDefaults(defineProps<{
  entry: JournalEntry;
  editable?: boolean;
  busy?: boolean;
  linkable?: boolean;
  channelEditable?: boolean;
  showYear?: boolean;
}>(), {
  editable: false,
  busy: false,
  linkable: true,
  channelEditable: false,
  showYear: false,
});

const emit = defineEmits<{
  openEntry: [entry: JournalEntry];
  continueDraft: [entry: JournalEntry];
  selectTag: [tag: string];
  saveContent: [entry: JournalEntry, contentText: string];
  setPublishedTime: [entry: JournalEntry, sourceCreatedAt: string];
  saveAccessSettings: [entry: JournalEntry, settings: AccessSettingsInput];
  setChannel: [entry: JournalEntry, channel: JournalPlainChannel];
  setPinned: [entry: JournalEntry, pinned: boolean];
  deleteEntry: [entry: JournalEntry];
}>();

const editing = shallowRef(false);
const confirmingDeletion = shallowRef(false);
const editingPublishedTime = shallowRef(false);
const accessSettingsOpen = shallowRef(false);
const draft = shallowRef(props.entry.contentText);
const hiddenStructuredKeys = new Set(['entities', 'caption_entities']);
const cardDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const cardTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatCardDate(date: Date): string {
  return cardDateFormatter.formatToParts(date)
    .filter(part => part.type === 'year' || part.type === 'month' || part.type === 'day')
    .map(part => `${part.value}${part.type === 'year' ? '年' : (part.type === 'month' ? '月' : '日')}`)
    .join('');
}

const isDetail = computed(() => !props.linkable);
const isDraft = computed(() => props.entry.publicationStatus === 'draft');
const plainChannel = computed(() => props.entry.channel as JournalPlainChannel);
const hasVisualMedia = computed(() => props.entry.assets.some(asset =>
  asset.kind === 'photo'
  || ['video', 'video_note', 'animation'].includes(asset.kind)
  || (asset.kind === 'sticker' && asset.mimeType?.startsWith('image/'))
  || (asset.kind === 'sticker' && asset.mimeType?.startsWith('video/')),
));
const normalizedContent = computed(() => props.entry.contentText.replace(/\s+/g, ' ').trim());
const normalizedPosterContent = computed(() =>
  stripJournalTags(props.entry.contentText, props.entry.tags).replace(/\s+/g, ' ').trim(),
);
const hasTextPoster = computed(() =>
  props.entry.bodyFormat === 'plain'
  && props.entry.assets.length === 0
  && normalizedPosterContent.value.length > 0,
);
const displayedContent = computed(() => {
  if (isDetail.value) return props.entry.contentText;
  if (hasTextPoster.value) return normalizedPosterContent.value;
  if (normalizedContent.value.length <= 72) return normalizedContent.value;
  return `${normalizedContent.value.slice(0, 72)}…`;
});
const structuredRows = computed(() => Object.entries(props.entry.structuredContent ?? {})
  .filter(([key]) => !hiddenStructuredKeys.has(key)));
const displayedStructuredRows = computed(() => isDetail.value
  ? structuredRows.value
  : structuredRows.value.slice(0, 3));
const cardVisualLimit = computed(() => props.linkable ? 5 : undefined);
const cardLinkable = computed(() => props.linkable);
const sourceCreatedDate = computed(() => new Date(props.entry.sourceCreatedAt));
const formattedDate = computed(() => formatCardDate(sourceCreatedDate.value));
const formattedTime = computed(() => cardTimeFormatter.format(sourceCreatedDate.value));
const statusLabel = computed(() => isDraft.value
  ? '草稿'
  : (props.entry.visibility === 'public'
      ? '公开'
      : (props.entry.visibility === 'protected' ? '加密' : '私有')));
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
  if (isDraft.value) return;
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
  if (isDraft.value) return;
  editing.value = false;
  confirmingDeletion.value = false;
  editingPublishedTime.value = true;
}

function openAccessSettings(): void {
  accessSettingsOpen.value = true;
}

function saveAccessSettings(settings: AccessSettingsInput): void {
  accessSettingsOpen.value = false;
  emit('saveAccessSettings', props.entry, settings);
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
      'entry--visual': hasVisualMedia,
      'entry--poster': hasTextPoster,
      'entry--editable': editable,
      'entry--linkable': cardLinkable && !editing && !confirmingDeletion,
    }"
    @click="handleCardClick"
  >
    <header v-if="isDetail" class="entry__header">
      <CardDateSpine
        :source-created-at="entry.sourceCreatedAt"
        :pinned="entry.pinned"
        :visibility="entry.visibility"
        :publication-status="entry.publicationStatus"
        :show-status="editable"
        :show-year="showYear"
        :linkable="cardLinkable"
        @open="openEntry"
      />
      <CardActionMenu
        v-if="editable && !confirmingDeletion"
        :busy="busy"
        :pinned="entry.pinned"
        :public-id="entry.publicId"
        :visibility="entry.visibility"
        :publication-status="entry.publicationStatus"
        :channel="plainChannel"
        :channel-editable="channelEditable"
        @edit="startEditing"
        @continue-edit="emit('continueDraft', entry)"
        @edit-published-time="startPublishedTimeEditing"
        @set-pinned="emit('setPinned', entry, $event)"
        @request-access-settings="openAccessSettings"
        @set-channel="emit('setChannel', entry, $event)"
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
    <JournalTextPoster
      v-else-if="hasTextPoster && !editing"
      :entry="entry"
      display="card"
    />

    <div class="entry__body">
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

      <div v-if="isDetail && entry.tags.length" class="entry__tags" aria-label="标签">
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

      <footer v-if="!isDetail" class="entry__meta">
        <div class="entry__meta-copy">
          <time :datetime="entry.sourceCreatedAt">{{ formattedDate }}</time>
          <span v-if="entry.pinned">置顶</span>
          <span v-if="editable">{{ statusLabel }}</span>
        </div>
        <div class="entry__meta-trailing">
          <CardActionMenu
            v-if="editable && !confirmingDeletion"
            :busy="busy"
            :pinned="entry.pinned"
            :public-id="entry.publicId"
            :visibility="entry.visibility"
            :publication-status="entry.publicationStatus"
            :channel="plainChannel"
            :channel-editable="channelEditable"
            compact
            @edit="startEditing"
            @continue-edit="emit('continueDraft', entry)"
            @edit-published-time="startPublishedTimeEditing"
            @set-pinned="emit('setPinned', entry, $event)"
            @request-access-settings="openAccessSettings"
            @set-channel="emit('setChannel', entry, $event)"
            @request-delete="startDeletion"
          />
          <time class="entry__meta-time" :datetime="entry.sourceCreatedAt">{{ formattedTime }}</time>
        </div>
      </footer>

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
    </div>

    <PublishedTimeDialog
      v-if="editingPublishedTime && !isDraft"
      :source-created-at="entry.sourceCreatedAt"
      :busy="busy"
      @close="editingPublishedTime = false"
      @save="emit('setPublishedTime', entry, $event)"
    />
    <AccessSettingsDialog
      v-if="accessSettingsOpen"
      :visibility="entry.visibility"
      :busy="busy"
      @close="accessSettingsOpen = false"
      @save="saveAccessSettings"
    />
  </article>
</template>

<style scoped>
.entry {
  display: grid;
  overflow: hidden;
  border-radius: 1.25rem;
  background: var(--surface-card);
  transition: transform 180ms ease;
}

.entry--linkable:hover {
  transform: translateY(-2px);
}

.entry--linkable {
  cursor: pointer;
}

.entry--detail {
  gap: 1rem;
  padding: 1.5rem;
  overflow: visible;
  border-radius: var(--radius-card);
}

.entry__header,
.entry__meta,
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

.entry__body {
  display: grid;
  gap: 0.6rem;
  padding: 0.8rem 0.9rem 0.65rem;
}

.entry--detail .entry__body {
  gap: 1rem;
  padding: 0;
}

.entry__meta {
  min-width: 0;
  justify-content: space-between;
  gap: 0.5rem;
}

.entry__meta-copy {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-muted);
  font-family: var(--font-condensed);
  font-size: 0.68rem;
  letter-spacing: 0.02em;
}

.entry__meta-copy span {
  white-space: nowrap;
}

.entry__meta-copy time {
  white-space: nowrap;
}

.entry__meta-copy span + span {
  padding-left: 0.45rem;
  border-left: 1px solid var(--border-subtle);
}

.entry__meta-trailing {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  margin-left: auto;
}

.entry__meta-time {
  overflow: hidden;
  color: var(--text-muted);
  font-family: var(--font-condensed);
  font-size: 0.68rem;
  letter-spacing: 0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry__content {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.94rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.entry--visual:not(.entry--detail) .entry__content,
.entry--poster:not(.entry--detail) .entry__content {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
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
  padding: 0 0.35rem;
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
    border-radius: 1.125rem;
  }

  .entry--detail {
    gap: 0.9rem;
    padding: 1rem;
    border-radius: var(--radius-card);
  }

  .entry__body {
    padding: 0.65rem;
  }

  .entry--detail .entry__body {
    padding: 0;
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

  .entry--editable .entry__meta-time {
    display: none;
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
