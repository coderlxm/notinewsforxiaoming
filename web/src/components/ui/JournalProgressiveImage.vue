<script setup lang="ts">
import { shallowRef, watch } from 'vue';

const props = withDefaults(defineProps<{
  src: string;
  previewSrc: string;
  alt: string;
  fit: 'cover' | 'contain';
  loading?: 'eager' | 'lazy';
}>(), {
  loading: 'lazy',
});

const state = shallowRef<'loading' | 'loaded' | 'error'>('loading');

watch(() => props.src, () => {
  state.value = 'loading';
});

function revealImage(): void {
  state.value = 'loaded';
}

function exposeImageError(): void {
  state.value = 'error';
}
</script>

<template>
  <span
    class="progressive-image"
    :class="[`progressive-image--${fit}`, `progressive-image--${state}`]"
    :aria-busy="state === 'loading'"
  >
    <img
      class="progressive-image__preview"
      :src="previewSrc"
      alt=""
      aria-hidden="true"
      :loading="loading"
      draggable="false"
    >
    <img
      class="progressive-image__original"
      :src="src"
      :alt="alt"
      :loading="loading"
      @load="revealImage"
      @error="exposeImageError"
    >
  </span>
</template>

<style scoped>
.progressive-image {
  position: relative;
  display: block;
  overflow: hidden;
}

.progressive-image__preview,
.progressive-image__original {
  position: absolute;
  display: block;
  width: 100%;
  height: 100%;
  inset: 0;
}

.progressive-image--cover .progressive-image__preview,
.progressive-image--cover .progressive-image__original {
  object-fit: cover;
}

.progressive-image--contain .progressive-image__preview,
.progressive-image--contain .progressive-image__original {
  object-fit: contain;
}

.progressive-image__preview {
  filter: blur(14px);
  opacity: 1;
  transform: scale(1.06);
  transition: opacity 220ms ease;
}

.progressive-image__original {
  opacity: 0;
  transition: opacity 280ms ease;
}

.progressive-image--loaded .progressive-image__preview,
.progressive-image--error .progressive-image__preview {
  opacity: 0;
}

.progressive-image--loaded .progressive-image__original,
.progressive-image--error .progressive-image__original {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .progressive-image__preview,
  .progressive-image__original {
    transition-duration: 0ms;
  }
}
</style>
