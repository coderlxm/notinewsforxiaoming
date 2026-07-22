<script setup lang="ts">
import { shallowRef, watch } from 'vue';

const props = withDefaults(defineProps<{
  src: string;
  fit?: 'cover' | 'contain';
}>(), {
  fit: 'cover',
});

const state = shallowRef<'loading' | 'loaded' | 'error'>('loading');

watch(() => props.src, () => {
  state.value = 'loading';
});

function revealVideo(): void {
  state.value = 'loaded';
}

function exposeVideoError(): void {
  state.value = 'error';
}
</script>

<template>
  <span
    class="progressive-video"
    :class="[`progressive-video--${fit}`, `progressive-video--${state}`]"
    :aria-busy="state === 'loading'"
  >
    <video
      class="progressive-video__media"
      :src="src"
      controls
      preload="metadata"
      @loadeddata="revealVideo"
      @error="exposeVideoError"
    />
  </span>
</template>

<style scoped>
.progressive-video {
  position: relative;
  display: block;
  overflow: hidden;
}

.progressive-video__media {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}

.progressive-video--cover .progressive-video__media {
  object-fit: cover;
}

.progressive-video--contain .progressive-video__media {
  object-fit: contain;
}

.progressive-video--loaded .progressive-video__media,
.progressive-video--error .progressive-video__media {
  opacity: 1;
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .progressive-video__media {
    transition-duration: 0ms;
  }
}
</style>
