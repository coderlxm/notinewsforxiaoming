<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue';
import type { CSSProperties } from 'vue';
import type { JournalAsset } from '../../types';
import { resolveJournalMediaType } from '../../utils/journalMedia';

const props = defineProps<{
  assets: readonly JournalAsset[];
}>();

const emit = defineEmits<{
  aspectRatioChange: [aspectRatio: number | null];
}>();

type StageAsset = JournalAsset & {
  mediaType: 'image' | 'video';
};

const currentIndex = shallowRef(0);
const videoReady = shallowRef(false);
const activeVideo = useTemplateRef<HTMLVideoElement>('activeVideo');

const stageAssets = computed<StageAsset[]>(() => props.assets.map((asset) => ({
  ...asset,
  mediaType: resolveJournalMediaType(asset) === 'video' ? 'video' : 'image',
})));
const currentAsset = computed(() => stageAssets.value[currentIndex.value]);
const positionLabel = computed(() => `${currentIndex.value + 1} / ${stageAssets.value.length}`);
const currentAdaptiveAspectRatio = computed(() => {
  const asset = currentAsset.value;
  if (!asset || asset.mediaType !== 'image' || asset.kind === 'sticker' || !asset.width || !asset.height) return null;
  const ratio = asset.width / asset.height;
  return ratio >= 0.45 && ratio <= 2.2 ? ratio : null;
});
const stageStyle = computed<CSSProperties>(() => currentAdaptiveAspectRatio.value
  ? { '--media-stage-aspect-ratio': String(currentAdaptiveAspectRatio.value) }
  : {});
const currentAssetFullBleed = computed(() => currentAdaptiveAspectRatio.value !== null);

watch(currentAdaptiveAspectRatio, (aspectRatio) => {
  emit('aspectRatioChange', aspectRatio);
}, { immediate: true });

watch(() => currentAsset.value?.id, () => {
  videoReady.value = currentAsset.value?.mediaType !== 'video';
}, { immediate: true });

function goTo(index: number): void {
  if (index === currentIndex.value) return;
  activeVideo.value?.pause();
  currentIndex.value = index;
}

function previous(): void {
  goTo(currentIndex.value - 1);
}

function next(): void {
  goTo(currentIndex.value + 1);
}

function revealVideo(): void {
  videoReady.value = true;
}

function handleKeyboard(event: KeyboardEvent): void {
  if (event.target instanceof HTMLMediaElement) return;
  if (event.key === 'ArrowLeft' && currentIndex.value > 0) {
    event.preventDefault();
    previous();
  }
  if (event.key === 'ArrowRight' && currentIndex.value < stageAssets.value.length - 1) {
    event.preventDefault();
    next();
  }
}

onBeforeUnmount(() => activeVideo.value?.pause());
</script>

<template>
  <section
    class="media-stage"
    :class="{ 'media-stage--adaptive-image': currentAssetFullBleed }"
    :style="stageStyle"
    aria-label="视觉媒体"
    tabindex="0"
    @keydown="handleKeyboard"
  >
    <div v-if="currentAsset" class="media-stage__viewport">
      <div
        :key="currentAsset.id"
        class="media-stage__item"
        :class="{
          'media-stage__item--sticker': currentAsset.kind === 'sticker',
          'media-stage__item--round': currentAsset.kind === 'video_note',
          'media-stage__item--full-bleed': currentAssetFullBleed,
          'media-stage__item--contained': !currentAssetFullBleed,
        }"
      >
        <img
          v-if="currentAsset.mediaType === 'image'"
          class="media-stage__media media-stage__image"
          :src="currentAsset.url"
          alt=""
          draggable="false"
        >
        <video
          v-else
          ref="activeVideo"
          class="media-stage__media media-stage__video"
          :class="{ 'media-stage__video--ready': videoReady }"
          :src="currentAsset.url"
          :poster="currentAsset.previewUrl!"
          autoplay
          controls
          muted
          playsinline
          preload="auto"
          :aria-busy="!videoReady"
          @loadeddata="revealVideo"
        />
      </div>
    </div>

    <footer v-if="stageAssets.length > 1" class="media-stage__controls">
      <div class="media-stage__pager">
        <button
          class="media-stage__arrow"
          type="button"
          aria-label="上一项媒体"
          :disabled="currentIndex === 0"
          @click="previous"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span class="media-stage__position" aria-live="polite">{{ positionLabel }}</span>
        <button
          class="media-stage__arrow"
          type="button"
          aria-label="下一项媒体"
          :disabled="currentIndex === stageAssets.length - 1"
          @click="next"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div class="media-stage__thumbnails" aria-label="选择媒体">
        <button
          v-for="(asset, index) in stageAssets"
          :key="asset.id"
          class="media-stage__thumbnail"
          :class="{ 'media-stage__thumbnail--active': index === currentIndex }"
          type="button"
          :aria-label="`查看第 ${index + 1} 项媒体`"
          :aria-current="index === currentIndex ? 'true' : undefined"
          @click="goTo(index)"
        >
          <img :src="asset.previewUrl" alt="" loading="lazy">
          <span v-if="asset.mediaType === 'video'" class="media-stage__video-mark" aria-hidden="true">
            ▶
          </span>
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.media-stage {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
  background: #20201e;
  color: #f7f7f5;
  outline: none;
}

