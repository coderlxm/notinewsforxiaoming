<script setup lang="ts">
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus';
import { computed, shallowRef, watch } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';
import { plainJournalChannels } from '../../journalChannels';
import type {
  JournalPlainChannel,
  JournalPublicationStatus,
  JournalVisibility,
} from '../../types';

const props = withDefaults(defineProps<{
  busy: boolean;
  pinned: boolean;
  visibility: JournalVisibility;
  publicationStatus: JournalPublicationStatus;
  channel?: JournalPlainChannel;
  channelEditable?: boolean;
  teleported?: boolean;
}>(), {
  channel: undefined,
  channelEditable: false,
  teleported: true,
});

const emit = defineEmits<{
  edit: [];
  continueEdit: [];
  editPublishedTime: [];
  setPinned: [pinned: boolean];
  setVisibility: [visibility: JournalVisibility];
  setChannel: [channel: JournalPlainChannel];
  requestDelete: [];
}>();

const open = shallowRef(false);
const pendingLabel = shallowRef<string | null>(null);
const channelTargets = computed(() => props.channelEditable && props.publicationStatus === 'published'
  ? plainJournalChannels.filter(option => option.value !== props.channel)
  : []);

watch(() => props.busy, (busy) => {
  if (!busy) pendingLabel.value = null;
});

function runMutation(label: string, action: () => void): void {
  pendingLabel.value = label;
  action();
}

function changePinned(): void {
  runMutation(
    props.pinned ? '正在取消置顶…' : '正在置顶…',
    () => emit('setPinned', !props.pinned),
  );
}

function changeVisibility(): void {
  const visibility = props.visibility === 'public' ? 'private' : 'public';
  runMutation(
    visibility === 'public' ? '正在设为公开…' : '正在转为私有…',
    () => emit('setVisibility', visibility),
  );
}

function editEntry(): void {
  if (props.publicationStatus === 'draft') {
    emit('continueEdit');
    return;
  }
  emit('edit');
}

function changeChannel(channel: JournalPlainChannel): void {
  const target = plainJournalChannels.find(option => option.value === channel)!;
  runMutation(`正在移动到${target.label}…`, () => emit('setChannel', channel));
}

function handleCommand(command: string): void {
  if (command.startsWith('channel:')) {
    changeChannel(command.slice('channel:'.length) as JournalPlainChannel);
    return;
  }
  switch (command) {
    case 'edit': editEntry(); break;
    case 'published-time': emit('editPublishedTime'); break;
    case 'pinned': changePinned(); break;
    case 'visibility': changeVisibility(); break;
    case 'delete': emit('requestDelete'); break;
  }
}
</script>

<template>
  <div class="action-menu" :aria-busy="busy">
    <JournalLoading
      v-if="busy && pendingLabel"
      class="action-menu__loading"
      variant="inline"
      :label="pendingLabel"
    />
    <ElDropdown
      v-else
      trigger="click"
      placement="bottom-end"
      :disabled="busy"
      :show-arrow="false"
      :teleported="teleported"
      max-height="calc(100dvh - 24px)"
      popper-class="journal-action-menu"
      @command="handleCommand"
      @visible-change="open = $event"
    >
      <button
        class="action-menu__trigger"
        type="button"
        aria-label="打开记录管理菜单"
        aria-haspopup="menu"
        :aria-expanded="open"
      >
        <span aria-hidden="true">•••</span>
      </button>

      <template #dropdown>
        <ElDropdownMenu aria-label="记录管理">
          <ElDropdownItem command="edit">
            {{ publicationStatus === 'draft' ? '继续编辑' : '编辑' }}
          </ElDropdownItem>
          <ElDropdownItem v-if="publicationStatus === 'published'" command="published-time">
            修改发布时间
          </ElDropdownItem>
          <ElDropdownItem v-if="publicationStatus === 'published'" command="pinned">
            {{ pinned ? '取消置顶' : '置顶' }}
          </ElDropdownItem>
          <ElDropdownItem v-if="publicationStatus === 'published'" command="visibility">
            {{ visibility === 'public' ? '转为私有' : '设为公开' }}
          </ElDropdownItem>
          <ElDropdownItem
            v-for="option in channelTargets"
            :key="option.value"
            :command="`channel:${option.value}`"
          >
            移动到{{ option.label }}
          </ElDropdownItem>
          <ElDropdownItem class="journal-action-menu__item--danger" command="delete">
            删除
          </ElDropdownItem>
        </ElDropdownMenu>
      </template>
    </ElDropdown>
  </div>
</template>

<style scoped>
.action-menu {
  position: relative;
  flex: none;
}

.action-menu__trigger {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  letter-spacing: 0.08em;
  place-items: center;
}

.action-menu__trigger:hover,
.action-menu__trigger[aria-expanded="true"] {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.action-menu__trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.action-menu__trigger:disabled {
  cursor: wait;
  opacity: 0.5;
}

.action-menu__loading {
  min-height: 2.5rem;
  color: var(--text-muted);
  font-size: 0.72rem;
}

:global(.journal-action-menu.el-popper) {
  width: max-content;
  min-width: 8.5rem;
  max-width: calc(100vw - 24px);
  padding: 0.3rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-card);
  color: var(--text-primary);
  box-shadow: 0 0.75rem 2rem rgb(24 22 20 / 14%);
  --el-bg-color-overlay: var(--surface-card);
  --el-border-color-light: var(--border-subtle);
  --el-color-primary: var(--accent);
  --el-dropdown-menuItem-hover-fill: var(--surface-muted);
  --el-dropdown-menuItem-hover-color: var(--accent-strong);
  --el-fill-color-light: var(--surface-muted);
  --el-text-color-regular: var(--text-primary);
}

:global(.journal-action-menu .el-dropdown-menu) {
  padding: 0;
}

:global(.journal-action-menu .el-dropdown-menu__item) {
  min-height: 2.5rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.5rem;
  color: var(--text-primary);
  font: inherit;
  font-size: 0.82rem;
  text-align: left;
}

:global(.journal-action-menu .el-dropdown-menu__item:not(.is-disabled):hover),
:global(.journal-action-menu .el-dropdown-menu__item:focus-visible) {
  background: var(--surface-muted);
}

:global(.journal-action-menu .journal-action-menu__item--danger) {
  color: var(--danger);
}

</style>
