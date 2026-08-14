<script setup lang="ts">
import { Calendar, Refresh } from '@element-plus/icons-vue';
import PublicChannelTagNavigation from '../PublicChannelTagNavigation.vue';

defineProps<{
  tags: readonly string[];
  activeTag: string;
  refreshing: boolean;
  refreshDisabled: boolean;
}>();

const emit = defineEmits<{
  select: [tag: string];
  openArchive: [];
  refresh: [];
}>();
</script>

<template>
  <div class="feed__public-intro">
    <div class="feed__public-heading">
      <PublicChannelTagNavigation
        class="feed__public-tags"
        :tags="tags"
        :active-tag="activeTag"
        @select="emit('select', $event)"
      />
      <div class="feed__public-actions">
        <button
          class="feed__public-action"
          type="button"
          aria-label="查看时间归档"
          title="时间归档"
          @click="emit('openArchive')"
        >
          <Calendar aria-hidden="true" />
        </button>
        <button
          class="feed__public-action feed__public-refresh"
          type="button"
          :disabled="refreshDisabled || refreshing"
          :aria-busy="refreshing"
          aria-label="刷新信息流"
          title="刷新信息流"
          @click="emit('refresh')"
        >
          <Refresh :class="{ 'feed__public-refresh-icon--active': refreshing }" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feed__public-intro {
  position: sticky;
  z-index: 4;
  top: 0;
  display: grid;
  min-width: 0;
  gap: 0.55rem;
  padding: 0.35rem 0;
  background: var(--surface-page);
}

.feed__public-heading {
  --public-actions-space: 5.2rem;

  position: relative;
  display: block;
  min-width: 0;
  min-height: 1.5rem;
  padding: 0 0.15rem;
}

.feed__public-tags {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding-inline: var(--public-actions-space);
}

.feed__public-actions {
  position: absolute;
  top: 50%;
  right: 0.15rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  transform: translateY(-50%);
}

.feed__public-action {
  display: grid;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  place-items: center;
  transition: color 160ms ease;
}

.feed__public-action:hover:not(:disabled) {
  color: var(--accent-strong);
}

.feed__public-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.feed__public-action:disabled {
  cursor: wait;
  opacity: 0.55;
}

.feed__public-action svg {
  width: 1.05rem;
  height: 1.05rem;
}

.feed__public-refresh-icon--active {
  animation: feed-public-refresh-spin 760ms linear infinite;
}

@keyframes feed-public-refresh-spin {
  to {
    transform: rotate(1turn);
  }
}

@media (max-width: 599px) {
  .feed__public-intro {
    padding: 0;
  }

  .feed__public-heading {
    display: grid;
    align-items: center;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.35rem;
  }

  .feed__public-tags {
    padding-inline: 0;
  }

  .feed__public-actions {
    position: static;
    transform: none;
  }

  .feed__public-refresh {
    display: none;
  }
}
</style>
