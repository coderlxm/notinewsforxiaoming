<script setup lang="ts">
import { shallowRef, watch } from 'vue';

const props = withDefaults(defineProps<{
  src: string;
  previewSrc: string;
  fit?: 'cover' | 'contain';
}>(), {
  fit: 'cover',
});

const state = shallowRef<'loading' | 'ready' | 'playing' | 'error'>('loading');

watch([() => props.src, () => props.previewSrc], () => {
  state.value = 'loading';
});

function markPreviewReady(): void {
  state.value = 'ready';
}

function playVideo(): void {
  state.value = 'playing';
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
    <button
      v-if="state === 'loading' || state === 'ready'"
      class="progressive-video__cover"
      type="button"
      :disabled="state === 'loading'"
      aria-label="播放视频"
      @click="playVideo"
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
      <span class="progressive-video__play" aria-hidden="true">▶</span>
    </button>
    <video
      v-else
      class="progressive-video__media"
      :src="src"
      :poster="previewSrc"
      controls
      autoplay
      preload="metadata"
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

.progressive-video__cover,
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

.progressive-video__cover {
  position: relative;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: var(--surface-muted);
  color: #fff;
  cursor: pointer;
}

.progressive-video__cover:disabled {
  cursor: default;
}

.progressive-video__preview {
  display: block;
  width: 100%;
  height: 100%;
  filter: blur(14px);
  object-fit: inherit;
  transform: scale(1.06);
}

.progressive-video--ready .progressive-video__preview {
  filter: none;
  transform: none;
  animation: progressive-video-cover-reveal 320ms ease both;
}

.progressive-video__play {
  position: absolute;
  display: grid;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: rgb(20 20 18 / 66%);
  box-shadow: 0 0 0 1px rgb(255 255 255 / 32%);
  font-size: 0.9rem;
  inset: 50% auto auto 50%;
  place-items: center;
  transform: translate(-50%, -50%);
}

@keyframes progressive-video-cover-reveal {
  from {
    filter: blur(14px);
    transform: scale(1.06);
  }
}

@media (prefers-reduced-motion: reduce) {
  .progressive-video__preview {
    animation: none;
  }
}
</style>
