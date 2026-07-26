<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useSiteProfileStore } from '../../stores/siteProfile';
import type { JournalEntry } from '../../types';
import { formatEntryTime } from '../../utils/formatters';

defineProps<{
  entry: JournalEntry;
}>();

const siteProfile = useSiteProfileStore();
const { profile } = storeToRefs(siteProfile);
</script>

<template>
  <aside class="detail-peek" aria-hidden="true">
    <span class="detail-peek__handle" />
    <div class="detail-peek__identity">
      <img v-if="profile" class="detail-peek__avatar" :src="profile.avatarUrl" alt="">
      <div class="detail-peek__identity-copy">
        <strong>小明同学</strong>
        <time :datetime="entry.sourceCreatedAt">{{ formatEntryTime(entry.sourceCreatedAt) }}</time>
      </div>
    </div>
    <p class="detail-peek__text">{{ entry.contentText }}</p>
  </aside>
</template>

<style scoped>
.detail-peek {
  display: none;
}

@media (max-width: 959px) {
  .detail-peek {
    position: fixed;
    z-index: 8;
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    gap: 9px;
    padding:
      10px
      max(20px, env(safe-area-inset-right))
      max(18px, calc(env(safe-area-inset-bottom) + 10px))
      max(20px, env(safe-area-inset-left));
    border-top: 1px solid var(--border-subtle);
    border-radius: 18px 18px 0 0;
    background: color-mix(in srgb, var(--surface-card) 96%, transparent);
    box-shadow: 0 -18px 48px rgb(17 17 15 / 18%);
    color: var(--text-primary);
    pointer-events: none;
  }

  .detail-peek__handle {
    width: 34px;
    height: 4px;
    border-radius: 999px;
    background: var(--border-strong);
    justify-self: center;
  }

  .detail-peek__identity {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 9px;
  }

  .detail-peek__avatar {
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 50%;
    object-fit: cover;
  }

  .detail-peek__identity-copy {
    display: grid;
    min-width: 0;
    gap: 1px;
  }

  .detail-peek__identity-copy strong {
    font-size: 0.82rem;
  }

  .detail-peek__identity-copy time {
    color: var(--text-muted);
    font-family: var(--font-condensed);
    font-size: 0.68rem;
  }

  .detail-peek__text {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    font-family: var(--font-serif);
    font-size: 0.95rem;
    line-height: 1.55;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
}

@media (prefers-color-scheme: dark) {
  .detail-peek {
    background: color-mix(in srgb, #272725 96%, transparent);
    box-shadow: 0 -18px 52px rgb(0 0 0 / 42%);
  }
}
</style>
