<script setup lang="ts">
import type { ContributionMedia } from '../../composables/useContributionForm';
import ContributionMediaItem from './ContributionMediaItem.vue';

defineProps<{
  media: ContributionMedia[];
  totalBytes: number;
  photoCount: number;
  videoCount: number;
  disabled: boolean;
}>();

const emit = defineEmits<{
  remove: [id: string];
  move: [id: string, direction: -1 | 1];
}>();

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
</script>

<template>
  <div v-if="media.length" class="contribution-media-list">
    <div class="contribution-media-list__summary" aria-live="polite">
      <span>{{ photoCount }} 张照片 · {{ videoCount }} 段视频</span>
      <span>{{ formatBytes(totalBytes) }} / 80 MiB</span>
    </div>
    <ol class="contribution-media-list__items">
      <ContributionMediaItem
        v-for="(item, index) in media"
        :key="item.id"
        :item="item"
        :index="index"
        :total="media.length"
        :disabled="disabled"
        @remove="emit('remove', $event)"
        @move="(id, direction) => emit('move', id, direction)"
      />
    </ol>
  </div>
</template>
