<script setup lang="ts">
import { Connection, Document, Hide, Lock, Top } from '@element-plus/icons-vue';
import { storeToRefs } from 'pinia';
import { computed, shallowRef, watch } from 'vue';
import ArticleRichBody from '../article/ArticleRichBody.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import { useSiteProfileStore } from '../../stores/siteProfile';
import type {
  JournalAsset,
  JournalEntry,
  JournalPlainChannel,
} from '../../types';
import { formatEntryTime, formatStructuredValue } from '../../utils/formatters';
import CardActionMenu from './CardActionMenu.vue';
import MediaGallery from './MediaGallery.vue';
import PublishedTimeDialog from './PublishedTimeDialog.vue';
import AccessSettingsDialog from './AccessSettingsDialog.vue';
import type { AccessSettingsInput } from './accessSettings';

const props = defineProps<{
  entry: JournalEntry;
  mode: 'public' | 'private';
  busy: boolean;
  hasLeadingStage: boolean;
  hasTextPoster: boolean;
  supplementalAssets: readonly JournalAsset[];
}>();

const siteProfile = useSiteProfileStore();
const { profile } = storeToRefs(siteProfile);

const emit = defineEmits<{
  selectTag: [tag: string];
  edit: [entry: JournalEntry];
  continueDraft: [entry: JournalEntry];
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

const isPrivateMode = computed(() => props.mode === 'private');
const isRich = computed(() => props.entry.bodyFormat === 'rich');
const plainTitle = computed(() =>
  isRich.value || props.hasTextPoster ? '' : props.entry.title?.trim() ?? '');
const plainChannel = computed(() => isRich.value
  ? undefined
  : props.entry.channel as JournalPlainChannel);
const formattedTime = computed(() => formatEntryTime(props.entry.sourceCreatedAt));
const structuredRows = computed(() => Object.entries(props.entry.structuredContent ?? {})
  .filter(([key]) => !hiddenStructuredKeys.has(key)));
const cover = computed(() => isRich.value
  ? props.entry.assets.find((asset) => asset.role === 'cover') ?? null
  : null);
const canSave = computed(() => draft.value !== props.entry.contentText && !props.busy);
const deletionMessage = computed(() => {
  const subject = isRich.value ? '这篇文章' : '这条记录';
  if (props.entry.assets.length === 0) return `永久删除${subject}？此操作无法撤销。`;
  if (props.entry.assets.length === 1) return `永久删除${subject}及其附件？此操作无法撤销。`;
  return `永久删除${subject}及其 ${props.entry.assets.length} 个附件？此操作无法撤销。`;
});

watch(() => props.entry.contentText, (contentText) => {
  draft.value = contentText;
  editing.value = false;
});

function requestEdit(): void {
  confirmingDeletion.value = false;
  editingPublishedTime.value = false;
  if (isRich.value) {
    emit('edit', props.entry);
    return;
  }
  editing.value = true;
}

function cancelEditing(): void {
  draft.value = props.entry.contentText;
  editing.value = false;
}

function requestDeletion(): void {
  editing.value = false;
  editingPublishedTime.value = false;
  confirmingDeletion.value = true;
}

function requestPublishedTimeEditing(): void {
  editing.value = false;
  confirmingDeletion.value = false;
  editingPublishedTime.value = true;
}

function saveAccessSettings(settings: AccessSettingsInput): void {
  accessSettingsOpen.value = false;
  emit('saveAccessSettings', props.entry, settings);
}
</script>

<template>
  <article
    class="detail-content"
    :class="{
      'detail-content--rich': isRich,
      'detail-content--with-stage': hasLeadingStage,
    }"
  >
    <header class="detail-content__header">
      <div class="detail-content__identity">
        <img v-if="profile" class="detail-content__avatar" :src="profile.avatarUrl" alt="">
        <div class="detail-content__identity-copy">
          <strong>小明同学</strong>
          <time :datetime="entry.sourceCreatedAt">{{ formattedTime }}</time>
        </div>
      </div>

      <div class="detail-content__management">
        <span class="detail-content__status">
          <Document v-if="entry.publicationStatus === 'draft'" aria-hidden="true" />
          <Connection v-else-if="entry.visibility === 'public'" aria-hidden="true" />
          <Lock v-else-if="entry.visibility === 'protected'" aria-hidden="true" />
          <Hide v-else aria-hidden="true" />
          {{ entry.publicationStatus === 'draft'
            ? '草稿'
            : (entry.visibility === 'public' ? '公开' : (entry.visibility === 'protected' ? '加密' : '私有')) }}
        </span>
        <span v-if="entry.pinned" class="detail-content__status"><Top aria-hidden="true" />置顶</span>
        <CardActionMenu
          v-if="isPrivateMode && !confirmingDeletion"
          :busy="busy"
          :pinned="entry.pinned"
          :public-id="entry.publicId"
          :visibility="entry.visibility"
          :publication-status="entry.publicationStatus"
          :channel="plainChannel"
          :channel-editable="!isRich"
          :teleported="false"
          @edit="requestEdit"
          @continue-edit="emit('continueDraft', entry)"
          @edit-published-time="requestPublishedTimeEditing"
          @set-pinned="emit('setPinned', entry, $event)"
          @request-access-settings="accessSettingsOpen = true"
          @set-channel="emit('setChannel', entry, $event)"
          @request-delete="requestDeletion"
        />
      </div>
    </header>

    <template v-if="isRich">
      <div class="detail-content__article-heading">
        <h1 v-if="entry.title" class="detail-content__title">{{ entry.title }}</h1>
        <button
          v-if="isPrivateMode"
          class="button detail-content__edit-article"
          type="button"
          :disabled="busy"
          @click="emit('edit', entry)"
        >
          编辑文章
        </button>
      </div>

      <figure v-if="cover" class="detail-content__cover">
        <img :src="cover.url" :alt="entry.title ?? ''">
      </figure>

      <ArticleRichBody :document="entry.richBody" class="detail-content__rich-body" />
    </template>

    <template v-else>
      <h1 v-if="plainTitle" class="detail-content__title detail-content__plain-title">
        {{ plainTitle }}
      </h1>
      <div v-if="editing" class="detail-content__editor">
        <label class="detail-content__editor-label" :for="`detail-content-${entry.id}`">编辑正文</label>
        <textarea
          :id="`detail-content-${entry.id}`"
          v-model="draft"
          class="detail-content__textarea"
          rows="9"
          :disabled="busy"
        />
        <div class="detail-content__editor-actions">
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
      <p v-else-if="entry.contentText" class="detail-content__text">{{ entry.contentText }}</p>
    </template>

    <dl v-if="structuredRows.length" class="detail-content__structured">
      <div v-for="row in structuredRows" :key="row[0]" class="detail-content__structured-row">
        <dt>{{ row[0] }}</dt>
        <dd>{{ formatStructuredValue(row[1]) }}</dd>
      </div>
    </dl>

    <MediaGallery v-if="supplementalAssets.length" :assets="supplementalAssets" display="detail" />

    <div v-if="entry.tags.length" class="detail-content__tags" aria-label="标签">
      <button
        v-for="tag in entry.tags"
        :key="tag"
        class="detail-content__tag"
        type="button"
        @click="emit('selectTag', tag)"
      >
        #{{ tag }}
      </button>
    </div>

    <footer v-if="isPrivateMode && confirmingDeletion" class="detail-content__delete-confirmation" role="alert">
      <p class="detail-content__delete-message">{{ deletionMessage }}</p>
      <div class="detail-content__delete-actions">
        <button class="button button--quiet" type="button" :disabled="busy" @click="confirmingDeletion = false">
          取消
        </button>
        <button
          class="button detail-content__delete-button"
          type="button"
          :disabled="busy"
          :aria-busy="busy"
          @click="emit('deleteEntry', entry)"
        >
          <JournalLoading v-if="busy" variant="inline" label="删除中…" />
          <template v-else>确认永久删除</template>
        </button>
      </div>
    </footer>

    <PublishedTimeDialog
      v-if="editingPublishedTime && entry.publicationStatus === 'published'"
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
.detail-content {
  min-width: 0;
  min-height: 0;
  padding: 68px clamp(24px, 3.2vw, 48px) 40px;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--surface-card);
  color: var(--text-primary);
  overscroll-behavior: contain;
  scrollbar-color: var(--border-strong) transparent;
  scrollbar-width: thin;
}

