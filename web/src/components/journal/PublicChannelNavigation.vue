<script setup lang="ts">
import { onClickOutside, useMediaQuery } from '@vueuse/core';
import { computed, shallowRef, useTemplateRef } from 'vue';
import { journalChannels } from '../../journalChannels';
import type { JournalChannel } from '../../types';
import AboutNavigationIcon from '../about/AboutNavigationIcon.vue';

const props = defineProps<{
  channel: JournalChannel | null;
  aboutActive: boolean;
  photosActive: boolean;
  immersive: boolean;
}>();

const emit = defineEmits<{
  select: [channel: JournalChannel];
  selectAbout: [];
  selectPhotos: [];
}>();

const sidebar = useTemplateRef<HTMLElement>('sidebar');
const edgeTrigger = useTemplateRef<HTMLButtonElement>('edgeTrigger');
const desktopNavigation = useMediaQuery('(min-width: 800px)');
const immersiveDrawer = computed(() => props.immersive && desktopNavigation.value);
const drawerOpen = shallowRef(false);

function openDrawer(): void {
  if (immersiveDrawer.value) drawerOpen.value = true;
}

function closeDrawer(): void {
  drawerOpen.value = false;
}

function handleFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && sidebar.value?.contains(nextTarget)) return;
  closeDrawer();
}

function handlePointerLeave(event: PointerEvent): void {
  if (event.pointerType !== 'mouse') return;
  const activeElement = document.activeElement;
  if (activeElement instanceof Node && sidebar.value?.contains(activeElement)) return;
  closeDrawer();
}

function handleEscape(): void {
  if (!immersiveDrawer.value || !drawerOpen.value) return;
  closeDrawer();
  edgeTrigger.value?.focus();
}

function selectChannel(channel: JournalChannel): void {
  closeDrawer();
  emit('select', channel);
}

function selectPhotos(): void {
  closeDrawer();
  emit('selectPhotos');
}

function selectAbout(): void {
  closeDrawer();
  emit('selectAbout');
}

onClickOutside(sidebar, closeDrawer);
</script>

<template>
  <aside
    ref="sidebar"
    class="channel-sidebar"
    :class="{
      'channel-sidebar--immersive': immersive,
      'channel-sidebar--open': immersive && drawerOpen,
    }"
    @pointerleave="handlePointerLeave"
    @focusout="handleFocusOut"
    @keydown.esc.stop.prevent="handleEscape"
  >
    <button
      v-if="immersiveDrawer"
      ref="edgeTrigger"
      class="channel-sidebar__edge-trigger"
      type="button"
      aria-label="展开页面导航"
      aria-controls="public-channel-navigation"
      :aria-expanded="drawerOpen"
      @pointerenter="openDrawer"
      @focus="openDrawer"
      @click="openDrawer"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m8 5 7 7-7 7" />
        <path d="m13 5 7 7-7 7" />
      </svg>
    </button>

    <div
      class="channel-sidebar__panel"
      :aria-hidden="immersiveDrawer && !drawerOpen ? 'true' : undefined"
      @pointerenter="openDrawer"
    >
      <nav id="public-channel-navigation" class="channel-sidebar__navigation" aria-label="公开页面导航">
        <div class="channel-sidebar__channels">
          <button
            v-for="item in journalChannels"
            :key="item.value"
            class="channel-sidebar__item"
            :class="{ 'channel-sidebar__item--active': channel === item.value && !aboutActive }"
            type="button"
            :aria-current="channel === item.value && !aboutActive ? 'page' : undefined"
            @click="selectChannel(item.value)"
          >
            <span class="channel-sidebar__marker" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </button>
          <button
            class="channel-sidebar__item"
            :class="{ 'channel-sidebar__item--active': photosActive }"
            type="button"
            :aria-current="photosActive ? 'page' : undefined"
            @click="selectPhotos"
          >
            <span class="channel-sidebar__marker" aria-hidden="true" />
            <span>照片墙</span>
          </button>
        </div>
        <button
          class="channel-sidebar__item channel-sidebar__about"
          :class="{ 'channel-sidebar__item--active': aboutActive }"
          type="button"
          :aria-current="aboutActive ? 'page' : undefined"
          @click="selectAbout"
        >
          <AboutNavigationIcon class="channel-sidebar__about-icon" />
          <span>关于我</span>
        </button>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
.channel-sidebar {
  min-width: 0;
  min-height: 0;
  padding: 1.5rem 0 2rem;
}

.channel-sidebar__panel,
.channel-sidebar__navigation {
  height: 100%;
}

.channel-sidebar__navigation {
  display: flex;
  flex-direction: column;
}

.channel-sidebar__edge-trigger {
  display: none;
}

.channel-sidebar__channels {
  display: grid;
  gap: 0.45rem;
}

.channel-sidebar__about {
  margin-top: auto;
}

.channel-sidebar__item {
  display: flex;
  width: 100%;
  min-height: 3.4rem;
  align-items: center;
  gap: 0.9rem;
  padding: 0.65rem 1rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 680;
  text-align: left;
  transition: background-color 150ms ease, color 150ms ease;
}

