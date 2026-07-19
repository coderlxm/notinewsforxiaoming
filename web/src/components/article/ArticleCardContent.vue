<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type { JournalEntry, JournalVisibility } from '../../types';
import { formatEntryTime } from '../../utils/formatters';
import RichArticleRenderer from './RichArticleRenderer.vue';

const props = withDefaults(defineProps<{
  entry: JournalEntry;
  editable?: boolean;
  busy?: boolean;
  linkable?: boolean;
  display?: 'summary' | 'full';
}>(), {
  editable: false,
  busy: false,
  linkable: true,
  display: 'summary',
});

const emit = defineEmits<{
  open: [entry: JournalEntry];
  selectTag: [tag: string];
  edit: [id: number];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  setPinned: [entry: JournalEntry, pinned: boolean];
  deleteEntry: [entry: JournalEntry];
}>();

const confirmingDeletion = shallowRef(false);

const cover = computed(() => props.entry.assets.find((asset) => asset.sourceKind === 'web' && asset.role === 'cover') ?? null);
const formattedTime = computed(() => formatEntryTime(props.entry.sourceCreatedAt));
const summary = computed(() => {
  const text = props.entry.contentText.replace(/\s+/g, ' ').trim();
  if (text.length <= 160) return text;
  return `${text.slice(0, 160)}…`;
});
const nextVisibility = computed<JournalVisibility>(() =>
  props.entry.visibility === 'public' ? 'private' : 'public',
);
const deletionMessage = computed(() => {
  if (props.entry.assets.length === 0) return '永久删除这篇文章？此操作无法撤销。';
  if (props.entry.assets.length === 1) return '永久删除这篇文章及其附件？此操作无法撤销。';
  return `永久删除这篇文章及其 ${props.entry.assets.length} 个附件？此操作无法撤销。`;
});

function startDeletion(): void {
  confirmingDeletion.value = true;
}

function openEntry(): void {
  if (props.linkable) emit('open', props.entry);
}
</script>

<template>
  <article class="article-card" :class="{ 'article-card--pinned': entry.pinned, 'article-card--full': display === 'full' }">
    <figure v-if="cover && display === 'summary'" class="article-card__cover">
      <button v-if="linkable" class="article-card__cover-button" type="button" @click="openEntry">
        <img :src="cover.url" :alt="entry.title ?? '文章封面'">
      </button>
      <img v-else :src="cover.url" :alt="entry.title ?? '文章封面'">
    </figure>

    <header class="article-card__header">
      <div class="article-card__identity">
        <img class="article-card__avatar" src="/avatar-ming.png" alt="">
        <div class="article-card__identity-copy">
          <strong>小明同学</strong>
          <button
            v-if="linkable && entry.visibility === 'public'"
            class="article-card__time article-card__time--link"
            type="button"
            @click="openEntry"
          >
            {{ formattedTime }}
          </button>
          <time v-else class="article-card__time" :datetime="entry.sourceCreatedAt">{{ formattedTime }}</time>
        </div>
      </div>
      <div class="article-card__badges">
        <span v-if="entry.pinned" class="article-card__badge" title="已置顶">📌 置顶</span>
        <span class="article-card__badge" :title="entry.visibility === 'public' ? '公开文章' : '私有文章'">
          {{ entry.visibility === 'public' ? '🌐 公开' : '🔒 私有' }}
        </span>
      </div>
    </header>

    <button
      v-if="linkable && display === 'summary'"
      type="button"
      class="article-card__title-button"
      @click="openEntry"
    >
      <h2 class="article-card__title">{{ entry.title }}</h2>
    </button>
    <h1 v-else-if="entry.title" class="article-card__title article-card__title--detail">{{ entry.title }}</h1>

    <figure v-if="cover && display === 'full'" class="article-card__cover article-card__cover--full">
      <img :src="cover.url" :alt="entry.title ?? '文章封面'">
    </figure>

    <p v-if="display === 'summary' && summary" class="article-card__summary" @click="linkable ? openEntry() : null">{{ summary }}</p>

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

    <footer
      v-if="editable"
      class="article-card__actions"
      :class="{ 'article-card__actions--confirming': confirmingDeletion }"
    >
      <template v-if="!confirmingDeletion">
        <button class="article-card__action" type="button" :disabled="busy" @click="emit('edit', entry.id)">编辑</button>
        <button
          class="article-card__action"
          type="button"
          :disabled="busy"
          @click="emit('setPinned', entry, !entry.pinned)"
        >
          {{ entry.pinned ? '取消置顶' : '置顶' }}
        </button>
        <button
          class="article-card__action"
          type="button"
          :disabled="busy"
          @click="emit('setVisibility', entry, nextVisibility)"
        >
          {{ nextVisibility === 'public' ? '设为公开' : '转为私有' }}
        </button>
        <button
          class="article-card__action article-card__action--danger"
          type="button"
          :disabled="busy"
          @click="startDeletion"
        >
          删除
        </button>
      </template>
      <div v-else class="article-card__delete-confirmation" role="alert">
        <p class="article-card__delete-message">{{ deletionMessage }}</p>
        <div class="article-card__delete-actions">
          <button class="button button--quiet" type="button" :disabled="busy" @click="confirmingDeletion = false">取消</button>
          <button class="button article-card__delete-button" type="button" :disabled="busy" @click="emit('deleteEntry', entry)">
            {{ busy ? '删除中…' : '确认删除' }}
          </button>
        </div>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.article-card {
  display: grid;
  gap: 0.85rem;
  padding: 1.15rem 1.2rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
}