.detail-content__header,
.detail-content__identity,
.detail-content__management,
.detail-content__article-heading,
.detail-content__editor-actions,
.detail-content__tags,
.detail-content__delete-actions {
  display: flex;
  align-items: center;
}

.detail-content__header {
  min-width: 0;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border-subtle);
}

.detail-content__identity {
  min-width: 0;
  gap: 10px;
}

.detail-content__avatar {
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
}

.detail-content__identity-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.detail-content__identity-copy strong {
  font-size: 0.86rem;
}

.detail-content__identity-copy time {
  color: var(--text-muted);
  font-family: var(--font-condensed);
  font-size: 0.72rem;
  letter-spacing: 0.03em;
}

.detail-content__management {
  min-width: 0;
  justify-content: flex-end;
  gap: 7px;
}

.detail-content__status {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 4px 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 0.68rem;
  white-space: nowrap;
}

.detail-content__status svg {
  width: 0.8rem;
  height: 0.8rem;
}

.detail-content__article-heading {
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-top: 28px;
}

.detail-content__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(1.65rem, 3vw, 2.45rem);
  line-height: 1.28;
}

.detail-content__plain-title {
  margin-top: 28px;
}

.detail-content__edit-article {
  flex: none;
  border-color: var(--accent);
  background: transparent;
  color: var(--accent-strong);
}

