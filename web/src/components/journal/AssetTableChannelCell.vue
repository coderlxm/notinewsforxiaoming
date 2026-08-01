<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue';
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus';
import { computed } from 'vue';
import { journalChannels, plainJournalChannels } from '../../journalChannels';
import type { JournalEntry, JournalPlainChannel } from '../../types';

const props = defineProps<{
  entry: JournalEntry;
  busy: boolean;
}>();

const emit = defineEmits<{
  setChannel: [channel: JournalPlainChannel];
}>();

const label = computed(() =>
  journalChannels.find(channel => channel.value === props.entry.channel)!.label,
);
const editable = computed(() =>
  props.entry.bodyFormat === 'plain' && props.entry.publicationStatus === 'published',
);

function setChannel(channel: JournalPlainChannel): void {
  if (channel === props.entry.channel) return;
  emit('setChannel', channel);
}
</script>

<template>
  <ElDropdown
    v-if="editable"
    trigger="click"
    placement="bottom-start"
    :disabled="busy"
    :show-arrow="false"
    popper-class="journal-action-menu"
    @command="setChannel"
  >
    <button
      class="asset-channel asset-channel--editable"
      type="button"
      :disabled="busy"
      :aria-label="`当前属于${label}，点击修改所属板块`"
    >
      <span>{{ label }}</span>
      <ArrowDown aria-hidden="true" />
    </button>

    <template #dropdown>
      <ElDropdownMenu aria-label="选择所属板块">
        <ElDropdownItem
          v-for="option in plainJournalChannels"
          :key="option.value"
          :command="option.value"
          :disabled="option.value === entry.channel"
        >
          {{ option.label }}
          <small v-if="option.value === entry.channel">当前</small>
        </ElDropdownItem>
      </ElDropdownMenu>
    </template>
  </ElDropdown>

  <span v-else class="asset-channel">{{ label }}</span>
</template>

<style scoped>
.asset-channel {
  display: inline-flex;
  width: 3.5rem;
  min-height: 1.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.25rem 0.55rem;
  border: 0;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font: inherit;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.asset-channel--editable {
  cursor: pointer;
}

.asset-channel--editable:hover,
.asset-channel--editable:focus-visible {
  background: color-mix(in srgb, var(--accent-soft) 72%, var(--accent));
}

.asset-channel--editable:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.asset-channel--editable:disabled {
  cursor: wait;
  opacity: 0.58;
}

.asset-channel svg {
  width: 0.72rem;
  height: 0.72rem;
}

:global(.journal-action-menu .el-dropdown-menu__item small) {
  margin-left: 0.75rem;
  color: var(--text-muted);
  font-size: 0.68rem;
}
</style>
