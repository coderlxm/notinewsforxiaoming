<script setup lang="ts">
import type { JournalEntry, JournalVisibility } from '../../types';
import EntryCard from './EntryCard.vue';

defineProps<{
  entries: readonly JournalEntry[];
  mutationEntryId: number | null;
}>();

const emit = defineEmits<{
  viewDetail: [publicId: string];
  selectTag: [tag: string];
  saveContent: [entry: JournalEntry, contentText: string];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  setPinned: [entry: JournalEntry, pinned: boolean];
  deleteEntry: [entry: JournalEntry];
}>();

function forwardSaveContent(entry: JournalEntry, contentText: string): void {
  emit('saveContent', entry, contentText);
}

function forwardVisibility(entry: JournalEntry, visibility: JournalVisibility): void {
  emit('setVisibility', entry, visibility);
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
    <div class="memory__entries">
      <EntryCard
        v-for="entry in entries"
        :key="entry.id"
        :entry="entry"
        editable
        :busy="mutationEntryId === entry.id"
        @view-detail="emit('viewDetail', $event)"
        @select-tag="emit('selectTag', $event)"
        @save-content="forwardSaveContent"
        @set-visibility="forwardVisibility"
        @set-pinned="forwardPinned"
        @delete-entry="forwardDelete"
      />
    </div>
  </section>
</template>

<style scoped>
.memory {
  display: grid;
  gap: 0.8rem;
  padding: 1rem 0 0.2rem;
}

.memory__header {
  padding: 0 0.15rem;
}

.memory__eyebrow {
  color: var(--accent-strong);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.16em;
}

.memory__title {
  margin: 0.25rem 0 0;
  font-family: var(--font-serif);
  font-size: 1.15rem;
}

.memory__entries {
  display: grid;
  gap: 0.7rem;
}

@media (max-width: 520px) {
  .memory__header {
    padding: 0 1rem;
  }
}
</style>
