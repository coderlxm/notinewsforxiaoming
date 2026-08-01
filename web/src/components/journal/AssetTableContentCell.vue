<script setup lang="ts">
import { computed } from 'vue';
import type { JournalEntry } from '../../types';

const props = defineProps<{
  entry: JournalEntry;
  typeLabel: string;
}>();

const emit = defineEmits<{
  selectTag: [tag: string];
}>();

const previewUrl = computed(() =>
  props.entry.assets.find(asset => asset.previewUrl !== null)?.previewUrl ?? null,
);
const primaryText = computed(() =>
  props.entry.title?.trim() || props.entry.contentText.trim() || props.typeLabel,
);
const secondaryText = computed(() =>
  props.entry.title?.trim() ? props.entry.contentText.trim() : '',
);
const visibleTags = computed(() => props.entry.tags.slice(0, 3));
const hiddenTagCount = computed(() => props.entry.tags.length - visibleTags.value.length);
</script>

<template>
  <div class="asset-table-content">
    <img
      v-if="previewUrl"
      class="asset-table-content__preview"
      :src="previewUrl"
      alt=""
      loading="lazy"
    >
    <span v-else class="asset-table-content__kind">{{ typeLabel }}</span>

    <div class="asset-table-content__copy">
      <strong class="asset-table-content__primary">{{ primaryText }}</strong>
      <span v-if="secondaryText" class="asset-table-content__secondary">
        {{ secondaryText }}
      </span>
      <div v-if="visibleTags.length" class="asset-table-content__tags">
        <button
          v-for="tag in visibleTags"
          :key="tag"
          class="asset-table-content__tag"
          type="button"
          @click="emit('selectTag', tag)"
        >
          #{{ tag }}
        </button>
        <span v-if="hiddenTagCount" class="asset-table-content__tag-count">
          +{{ hiddenTagCount }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.asset-table-content {
  display: grid;
  min-width: 0;
  grid-template-columns: 3.5rem minmax(0, 1fr);
  align-items: center;
  gap: 0.7rem;
}

.asset-table-content__preview,
.asset-table-content__kind {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 8px;
}

.asset-table-content__preview {
  display: block;
  background: var(--surface-muted);
  object-fit: cover;
}

.asset-table-content__kind {
  display: grid;
  padding: 0.35rem;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 0.66rem;
  font-weight: 700;
  line-height: 1.25;
  place-items: center;
  text-align: center;
}

.asset-table-content__copy {
  display: grid;
  min-width: 0;
  gap: 0.22rem;
}

.asset-table-content__primary,
.asset-table-content__secondary {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
}

.asset-table-content__primary {
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: 0.82rem;
  font-weight: 680;
  line-height: 1.45;
  -webkit-line-clamp: 2;
}

.asset-table-content__secondary {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.4;
  -webkit-line-clamp: 1;
}

.asset-table-content__tags {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.35rem;
  overflow: hidden;
  white-space: nowrap;
}

.asset-table-content__tag {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent-strong);
  cursor: pointer;
  font-size: 0.68rem;
}

.asset-table-content__tag:hover {
  text-decoration: underline;
}

.asset-table-content__tag-count {
  color: var(--text-muted);
  font-size: 0.68rem;
}
</style>
