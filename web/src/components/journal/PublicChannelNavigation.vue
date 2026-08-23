<script setup lang="ts">
import { journalChannels } from '../../journalChannels';
import type { JournalChannel } from '../../types';
import AboutNavigationIcon from '../about/AboutNavigationIcon.vue';

defineProps<{
  channel: JournalChannel | null;
  aboutActive: boolean;
  photosActive: boolean;
}>();

const emit = defineEmits<{
  select: [channel: JournalChannel];
  selectAbout: [];
  selectPhotos: [];
}>();
</script>

<template>
  <aside class="channel-sidebar">
    <nav class="channel-sidebar__navigation" aria-label="公开页面导航">
      <div class="channel-sidebar__channels">
        <button
          v-for="item in journalChannels"
          :key="item.value"
          class="channel-sidebar__item"
          :class="{ 'channel-sidebar__item--active': channel === item.value && !aboutActive }"
          type="button"
          :aria-current="channel === item.value && !aboutActive ? 'page' : undefined"
          @click="emit('select', item.value)"
        >
          <span class="channel-sidebar__marker" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
        <button
          class="channel-sidebar__item"
          :class="{ 'channel-sidebar__item--active': photosActive }"
          type="button"
          :aria-current="photosActive ? 'page' : undefined"
          @click="emit('selectPhotos')"
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
        @click="emit('selectAbout')"
      >
        <AboutNavigationIcon class="channel-sidebar__about-icon" />
        <span>关于我</span>
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.channel-sidebar {
  min-width: 0;
  min-height: 0;
  padding: 1.5rem 0 2rem;
}

.channel-sidebar__navigation {
  display: flex;
  height: 100%;
  flex-direction: column;
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
</style>
