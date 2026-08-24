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
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: start;
  gap: 24px 16px;
  padding: 4px 2px 12px;
}

@media (max-width: 1439px) {
  .photo-album-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 22px 14px;
  }
}

@media (max-width: 1099px) {
  .photo-album-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px 12px;
  }
}

@media (max-width: 799px) {
  .photo-album-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 10px;
  }
}

@media (max-width: 359px) {
  .photo-album-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
