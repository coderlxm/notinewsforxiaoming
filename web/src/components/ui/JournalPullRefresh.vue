<script setup lang="ts">
import { PullRefresh } from 'vant';
import JournalLoading from './JournalLoading.vue';

defineProps<{
  disabled: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

defineSlots<{
  default(): unknown;
}>();

const refreshing = defineModel<boolean>({ required: true });
</script>

<template>
  <PullRefresh
    v-model="refreshing"
    class="journal-pull-refresh"
    :disabled="disabled"
    :head-height="50"
    :pull-distance="64"
    :animation-duration="220"
    @refresh="emit('refresh')"
  >
    <template #pulling>
      <span class="journal-pull-refresh__status" role="status" aria-live="polite">
        <span class="journal-pull-refresh__spine" aria-hidden="true"></span>
        下拉刷新
      </span>
    </template>

    <template #loosing>
      <span class="journal-pull-refresh__status journal-pull-refresh__status--ready" role="status" aria-live="polite">
        <span class="journal-pull-refresh__spine" aria-hidden="true"></span>
        松开，看看新记录
      </span>
    </template>

    <template #loading>
      <JournalLoading variant="inline" label="正在整理新记录…" />
    </template>

    <slot />
  </PullRefresh>
</template>

<style scoped>
.journal-pull-refresh {
  overflow: hidden;
}

.journal-pull-refresh :deep(.van-pull-refresh__track) {
  position: relative;
  height: 100%;
  transition-property: transform;
  transition-timing-function: var(--ease-card);
}

.journal-pull-refresh :deep(.van-pull-refresh__head) {
  position: absolute;
  left: 0;
  display: grid;
  width: 100%;
  height: 50px;
  overflow: hidden;
  place-items: center;
  color: var(--text-muted);
  font-size: 0.78rem;
  transform: translateY(-100%);
}

.journal-pull-refresh__status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  letter-spacing: 0.04em;
}

.journal-pull-refresh__spine {
  width: 0.22rem;
  height: 0.95rem;
  border-radius: 1px;
  background: var(--accent);
}

.journal-pull-refresh__status--ready {
  color: var(--accent-strong);
}

.journal-pull-refresh__status--ready .journal-pull-refresh__spine {
  height: 1.15rem;
  background: var(--accent-strong);
}

@media (prefers-reduced-motion: reduce) {
  .journal-pull-refresh :deep(.van-pull-refresh__track) {
    transition-duration: 0ms !important;
  }
}
</style>
