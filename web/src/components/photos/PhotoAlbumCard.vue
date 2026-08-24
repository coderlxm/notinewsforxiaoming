<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { PhotoAlbumSummary } from '../../../../src/shared/photoLibraryProtocol';
import JournalProgressiveImage from '../ui/JournalProgressiveImage.vue';

const props = defineProps<{
  album: PhotoAlbumSummary;
}>();

const dateRange = computed(() => {
  const { takenAtStart, takenAtEnd } = props.album;
  if (!takenAtStart || !takenAtEnd) return null;

  const start = dayjs(takenAtStart).format('YYYY.M.D');
  const end = dayjs(takenAtEnd).format('YYYY.M.D');
  return start === end ? start : `${start} — ${end}`;
});
</script>

<template>
  <RouterLink
    class="photo-album-card"
    :to="{ name: 'photo-album', params: { albumId: album.id } }"
  >
    <!-- 背后叠放相纸 2 -->
    <span class="photo-album-card__layer photo-album-card__layer--back" aria-hidden="true" />
    <!-- 背后叠放相纸 1 -->
    <span class="photo-album-card__layer photo-album-card__layer--middle" aria-hidden="true" />

    <!-- 主封面相纸 -->
    <div class="photo-album-card__front">
      <div class="photo-album-card__photo-frame">
        <JournalProgressiveImage
          class="photo-album-card__image"
          :src="album.cover.card.url"
          :preview-src="album.cover.preview.url"
          :alt="`${album.name}相册封面：${album.cover.title}`"
          fit="cover"
          loading="lazy"
        />
      </div>
      <div class="photo-album-card__copy">
        <strong class="photo-album-card__name">{{ album.name }}</strong>
        <div class="photo-album-card__summary">
          <span class="photo-album-card__badge">{{ album.photoCount }} 张</span>
          <span v-if="dateRange" class="photo-album-card__date">{{ dateRange }}</span>
        </div>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.photo-album-card {
  position: relative;
  display: block;
  min-width: 0;
  overflow: visible;
  color: var(--photo-text-primary);
  text-decoration: none;
  isolation: isolate;
}

/* 背后叠放相纸公用样式 */
.photo-album-card__layer {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  pointer-events: none;
  transition: transform 300ms var(--ease-card), background-color 300ms ease, border-color 300ms ease, box-shadow 300ms ease;
  transform-origin: center center;
}

/* 背后相纸 2（底层，向右微旋） */
.photo-album-card__layer--back {
  z-index: 1;
  background: #171716;
  border: 1px solid rgb(255 255 255 / 7%);
  box-shadow: 0 4px 14px rgb(0 0 0 / 60%);
  transform: rotate(3.4deg) translate(3px, -2px);
}

/* 背后相纸 1（中层，向左微旋） */
.photo-album-card__layer--middle {
  z-index: 2;
  background: #20201f;
  border: 1px solid rgb(255 255 255 / 10%);
  box-shadow: 0 6px 18px rgb(0 0 0 / 70%);
  transform: rotate(-2.8deg) translate(-3px, -1px);
}

/* 前景主封面（实体相纸装裱衬底） */
.photo-album-card__front {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  padding: clamp(4px, 0.6vw, 6px) clamp(4px, 0.6vw, 6px) clamp(7px, 1vw, 9px);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 6px;
  background: #191918;
  box-shadow: 0 10px 26px rgb(0 0 0 / 85%);
  transition: transform 300ms var(--ease-card), box-shadow 300ms ease, border-color 200ms ease;
  transform-origin: center center;
}

/* 照片内框（模拟装裱开窗） */
.photo-album-card__photo-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: 4px;
  background: #0d0d0c;
}

.photo-album-card__image {
  width: 100%;
  height: 100%;
  transition: transform 350ms var(--ease-card);
}

/* 底部相纸信息栏 */
.photo-album-card__copy {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
  padding: clamp(6px, 0.8vw, 8px) 2px 1px;
}

.photo-album-card__name {
  overflow: hidden;
  font-family: var(--font-serif);
  font-size: clamp(0.84rem, 1.25vw, 1.02rem);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-album-card__summary {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.35rem;
  color: var(--photo-text-secondary);
  font-size: 0.62rem;
  line-height: 1.4;
}

.photo-album-card__badge {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgb(255 255 255 / 8%);
  color: var(--photo-text-primary);
  font-weight: 500;
}

.photo-album-card__date {
  opacity: 0.68;
  transition: opacity 180ms ease;
}

/* 悬停与聚焦：扇形散开（Fan-out）与相纸上浮 */
.photo-album-card:focus-visible .photo-album-card__front {
  border-color: rgb(255 255 255 / 26%);
  box-shadow: 0 16px 36px rgb(0 0 0 / 95%);
  transform: translateY(-5px) scale(1.02);
}

.photo-album-card:focus-visible .photo-album-card__layer--middle {
  border-color: rgb(255 255 255 / 16%);
  background: #262625;
  transform: rotate(-5.5deg) translate(-8px, -4px);
}

.photo-album-card:focus-visible .photo-album-card__layer--back {
  border-color: rgb(255 255 255 / 12%);
  background: #1c1c1b;
  transform: rotate(5.8deg) translate(8px, -4px);
}

.photo-album-card:focus-visible .photo-album-card__image {
  transform: scale(1.035);
}

.photo-album-card:focus-visible .photo-album-card__date {
  opacity: 1;
}

@media (hover: hover) {
  .photo-album-card:hover .photo-album-card__front {
    border-color: rgb(255 255 255 / 26%);
    box-shadow: 0 16px 36px rgb(0 0 0 / 95%);
    transform: translateY(-5px) scale(1.02);
  }

  .photo-album-card:hover .photo-album-card__layer--middle {
    border-color: rgb(255 255 255 / 16%);
    background: #262625;
    transform: rotate(-5.5deg) translate(-8px, -4px);
  }

  .photo-album-card:hover .photo-album-card__layer--back {
    border-color: rgb(255 255 255 / 12%);
    background: #1c1c1b;
    transform: rotate(5.8deg) translate(8px, -4px);
  }

  .photo-album-card:hover .photo-album-card__image {
    transform: scale(1.035);
  }

  .photo-album-card:hover .photo-album-card__date {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .photo-album-card__front,
  .photo-album-card__layer,
  .photo-album-card__date,
  .photo-album-card__image {
    transition: none;
  }

  .photo-album-card:hover .photo-album-card__front,
  .photo-album-card:focus-visible .photo-album-card__front {
    transform: none;
  }

  .photo-album-card:hover .photo-album-card__layer--middle,
  .photo-album-card:focus-visible .photo-album-card__layer--middle {
    transform: rotate(-2.8deg) translate(-3px, -1px);
  }

  .photo-album-card:hover .photo-album-card__layer--back,
  .photo-album-card:focus-visible .photo-album-card__layer--back {
    transform: rotate(3.4deg) translate(3px, -2px);
  }

  .photo-album-card:focus-visible .photo-album-card__image,
  .photo-album-card:hover .photo-album-card__image {
    transform: none;
  }
}
</style>
