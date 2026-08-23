<script setup lang="ts">
import { JustifiedGrid } from '@egjs/grid';
import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue';
import type { PhotoLibraryPhoto } from '../../../../src/shared/photoLibraryProtocol';
import { usePhotoLightbox } from '../../composables/usePhotoLightbox';
import PhotoGalleryItem from './PhotoGalleryItem.vue';

const props = defineProps<{
  photos: readonly PhotoLibraryPhoto[];
}>();

const emit = defineEmits<{
  layoutReady: [];
}>();

const gallery = useTemplateRef<HTMLDivElement>('gallery');
const scrollRoot = shallowRef<HTMLElement | null>(null);
const lightbox = usePhotoLightbox(() => props.photos);
let grid: JustifiedGrid | null = null;
let layoutAnnounced = false;
let active = true;

function handleRenderComplete(): void {
  if (layoutAnnounced) return;
  layoutAnnounced = true;
  emit('layoutReady');
}

onMounted(async () => {
  scrollRoot.value = gallery.value!.closest<HTMLElement>('.app-scroll');
  await nextTick();
  if (!active) return;

  grid = new JustifiedGrid(gallery.value!, {
    gap: 10,
    columnRange: [1, 5],
    sizeRange: [160, 320],
    isCroppedSize: false,
    stretch: false,
    passUnstretchRow: true,
    useResizeObserver: true,
    observeChildren: true,
    useTransform: true,
  });
  grid.on('renderComplete', handleRenderComplete);
  grid.renderItems();
});

onBeforeUnmount(() => {
  active = false;
  grid?.off('renderComplete', handleRenderComplete);
  grid?.destroy();
  lightbox.destroy();
});
</script>

<template>
  <div ref="gallery" class="photo-justified-gallery" aria-label="相册照片">
    <PhotoGalleryItem
      v-for="(photo, index) in photos"
      :key="photo.id"
      :photo="photo"
      :scroll-root="scrollRoot"
      @open="lightbox.open(index)"
    />
  </div>
</template>

<style scoped>
.photo-justified-gallery {
  position: relative;
  width: 100%;
  min-height: 12rem;
}
</style>
