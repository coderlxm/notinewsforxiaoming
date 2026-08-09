<script setup lang="ts">
import type { JournalEntry, JournalPlainChannel } from '../../types';
import type { AccessSettingsInput } from './accessSettings';
import ArticleCardContent from '../article/ArticleCardContent.vue';
import EntryCard from './EntryCard.vue';

defineProps<{
  entries: readonly JournalEntry[];
  mutationEntryId: number | null;
}>();

const emit = defineEmits<{
  openEntry: [entry: JournalEntry];
  editArticle: [id: number];
  selectTag: [tag: string];
  saveContent: [entry: JournalEntry, contentText: string];
  setPublishedTime: [entry: JournalEntry, sourceCreatedAt: string];
  saveAccessSettings: [entry: JournalEntry, settings: AccessSettingsInput];
  setChannel: [entry: JournalEntry, channel: JournalPlainChannel];
  setPinned: [entry: JournalEntry, pinned: boolean];
  deleteEntry: [entry: JournalEntry];
}>();

function forwardSaveContent(entry: JournalEntry, contentText: string): void {
  emit('saveContent', entry, contentText);
}

function forwardPublishedTime(entry: JournalEntry, sourceCreatedAt: string): void {
  emit('setPublishedTime', entry, sourceCreatedAt);
}

function forwardAccessSettings(entry: JournalEntry, settings: AccessSettingsInput): void {
  emit('saveAccessSettings', entry, settings);
}

function forwardChannel(entry: JournalEntry, channel: JournalPlainChannel): void {
  emit('setChannel', entry, channel);
}

function forwardPinned(entry: JournalEntry, pinned: boolean): void {
  emit('setPinned', entry, pinned);
}

function forwardDelete(entry: JournalEntry): void {
  emit('deleteEntry', entry);
}
</script>

<template>
  <section v-if="entries.length" class="memory" aria-labelledby="memory-title">
    <header class="memory__header">
      <span class="memory__eyebrow">往年今日</span>
      <h2 id="memory-title" class="memory__title">时间留下来的这一天</h2>
    </header>
    <div class="memory__entries" tabindex="0" aria-label="往年今日记录，横向滚动">
      <div v-for="entry in entries" :key="entry.id" class="memory__item">
        <ArticleCardContent
          v-if="entry.bodyFormat === 'rich'"
          :entry="entry"
          editable
          :busy="mutationEntryId === entry.id"
          @open-entry="emit('openEntry', $event)"
          @edit="emit('editArticle', $event)"
          @select-tag="emit('selectTag', $event)"
          @set-published-time="forwardPublishedTime"
          @save-access-settings="forwardAccessSettings"
          @set-pinned="forwardPinned"
          @delete-entry="forwardDelete"
        />
        <EntryCard
          v-else
          :entry="entry"
          editable
          :busy="mutationEntryId === entry.id"
          channel-editable
          @open-entry="emit('openEntry', $event)"
          @select-tag="emit('selectTag', $event)"
          @save-content="forwardSaveContent"
          @set-published-time="forwardPublishedTime"
          @save-access-settings="forwardAccessSettings"
          @set-channel="forwardChannel"
          @set-pinned="forwardPinned"
          @delete-entry="forwardDelete"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.memory {
  display: grid;
  gap: 0.75rem;
  padding: 1.15rem 0 0.35rem;
  border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
}

.memory__header {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  padding: 0 0.15rem;
}

.memory__eyebrow {
  color: var(--accent-strong);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.16em;
}

.memory__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.05rem;
  font-weight: 680;
}

.memory__entries {
  display: grid;
  grid-auto-columns: clamp(17rem, 28vw, 22rem);
  grid-auto-flow: column;
  gap: 0.8rem;
  padding: 0 0.15rem 0.55rem;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scroll-snap-type: inline proximity;
  scrollbar-color: var(--border-strong) transparent;
  scrollbar-width: thin;
}

.memory__item {
  min-width: 0;
  scroll-snap-align: start;
}

@media (max-width: 599px) {
  .memory {
    padding-top: 0.9rem;
  }

  .memory__header {
    display: grid;
    gap: 0.15rem;
  }

  .memory__entries {
    grid-auto-columns: min(82vw, 19rem);
    gap: 0.6rem;
  }
}
</style>
