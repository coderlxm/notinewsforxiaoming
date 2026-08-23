<script setup lang="ts">
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, watch } from 'vue';
import { usePhotoLibraryStore } from '../../stores/photoLibrary';
import JournalLoading from '../ui/JournalLoading.vue';
import PhotoJustifiedGallery from './PhotoJustifiedGallery.vue';

defineOptions({ name: 'PhotoAlbumView' });

const props = defineProps<{
  albumId: string;
}>();

const emit = defineEmits<{
  layoutReady: [];
}>();

const store = usePhotoLibraryStore();
const { albumsById, albumLoadingIds, albumErrorsById } = storeToRefs(store);
const album = computed(() => albumsById.value.get(props.albumId) ?? null);
const loading = computed(() => albumLoadingIds.value.has(props.albumId) && album.value === null);
const error = computed(() => albumErrorsById.value.get(props.albumId) ?? null);
const dateRange = computed(() => {
  const startValue = album.value?.album.takenAtStart;
  const endValue = album.value?.album.takenAtEnd;
  if (!startValue || !endValue) return null;

  const start = dayjs(startValue).format('YYYY年M月D日');
  const end = dayjs(endValue).format('YYYY年M月D日');
  return start === end ? start : `${start} — ${end}`;
});

let activeRequest = 0;

watch(() => props.albumId, async (albumId) => {
  const request = ++activeRequest;
  document.title = '照片墙 · 小明同学';
  await store.ensureAlbum(albumId);
  if (request !== activeRequest || albumId !== props.albumId) return;

  const detail = albumsById.value.get(albumId);
  if (detail) {
    document.title = `${detail.album.name} · 照片墙 · 小明同学`;
    return;
  }

  await nextTick();
  if (request === activeRequest && albumId === props.albumId) emit('layoutReady');
}, { immediate: true });

onBeforeUnmount(() => {
  activeRequest++;
});
</script>

<template>
  <main class="photo-album-view">
    <JournalLoading
      v-if="loading"
      variant="canvas"
      label="正在整理相册…"
    />

    <section
      v-else-if="error"
      class="photo-album-view__state photo-album-view__state--error"
      role="alert"
    >
      <h1>相册没有加载完成</h1>
      <p>{{ error }}</p>
      <RouterLink to="/photos">返回照片墙</RouterLink>
    </section>

    <div v-else-if="album" class="photo-album-view__content">
      <header class="photo-album-view__header">
        <RouterLink class="photo-album-view__back" to="/photos">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
          </svg>
          返回照片墙
        </RouterLink>
        <p class="photo-album-view__eyebrow">PHOTO ALBUM</p>
        <h1 class="photo-album-view__title">{{ album.album.name }}</h1>
        <p class="photo-album-view__summary">
          <span>{{ album.album.photoCount }} 张照片</span>
          <span v-if="dateRange">{{ dateRange }}</span>
        </p>
      </header>

      <PhotoJustifiedGallery
        :key="album.album.id"
        :photos="album.photos"
        @layout-ready="emit('layoutReady')"
      />
    </div>
  </main>
</template>

<style scoped>
.photo-album-view {
  width: min(calc(100% - (var(--page-gutter) * 2)), 1320px);
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 4.5rem) 0 5rem;
}

.photo-album-view__content {
  display: grid;
  gap: clamp(2.2rem, 5vw, 4rem);
}

.photo-album-view__header {
  display: grid;
  gap: 0.42rem;
}

.photo-album-view__back {
  display: inline-flex;
  width: max-content;
  align-items: center;
  gap: 0.22rem;
  margin-bottom: 1.4rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-decoration: none;
}

.photo-album-view__back:hover {
  color: var(--accent-strong);
}

.photo-album-view__back svg {
  width: 1rem;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.photo-album-view__eyebrow,
.photo-album-view__title,
.photo-album-view__summary,
.photo-album-view__state h1,
.photo-album-view__state p {
  margin: 0;
}

.photo-album-view__eyebrow {
  color: var(--accent-strong);
  font-size: 0.66rem;
  font-weight: 780;
  letter-spacing: 0.2em;
}

.photo-album-view__title,
.photo-album-view__state h1 {
  font-family: var(--font-serif);
}

.photo-album-view__title {
  font-size: clamp(1.8rem, 4vw, 2.7rem);
  line-height: 1.28;
}

.photo-album-view__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.9rem;
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.7;
}

.photo-album-view__state {
  display: grid;
  min-height: 22rem;
  align-content: center;
  gap: 0.65rem;
  padding: clamp(1.4rem, 4vw, 2.2rem);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.photo-album-view__state h1 {
  font-size: 1.2rem;
}

.photo-album-view__state p,
.photo-album-view__state a {
  font-size: 0.8rem;
  line-height: 1.7;
}

.photo-album-view__state--error {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border-subtle));
}

.photo-album-view__state--error h1,
.photo-album-view__state--error p {
  color: var(--danger);
}

@media (max-width: 599px) {
  .photo-album-view {
    padding: 1.5rem 0 4rem;
  }

  .photo-album-view__back {
    margin-bottom: 1rem;
  }
}
</style>
