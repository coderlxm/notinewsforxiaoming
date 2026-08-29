<script setup lang="ts">
import type { JournalInteractionSummary } from '../../types';
import JournalReactionButton from './JournalReactionButton.vue';

defineProps<{
  summary: JournalInteractionSummary;
  interactive: boolean;
  reactionPending?: boolean;
}>();

const emit = defineEmits<{
  toggleReaction: [];
  openComments: [];
}>();
</script>

<template>
  <span
    v-if="interactive || summary.reactionCount > 0 || summary.commentCount > 0"
    class="entry-interactions"
  >
    <template v-if="interactive">
      <JournalReactionButton
        :reacted="summary.viewerReacted"
        :count="summary.reactionCount"
        :pending="reactionPending ?? false"
        variant="card"
        aria-label="点赞"
        @toggle="emit('toggleReaction')"
      />
      <button
        type="button"
        class="entry-interactions__comments"
        aria-label="查看评论"
        @click="emit('openComments')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M21 11.6c0 3.8-4 6.9-9 6.9-1 0-2-.1-2.9-.4L5 19.6l1.3-3.2C4.2 15.2 3 13.5 3 11.6c0-3.8 4-6.9 9-6.9s9 3.1 9 6.9Z"
          />
        </svg>
        <span v-if="summary.commentCount > 0">{{ summary.commentCount }}</span>
      </button>
    </template>
    <template v-else>
      <span class="entry-interactions__static">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
        <span v-if="summary.reactionCount > 0">{{ summary.reactionCount }}</span>
      </span>
      <span class="entry-interactions__static">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M21 11.6c0 3.8-4 6.9-9 6.9-1 0-2-.1-2.9-.4L5 19.6l1.3-3.2C4.2 15.2 3 13.5 3 11.6c0-3.8 4-6.9 9-6.9s9 3.1 9 6.9Z"
          />
        </svg>
        <span v-if="summary.commentCount > 0">{{ summary.commentCount }}</span>
      </span>
    </template>
  </span>
</template>

<style scoped>
.entry-interactions {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.entry-interactions__comments {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 40px;
  padding: 0 0.35rem;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  line-height: 1;
  transition: color 160ms ease;
}

.entry-interactions__comments:hover {
  color: var(--accent-strong);
}

.entry-interactions__comments:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
  border-radius: 0.5rem;
}

.entry-interactions__comments svg {
  width: 1em;
  height: 1em;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.entry-interactions__static {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0 0.3rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1;
}

.entry-interactions__static svg {
  width: 0.95em;
  height: 0.95em;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.entry-interactions__static span,
.entry-interactions__comments span {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
