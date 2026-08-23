<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted } from 'vue';
import { usePhotoLightbox } from '../../composables/usePhotoLightbox';
import { usePhotoLibraryStore } from '../../stores/photoLibrary';
import JournalLoading from '../ui/JournalLoading.vue';
import FeaturedPhotoStrip from './FeaturedPhotoStrip.vue';
import PhotoAlbumGrid from './PhotoAlbumGrid.vue';

defineOptions({ name: 'PhotoLibraryView' });

const emit = defineEmits<{
  layoutReady: [];
}>();

const store = usePhotoLibraryStore();
const { overview, overviewLoading, overviewError } = storeToRefs(store);
const featured = computed(() => overview.value?.featured ?? []);
const lightbox = usePhotoLightbox(featured);
let active = true;

onMounted(async () => {
  await store.ensureOverview();
  if (!active) return;
  await nextTick();
  if (!active) return;
  emit('layoutReady');
});

onBeforeUnmount(() => {
  active = false;
  lightbox.destroy();
});
</script>

<template>
  <main class="photo-library-view">
    <header class="photo-library-view__header">
      <p class="photo-library-view__eyebrow">PHOTOGRAPHY</p>
      <h1 class="photo-library-view__title">照片墙</h1>
      <p class="photo-library-view__description">
        把途中遇见的光、风景和生活片段，留在这里慢慢回看。
      </p>
    </header>

    <JournalLoading
      v-if="overviewLoading && !overview"
      variant="canvas"
      label="正在整理照片…"
    />

    <section
      v-else-if="overviewError && !overview"
      class="photo-library-view__state photo-library-view__state--error"
      role="alert"
    >
      <h2>照片墙没有加载完成</h2>
      <p>{{ overviewError }}</p>
    </section>

    <div v-else-if="overview" class="photo-library-view__content">
      <section class="photo-library-view__featured" aria-labelledby="featured-photos-title">
        <div class="photo-library-view__section-heading">
          <p>RECENT FRAMES</p>
          <h2 id="featured-photos-title">近期精选</h2>
        </div>
        <FeaturedPhotoStrip
          :photos="overview.featured"
          @open-photo="lightbox.open"
        />
      </section>

      <section class="photo-library-view__albums" aria-labelledby="photo-albums-title">
        <div class="photo-library-view__section-heading">
          <p>ALBUMS</p>
          <h2 id="photo-albums-title">按相册浏览</h2>
        </div>
        <PhotoAlbumGrid :albums="overview.albums" />
      </section>
    </div>
  </main>
</template>

<style scoped>
.photo-library-view {
  width: 100%;
  padding: clamp(2rem, 5vw, 4.5rem) 0 5rem;
}

.photo-library-view__header,
.photo-library-view__albums,
.photo-library-view__state {
  width: min(calc(100% - (var(--page-gutter) * 2)), 1220px);
  margin-right: auto;
  margin-left: auto;
}

.photo-library-view__header {
  display: grid;
  gap: 0.5rem;
  margin-bottom: clamp(2.4rem, 5vw, 4rem);
}

.photo-library-view__eyebrow,
.photo-library-view__title,
.photo-library-view__description,
.photo-library-view__section-heading p,
.photo-library-view__section-heading h2,
.photo-library-view__state h2,
.photo-library-view__state p {
  margin: 0;
}

.photo-library-view__eyebrow,
.photo-library-view__section-heading p {
  color: var(--accent-strong);
  font-size: 0.66rem;
  font-weight: 780;
  letter-spacing: 0.2em;
}

.photo-library-view__title,
.photo-library-view__section-heading h2,
.photo-library-view__state h2 {
  font-family: var(--font-serif);
}

.photo-library-view__title {
  font-size: clamp(1.9rem, 4vw, 2.8rem);
  line-height: 1.24;
}

.photo-library-view__description {
  max-width: 34rem;
  color: var(--text-muted);
  font-family: var(--font-serif);
  font-size: 0.9rem;
  line-height: 1.8;
}

.photo-library-view__content {
  display: grid;
  gap: clamp(4rem, 8vw, 7rem);
}

.photo-library-view__featured {
  display: grid;
  gap: 1.25rem;
}

.photo-library-view__section-heading {
  display: grid;
  width: min(calc(100% - (var(--page-gutter) * 2)), 1220px);
  margin: 0 auto;
  gap: 0.28rem;
}

.photo-library-view__section-heading h2 {
  font-size: clamp(1.22rem, 2.2vw, 1.65rem);
}

.photo-library-view__albums {
  display: grid;
  gap: 1.5rem;
}

.photo-library-view__albums .photo-library-view__section-heading {
  width: 100%;
}

.photo-library-view__state {
  display: grid;
  min-height: 20rem;
  align-content: center;
  gap: 0.65rem;
  padding: clamp(1.4rem, 4vw, 2.2rem);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.photo-library-view__state h2 {
  font-size: 1.15rem;
}

.photo-library-view__state p {
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.7;
}

.photo-library-view__state--error {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border-subtle));
}

.photo-library-view__state--error h2,
.photo-library-view__state--error p {
  color: var(--danger);
}

@media (max-width: 599px) {
  .photo-library-view {
    padding: 1.5rem 0 4rem;
  }

  .photo-library-view__header {
    margin-bottom: 2.6rem;
  }

  .photo-library-view__content {
    gap: 4.5rem;
  }
}
</style>
