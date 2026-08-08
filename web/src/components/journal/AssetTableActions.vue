<script setup lang="ts">
import { Edit, View } from '@element-plus/icons-vue';
import CardActionMenu from './CardActionMenu.vue';
import type { JournalEntry, JournalVisibility } from '../../types';

defineProps<{
  entry: JournalEntry;
  busy: boolean;
}>();

const emit = defineEmits<{
  edit: [entry: JournalEntry];
  view: [entry: JournalEntry];
  editPublishedTime: [entry: JournalEntry];
  setPinned: [entry: JournalEntry, pinned: boolean];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  deleteEntry: [entry: JournalEntry];
}>();

function requestDelete(entry: JournalEntry): void {
  const subject = entry.bodyFormat === 'rich' ? '这篇文章' : '这条记录';
  if (window.confirm(`永久删除${subject}？此操作无法撤销。`)) emit('deleteEntry', entry);
}
</script>

<template>
  <div class="asset-table-actions" :aria-busy="busy">
    <button
      class="asset-table-actions__button"
      type="button"
      :disabled="busy"
      @click="emit('edit', entry)"
    >
      <Edit aria-hidden="true" />
      {{ entry.publicationStatus === 'draft' ? '继续编辑' : '编辑' }}
    </button>
    <button
      class="asset-table-actions__button"
      type="button"
      :disabled="busy"
      @click="emit('view', entry)"
    >
      <View aria-hidden="true" />
      查看
    </button>
    <CardActionMenu
      :busy="busy"
      :pinned="entry.pinned"
      :visibility="entry.visibility"
      :publication-status="entry.publicationStatus"
      :edit-visible="false"
      @edit="emit('edit', entry)"
      @continue-edit="emit('edit', entry)"
      @edit-published-time="emit('editPublishedTime', entry)"
      @set-pinned="emit('setPinned', entry, $event)"
      @set-visibility="emit('setVisibility', entry, $event)"
      @request-delete="requestDelete(entry)"
    />
  </div>
</template>

<style scoped>
.asset-table-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.asset-table-actions__button {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent-strong);
  cursor: pointer;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
}

.asset-table-actions__button:hover {
  text-decoration: underline;
}

.asset-table-actions__button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.asset-table-actions__button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.asset-table-actions__button svg {
  width: 0.9rem;
  height: 0.9rem;
}
</style>