.detail-content__cover {
  margin: 26px 0 0;
  overflow: hidden;
  border-radius: var(--radius-media);
  background: var(--surface-muted);
}

.detail-content__cover img {
  display: block;
  width: 100%;
  max-height: 520px;
  object-fit: cover;
}

.detail-content__rich-body {
  margin-top: 24px;
}

.detail-content__text {
  margin: 28px 0 0;
  font-family: var(--font-serif);
  font-size: clamp(1.05rem, 1.5vw, 1.25rem);
  line-height: 1.82;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.detail-content__plain-title + .detail-content__text,
.detail-content__plain-title + .detail-content__editor {
  margin-top: 14px;
}

.detail-content__structured {
  display: grid;
  gap: 8px;
  margin: 24px 0 0;
  padding: 16px;
  border-left: 3px solid var(--accent);
  background: var(--surface-muted);
}

.detail-content__structured-row {
  display: grid;
  grid-template-columns: minmax(82px, 0.32fr) minmax(0, 1fr);
  gap: 14px;
}

.detail-content__structured-row dt {
  color: var(--text-muted);
  font-size: 0.74rem;
}

.detail-content__structured-row dd {
  margin: 0;
  font-size: 0.83rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.detail-content__editor {
  display: grid;
  gap: 10px;
  margin-top: 26px;
}

.detail-content__editor-label {
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 700;
}

.detail-content__textarea {
  width: 100%;
  resize: vertical;
  line-height: 1.7;
}

.detail-content__editor-actions,
.detail-content__delete-actions {
  justify-content: flex-end;
  gap: 8px;
}

.detail-content__tags {
  gap: 7px;
  margin-top: 24px;
  flex-wrap: wrap;
}

.detail-content__tag {
  min-height: 32px;
  padding: 4px 8px;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: var(--accent-strong);
  cursor: pointer;
  font-size: 0.8rem;
}

.detail-content__tag:hover {
  border-bottom-color: currentColor;
}

.detail-content__tag:focus-visible,
.detail-content__edit-article:focus-visible,
.detail-content__delete-button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.detail-content__delete-confirmation {
  display: grid;
  gap: 12px;
  margin-top: 28px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--danger) 34%, var(--border-subtle));
  background: var(--danger-soft);
}

.detail-content__delete-message {
  margin: 0;
  color: var(--danger);
  font-size: 0.82rem;
  line-height: 1.55;
}

.detail-content__delete-button {
  background: var(--danger);
  color: #fff;
}

.detail-content :deep(.media) {
  margin-top: 24px;
}

@media (max-width: 959px) {
  .detail-content {
    width: 100%;
    min-height: auto;
    flex: 0 0 auto;
    padding:
      max(68px, calc(env(safe-area-inset-top) + 58px))
      max(20px, env(safe-area-inset-right))
      max(40px, calc(env(safe-area-inset-bottom) + 28px))
      max(20px, env(safe-area-inset-left));
    overflow: visible;
  }

  .detail-content--with-stage {
    padding-top: 24px;
  }

  .detail-content__header {
    align-items: flex-start;
  }

  .detail-content__management {
    flex-wrap: wrap;
  }
}

@media (max-width: 599px) {
  .detail-content__status {
    display: none;
  }

  .detail-content__article-heading {
    display: grid;
  }

  .detail-content__edit-article {
    justify-self: start;
  }

  .detail-content__structured-row {
    grid-template-columns: 1fr;
    gap: 3px;
  }
}

:global(html[data-theme='dark']) .detail-content {
  background: #272725;
}

@media (prefers-reduced-motion: reduce) {
  .detail-content__tag,
  .detail-content__edit-article,
  .detail-content__delete-button {
    transition: none;
  }
}
</style>
