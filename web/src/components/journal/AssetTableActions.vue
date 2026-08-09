<script setup lang="ts">
import { Edit, View } from '@element-plus/icons-vue';
import { shallowRef } from 'vue';
import type { JournalEntry } from '../../types';
import CardActionMenu from './CardActionMenu.vue';
import AccessSettingsDialog from './AccessSettingsDialog.vue';
import type { AccessSettingsInput } from './accessSettings';

const props = defineProps<{
  entry: JournalEntry;
  busy: boolean;
}>();

const accessSettingsOpen = shallowRef(false);

const emit = defineEmits<{
  edit: [entry: JournalEntry];
  view: [entry: JournalEntry];
  editPublishedTime: [entry: JournalEntry];
  setPinned: [entry: JournalEntry, pinned: boolean];
  saveAccessSettings: [entry: JournalEntry, settings: AccessSettingsInput];
  deleteEntry: [entry: JournalEntry];
}>();

function requestDelete(entry: JournalEntry): void {
  const subject = entry.bodyFormat === 'rich' ? '这篇文章' : '这条记录';
  if (window.confirm(`永久删除${subject}？此操作无法撤销。`)) emit('deleteEntry', entry);
}

function saveAccessSettings(settings: AccessSettingsInput): void {
  accessSettingsOpen.value = false;
  emit('saveAccessSettings', props.entry, settings);
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
      编辑
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
      :public-id="entry.publicId"
      :visibility="entry.visibility"
      :publication-status="entry.publicationStatus"
      :edit-visible="false"
      @edit="emit('edit', entry)"
      @continue-edit="emit('edit', entry)"
      @edit-published-time="emit('editPublishedTime', entry)"
      @set-pinned="emit('setPinned', entry, $event)"
      @request-access-settings="accessSettingsOpen = true"
      @request-delete="requestDelete(entry)"
    />
    <AccessSettingsDialog
      v-if="accessSettingsOpen"
      :visibility="entry.visibility"
      :busy="busy"
      @close="accessSettingsOpen = false"
      @save="saveAccessSettings"
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
