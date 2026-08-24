<script setup lang="ts">
import dayjs from 'dayjs';
import { useReducedMotion } from 'motion-v';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { PhotoLibraryPhoto } from '../../../../src/shared/photoLibraryProtocol';
import JournalProgressiveImage from '../ui/JournalProgressiveImage.vue';

const props = defineProps<{
  photos: readonly PhotoLibraryPhoto[];
}>();

const emit = defineEmits<{
  openPhoto: [index: number];
}>();

const reducedMotion = useReducedMotion();
const activeIndex = ref(0);
const isPaused = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;
const SLIDE_DURATION = 6000;

const activePhoto = computed<PhotoLibraryPhoto | null>(() => {
  if (props.photos.length === 0) return null;
  return props.photos[activeIndex.value] ?? props.photos[0];
});

const metadataItems = computed(() => {
  if (!activePhoto.value) return [];
  return [
    activePhoto.value.metadata.takenAt
      ? dayjs(activePhoto.value.metadata.takenAt).format('YYYY.MM.DD')
      : null,
    activePhoto.value.metadata.camera,
    activePhoto.value.metadata.lens,
  ].filter((value): value is string => value !== null);
});

function nextSlide(): void {
  if (props.photos.length <= 1) return;
  activeIndex.value = (activeIndex.value + 1) % props.photos.length;
}

function prevSlide(): void {
  if (props.photos.length <= 1) return;
  activeIndex.value = (activeIndex.value - 1 + props.photos.length) % props.photos.length;
}

function goToSlide(index: number): void {
  activeIndex.value = index;
  resetTimer();
}

function startTimer(): void {
  if (reducedMotion.value || props.photos.length <= 1) return;
  stopTimer();
  timer = setInterval(() => {
    if (!isPaused.value) {
      nextSlide();
    }
  }, SLIDE_DURATION);
}

function stopTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function resetTimer(): void {
  stopTimer();
  startTimer();
}

function handleFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && event.currentTarget instanceof HTMLElement
    && event.currentTarget.contains(nextTarget)) return;
  isPaused.value = false;
}

function handleVisibilityChange(): void {
  isPaused.value = document.visibilityState === 'hidden';
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange);
  startTimer();
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  stopTimer();
});
</script>

<template>
  <section
    v-if="activePhoto"
    class="photo-hero"
    aria-labelledby="photo-library-title"
    @pointerenter="isPaused = true"
    @pointerleave="isPaused = false"
    @focusin="isPaused = true"
    @focusout="handleFocusOut"
  >
    <div class="photo-hero__media-container">
      <Transition name="hero-fade">
        <button
          :key="activePhoto.id"
          class="photo-hero__surface"
          type="button"
          :aria-label="`查看焦点照片：${activePhoto.title}`"
          @click="emit('openPhoto', activeIndex)"
        >
          <JournalProgressiveImage
            class="photo-hero__image"
            :src="activePhoto.view.url"
            :preview-src="activePhoto.preview.url"
            :alt="activePhoto.title"
            fit="cover"
            loading="eager"
          />
        </button>
      </Transition>
    </div>

    <!-- 左右翻页控制器 -->
    <div v-if="photos.length > 1" class="photo-hero__controls">
      <button
        class="photo-hero__nav-btn photo-hero__nav-btn--prev"
        type="button"
        aria-label="上一张焦点照片"
        @click="prevSlide(); resetTimer()"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        class="photo-hero__nav-btn photo-hero__nav-btn--next"
        type="button"
        aria-label="下一张焦点照片"
        @click="nextSlide(); resetTimer()"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>

    <!-- 文本信息区 -->
    <div class="photo-hero__copy">
      <p class="photo-hero__eyebrow">PHOTOGRAPHY</p>
      <h1 id="photo-library-title" class="photo-hero__title">照片墙</h1>
      <p class="photo-hero__description">
        把途中遇见的光、风景和生活片段，留在这里慢慢回看。
      </p>

      <Transition name="copy-fade" mode="out-in">
        <div :key="activePhoto.id" class="photo-hero__photo-details">
          <p class="photo-hero__photo-title">{{ activePhoto.title }}</p>
          <div v-if="metadataItems.length > 0" class="photo-hero__metadata" aria-label="焦点照片信息">
            <span v-for="(item, index) in metadataItems" :key="`${index}:${item}`">{{ item }}</span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 底部 Netflix 风格分页指示条 -->
    <div v-if="photos.length > 1" class="photo-hero__pagination" role="tablist" aria-label="焦点照片分页">
      <button
        v-for="(photo, index) in photos"
        :key="photo.id"
        class="photo-hero__dot"
        :class="{ 'photo-hero__dot--active': index === activeIndex }"
        type="button"
        role="tab"
        :aria-selected="index === activeIndex"
        :aria-label="`切换至照片 ${index + 1}：${photo.title}`"
        @click="goToSlide(index)"
      />
    </div>
  </section>
