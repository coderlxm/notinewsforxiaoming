<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type { CSSProperties } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';
import JournalProgressiveImage from '../ui/JournalProgressiveImage.vue';
import type { JournalEntry } from '../../types';
import { resolveJournalCardImageSource } from '../../utils/journalMedia';
import AccessSettingsDialog from '../journal/AccessSettingsDialog.vue';
import type { AccessSettingsInput } from '../journal/accessSettings';
import CardActionMenu from '../journal/CardActionMenu.vue';
import CardDateSpine from '../journal/CardDateSpine.vue';
import PublishedTimeDialog from '../journal/PublishedTimeDialog.vue';
import CardStatusIndicator from '../journal/CardStatusIndicator.vue';
import ArticleRichBody from './ArticleRichBody.vue';
import RichArticleRenderer from './RichArticleRenderer.vue';

const props = withDefaults(defineProps<{
  entry: JournalEntry;
  editable?: boolean;
  busy?: boolean;
  linkable?: boolean;
  display?: 'summary' | 'full';
  anchored?: boolean;
  showYear?: boolean;
}>(), {
  editable: false,
  busy: false,
  linkable: true,
  display: 'summary',
  anchored: false,
  showYear: false,
});

const emit = defineEmits<{
  openEntry: [entry: JournalEntry];
  selectTag: [tag: string];
  edit: [id: number];
  setPublishedTime: [entry: JournalEntry, sourceCreatedAt: string];
  saveAccessSettings: [entry: JournalEntry, settings: AccessSettingsInput];
  setPinned: [entry: JournalEntry, pinned: boolean];
  deleteEntry: [entry: JournalEntry];
}>();

const confirmingDeletion = shallowRef(false);
const editingPublishedTime = shallowRef(false);
const accessSettingsOpen = shallowRef(false);

const cover = computed(() => props.entry.assets.find((asset) =>
  asset.sourceKind === 'web' && asset.role === 'cover') ?? null);
const summaryCoverStyle = computed<CSSProperties | undefined>(() => {
  if (!cover.value?.width || !cover.value.height) return undefined;
  return { aspectRatio: `${cover.value.width} / ${cover.value.height}` };
});
const summary = computed(() => {
  const text = props.entry.contentText.replace(/\s+/g, ' ').trim();
  if (text.length <= 72) return text;
  return `${text.slice(0, 72)}…`;
});
const cardLinkable = computed(() => props.linkable && props.display === 'summary');
const cardStatusCount = computed(() => props.display === 'summary'
  ? Number(props.entry.pinned) + Number(props.entry.visibility === 'protected')
  : 0);
const deletionMessage = computed(() => {
  if (props.entry.assets.length === 0) return '永久删除这篇文章？此操作无法撤销。';
  if (props.entry.assets.length === 1) return '永久删除这篇文章及其附件？此操作无法撤销。';
  return `永久删除这篇文章及其 ${props.entry.assets.length} 个附件？此操作无法撤销。`;
});

function startDeletion(): void {
  editingPublishedTime.value = false;
  confirmingDeletion.value = true;
}

function startPublishedTimeEditing(): void {
  confirmingDeletion.value = false;
  editingPublishedTime.value = true;
}

function saveAccessSettings(settings: AccessSettingsInput): void {
  accessSettingsOpen.value = false;
  emit('saveAccessSettings', props.entry, settings);
}

function openEntry(): void {
  if (cardLinkable.value) emit('openEntry', props.entry);
}

function handleCardClick(event: MouseEvent): void {
  if (confirmingDeletion.value) return;
  if ((event.target as Element).closest('button, a, input, textarea, select, audio, video')) return;
  openEntry();
}
</script>

