<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import type { CSSProperties } from 'vue';
import type { JournalAsset } from '../../types';
import { resolveJournalMediaType } from '../../utils/journalMedia';
import { mountJournalVideo, releaseJournalVideo } from '../../utils/journalVideoPlayerPool';

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
const videoPlaying = shallowRef(false);
const videoControlsActivated = shallowRef(false);
const videoCurrentTime = shallowRef(0);
const videoDuration = shallowRef(0);

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
const videoProgressStyle = computed(() => ({
  '--video-progress': `${videoDuration.value > 0 ? (videoCurrentTime.value / videoDuration.value) * 100 : 0}%`,
}));

watch(currentAdaptiveAspectRatio, (aspectRatio) => {
  emit('aspectRatioChange', aspectRatio);
}, { immediate: true });

let currentMountedVideo: HTMLVideoElement | null = null;
let currentMountedUrl: string | null = null;
let currentVideoHost: HTMLElement | null = null;

function handleVideoReady(): void {
  videoReady.value = true;
}

function handleVideoPlay(): void {
  videoPlaying.value = true;
}

function handleVideoPause(): void {
  videoPlaying.value = false;
}

function handleVideoEnded(): void {
  videoPlaying.value = false;
  videoControlsActivated.value = true;
}

function handleVideoTimelineChange(event: Event): void {
  const video = event.currentTarget as HTMLVideoElement;
  videoCurrentTime.value = video.currentTime;
  videoDuration.value = Number.isFinite(video.duration) ? video.duration : 0;
}

function handleVideoHostMount(container: HTMLElement | null): void {
  const asset = currentAsset.value;
  if (container === currentVideoHost && currentMountedUrl === asset?.url) return;

  if (currentMountedVideo) {
    currentMountedVideo.removeEventListener('loadeddata', handleVideoReady);
    currentMountedVideo.removeEventListener('canplay', handleVideoReady);
    currentMountedVideo.removeEventListener('play', handleVideoPlay);
    currentMountedVideo.removeEventListener('pause', handleVideoPause);
    currentMountedVideo.removeEventListener('ended', handleVideoEnded);
    currentMountedVideo.removeEventListener('timeupdate', handleVideoTimelineChange);
    currentMountedVideo.removeEventListener('durationchange', handleVideoTimelineChange);
    currentMountedVideo.removeEventListener('loadedmetadata', handleVideoTimelineChange);
    currentMountedVideo.pause();
    currentMountedVideo.remove();
    currentMountedVideo = null;
  }
  if (currentMountedUrl) {
    releaseJournalVideo(currentMountedUrl);
    currentMountedUrl = null;
  }

  currentVideoHost = container;

  if (!container || !asset || asset.mediaType !== 'video') {
    videoReady.value = asset?.mediaType !== 'video';
    videoPlaying.value = false;
    videoControlsActivated.value = false;
    videoCurrentTime.value = 0;
    videoDuration.value = 0;
    return;
  }

  const video = mountJournalVideo(asset.url, container);
  currentMountedVideo = video;
  currentMountedUrl = asset.url;

  video.controls = false;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  if (asset.previewUrl && !video.poster) {
    video.poster = asset.previewUrl;
  }

  if (video.readyState >= 2) {
    videoReady.value = true;
  } else {
    videoReady.value = false;
    video.addEventListener('loadeddata', handleVideoReady, { once: true });
    video.addEventListener('canplay', handleVideoReady, { once: true });
  }

  videoPlaying.value = !video.paused && !video.ended;
  videoCurrentTime.value = video.currentTime;
  videoDuration.value = Number.isFinite(video.duration) ? video.duration : 0;
  video.addEventListener('play', handleVideoPlay);
  video.addEventListener('pause', handleVideoPause);
  video.addEventListener('ended', handleVideoEnded);
  video.addEventListener('timeupdate', handleVideoTimelineChange);
  video.addEventListener('durationchange', handleVideoTimelineChange);
  video.addEventListener('loadedmetadata', handleVideoTimelineChange);
  void video.play();
}

const setVideoHostRef = (element: unknown): void => {
  handleVideoHostMount(element as HTMLElement | null);
};

function toggleVideoPlayback(): void {
  if (!currentMountedVideo || !videoReady.value) return;
  if (currentMountedVideo.paused || currentMountedVideo.ended) {
    void currentMountedVideo.play();
    return;
  }
  videoControlsActivated.value = true;
  currentMountedVideo.pause();
}

function seekVideo(event: Event): void {
  if (!currentMountedVideo) return;
  const input = event.currentTarget as HTMLInputElement;
  currentMountedVideo.currentTime = Number(input.value);
  videoCurrentTime.value = currentMountedVideo.currentTime;
}

