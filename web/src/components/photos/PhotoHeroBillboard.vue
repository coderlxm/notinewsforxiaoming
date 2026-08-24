<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { PhotoLibraryPhoto } from '../../../../src/shared/photoLibraryProtocol';
import JournalProgressiveImage from '../ui/JournalProgressiveImage.vue';

const props = defineProps<{
  photo: PhotoLibraryPhoto;
}>();

const emit = defineEmits<{
  openPhoto: [];
}>();

const metadataItems = computed(() => [
  props.photo.metadata.takenAt
    ? dayjs(props.photo.metadata.takenAt).format('YYYY.MM.DD')
    : null,
  props.photo.metadata.camera,
  props.photo.metadata.lens,
].filter((value): value is string => value !== null));
</script>

<template>
  <section class="photo-hero" aria-labelledby="photo-library-title">
    <button
      class="photo-hero__surface"
      type="button"
      :aria-label="`查看焦点照片：${photo.title}`"
      @click="emit('openPhoto')"
    >
      <JournalProgressiveImage
        class="photo-hero__image"
        :src="photo.view.url"
        :preview-src="photo.preview.url"
        :alt="photo.title"
        fit="cover"
        loading="eager"
      />
    </button>

    <div class="photo-hero__copy">
      <p class="photo-hero__eyebrow">PHOTOGRAPHY</p>
      <h1 id="photo-library-title" class="photo-hero__title">照片墙</h1>
      <p class="photo-hero__description">
        把途中遇见的光、风景和生活片段，留在这里慢慢回看。
      </p>
      <p class="photo-hero__photo-title">{{ photo.title }}</p>
      <div v-if="metadataItems.length > 0" class="photo-hero__metadata" aria-label="焦点照片信息">
        <span v-for="(item, index) in metadataItems" :key="`${index}:${item}`">{{ item }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.photo-hero {
  position: relative;
  width: 100%;
  height: clamp(20rem, 44vh, 32rem);
  overflow: hidden;
  background: var(--photo-surface);
}

.photo-hero::before,
.photo-hero::after {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  content: '';
  inset: 0;
}

.photo-hero::before {
  background: linear-gradient(
    to top,
    var(--photo-canvas) 0%,
    rgb(12 12 12 / 82%) 22%,
    rgb(12 12 12 / 26%) 58%,
    transparent 82%
  );
}

.photo-hero::after {
  background:
    radial-gradient(circle at 50% 42%, transparent 46%, rgb(0 0 0 / 34%) 100%),
    linear-gradient(to right, rgb(0 0 0 / 34%), transparent 45%);
}

.photo-hero__surface,
.photo-hero__image {
  width: 100%;
  height: 100%;
}

.photo-hero__surface {
  position: absolute;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
  inset: 0;
}

.photo-hero__surface:focus-visible {
  outline-offset: -4px;
}

.photo-hero__copy {
  position: absolute;
  z-index: 2;
  bottom: clamp(1.5rem, 3vw, 2.6rem);
  left: var(--photo-edge);
  display: grid;
  width: min(38rem, calc(100% - (var(--photo-edge) * 2)));
  gap: 0.45rem;
  pointer-events: none;
}

.photo-hero__eyebrow,
.photo-hero__title,
.photo-hero__description,
.photo-hero__photo-title {
  margin: 0;
}

.photo-hero__eyebrow {
  color: var(--accent-strong);
  font-size: 0.67rem;
  font-weight: 800;
  letter-spacing: 0.24em;
}

.photo-hero__title {
  color: var(--photo-text-primary);
  font-family: var(--font-serif);
  font-size: clamp(2.1rem, 4.2vw, 3.5rem);
  line-height: 1.15;
  text-shadow: 0 0.15rem 1.5rem rgb(0 0 0 / 55%);
}

.photo-hero__description {
  max-width: 34rem;
  color: var(--photo-text-secondary);
  font-family: var(--font-serif);
  font-size: clamp(0.78rem, 1.2vw, 0.92rem);
  line-height: 1.7;
}

.photo-hero__photo-title {
  margin-top: 0.25rem;
  color: var(--photo-text-primary);
  font-size: 0.76rem;
  font-weight: 680;
  letter-spacing: 0.02em;
}

.photo-hero__metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.photo-hero__metadata span {
  padding: 0.28rem 0.52rem;
  border: 1px solid var(--photo-border);
  border-radius: 999px;
  background: rgb(16 16 16 / 62%);
  color: var(--photo-text-secondary);
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.025em;
}

@media (max-width: 599px) {
  .photo-hero {
    height: clamp(18rem, 42vh, 26rem);
  }

  .photo-hero__copy {
    bottom: 1.75rem;
    gap: 0.42rem;
  }

  .photo-hero__title {
    font-size: clamp(1.9rem, 10vw, 2.7rem);
  }

  .photo-hero__description {
    max-width: 25rem;
    line-height: 1.55;
  }
}
</style>
