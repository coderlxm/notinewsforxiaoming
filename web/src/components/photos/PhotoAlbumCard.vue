<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { PhotoAlbumSummary } from '../../../../src/shared/photoLibraryProtocol';
import JournalProgressiveImage from '../ui/JournalProgressiveImage.vue';

const props = defineProps<{
  album: PhotoAlbumSummary;
}>();

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
    <JournalProgressiveImage
      class="photo-album-card__image"
      :src="album.cover.card.url"
      :preview-src="album.cover.preview.url"
      :alt="`${album.name}相册封面：${album.cover.title}`"
      fit="cover"
      loading="lazy"
    />
    <span class="photo-album-card__copy">
      <strong class="photo-album-card__name">{{ album.name }}</strong>
      <span class="photo-album-card__summary">
        <span>{{ album.photoCount }} 张照片</span>
        <span v-if="dateRange" class="photo-album-card__date">{{ dateRange }}</span>
      </span>
    </span>
  </RouterLink>
</template>

<style scoped>
.photo-album-card {
  position: relative;
  display: block;
  min-width: 0;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border: 1px solid var(--photo-border);
  border-radius: 6px;
  background: var(--photo-surface);
  color: var(--photo-text-primary);
  box-shadow: 0 0 0 rgb(0 0 0 / 0%);
  text-decoration: none;
  transition: transform 220ms var(--ease-card), box-shadow 220ms ease, border-color 160ms ease;
}

.photo-album-card__image {
  width: 100%;
  height: 100%;
  transition: transform 300ms var(--ease-card);
}

.photo-album-card::after {
  position: absolute;
  background: linear-gradient(transparent 28%, rgb(4 4 4 / 86%) 100%);
  pointer-events: none;
  content: '';
  inset: 0;
}

.photo-album-card__copy {
  position: absolute;
  z-index: 1;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  min-width: 0;
  gap: 0.2rem;
  padding: clamp(0.6rem, 1.2vw, 0.9rem);
  pointer-events: none;
}

.photo-album-card__name {
  overflow: hidden;
  font-family: var(--font-serif);
  font-size: clamp(0.82rem, 1.35vw, 1.05rem);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-album-card__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.6rem;
  color: var(--photo-text-secondary);
  font-size: 0.62rem;
  line-height: 1.45;
}

.photo-album-card__date {
  opacity: 0.62;
  transition: opacity 180ms ease;
}

.photo-album-card:focus-visible {
  border-color: rgb(255 255 255 / 16%);
  box-shadow: 0 14px 30px rgb(0 0 0 / 52%);
}

.photo-album-card:focus-visible .photo-album-card__image {
  transform: scale(1.025);
}

.photo-album-card:focus-visible .photo-album-card__date {
  opacity: 1;
}

@media (hover: hover) {
  .photo-album-card:hover {
    border-color: rgb(255 255 255 / 16%);
    box-shadow: 0 14px 30px rgb(0 0 0 / 52%);
    transform: translateY(-2px);
  }

  .photo-album-card:hover .photo-album-card__image {
    transform: scale(1.025);
  }

  .photo-album-card:hover .photo-album-card__date {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .photo-album-card,
  .photo-album-card__date,
  .photo-album-card__image {
    transition: none;
  }

  .photo-album-card:hover,
  .photo-album-card:focus-visible .photo-album-card__image,
  .photo-album-card:hover .photo-album-card__image {
    transform: none;
  }
}
</style>
