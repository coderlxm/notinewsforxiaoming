<script setup lang="ts">
import { computed, toRef, useTemplateRef } from 'vue';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion-v';
import type { PhotoLibraryPhoto } from '../../../../src/shared/photoLibraryProtocol';
import JournalProgressiveImage from '../ui/JournalProgressiveImage.vue';

const props = defineProps<{
  photo: PhotoLibraryPhoto;
  scrollRoot: HTMLElement | null;
}>();

const emit = defineEmits<{
  open: [];
}>();

const surface = useTemplateRef<HTMLButtonElement>('surface');
const reducedMotion = useReducedMotion();
const direction = Number.parseInt(props.photo.id.at(-1)!, 16) % 2 === 0 ? 1 : -1;
const scrollRoot = toRef(props, 'scrollRoot');
const { scrollYProgress } = useScroll({
  container: scrollRoot,
  target: surface,
  offset: ['start end', 'end start'],
});
const parallaxY = useTransform(scrollYProgress, [0, 0.5, 1], [-7 * direction, 0, 7 * direction]);

const imageRatio = computed(() => `${props.photo.card.width} / ${props.photo.card.height}`);
const revealInitial = computed(() => reducedMotion.value
  ? { opacity: 1, y: 0 }
  : { opacity: 0, y: 18 * direction });
const revealTarget = computed(() => ({ opacity: 1, y: 0 }));
const revealTransition = computed(() => reducedMotion.value
  ? { duration: 0 }
  : { duration: 0.52, ease: [0.22, 1, 0.36, 1] as const });
const inViewOptions = computed(() => ({
  ...(props.scrollRoot ? { root: props.scrollRoot } : {}),
  amount: 0.15,
  once: true,
}));
const parallaxStyle = computed(() => ({
  y: reducedMotion.value ? 0 : parallaxY,
}));
</script>

<template>
  <figure
    class="photo-gallery-item"
    :data-grid-width="photo.card.width"
    :data-grid-height="photo.card.height"
  >
    <motion.div
      class="photo-gallery-item__reveal"
      :initial="revealInitial"
      :while-in-view="revealTarget"
      :in-view-options="inViewOptions"
      :transition="revealTransition"
    >
      <motion.div class="photo-gallery-item__parallax" :style="parallaxStyle">
        <button
          ref="surface"
          class="photo-gallery-item__surface"
          data-grid-maintained-target
          :style="{ aspectRatio: imageRatio }"
          type="button"
          :aria-label="`查看照片：${photo.title}`"
          @click="emit('open')"
        >
          <JournalProgressiveImage
            class="photo-gallery-item__image"
            :src="photo.card.url"
            :preview-src="photo.preview.url"
            :alt="photo.title"
            fit="cover"
            loading="lazy"
          />
        </button>
      </motion.div>
    </motion.div>
    <figcaption class="photo-gallery-item__caption">{{ photo.title }}</figcaption>
  </figure>
</template>

<style scoped>
.photo-gallery-item {
  min-width: 0;
  margin: 0;
}

.photo-gallery-item__reveal,
.photo-gallery-item__parallax,
.photo-gallery-item__surface,
.photo-gallery-item__image {
  width: 100%;
  height: 100%;
}

.photo-gallery-item__surface {
  position: relative;
  display: block;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-media);
  background: var(--surface-muted);
  cursor: zoom-in;
}

.photo-gallery-item__image {
  transition: transform 420ms var(--ease-card);
}

.photo-gallery-item__surface:hover .photo-gallery-item__image {
  transform: scale(1.012);
}

.photo-gallery-item__caption {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .photo-gallery-item__image {
    transition: none;
  }

  .photo-gallery-item__surface:hover .photo-gallery-item__image {
    transform: none;
  }
}
</style>