function goTo(index: number): void {
  if (index === currentIndex.value) return;
  currentMountedVideo?.pause();
  currentIndex.value = index;
}

function previous(): void {
  goTo(currentIndex.value - 1);
}

function next(): void {
  goTo(currentIndex.value + 1);
}

function handleKeyboard(event: KeyboardEvent): void {
  if (event.target instanceof HTMLMediaElement || event.target instanceof HTMLInputElement) return;
  if (event.key === 'ArrowLeft' && currentIndex.value > 0) {
    event.preventDefault();
    previous();
  }
  if (event.key === 'ArrowRight' && currentIndex.value < stageAssets.value.length - 1) {
    event.preventDefault();
    next();
  }
}

onBeforeUnmount(() => {
  handleVideoHostMount(null);
});
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
        <div
          v-else
          :ref="setVideoHostRef"
          class="media-stage__media media-stage__video-host"
          :class="{ 'media-stage__video-host--ready': videoReady }"
          :aria-busy="!videoReady"
          @click="toggleVideoPlayback"
        />
        <button
          v-if="currentAsset.mediaType === 'video'"
          class="media-stage__playback-toggle"
          :class="{ 'media-stage__playback-toggle--playing': videoPlaying }"
          type="button"
          :aria-label="videoPlaying ? '暂停视频' : '播放视频'"
          :disabled="!videoReady"
          @click.stop="toggleVideoPlayback"
        >
          <svg v-if="videoPlaying" class="media-stage__playback-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 6v12M16 6v12" />
          </svg>
          <svg v-else class="media-stage__playback-icon media-stage__playback-icon--play" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 9 6-9 6Z" />
          </svg>
        </button>
        <input
          v-if="currentAsset.mediaType === 'video'"
          class="media-stage__progress"
          :class="{ 'media-stage__progress--visible': videoControlsActivated }"
          type="range"
          min="0"
          :max="videoDuration"
          step="0.1"
          :value="videoCurrentTime"
          :style="videoProgressStyle"
          aria-label="视频进度"
          :disabled="!videoReady || videoDuration <= 0"
          @input="seekVideo"
        >
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

.media-stage__video-host {
  pointer-events: none;
  overflow: hidden;
}

.media-stage__video-host--ready {
  pointer-events: auto;
}

.media-stage__video-host :deep(video) {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  object-fit: inherit;
  border-radius: inherit;
}

.media-stage__playback-toggle {
  z-index: 2;
  display: grid;
  width: 46px;
  height: 46px;
  padding: 0;
  border: 1px solid rgb(255 255 255 / 36%);
  border-radius: 50%;
  grid-area: 1 / 1;
  background: rgb(20 20 20 / 58%);
  color: #fff;
  cursor: pointer;
  opacity: 1;
  place-items: center;
  transition: opacity 220ms ease, transform 220ms ease;
}

.media-stage__playback-toggle--playing,
.media-stage__playback-toggle:disabled {
  pointer-events: none;
  opacity: 0;
  transform: scale(0.9);
}

.media-stage__playback-icon {
  display: block;
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.media-stage__playback-icon--play {
  fill: currentColor;
  stroke: none;
}

.media-stage__progress {
  z-index: 2;
  width: calc(100% - 32px);
  height: 44px;
  align-self: end;
  padding: 0;
  margin: 0 16px;
  -webkit-appearance: none;
  appearance: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  cursor: pointer;
  grid-area: 1 / 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
}

.media-stage__progress--visible {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: hover) and (pointer: fine) {
  .media-stage__item:hover .media-stage__progress:not(:disabled) {
    opacity: 1;
    pointer-events: auto;
  }
}

.media-stage__progress::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    rgb(255 255 255 / 92%) 0 var(--video-progress),
    rgb(255 255 255 / 32%) var(--video-progress) 100%
  );
}

.media-stage__progress::-webkit-slider-thumb {
  width: 13px;
  height: 13px;
  margin-top: -5px;
  -webkit-appearance: none;
  appearance: none;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 5px rgb(0 0 0 / 32%);
}

.media-stage__progress::-moz-range-track {
  height: 3px;
  border-radius: 999px;
  background: rgb(255 255 255 / 32%);
}

.media-stage__progress::-moz-range-progress {
  height: 3px;
  border-radius: 999px;
  background: rgb(255 255 255 / 92%);
}

.media-stage__progress::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border: 0;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 5px rgb(0 0 0 / 32%);
}

.media-stage__progress:disabled {
  pointer-events: none;
  opacity: 0;
}

.media-stage__progress:focus,
.media-stage__progress:focus-visible {
  border-color: transparent;
  outline: none;
  box-shadow: none;
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
  .media-stage__media,
  .media-stage__playback-toggle,
  .media-stage__progress {
    animation: none;
    transition: none;
  }
}
</style>
