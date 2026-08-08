<script setup lang="ts">
import { List } from 'vant';
import type { JournalEntry, JournalPlainChannel, JournalVisibility } from '../../types';
import JournalLoading from '../ui/JournalLoading.vue';
import WaterfallFeed from './WaterfallFeed.vue';

defineProps<{
  entries: readonly JournalEntry[];
  loading: boolean;
  loadingMore: boolean;
  finished: boolean;
  disabled: boolean;
  mutationEntryId: number | null;
}>();

const emit = defineEmits<{
  load: [];
  layoutReady: [];
  openEntry: [entry: JournalEntry];
  continueDraft: [entry: JournalEntry];
  selectTag: [tag: string];
  editArticle: [id: number];
  saveContent: [entry: JournalEntry, contentText: string];
  setPublishedTime: [entry: JournalEntry, sourceCreatedAt: string];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  setPinned: [entry: JournalEntry, pinned: boolean];
  setChannel: [entry: JournalEntry, channel: JournalPlainChannel];
  deleteEntry: [entry: JournalEntry];
}>();

function forwardSaveContent(entry: JournalEntry, contentText: string): void {
  emit('saveContent', entry, contentText);
}

function forwardPublishedTime(entry: JournalEntry, sourceCreatedAt: string): void {
  emit('setPublishedTime', entry, sourceCreatedAt);
}

function forwardVisibility(entry: JournalEntry, visibility: JournalVisibility): void {
  emit('setVisibility', entry, visibility);
}

function forwardPinned(entry: JournalEntry, pinned: boolean): void {
  emit('setPinned', entry, pinned);
}

function forwardChannel(entry: JournalEntry, channel: JournalPlainChannel): void {
  emit('setChannel', entry, channel);
}
</script>

<template>
  <section class="private-waterfall-results">
    <List
      class="private-waterfall-results__infinite-list"
      :loading="loadingMore"
      :finished="finished"
      :disabled="disabled"
      :immediate-check="false"
      :offset="320"
      @load="emit('load')"
    >
      <WaterfallFeed
        :entries="entries"
        :loading="loading"
        mode="private"
        :mutation-entry-id="mutationEntryId"
        @layout-ready="emit('layoutReady')"
        @open-entry="emit('openEntry', $event)"
        @continue-draft="emit('continueDraft', $event)"
        @select-tag="emit('selectTag', $event)"
        @edit-article="emit('editArticle', $event)"
        @save-content="forwardSaveContent"
        @set-published-time="forwardPublishedTime"
        @set-visibility="forwardVisibility"
        @set-pinned="forwardPinned"
        @set-channel="forwardChannel"
        @delete-entry="emit('deleteEntry', $event)"
      />

      <p
        v-if="!loading && !entries.length"
        class="private-waterfall-results__empty"
      >
        没有符合当前筛选条件的记录。
      </p>

      <template #loading>
        <div class="private-waterfall-results__pagination-loading">
          <JournalLoading variant="inline" label="正在读取更早记录…" />
        </div>
      </template>
    </List>
  </section>
</template>

<style scoped>
.private-waterfall-results {
  display: grid;
  min-width: 0;
}

.private-waterfall-results__infinite-list {
  display: grid;
  gap: 0.75rem;
}

.private-waterfall-results__empty,
.private-waterfall-results__pagination-loading {
  margin: 0;
  padding: 0.75rem 1rem 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  text-align: center;
}

.private-waterfall-results__empty {
  padding: 3rem 1rem;
}
</style>