</template>

<style scoped>
.photo-hero {
  position: relative;
  width: 100%;
  height: clamp(28rem, 62vh, 45rem);
  overflow: hidden;
  background: var(--photo-surface);
}

.photo-hero__media-container {
  position: absolute;
  inset: 0;
}

.photo-hero::before,
.photo-hero::after {
  position: absolute;
  z-index: 2;
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

.photo-hero__surface {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}

.photo-hero__surface:focus-visible {
  outline-offset: -4px;
}

.photo-hero__image {
  width: 100%;
  height: 100%;
}

/* 渐变切换动效 */
.hero-fade-enter-active,
.hero-fade-leave-active {
  transition: opacity 800ms cubic-bezier(0.2, 0, 0, 1), transform 1000ms cubic-bezier(0.2, 0, 0, 1);
}

.hero-fade-enter-from {
  opacity: 0;
  transform: scale(1.03);
}

.hero-fade-leave-to {
  opacity: 0;
}

.copy-fade-enter-active,
.copy-fade-leave-active {
  transition: opacity 280ms ease, transform 280ms ease;
}

.copy-fade-enter-from {
  opacity: 0;
  transform: translateY(5px);
}

.copy-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

/* 翻页左右按钮 */
.photo-hero__controls {
  position: absolute;
  z-index: 4;
  top: 50%;
  right: var(--photo-edge);
  left: var(--photo-edge);
  display: flex;
  justify-content: space-between;
  transform: translateY(-50%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 250ms ease;
}

.photo-hero:hover .photo-hero__controls,
.photo-hero:focus-within .photo-hero__controls {
  opacity: 1;
}

.photo-hero__nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 999px;
  background: rgb(15 15 15 / 65%);
  backdrop-filter: blur(8px);
  color: rgb(255 255 255 / 85%);
  cursor: pointer;
  pointer-events: auto;
  transition: background-color 180ms ease, transform 180ms ease, border-color 180ms ease;
}

.photo-hero__nav-btn:hover {
  background: rgb(32 32 32 / 85%);
  border-color: rgb(255 255 255 / 35%);
  transform: scale(1.08);
}

/* 文本信息区 */
.photo-hero__copy {
  position: absolute;
  z-index: 3;
  bottom: clamp(2rem, 4.5vw, 3.8rem);
  left: var(--photo-edge);
  display: grid;
  width: min(38rem, calc(100% - (var(--photo-edge) * 2)));
  gap: 0.5rem;
  pointer-events: none;
}

.photo-hero__photo-details {
  display: grid;
  gap: 0.45rem;
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
  margin-top: 0.2rem;
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

/* 分页指示条 */
.photo-hero__pagination {
  position: absolute;
  z-index: 4;
  right: var(--photo-edge);
  bottom: clamp(2rem, 4.5vw, 3.8rem);
  display: flex;
  align-items: center;
  gap: 6px;
}

.photo-hero__dot {
  position: relative;
  width: 22px;
  height: 3px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgb(255 255 255 / 22%);
  cursor: pointer;
  overflow: hidden;
  transition: width 260ms ease, background-color 200ms ease;
}

.photo-hero__dot:hover {
  background: rgb(255 255 255 / 45%);
}

.photo-hero__dot--active {
  width: 34px;
  background: rgb(255 255 255 / 90%);
  box-shadow: 0 0 8px rgb(255 255 255 / 40%);
}

@media (max-width: 599px) {
  .photo-hero {
    height: clamp(22rem, 52vh, 32rem);
  }

  .photo-hero__copy {
    bottom: 2rem;
    gap: 0.42rem;
  }

  .photo-hero__title {
    font-size: clamp(1.9rem, 10vw, 2.7rem);
  }

  .photo-hero__description {
    max-width: 25rem;
    line-height: 1.55;
  }

  .photo-hero__controls {
    display: none;
  }

  .photo-hero__pagination {
    bottom: 0.95rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-fade-enter-active,
  .hero-fade-leave-active,
  .copy-fade-enter-active,
  .copy-fade-leave-active {
    transition: none;
  }

  .hero-fade-enter-from,
  .copy-fade-enter-from,
  .copy-fade-leave-to {
    transform: none;
  }
}
</style>