<template>
  <article
    class="article-card"
    :class="{
      'article-card--pinned': entry.pinned,
      'article-card--full': display === 'full',
      'article-card--without-cover': !cover,
      'article-card--linkable': cardLinkable && !confirmingDeletion,
      'article-card--status-fold': cardStatusCount > 0 && !cover,
      'article-card--two-statuses': cardStatusCount > 1 && !cover,
    }"
    @click="handleCardClick"
  >
    <CardStatusIndicator
      v-if="cardStatusCount && !cover"
      :pinned="entry.pinned"
      :encrypted="entry.visibility === 'protected'"
      tone="surface"
    />
    <header class="article-card__header">
      <CardDateSpine
        :source-created-at="entry.sourceCreatedAt"
        :pinned="display === 'full' && entry.pinned"
        :visibility="entry.visibility"
        :publication-status="entry.publicationStatus"
        :show-status="editable"
        :show-year="showYear"
        :linkable="cardLinkable"
        @open="openEntry"
      />
      <div class="article-card__header-actions">
        <span
          v-if="display === 'summary' && entry.aiGenerated"
          class="article-card__ai-badge"
          aria-label="AI 生成"
        >AI 生成</span>
        <CardActionMenu
          v-if="editable && !confirmingDeletion"
          :busy="busy"
          :pinned="entry.pinned"
          :public-id="entry.publicId"
          :visibility="entry.visibility"
          :publication-status="entry.publicationStatus"
          @edit="emit('edit', entry.id)"
          @edit-published-time="startPublishedTimeEditing"
          @set-pinned="emit('setPinned', entry, $event)"
          @request-access-settings="accessSettingsOpen = true"
          @request-delete="startDeletion"
        />
      </div>
    </header>

    <figure
      v-if="cover && display === 'summary'"
      class="article-card__cover article-card__cover--summary"
      :class="{ 'article-card__cover--corner-safe': cardStatusCount > 0 }"
      :style="summaryCoverStyle"
    >
      <CardStatusIndicator
        v-if="cardStatusCount"
        :pinned="entry.pinned"
        :encrypted="entry.visibility === 'protected'"
        tone="media"
      />
      <button
        v-if="linkable"
        class="article-card__cover-media article-card__cover-button"
        type="button"
        @click="openEntry"
      >
        <JournalProgressiveImage
          class="article-card__cover-image"
          :src="resolveJournalCardImageSource(cover)"
          :preview-src="cover.previewUrl!"
          :alt="entry.title ?? '文章封面'"
          fit="cover"
          loading="lazy"
        />
      </button>
      <JournalProgressiveImage
        v-else
        class="article-card__cover-media article-card__cover-image"
        :src="resolveJournalCardImageSource(cover)"
        :preview-src="cover.previewUrl!"
        :alt="entry.title ?? '文章封面'"
        fit="cover"
        loading="lazy"
      />
    </figure>

    <h2 v-if="display === 'summary' && entry.title" class="article-card__title">
      <button v-if="linkable" type="button" class="article-card__title-button" @click="openEntry">
        {{ entry.title }}
      </button>
      <template v-else>{{ entry.title }}</template>
    </h2>
    <h1 v-else-if="entry.title" class="article-card__title article-card__title--detail">{{ entry.title }}</h1>

    <figure v-if="cover && display === 'full'" class="article-card__cover article-card__cover--full">
      <img :src="cover.url" :alt="entry.title ?? '文章封面'">
    </figure>

    <button
      v-if="display === 'summary' && summary && linkable"
      type="button"
      class="article-card__summary-button"
      @click="openEntry"
    >
      {{ summary }}
    </button>
    <p v-else-if="display === 'summary' && summary" class="article-card__summary">{{ summary }}</p>

    <ArticleRichBody
      v-else-if="display === 'full' && anchored"
      :document="entry.richBody"
      class="article-card__body"
    />
    <RichArticleRenderer
      v-else-if="display === 'full'"
      :document="entry.richBody"
      class="article-card__body"
    />

    <div v-if="entry.tags.length" class="article-card__tags" aria-label="标签">
      <button
        v-for="tag in entry.tags"
        :key="tag"
        class="article-card__tag"
        type="button"
        @click="emit('selectTag', tag)"
      >
        #{{ tag }}
      </button>
    </div>

    <footer v-if="editable && confirmingDeletion" class="article-card__delete-confirmation" role="alert">
      <p class="article-card__delete-message">{{ deletionMessage }}</p>
      <div class="article-card__delete-actions">
        <button class="button button--quiet" type="button" :disabled="busy" @click="confirmingDeletion = false">
          取消
        </button>
        <button
          class="button article-card__delete-button"
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
.article-card {
  position: relative;
  display: grid;
  gap: 0.8rem;
  padding: 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: 1.25rem;
  background: var(--surface-card);
  transition: border-color 180ms ease, transform 180ms ease;
}

