<script setup lang="ts">
import { ElPagination } from 'element-plus';
import type { JournalEntry, JournalPlainChannel, JournalVisibility } from '../../types';
import JournalLoading from '../ui/JournalLoading.vue';
import AssetTableView from './AssetTableView.vue';
import JournalAssetTablePlaceholder from './JournalAssetTablePlaceholder.vue';

defineProps<{
  entries: readonly JournalEntry[];
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  error: string | null;
  mutationEntryId: number | null;
}>();

const emit = defineEmits<{
  changePage: [page: number];
  view: [entry: JournalEntry];
  edit: [entry: JournalEntry];
  editPublishedTime: [entry: JournalEntry];
  setPinned: [entry: JournalEntry, pinned: boolean];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  deleteEntry: [entry: JournalEntry];
  selectTag: [tag: string];
  setChannel: [entry: JournalEntry, channel: JournalPlainChannel];
}>();

function forwardSetPinned(entry: JournalEntry, pinned: boolean): void {
  emit('setPinned', entry, pinned);
}

function forwardSetVisibility(entry: JournalEntry, visibility: JournalVisibility): void {
  emit('setVisibility', entry, visibility);
}

function forwardSetChannel(entry: JournalEntry, channel: JournalPlainChannel): void {
  emit('setChannel', entry, channel);
}
</script>

<template>
  <section class="private-asset-table-results">
    <div class="private-asset-table-results__table">
      <JournalAssetTablePlaceholder v-if="loading" />
      <AssetTableView
        v-else-if="entries.length"
        :entries="entries"
        :mutation-entry-id="mutationEntryId"
        @view="emit('view', $event)"
        @edit="emit('edit', $event)"
        @edit-published-time="emit('editPublishedTime', $event)"
        @set-pinned="forwardSetPinned"
        @set-visibility="forwardSetVisibility"
        @delete-entry="emit('deleteEntry', $event)"
        @select-tag="emit('selectTag', $event)"
        @set-channel="forwardSetChannel"
      />
    </div>

    <div class="private-asset-table-results__result">
      <div v-if="loading" class="private-asset-table-results__status">
        <JournalLoading variant="inline" label="正在读取记录…" />
      </div>
      <p v-else-if="error" class="private-asset-table-results__error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="!entries.length" class="private-asset-table-results__empty">
        没有符合当前筛选条件的记录。
      </p>

      <ElPagination
        v-if="!error"
        class="private-asset-table-results__pagination"
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        :disabled="loading"
        :pager-count="7"
        layout="total, prev, pager, next, jumper"
        @current-change="emit('changePage', $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.private-asset-table-results {
  display: grid;
  gap: 1rem;
}

.private-asset-table-results__result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem 1rem;
  min-height: 2.5rem;
}

.private-asset-table-results__status {
  display: inline-flex;
}

.private-asset-table-results__empty,
.private-asset-table-results__error {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.82rem;
  text-align: center;
}

.private-asset-table-results__error {
  color: var(--danger);
}

.private-asset-table-results__pagination {
  flex-wrap: wrap;
  justify-content: center;
  row-gap: 0.5rem;
}
</style>