.channel-sidebar__item:hover {
  background: color-mix(in srgb, var(--surface-muted) 58%, transparent);
  color: var(--text-primary);
}

.channel-sidebar__item--active {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.channel-sidebar__marker {
  width: 0.35rem;
  height: 1.4rem;
  border-radius: 999px;
  background: var(--border-strong);
}

.channel-sidebar__item--active .channel-sidebar__marker {
  background: var(--accent);
}

.channel-sidebar__about-icon {
  width: 1.4rem;
  height: 1.4rem;
  flex: none;
  color: var(--border-strong);
}

.channel-sidebar__item--active .channel-sidebar__about-icon {
  color: var(--accent);
}

@media (min-width: 800px) {
  .channel-sidebar--immersive {
    position: fixed;
    z-index: 30;
    top: 0;
    bottom: 0;
    left: 0;
    width: 264px;
    padding: 0;
    color: var(--photo-text-primary);
    pointer-events: none;
  }

  .channel-sidebar--immersive .channel-sidebar__edge-trigger {
    position: absolute;
    z-index: 2;
    top: 50%;
    left: 10px;
    display: grid;
    width: 44px;
    height: 72px;
    padding: 0;
    border: 1px solid var(--photo-border);
    border-radius: 0 14px 14px 0;
    background: var(--photo-glass-bg);
    color: var(--photo-text-muted);
    box-shadow: 0 12px 32px rgb(0 0 0 / 36%);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    cursor: pointer;
    place-items: center;
    pointer-events: auto;
    transform: translateY(-50%);
    transition: transform 200ms var(--ease-card), color 160ms ease, background-color 160ms ease;
  }

  .channel-sidebar--immersive .channel-sidebar__edge-trigger:hover,
  .channel-sidebar--immersive .channel-sidebar__edge-trigger:focus-visible {
    background: rgb(31 31 31 / 88%);
    color: var(--photo-text-primary);
  }

  .channel-sidebar--immersive .channel-sidebar__edge-trigger svg {
    width: 1.35rem;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.5;
  }

  .channel-sidebar--immersive.channel-sidebar--open .channel-sidebar__edge-trigger {
    transform: translate(210px, -50%);
  }

  .channel-sidebar--immersive .channel-sidebar__panel {
    width: 220px;
    padding: 1.5rem 1rem 2rem;
    border-right: 1px solid var(--photo-border);
    background: var(--photo-glass-bg);
    box-shadow: 1.5rem 0 3.5rem rgb(0 0 0 / 42%);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    opacity: 0;
    pointer-events: none;
    transform: translateX(-100%);
    visibility: hidden;
    transition:
      transform 200ms var(--ease-card),
      opacity 160ms ease,
      visibility 0s linear 200ms;
  }

  .channel-sidebar--immersive.channel-sidebar--open .channel-sidebar__panel {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(0);
    visibility: visible;
    transition-delay: 0s;
  }

  .channel-sidebar--immersive .channel-sidebar__item {
    color: var(--photo-text-secondary);
  }

  .channel-sidebar--immersive .channel-sidebar__item:hover {
    background: var(--photo-surface-hover);
    color: var(--photo-text-primary);
  }

  .channel-sidebar--immersive .channel-sidebar__item--active {
    background: var(--photo-surface-hover);
    color: var(--photo-text-primary);
  }

  .channel-sidebar--immersive .channel-sidebar__marker {
    background: rgb(255 255 255 / 22%);
  }

  .channel-sidebar--immersive .channel-sidebar__item--active .channel-sidebar__marker {
    background: var(--accent);
  }
}

@media (max-width: 799px) {
  .channel-sidebar {
    z-index: 10;
    grid-row: 2;
    padding:
      0.25rem
      max(0.55rem, env(safe-area-inset-right))
      max(0.25rem, env(safe-area-inset-bottom))
      max(0.55rem, env(safe-area-inset-left));
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-page);
    box-shadow: 0 -0.6rem 1.6rem rgb(24 22 20 / 5%);
  }

  .channel-sidebar--immersive {
    border-top-color: var(--photo-border);
    background: var(--photo-canvas);
    box-shadow: 0 -0.6rem 1.6rem rgb(0 0 0 / 24%);
  }

  .channel-sidebar__panel {
    height: auto;
  }

  .channel-sidebar__navigation {
    display: grid;
    width: 100%;
    height: auto;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.18rem;
  }

  .channel-sidebar__channels {
    display: contents;
  }

  .channel-sidebar__about {
    margin-top: 0;
  }

  .channel-sidebar__item {
    width: 100%;
    min-width: 0;
    min-height: 2.6rem;
    justify-content: center;
    gap: 0;
    padding: 0.3rem 0.6rem;
    font-size: 0.76rem;
  }

  .channel-sidebar__marker {
    display: none;
  }

  .channel-sidebar__about-icon {
    display: none;
  }

  .channel-sidebar__item.channel-sidebar__item--active,
  .channel-sidebar__item.channel-sidebar__item--active:hover {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
}

@media (prefers-reduced-motion: reduce) {
  .channel-sidebar--immersive .channel-sidebar__edge-trigger,
  .channel-sidebar--immersive .channel-sidebar__panel {
    transition: none;
  }
}
</style>