.article-card--status-fold:not(.article-card--full) {
  overflow: hidden;
}

.article-card--status-fold:not(.article-card--full) .article-card__header {
  padding-right: 2.65rem;
}

.article-card--two-statuses:not(.article-card--full) .article-card__header {
  padding-right: 3.65rem;
}

.article-card--linkable:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
}

.article-card--linkable {
  cursor: pointer;
}

.article-card--pinned {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-subtle));
}

.article-card--full {
  gap: 1rem;
  padding: 1.5rem;
  border-radius: var(--radius-card);
}

.article-card__header,
.article-card__tags,
.article-card__delete-actions {
  display: flex;
  align-items: center;
}

.article-card__header-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.5rem;
}

.article-card__ai-badge {
  flex: none;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 750;
  line-height: 1.2;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.article-card__header {
  min-width: 0;
  justify-content: space-between;
  gap: 0.5rem;
}

.article-card__cover {
  position: relative;
  margin: 0;
  overflow: hidden;
  border-radius: var(--radius-media);
  background: var(--surface-muted);
}

.article-card__cover--corner-safe {
  --article-corner-safe-size: calc(2.75rem + 2px);
}

.article-card__cover--corner-safe::before {
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-top: var(--article-corner-safe-size) solid #171816;
  border-left: var(--article-corner-safe-size) solid transparent;
  content: '';
}

.article-card__cover--corner-safe .article-card__cover-media {
  position: relative;
  z-index: 1;
  clip-path: polygon(
    0 0,
    calc(100% - var(--article-corner-safe-size)) 0,
    100% var(--article-corner-safe-size),
    100% 100%,
    0 100%
  );
}

.article-card__cover img,
.article-card__cover-button {
  display: block;
  width: 100%;
}

.article-card__cover img {
  height: auto;
}

.article-card__cover-button {
  min-height: 2.5rem;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.article-card__cover-image {
  width: 100%;
  height: 100%;
}

.article-card__cover-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -3px;
}

.article-card__cover--full {
  margin-top: 0.25rem;
}

@media (max-width: 599px) {
  .article-card__cover--corner-safe {
    --article-corner-safe-size: calc(2.5rem + 2px);
  }
}

.article-card__title-button,
.article-card__summary-button {
  width: 100%;
  min-height: 2.5rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.article-card__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(1.15rem, 1.4vw, 1.35rem);
  font-weight: 750;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.article-card--without-cover:not(.article-card--full) .article-card__title {
  font-size: clamp(1.3rem, 1.8vw, 1.65rem);
  line-height: 1.38;
}

.article-card__title--detail {
  font-size: clamp(1.75rem, 5vw, 2.35rem);
  font-weight: 800;
  line-height: 1.3;
}

.article-card__summary,
.article-card__summary-button {
  display: -webkit-box;
  margin: 0;
  color: var(--text-primary);
  font-size: 0.92rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.article-card__summary-button:hover {
  color: var(--accent-strong);
}

.article-card__summary-button:focus-visible,
.article-card__title-button:focus-visible,
.article-card__tag:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.article-card__body {
  margin: 0.35rem 0;
}

.article-card__tags {
  gap: 0.15rem;
  flex-wrap: wrap;
}

.article-card__tag {
  min-height: 2.5rem;
  padding: 0.45rem 0.35rem;
  border: 0;
  background: transparent;
  color: var(--accent-strong);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
}

.article-card__tag:hover {
  text-decoration: underline;
}

.article-card__delete-confirmation {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--danger) 32%, transparent);
  border-radius: 0.75rem;
  background: var(--danger-soft);
  color: var(--danger);
}

.article-card__delete-message {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
}

.article-card__delete-actions {
  justify-content: flex-end;
  gap: 0.55rem;
}

.article-card__delete-actions .button {
  min-height: 2.5rem;
}

.article-card__delete-button {
  background: var(--danger);
  color: #fff;
}

@media (max-width: 599px) {
  .article-card {
    gap: 0.65rem;
    padding: 0.65rem;
    border-radius: 1.125rem;
  }

  .article-card--full {
    gap: 0.9rem;
    padding: 1rem;
    border-radius: var(--radius-card);
  }

  .article-card__tags {
    gap: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-card {
    transition: none;
  }

  .article-card--linkable:hover {
    transform: none;
  }
}
</style>
