<script setup lang="ts">
import { shallowRef, watch } from 'vue';

const props = withDefaults(defineProps<{
  src: string;
  previewSrc: string;
  fit?: 'cover' | 'contain';
}>(), {
  fit: 'cover',
});

const state = shallowRef<'loading' | 'loaded' | 'error'>('loading');
const previewReady = shallowRef(false);
const videoReady = shallowRef(false);

watch([() => props.src, () => props.previewSrc], () => {
  state.value = 'loading';
  previewReady.value = false;
  videoReady.value = false;
});

function revealWhenReady(): void {
  if (previewReady.value && videoReady.value) state.value = 'loaded';
}

function markPreviewReady(): void {
  previewReady.value = true;
  revealWhenReady();
}

function markVideoReady(): void {
  videoReady.value = true;
  revealWhenReady();
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
    <img
      class="progressive-video__preview"
      :src="previewSrc"
      alt=""
      aria-hidden="true"
      loading="eager"
      draggable="false"
      @load="markPreviewReady"
    >
    <video
      class="progressive-video__media"
      :src="src"
      :poster="previewSrc"
      controls
      preload="metadata"
      @loadeddata="markVideoReady"
      @error="exposeVideoError"
    />
  </span>
</template>

<style scoped>
.progressive-video {
  position: relative;
  display: grid;
  overflow: hidden;
}

.progressive-video__preview,
.progressive-video__media {
  display: block;
  width: 100%;
  height: 100%;
  grid-area: 1 / 1;
}

.progressive-video--cover .progressive-video__preview,
.progressive-video--cover .progressive-video__media {
  object-fit: cover;
}

.progressive-video--contain .progressive-video__preview,
.progressive-video--contain .progressive-video__media {
  object-fit: contain;
}

.progressive-video__preview {
  filter: blur(14px);
  opacity: 1;
  transform: scale(1.06);
}

.progressive-video__media {
  opacity: 0;
  pointer-events: none;
}

.progressive-video--loaded .progressive-video__preview {
  opacity: 0;
  animation: progressive-video-preview-hide 320ms ease both;
}

.progressive-video--loaded .progressive-video__media {
  opacity: 1;
  pointer-events: auto;
  animation: progressive-video-media-reveal 320ms ease both;
}

.progressive-video--error .progressive-video__preview {
  opacity: 0;
}

.progressive-video--error .progressive-video__media {
  opacity: 1;
  pointer-events: auto;
}

@keyframes progressive-video-preview-hide {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes progressive-video-media-reveal {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .progressive-video__preview,
  .progressive-video__media {
    animation: none;
  }
}
</style>
