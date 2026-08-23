<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import { useAnimate, useReducedMotion } from 'motion-v';
import type { PhotoLibraryPhoto } from '../../../../src/shared/photoLibraryProtocol';
import JournalProgressiveImage from '../ui/JournalProgressiveImage.vue';
import FeaturedPhotoExif from './FeaturedPhotoExif.vue';

defineProps<{
  photos: readonly PhotoLibraryPhoto[];
}>();

const emit = defineEmits<{
  openPhoto: [index: number];
}>();

const stripGroup = useTemplateRef<HTMLElement>('stripGroup');
const [trackScope, animate] = useAnimate<HTMLElement>();
const reducedMotion = useReducedMotion();
let resizeObserver: ResizeObserver | null = null;
let playbackControls: {
  pause(): void;
  play(): void;
  stop(): void;
} | null = null;
let pointerInside = false;
let focusWithin = false;
let active = false;

function syncPlayback(): void {
  if (pointerInside || focusWithin) playbackControls?.pause();
  else playbackControls?.play();
}

function startAnimation(): void {
  playbackControls?.stop();
  const distance = stripGroup.value!.getBoundingClientRect().width;
  playbackControls = animate(
    trackScope.value,
    { x: [0, -distance] },
    {
      duration: distance / 28,
      ease: 'linear',
      repeat: Infinity,
    },
  );
  syncPlayback();
}

function handlePointerEnter(): void {
  pointerInside = true;
  syncPlayback();
}

function handlePointerLeave(): void {
  pointerInside = false;
  syncPlayback();
}

function handleFocusIn(): void {
  focusWithin = true;
  syncPlayback();
}

function handleFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && event.currentTarget instanceof HTMLElement
    && event.currentTarget.contains(nextTarget)) return;
  focusWithin = false;
  syncPlayback();
}

onMounted(() => {
  active = true;
  resizeObserver = new ResizeObserver(() => {
    if (!reducedMotion.value) startAnimation();
  });
  resizeObserver.observe(stripGroup.value!);
  if (!reducedMotion.value) startAnimation();
});

watch(reducedMotion, async (reduced) => {
  if (reduced) {
    playbackControls?.stop();
    playbackControls = null;
    return;
  }

  await nextTick();
  if (active) startAnimation();
});

onBeforeUnmount(() => {
  active = false;
  resizeObserver?.disconnect();
  playbackControls?.stop();
});
</script>

<template>
  <div
    class="featured-photo-strip"
    :class="{ 'featured-photo-strip--static': reducedMotion }"
    tabindex="0"
    aria-label="近期精选照片，聚焦后暂停自动移动"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
    @focusin="handleFocusIn"
    @focusout="handleFocusOut"
  >
    <div ref="trackScope" class="featured-photo-strip__track">
      <div ref="stripGroup" class="featured-photo-strip__group">
        <button
          v-for="(photo, index) in photos"
          :key="photo.id"
          class="featured-photo-strip__frame"
          :style="{ aspectRatio: `${photo.card.width} / ${photo.card.height}` }"
          type="button"
          :aria-label="`查看照片：${photo.title}`"
          @click="emit('openPhoto', index)"
        >
          <JournalProgressiveImage
            class="featured-photo-strip__image"
            :src="photo.card.url"
            :preview-src="photo.preview.url"
            :alt="photo.title"
            fit="cover"
            :loading="index < 3 ? 'eager' : 'lazy'"
          />
          <FeaturedPhotoExif :metadata="photo.metadata" />
        </button>
      </div>

      <div
        v-if="!reducedMotion"
        class="featured-photo-strip__group"
        aria-hidden="true"
      >
        <button
          v-for="(photo, index) in photos"
          :key="`repeat-${photo.id}`"
          class="featured-photo-strip__frame"
          :style="{ aspectRatio: `${photo.card.width} / ${photo.card.height}` }"
          type="button"
          tabindex="-1"
          @click="emit('openPhoto', index)"
        >
          <JournalProgressiveImage
            class="featured-photo-strip__image"
            :src="photo.card.url"
            :preview-src="photo.preview.url"
            alt=""
            fit="cover"
            loading="lazy"
          />
          <FeaturedPhotoExif :metadata="photo.metadata" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.featured-photo-strip {
  position: relative;
  width: 100%;
  overflow: hidden;
  outline-offset: -2px;
}

.featured-photo-strip::before,
.featured-photo-strip::after {
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  width: clamp(1.75rem, 4vw, 3.5rem);
  pointer-events: none;
  content: '';
}

.featured-photo-strip::before {
  left: 0;
  background: linear-gradient(to right, var(--surface-page), transparent);
}

.featured-photo-strip::after {
  right: 0;
  background: linear-gradient(to left, var(--surface-page), transparent);
}

.featured-photo-strip--static {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
}

.featured-photo-strip__track {
  display: flex;
  width: max-content;
  will-change: transform;
}

.featured-photo-strip--static .featured-photo-strip__track {
  padding: 0 var(--page-gutter);
  will-change: auto;
}

.featured-photo-strip__group {
  display: flex;
  flex-shrink: 0;
  gap: 1rem;
  padding-right: 1rem;
}

.featured-photo-strip--static .featured-photo-strip__group {
  padding-right: 0;
}

.featured-photo-strip__frame {
  position: relative;
  display: block;
  height: clamp(13rem, 24vw, 19rem);
  flex: 0 0 auto;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-media);
  background: var(--surface-muted);
  cursor: zoom-in;
}

.featured-photo-strip__image {
  width: 100%;
  height: 100%;
  transition: transform 420ms var(--ease-card);
}

.featured-photo-strip__frame:hover .featured-photo-strip__image {
  transform: scale(1.012);
}

@media (max-width: 599px) {
  .featured-photo-strip__group {
    gap: 0.65rem;
    padding-right: 0.65rem;
  }

  .featured-photo-strip__frame {
    height: 11.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .featured-photo-strip__image {
    transition: none;
  }

  .featured-photo-strip__frame:hover .featured-photo-strip__image {
    transform: none;
  }
}
</style>
