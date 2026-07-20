<script setup lang="ts">
import { nextTick, shallowRef, useTemplateRef, watch } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';
import type { JournalVisibility } from '../../types';

const props = defineProps<{
  busy: boolean;
  pinned: boolean;
  visibility: JournalVisibility;
}>();

const emit = defineEmits<{
  edit: [];
  setPinned: [pinned: boolean];
  setVisibility: [visibility: JournalVisibility];
  requestDelete: [];
}>();

const open = shallowRef(false);
const pendingLabel = shallowRef<string | null>(null);
const trigger = useTemplateRef<HTMLButtonElement>('trigger');
const firstAction = useTemplateRef<HTMLButtonElement>('firstAction');

watch(() => props.busy, (busy) => {
  if (!busy) pendingLabel.value = null;
});

async function setOpen(value: boolean, focusFirst = false): Promise<void> {
  open.value = value;
  if (value && focusFirst) {
    await nextTick();
    firstAction.value?.focus();
  }
}

function closeAndFocusTrigger(): void {
  open.value = false;
  trigger.value?.focus();
}

function handleFocusOut(event: FocusEvent): void {
  const menu = event.currentTarget as HTMLElement;
  if (!menu.contains(event.relatedTarget as Node | null)) open.value = false;
}

function focusAdjacent(event: KeyboardEvent, direction: 1 | -1): void {
  const panel = event.currentTarget as HTMLElement;
  const items = [...panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement);
  const nextIndex = (activeIndex + direction + items.length) % items.length;
  items[nextIndex]!.focus();
}

function run(action: () => void): void {
  open.value = false;
  action();
}

function runMutation(label: string, action: () => void): void {
  pendingLabel.value = label;
  run(action);
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
</script>

<template>
  <div class="action-menu" :aria-busy="busy" @focusout="handleFocusOut" @keydown.esc.stop="closeAndFocusTrigger">
    <JournalLoading
      v-if="busy && pendingLabel"
      class="action-menu__loading"
      variant="inline"
      :label="pendingLabel"
    />
    <button
      v-else
      ref="trigger"
      class="action-menu__trigger"
      type="button"
      aria-label="打开记录管理菜单"
      aria-haspopup="menu"
      :aria-expanded="open"
      :disabled="busy"
      @click="setOpen(!open)"
      @keydown.down.prevent="setOpen(true, true)"
    >
      <span aria-hidden="true">•••</span>
    </button>

    <div
      v-if="open"
      class="action-menu__panel"
      role="menu"
      aria-label="记录管理"
      @keydown.down.prevent="focusAdjacent($event, 1)"
      @keydown.up.prevent="focusAdjacent($event, -1)"
    >
      <button ref="firstAction" class="action-menu__item" type="button" role="menuitem" :disabled="busy" @click="run(() => emit('edit'))">
        编辑
      </button>
      <button
        class="action-menu__item"
        type="button"
        role="menuitem"
        :disabled="busy"
        @click="changePinned"
      >
        {{ pinned ? '取消置顶' : '置顶' }}
      </button>
      <button
        class="action-menu__item"
        type="button"
        role="menuitem"
        :disabled="busy"
        @click="changeVisibility"
      >
        {{ visibility === 'public' ? '转为私有' : '设为公开' }}
      </button>
      <button class="action-menu__item action-menu__item--danger" type="button" role="menuitem" :disabled="busy" @click="run(() => emit('requestDelete'))">
        删除
      </button>
    </div>
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

.action-menu__trigger:focus-visible,
.action-menu__item:focus-visible {
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

.action-menu__panel {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.3rem);
  right: 0;
  display: grid;
  width: max-content;
  min-width: 8.5rem;
  padding: 0.3rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-card);
  box-shadow: 0 0.75rem 2rem rgb(24 22 20 / 14%);
  animation: menu-enter 140ms ease-out;
}

.action-menu__item {
  min-height: 2.5rem;
  padding: 0.55rem 0.75rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  text-align: left;
}

.action-menu__item:hover,
.action-menu__item:focus-visible {
  background: var(--surface-muted);
}

.action-menu__item--danger {
  color: var(--danger);
}

.action-menu__item:disabled {
  cursor: wait;
  opacity: 0.5;
}

@keyframes menu-enter {
  from {
    opacity: 0;
    transform: translateY(-0.3rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-menu__panel {
    animation: none;
  }
}
</style>
