<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted } from 'vue';
import { usePhotoLightbox } from '../../composables/usePhotoLightbox';
import { usePhotoLibraryStore } from '../../stores/photoLibrary';
import JournalLoading from '../ui/JournalLoading.vue';
import FeaturedPhotoStrip from './FeaturedPhotoStrip.vue';
import PhotoAlbumGrid from './PhotoAlbumGrid.vue';
import PhotoHeroBillboard from './PhotoHeroBillboard.vue';

defineOptions({ name: 'PhotoLibraryView' });

const emit = defineEmits<{
  layoutReady: [];
}>();

const store = usePhotoLibraryStore();
const { overview, overviewLoading, overviewError } = storeToRefs(store);
const featured = computed(() => overview.value?.featured ?? []);
const heroPhoto = computed(() => featured.value[0] ?? null);
const stripPhotos = computed(() => featured.value.slice(1));
const lightbox = usePhotoLightbox(featured);
let active = true;

function openHeroPhoto(): void {
  lightbox.open(0);
}

function openStripPhoto(index: number): void {
  lightbox.open(index + 1);
}

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
      <h1>照片墙没有加载完成</h1>
      <p>{{ overviewError }}</p>
    </section>

    <div v-else-if="overview" class="photo-library-view__content">
      <PhotoHeroBillboard
        v-if="heroPhoto"
        :photo="heroPhoto"
        @open-photo="openHeroPhoto"
      />

      <section
        v-if="stripPhotos.length > 0"
        class="photo-library-view__featured"
        aria-labelledby="featured-photos-title"
      >
        <div class="photo-library-view__section-heading">
          <p>RECENT FRAMES</p>
          <h2 id="featured-photos-title">近期精选</h2>
        </div>
        <FeaturedPhotoStrip
          :photos="stripPhotos"
          @open-photo="openStripPhoto"
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
  min-height: 100%;
  padding: 0 0 clamp(1.2rem, 2.5vw, 2rem);
  background: var(--photo-canvas);
  color: var(--photo-text-primary);
}

.photo-library-view__albums,
.photo-library-view__state {
  width: calc(100% - (var(--photo-edge) * 2));
  margin-right: auto;
  margin-left: auto;
}

.photo-library-view__section-heading p,
.photo-library-view__section-heading h2,
.photo-library-view__state h1,
.photo-library-view__state p {
  margin: 0;
}

.photo-library-view__section-heading p {
  color: var(--accent-strong);
  font-size: 0.66rem;
  font-weight: 780;
  letter-spacing: 0.2em;
}

.photo-library-view__section-heading h2,
.photo-library-view__state h1 {
  font-family: var(--font-serif);
}

.photo-library-view__content {
  display: grid;
  gap: clamp(1.5rem, 2.6vw, 2.6rem);
}

.photo-library-view__featured {
  display: grid;
  gap: 0.85rem;
}

.photo-library-view__section-heading {
  display: grid;
  width: calc(100% - (var(--photo-edge) * 2));
  margin: 0 auto;
  gap: 0.22rem;
}

.photo-library-view__section-heading h2 {
  font-size: clamp(1.22rem, 2.2vw, 1.65rem);
}

.photo-library-view__albums {
  display: grid;
  gap: 1rem;
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

.photo-library-view__state h1 {
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

.photo-library-view__state--error h1,
.photo-library-view__state--error p {
  color: var(--danger);
}

@media (max-width: 599px) {
  .photo-library-view {
    padding-bottom: 1.5rem;
  }

  .photo-library-view__content {
    gap: 1.6rem;
  }
}
</style>
