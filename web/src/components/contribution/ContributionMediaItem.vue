<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import type { ContributionMedia } from '../../composables/useContributionForm';

const props = defineProps<{
  item: ContributionMedia;
  index: number;
  total: number;
  disabled: boolean;
}>();

const emit = defineEmits<{
  remove: [id: string];
  move: [id: string, direction: -1 | 1];
}>();

const previewFailed = shallowRef(false);

watch(
  () => props.item.id,
  () => {
    previewFailed.value = false;
  },
);

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
</script>

<template>
  <li class="contribution-media-item">
    <div class="contribution-media-item__preview">
      <img
        v-if="item.previewKind === 'image' && item.objectUrl && !previewFailed"
        :src="item.objectUrl"
        alt=""
        width="88"
        height="88"
        @error="previewFailed = true"
      >
      <video
        v-else-if="item.previewKind === 'video' && item.objectUrl && !previewFailed"
        :src="item.objectUrl"
        muted
        playsinline
        preload="metadata"
        @error="previewFailed = true"
      ></video>
      <span v-else aria-hidden="true">
        {{ item.kind === 'video' ? 'VIDEO' : 'IMG' }}
      </span>
    </div>

    <div class="contribution-media-item__details">
      <p class="contribution-media-item__name">{{ item.file.name }}</p>
      <p class="contribution-media-item__meta">
        {{ item.kind === 'video' ? '视频' : item.kind === 'photo' ? '照片' : '不支持的文件' }}
        · {{ formatBytes(item.file.size) }}
      </p>
      <div class="contribution-media-item__actions">
        <button
          type="button"
          class="contribution-icon-button"
          :disabled="disabled || index === 0"
          :aria-label="`前移 ${item.file.name}`"
          @click="emit('move', item.id, -1)"
        >
          ↑
        </button>
        <button
          type="button"
          class="contribution-icon-button"
          :disabled="disabled || index === total - 1"
          :aria-label="`后移 ${item.file.name}`"
          @click="emit('move', item.id, 1)"
        >
          ↓
        </button>
        <button
          type="button"
          class="contribution-icon-button contribution-icon-button--remove"
          :disabled="disabled"
          :aria-label="`移除 ${item.file.name}`"
          @click="emit('remove', item.id)"
        >
          移除
        </button>
      </div>
    </div>
  </li>
</template>
