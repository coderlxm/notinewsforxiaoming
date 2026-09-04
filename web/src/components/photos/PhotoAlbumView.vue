<script setup lang="ts" name="PhotoAlbumView">
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, watch } from 'vue';
import { usePhotoLibraryStore } from '../../stores/photoLibrary';
import JournalLoading from '../ui/JournalLoading.vue';
import PhotoAlbumFloatingToolbar from './PhotoAlbumFloatingToolbar.vue';
import PhotoJustifiedGallery from './PhotoJustifiedGallery.vue';

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
      <PhotoAlbumFloatingToolbar
        :name="album.album.name"
        :photo-count="album.album.photoCount"
        :date-range="dateRange"
      />

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
  width: 100%;
  min-height: 100%;
  padding:
    0
    max(var(--photo-edge), env(safe-area-inset-right))
    clamp(3.5rem, 7vw, 6rem)
    max(var(--photo-edge), env(safe-area-inset-left));
  background: var(--photo-canvas);
  color: var(--photo-text-primary);
}

.photo-album-view__content {
  position: relative;
}

.photo-album-view__state {
  display: grid;
  width: min(42rem, 100%);
  min-height: 22rem;
  align-content: center;
  gap: 0.65rem;
  margin: clamp(2rem, 5vw, 4.5rem) auto 0;
  padding: clamp(1.4rem, 4vw, 2.2rem);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.photo-album-view__state h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.2rem;
}

.photo-album-view__state p {
  margin: 0;
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
    padding-bottom: 3.5rem;
  }
}
</style>
