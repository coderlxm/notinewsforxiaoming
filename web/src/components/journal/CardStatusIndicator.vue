<script setup lang="ts">
import { computed } from 'vue';
import { Flag, Lock, Unlock } from '@element-plus/icons-vue';
import type { TextPosterTemplate } from '../../utils/textPosterTemplate';

const props = withDefaults(defineProps<{
  pinned?: boolean;
  encrypted?: boolean;
  locked?: boolean;
  tone?: 'surface' | 'poster' | 'protected' | 'media';
  posterTemplate?: TextPosterTemplate;
}>(), {
  pinned: false,
  encrypted: false,
  locked: false,
  tone: 'surface',
});

const statusCount = computed(() => Number(props.pinned) + Number(props.encrypted));
</script>

<template>
  <div
    class="card-status-indicator"
    :class="[
      `card-status-indicator--${tone}`,
      posterTemplate ? `card-status-indicator--poster-${posterTemplate}` : '',
      { 'card-status-indicator--double': statusCount > 1 },
    ]"
  >
    <span class="card-status-indicator__icons">
      <span v-if="pinned" title="置顶内容" aria-label="置顶内容" role="img">
        <Flag aria-hidden="true" />
      </span>
      <span
        v-if="encrypted"
        :title="locked ? '加密内容' : '已解锁的加密内容'"
        :aria-label="locked ? '加密内容' : '已解锁的加密内容'"
        role="img"
      >
        <Lock v-if="locked" aria-hidden="true" />
        <Unlock v-else aria-hidden="true" />
      </span>
    </span>
  </div>
</template>

<style scoped>
.card-status-indicator {
  --status-fold-bg: var(--accent-soft);
  --status-fold-ink: var(--accent-strong);
  position: absolute;
  top: 0;
  right: 0;
  z-index: 6;
  width: 2.75rem;
  height: 2.75rem;
  color: var(--status-fold-ink);
  pointer-events: none;
}

.card-status-indicator::before {
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-top: 2.75rem solid var(--status-fold-bg);
  border-left: 2.75rem solid transparent;
  content: '';
}

.card-status-indicator--double {
  width: 3.75rem;
}

.card-status-indicator--double::before {
  border-left-width: 3.75rem;
}

.card-status-indicator--media {
  --status-fold-bg: #20211f;
  --status-fold-ink: #f8f7f3;
}

.card-status-indicator--protected {
  --status-fold-bg: var(--protected-accent);
  --status-fold-ink: #f8f5ef;
}

.card-status-indicator--poster {
  --status-fold-ink: #f8f5ef;
}

.card-status-indicator--poster-editorial {
  --status-fold-bg: #b4313d;
}

.card-status-indicator--poster-book {
  --status-fold-bg: #9b5a36;
}

.card-status-indicator--poster-swiss {
  --status-fold-bg: #d52f3c;
}

.card-status-indicator--poster-archive {
  --status-fold-bg: #a84432;
}

.card-status-indicator--poster-cinema {
  --status-fold-bg: #973a69;
}

.card-status-indicator--poster-notebook {
  --status-fold-bg: #c14d4f;
}

.card-status-indicator--poster-gazette {
  --status-fold-bg: #8e2932;
}

.card-status-indicator__icons {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.28rem;
}

.card-status-indicator__icons {
  position: absolute;
  top: 0.38rem;
  right: 0.34rem;
}

.card-status-indicator__icons > span {
  display: grid;
  width: 0.95rem;
  height: 0.95rem;
  place-items: center;
}

.card-status-indicator__icons :deep(svg) {
  width: 0.85rem;
  height: 0.85rem;
}

@media (max-width: 599px) {
  .card-status-indicator {
    width: 2.5rem;
    height: 2.5rem;
  }

  .card-status-indicator::before {
    border-top-width: 2.5rem;
    border-left-width: 2.5rem;
  }

  .card-status-indicator--double {
    width: 3.5rem;
  }

  .card-status-indicator--double::before {
    border-left-width: 3.5rem;
  }

  .card-status-indicator__icons {
    top: 0.34rem;
    right: 0.3rem;
    gap: 0.24rem;
  }
}

@media (prefers-color-scheme: dark) {
  .card-status-indicator--poster-editorial {
    --status-fold-bg: #d65c67;
  }

  .card-status-indicator--poster-book {
    --status-fold-bg: #c78758;
  }

  .card-status-indicator--poster-swiss {
    --status-fold-bg: #e45a65;
  }

  .card-status-indicator--poster-archive {
    --status-fold-bg: #c86b4e;
  }

  .card-status-indicator--poster-cinema {
    --status-fold-bg: #d270a3;
  }

  .card-status-indicator--poster-notebook {
    --status-fold-bg: #d36769;
  }

  .card-status-indicator--poster-gazette {
    --status-fold-bg: #ce5a63;
  }
}
</style>
