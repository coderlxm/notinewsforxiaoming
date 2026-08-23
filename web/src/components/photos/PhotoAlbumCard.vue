<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { PhotoAlbumSummary } from '../../../../src/shared/photoLibraryProtocol';
import JournalProgressiveImage from '../ui/JournalProgressiveImage.vue';

const props = defineProps<{
  album: PhotoAlbumSummary;
}>();

const coverRatio = computed(() => `${props.album.cover.card.width} / ${props.album.cover.card.height}`);
const dateRange = computed(() => {
  const { takenAtStart, takenAtEnd } = props.album;
  if (!takenAtStart || !takenAtEnd) return null;

  const start = dayjs(takenAtStart).format('YYYY.M.D');
  const end = dayjs(takenAtEnd).format('YYYY.M.D');
  return start === end ? start : `${start} — ${end}`;
});
</script>

<template>
  <RouterLink
    class="photo-album-card"
    :to="{ name: 'photo-album', params: { albumId: album.id } }"
  >
    <span class="photo-album-card__cover" :style="{ aspectRatio: coverRatio }">
      <JournalProgressiveImage
        class="photo-album-card__image"
        :src="album.cover.card.url"
        :preview-src="album.cover.preview.url"
        :alt="`${album.name}相册封面：${album.cover.title}`"
        fit="cover"
        loading="lazy"
      />
    </span>
    <span class="photo-album-card__copy">
      <strong class="photo-album-card__name">{{ album.name }}</strong>
      <span class="photo-album-card__summary">
        <span>{{ album.photoCount }} 张照片</span>
        <span v-if="dateRange">{{ dateRange }}</span>
      </span>
    </span>
  </RouterLink>
</template>

<style scoped>
.photo-album-card {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 0.8rem;
  color: inherit;
  text-decoration: none;
}

.photo-album-card__cover {
  position: relative;
  display: block;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--radius-media);
  background: var(--surface-muted);
}

.photo-album-card__image {
  width: 100%;
  height: 100%;
  transition: transform 420ms var(--ease-card);
}

.photo-album-card:hover .photo-album-card__image {
  transform: scale(1.015);
}

.photo-album-card__copy {
  display: grid;
  min-width: 0;
  gap: 0.3rem;
}

.photo-album-card__name {
  overflow: hidden;
  font-family: var(--font-serif);
  font-size: clamp(1rem, 1.8vw, 1.22rem);
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-album-card__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem 0.75rem;
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.6;
}

@media (prefers-reduced-motion: reduce) {
  .photo-album-card__image {
    transition: none;
  }

  .photo-album-card:hover .photo-album-card__image {
    transform: none;
  }
}
</style>