.article-card--pinned {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border-subtle));
}

.article-card--full {
  padding: 1.6rem 1.8rem;
  gap: 1rem;
}

.article-card__cover {
  margin: 0;
  border-radius: 0.8rem;
  overflow: hidden;
}

.article-card__cover--full {
  margin: 0.5rem 0 0.2rem;
}

.article-card__cover img,
.article-card__cover-button {
  display: block;
  width: 100%;
  max-height: 20rem;
  object-fit: cover;
}

.article-card__cover-button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.article-card__header,
.article-card__identity,
.article-card__badges,
.article-card__actions,
.article-card__tags {
  display: flex;
  align-items: center;
}

.article-card__header {
  justify-content: space-between;
  gap: 0.75rem;
}

.article-card__identity {
  min-width: 0;
  gap: 0.65rem;
}

.article-card__avatar {
  width: 2.45rem;
  height: 2.45rem;
  flex: none;
  border-radius: 50%;
}

.article-card__identity-copy {
  display: grid;
  min-width: 0;
  gap: 0.08rem;
}

.article-card__identity-copy strong {
  font-size: 0.92rem;
}

.article-card__time {
  color: var(--text-muted);
  font: inherit;
  font-size: 0.76rem;
}

.article-card__time--link {
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.article-card__time--link:hover {
  color: var(--accent-strong);
  text-decoration: underline;
}

.article-card__badges {
  justify-content: flex-end;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.article-card__badge {
  padding: 0.28rem 0.48rem;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 0.7rem;
  white-space: nowrap;
}

.article-card__title-button {
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.article-card__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.3rem;
  font-weight: 750;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.article-card__title--detail {
  font-size: clamp(1.6rem, 5vw, 2.1rem);
  font-weight: 800;
}

.article-card__summary {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.98rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.article-card__body {
  margin: 0.4rem 0;
}

.article-card__tags {
  gap: 0.35rem;
  flex-wrap: wrap;
}

.article-card__tag,
.article-card__action {
  border: 0;
  background: transparent;
  color: var(--accent-strong);
  cursor: pointer;
}

.article-card__tag {
  padding: 0.2rem 0.15rem;
  font-size: 0.84rem;
}

.article-card__tag:hover,
.article-card__action:hover:not(:disabled) {
  text-decoration: underline;
}

.article-card__actions {
  gap: 1rem;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
}

.article-card__action {
  padding: 0;
  font-size: 0.8rem;
}

.article-card__action:disabled {
  cursor: wait;
  opacity: 0.5;
}

.article-card__action--danger {
  color: var(--danger);
}

.article-card__actions--confirming {
  display: block;
}

.article-card__delete-confirmation {
  display: grid;
  gap: 0.65rem;
  width: 100%;
  padding: 0.75rem;
  border: 1px solid color-mix(in srgb, var(--danger) 32%, transparent);
  border-radius: 0.8rem;
  background: var(--danger-soft);
  color: var(--danger);
}

.article-card__delete-message {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
}

.article-card__delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
}

.article-card__delete-button {
  background: var(--danger);
  color: #fff;
}

@media (max-width: 520px) {
  .article-card {
    padding: 1rem 0;
    border-right: 0;
    border-left: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .article-card--full {
    padding: 0;
    border: 0;
  }

  .article-card__cover,
  .article-card__header,
  .article-card__summary,
  .article-card__tags,
  .article-card__actions,
  .article-card__title,
  .article-card__body {
    margin-right: 1rem;
    margin-left: 1rem;
  }
}
</style>
