<script setup lang="ts">
import { ElPagination } from 'element-plus';
import type { JournalEntry, JournalPlainChannel, JournalVisibility } from '../../types';
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
      <p v-if="error" class="private-asset-table-results__error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="!loading && !entries.length" class="private-asset-table-results__empty">
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
        background
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
  --el-color-primary: var(--accent-strong);
  --el-pagination-bg-color: transparent;
  --el-pagination-text-color: var(--text-muted);
  --el-pagination-button-color: var(--text-primary);
  --el-pagination-button-bg-color: var(--surface-card);
  --el-pagination-button-disabled-color: var(--text-muted);
  --el-pagination-button-disabled-bg-color: var(--surface-muted);
  --el-pagination-hover-color: var(--accent-strong);
  --el-pagination-border-radius: 8px;
  --el-pagination-item-gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  row-gap: 0.5rem;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.78rem;
  font-weight: 600;
}

.private-asset-table-results__pagination :deep(.btn-prev),
.private-asset-table-results__pagination :deep(.btn-next),
.private-asset-table-results__pagination :deep(.el-pager li) {
  border: 1px solid var(--border-subtle);
  background: var(--surface-card);
  transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
}

.private-asset-table-results__pagination :deep(.btn-prev:hover:not(:disabled)),
.private-asset-table-results__pagination :deep(.btn-next:hover:not(:disabled)),
.private-asset-table-results__pagination :deep(.el-pager li:hover:not(.is-active)) {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border-subtle));
  background: var(--accent-soft);
}

.private-asset-table-results__pagination :deep(.el-pager li.is-active) {
  border-color: var(--accent-strong);
  background: var(--accent-strong);
  color: #fff;
}

.private-asset-table-results__pagination :deep(.btn-prev:disabled),
.private-asset-table-results__pagination :deep(.btn-next:disabled) {
  border-color: transparent;
  opacity: 0.55;
}

.private-asset-table-results__pagination :deep(.el-pagination__total),
.private-asset-table-results__pagination :deep(.el-pagination__jump) {
  color: var(--text-muted);
}

.private-asset-table-results__pagination :deep(.el-pagination__editor.el-input) {
  --el-input-bg-color: var(--surface-card);
  --el-input-border-color: var(--border-subtle);
  --el-input-hover-border-color: var(--border-strong);
  --el-input-focus-border-color: var(--accent);
  --el-input-text-color: var(--text-primary);
}

.private-asset-table-results__pagination :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--border-subtle) inset;
}
</style>