.media-stage:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.media-stage__viewport {
  display: grid;
  min-height: 0;
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  overflow: hidden;
}

.media-stage__item {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template: minmax(0, 1fr) / minmax(0, 1fr);
  overflow: hidden;
  place-items: center;
  animation: media-stage-enter 160ms ease-out;
}

.media-stage__media {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-area: 1 / 1;
  object-fit: contain;
}

.media-stage__item--contained {
  padding: clamp(20px, 3vw, 48px);
}

.media-stage__item--full-bleed .media-stage__media {
  object-fit: contain;
}

.media-stage__video {
  pointer-events: none;
}

.media-stage__video--ready {
  pointer-events: auto;
}

.media-stage__item--sticker .media-stage__media {
  width: min(72%, 440px);
  height: min(72%, 440px);
  max-width: min(72%, 440px);
  max-height: min(72%, 440px);
  object-fit: contain;
}

.media-stage__item--round .media-stage__media {
  width: min(72%, 520px);
  height: auto;
  aspect-ratio: 1;
  border-radius: 50%;
  object-fit: cover;
}

.media-stage__controls {
  display: grid;
  height: 130px;
  gap: 10px;
  padding: 12px 20px 16px;
  background: linear-gradient(to top, rgb(0 0 0 / 34%), transparent);
}

.media-stage__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.media-stage__arrow {
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 50%;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  cursor: pointer;
  place-items: center;
}

.media-stage__arrow svg {
  display: block;
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.6;
}

.media-stage__arrow:hover:not(:disabled) {
  background: rgb(255 255 255 / 16%);
}

.media-stage__arrow:focus-visible,
.media-stage__thumbnail:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.media-stage__arrow:disabled {
  cursor: default;
  opacity: 0.32;
}

.media-stage__position {
  min-width: 4rem;
  color: rgb(255 255 255 / 82%);
  font-family: var(--font-condensed);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-align: center;
}

.media-stage__thumbnails {
  display: flex;
  max-width: 100%;
  justify-content: center;
  gap: 7px;
  padding: 3px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-color: rgb(255 255 255 / 30%) transparent;
  scrollbar-width: thin;
}

.media-stage__thumbnail {
  position: relative;
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  padding: 2px;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 7px;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  cursor: pointer;
  place-items: center;
}

.media-stage__thumbnail--active {
  border-color: var(--accent);
}

.media-stage__thumbnail img {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
}

.media-stage__video-mark {
  z-index: 1;
  display: grid;
  width: 22px;
  height: 22px;
  grid-area: 1 / 1;
  border-radius: 50%;
  background: rgb(0 0 0 / 62%);
  box-shadow: 0 0 0 1px rgb(255 255 255 / 32%);
  color: #fff;
  font-size: 0.58rem;
  place-items: center;
}

@keyframes media-stage-enter {
  from {
    opacity: 0;
    transform: scale(0.992);
  }
}

@media (max-width: 959px) {
  .media-stage {
    height: clamp(19rem, 52dvh, 34rem);
    flex: 0 0 auto;
  }

  .media-stage__viewport {
    padding: max(56px, calc(env(safe-area-inset-top) + 48px)) 16px 16px;
  }

  .media-stage--adaptive-image {
    height: auto;
    min-height: 0;
    grid-template-rows: auto auto;
  }

  .media-stage--adaptive-image .media-stage__viewport {
    min-height: 0;
    padding: 0;
    grid-template-rows: auto;
  }

  .media-stage--adaptive-image .media-stage__item {
    width: 100%;
    height: auto;
    align-self: center;
    aspect-ratio: var(--media-stage-aspect-ratio);
  }

  .media-stage__item--contained {
    padding: 0;
  }

  .media-stage__controls {
    padding-right: max(14px, env(safe-area-inset-right));
    padding-left: max(14px, env(safe-area-inset-left));
  }
}

:global(html[data-theme='dark'] .media-stage) {
  background: #171715;
}

@media (prefers-reduced-motion: reduce) {
  .media-stage__media {
    animation: none;
    transition: none;
  }
}
</style>
