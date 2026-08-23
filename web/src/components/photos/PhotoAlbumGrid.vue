<script setup lang="ts">
import type { PhotoAlbumSummary } from '../../../../src/shared/photoLibraryProtocol';
import PhotoAlbumCard from './PhotoAlbumCard.vue';

defineProps<{
  albums: readonly PhotoAlbumSummary[];
}>();
</script>

<template>
  <div class="photo-album-grid">
    <PhotoAlbumCard
      v-for="album in albums"
      :key="album.id"
      :album="album"
    />
  </div>
</template>

<style scoped>
.photo-album-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: clamp(1.6rem, 3vw, 2.6rem) clamp(1rem, 2.2vw, 1.8rem);
}

@media (max-width: 899px) {
  .photo-album-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 559px) {
  .photo-album-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}
</style>
