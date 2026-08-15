<script setup lang="ts">
import { shallowRef } from 'vue';

const props = withDefaults(defineProps<{
  previewSrc: string;
  fit?: 'cover' | 'contain';
}>(), {
  fit: 'cover',
});

const emit = defineEmits<{
  open: [];
}>();

const state = shallowRef<'loading' | 'ready' | 'error'>('loading');

function markPreviewReady(): void {
  state.value = 'ready';
}

function exposePreviewError(): void {
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
      class="progressive-video__cover"
      type="button"
      aria-label="打开视频详情"
      @click="emit('open')"
    >
      <img
        class="progressive-video__preview"
        :src="previewSrc"
        alt=""
        aria-hidden="true"
        loading="eager"
        draggable="false"
        @load="markPreviewReady"
        @error="exposePreviewError"
      >
      <span class="progressive-video__play" aria-hidden="true" />
    </button>
  </span>
</template>

<style scoped>
.progressive-video {
  position: relative;
  display: grid;
  overflow: hidden;
}

.progressive-video__cover {
  display: block;
  width: 100%;
  height: 100%;
  grid-area: 1 / 1;
}

.progressive-video--cover .progressive-video__preview {
  object-fit: cover;
}

.progressive-video--contain .progressive-video__preview {
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
  z-index: 3;
  display: grid;
  top: 0.6rem;
  right: 0.6rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: rgb(255 255 255 / 24%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 18%);
  backdrop-filter: blur(4px);
  place-items: center;
}

.progressive-video__play::before {
  width: 0;
  height: 0;
  border-top: 0.24rem solid transparent;
  border-bottom: 0.24rem solid transparent;
  border-left: 0.36rem solid #fff;
  content: '';
  transform: translateX(0.04rem);
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
