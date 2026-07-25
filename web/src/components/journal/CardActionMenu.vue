<script setup lang="ts">
import { nextTick, onBeforeUnmount, shallowRef, useId, useTemplateRef, watch } from 'vue';
import type { CSSProperties } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';
import type { JournalVisibility } from '../../types';

const props = defineProps<{
  busy: boolean;
  pinned: boolean;
  visibility: JournalVisibility;
}>();

const emit = defineEmits<{
  edit: [];
  editPublishedTime: [];
  setPinned: [pinned: boolean];
  setVisibility: [visibility: JournalVisibility];
  requestDelete: [];
}>();

const open = shallowRef(false);
const pendingLabel = shallowRef<string | null>(null);
const panelStyle = shallowRef<CSSProperties>({});
const menuId = useId();
const trigger = useTemplateRef<HTMLButtonElement>('trigger');
const panel = useTemplateRef<HTMLElement>('panel');
const firstAction = useTemplateRef<HTMLButtonElement>('firstAction');

watch(() => props.busy, (busy) => {
  if (busy) close();
  else pendingLabel.value = null;
});

async function setOpen(value: boolean, focusFirst = false): Promise<void> {
  const menu = panel.value!;
  if (!value) {
    if (menu.matches(':popover-open')) menu.hidePopover();
    return;
  }

  if (!menu.matches(':popover-open')) menu.showPopover();
  await nextTick();
  positionPanel();
  if (focusFirst) firstAction.value!.focus();
}

function positionPanel(): void {
  const triggerRect = trigger.value!.getBoundingClientRect();
  const panelRect = panel.value!.getBoundingClientRect();
  const edge = 12;
  const gap = 6;
  const left = Math.min(
    Math.max(edge, triggerRect.right - panelRect.width),
    window.innerWidth - panelRect.width - edge,
  );
  const top = triggerRect.bottom + gap + panelRect.height <= window.innerHeight - edge
    ? triggerRect.bottom + gap
    : Math.max(edge, triggerRect.top - panelRect.height - gap);

  panelStyle.value = {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
  };
}

function close(): void {
  const menu = panel.value;
  if (menu?.matches(':popover-open')) menu.hidePopover();
}

function handleToggle(event: Event): void {
  const isOpen = (event as ToggleEvent).newState === 'open';
  open.value = isOpen;
  if (isOpen) {
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return;
  }
  document.removeEventListener('scroll', close, true);
  window.removeEventListener('resize', close);
}

function closeAndFocusTrigger(): void {
  close();
  trigger.value?.focus();
}

function handleFocusOut(event: FocusEvent): void {
  const menu = event.currentTarget as HTMLElement;
  if (!menu.contains(event.relatedTarget as Node | null)) close();
}

function focusAdjacent(event: KeyboardEvent, direction: 1 | -1): void {
  const panel = event.currentTarget as HTMLElement;
  const items = [...panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement);
  const nextIndex = (activeIndex + direction + items.length) % items.length;
  items[nextIndex]!.focus();
}

function run(action: () => void): void {
  close();
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

onBeforeUnmount(() => {
  document.removeEventListener('scroll', close, true);
  window.removeEventListener('resize', close);
});
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
      :aria-controls="menuId"
      :aria-expanded="open"
      :disabled="busy"
      @click="setOpen(!open)"
      @keydown.down.prevent="setOpen(true, true)"
    >
      <span aria-hidden="true">•••</span>
    </button>

    <div
      :id="menuId"
      ref="panel"
      class="action-menu__panel"
      :style="panelStyle"
      popover="auto"
      role="menu"
      aria-label="记录管理"
      @toggle="handleToggle"
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
        @click="run(() => emit('editPublishedTime'))"
      >
        修改发布时间
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
  position: fixed;
  top: auto;
  right: auto;
  bottom: auto;
  left: auto;
  width: max-content;
  height: max-content;
  min-width: 8.5rem;
  max-width: calc(100vw - 24px);
  max-height: calc(100dvh - 24px);
  margin: 0;
  padding: 0.3rem;
  overflow-y: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-card);
  box-shadow: 0 0.75rem 2rem rgb(24 22 20 / 14%);
  animation: menu-enter 140ms ease-out;
}

.action-menu__panel:popover-open {
  display: flex;
  flex-direction: column;
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
