<script setup lang="ts">
import { Grid, List } from '@element-plus/icons-vue';
import type { AssetView } from '../../types';

const props = defineProps<{
  view: AssetView;
}>();

const emit = defineEmits<{
  change: [view: AssetView];
}>();

function select(view: AssetView): void {
  if (view !== props.view) emit('change', view);
}
</script>

<template>
  <section class="asset-view-switch" aria-label="资产展示方式">
    <span class="asset-view-switch__label">当前资产</span>
    <div class="asset-view-switch__options">
      <button
        class="asset-view-switch__option"
        :class="{ 'asset-view-switch__option--active': view === 'waterfall' }"
        type="button"
        :aria-pressed="view === 'waterfall'"
        @click="select('waterfall')"
      >
        <Grid aria-hidden="true" />
        <span>瀑布</span>
      </button>
      <button
        class="asset-view-switch__option"
        :class="{ 'asset-view-switch__option--active': view === 'table' }"
        type="button"
        :aria-pressed="view === 'table'"
        @click="select('table')"
      >
        <List aria-hidden="true" />
        <span>表格</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.asset-view-switch {
  display: flex;
  min-height: 3.25rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.55rem 0.7rem 0.55rem 0.85rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.asset-view-switch__label {
  color: var(--accent-strong);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.asset-view-switch__options {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.2rem;
  border-radius: 9px;
  background: var(--surface-muted);
}

.asset-view-switch__option {
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.76rem;
}

.asset-view-switch__option svg {
  width: 0.92rem;
  height: 0.92rem;
}

.asset-view-switch__option--active {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--border-subtle));
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
}

@media (max-width: 599px) {
  .asset-view-switch {
    min-height: 3rem;
    padding-left: 0.75rem;
  }

  .asset-view-switch__option {
    padding-inline: 0.55rem;
  }
}
</style>
