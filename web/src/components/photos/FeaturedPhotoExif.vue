<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import type { PhotoDisplayMetadata } from '../../../../src/shared/photoLibraryProtocol';

const props = defineProps<{
  metadata: PhotoDisplayMetadata;
}>();

const context = computed(() => [
  props.metadata.takenAt ? dayjs(props.metadata.takenAt).format('YYYY.MM.DD') : null,
  props.metadata.camera ?? props.metadata.lens,
].filter((value): value is string => value !== null).join(' · '));

const exposure = computed(() => [
  props.metadata.focalLength,
  props.metadata.aperture,
  props.metadata.shutterSpeed,
  props.metadata.iso ? `ISO ${props.metadata.iso}` : null,
].filter((value): value is string => value !== null).join('  '));
</script>

<template>
  <span
    v-if="context || exposure"
    class="featured-photo-exif"
    aria-hidden="true"
  >
    <span v-if="context" class="featured-photo-exif__context">{{ context }}</span>
    <span v-if="exposure" class="featured-photo-exif__exposure">{{ exposure }}</span>
  </span>
</template>

<style scoped>
.featured-photo-exif {
  position: absolute;
  z-index: 1;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  gap: 0.18rem;
  min-width: 0;
  padding: 3rem 0.78rem 0.68rem;
  color: rgb(255 255 255 / 96%);
  background: linear-gradient(transparent, rgb(8 8 7 / 76%));
  font-family: var(--font-sans);
  line-height: 1.25;
  text-align: left;
  text-shadow: 0 1px 12px rgb(0 0 0 / 40%);
  pointer-events: none;
}

.featured-photo-exif__context,
.featured-photo-exif__exposure {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.featured-photo-exif__context {
  font-size: 0.67rem;
  font-weight: 650;
  letter-spacing: 0.045em;
}

.featured-photo-exif__exposure {
  color: rgb(255 255 255 / 76%);
  font-size: 0.61rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.025em;
}
</style>
