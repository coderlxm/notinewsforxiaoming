<script setup lang="ts">
import { shallowRef } from 'vue';
import type { AdminContributionAsset } from '../../types';
import { formatFileSize } from '../../utils/formatters';

const props = defineProps<{
  assets: readonly AdminContributionAsset[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  move: [assetId: number, direction: -1 | 1];
  remove: [assetId: number];
}>();

const playingVideoIds = shallowRef<ReadonlySet<number>>(new Set());

function playVideo(assetId: number): void {
  playingVideoIds.value = new Set([...playingVideoIds.value, assetId]);
}
</script>

<template>
  <section class="review-media" aria-labelledby="review-media-title">
    <div class="review-media__heading">
      <div>
        <h2 id="review-media-title">素材</h2>
        <p>发布时会沿用这里的顺序。</p>
      </div>
      <span>{{ assets.length }} 项</span>
    </div>

    <div v-if="assets.length" class="review-media__list">
      <article v-for="(asset, index) in assets" :key="asset.id" class="review-media__item">
        <div class="review-media__visual" :style="{ aspectRatio: `${asset.width} / ${asset.height}` }">
          <img
            v-if="asset.kind === 'photo'"
            :src="asset.url"
            :alt="asset.sourceName"
            loading="lazy"
          >
          <video
            v-else-if="playingVideoIds.has(asset.id)"
            :src="asset.url"
            controls
            autoplay
            preload="metadata"
          />
          <button
            v-else
            class="review-media__play"
            type="button"
            :disabled="disabled"
            :aria-label="`播放 ${asset.sourceName}`"
            @click="playVideo(asset.id)"
          >
            <img :src="asset.previewUrl" alt="" loading="lazy">
            <span aria-hidden="true">▶</span>
          </button>
        </div>

        <div class="review-media__details">
          <strong>{{ asset.sourceName }}</strong>
          <span>
            {{ asset.kind === 'photo' ? '照片' : '视频' }}
            · {{ formatFileSize(asset.byteSize) }}
          </span>
          <div class="review-media__actions">
            <button
              class="button button--quiet"
              type="button"
              :disabled="disabled || index === 0"
              @click="emit('move', asset.id, -1)"
            >
              前移
            </button>
            <button
              class="button button--quiet"
              type="button"
              :disabled="disabled || index === assets.length - 1"
              @click="emit('move', asset.id, 1)"
            >
              后移
            </button>
            <button
              class="review-media__remove"
              type="button"
              :disabled="disabled"
              @click="emit('remove', asset.id)"
            >
              删除
            </button>
          </div>
        </div>
      </article>
    </div>
    <p v-else class="review-media__empty">这份投稿已不包含素材，将作为纯文字记录发布。</p>
  </section>
</template>

<style scoped>
.review-media {
  display: grid;
  gap: 0.75rem;
}

.review-media__heading,
.review-media__item,
.review-media__actions {
  display: flex;
}

.review-media__heading {
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.review-media__heading h2 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1rem;
}

.review-media__heading p,
.review-media__heading > span,
.review-media__empty {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.review-media__heading p {
  margin: 0.2rem 0 0;
}

.review-media__list {
  display: grid;
  gap: 0.75rem;
}

.review-media__item {
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.review-media__visual {
  position: relative;
  width: 8rem;
  max-height: 7rem;
  flex: none;
  overflow: hidden;
  border-radius: var(--radius-media);
  background: var(--surface-muted);
}

.review-media__visual > img,
.review-media__visual > video,
.review-media__play,
.review-media__play img {
  display: block;
  width: 100%;
  height: 100%;
}

.review-media__visual > img,
.review-media__visual > video,
.review-media__play img {
  object-fit: cover;
}

.review-media__play {
  position: relative;
  padding: 0;
  border: 0;
  cursor: pointer;
}

.review-media__play span {
  position: absolute;
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: rgb(20 20 18 / 66%);
  color: #fff;
  font-size: 0.8rem;
  inset: 50% auto auto 50%;
  place-items: center;
  transform: translate(-50%, -50%);
}

.review-media__details {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.24rem;
}

.review-media__details strong {
  overflow: hidden;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-media__details > span {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.review-media__actions {
  gap: 0.4rem;
  margin-top: 0.35rem;
}

.review-media__actions .button,
.review-media__remove {
  min-height: 2rem;
  padding: 0.35rem 0.62rem;
  font-size: 0.7rem;
}

.review-media__remove {
  border: 0;
  background: transparent;
  color: var(--danger);
  cursor: pointer;
}

.review-media__empty {
  margin: 0;
  padding: 1rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-card);
  text-align: center;
}

@media (max-width: 599px) {
  .review-media__item {
    align-items: stretch;
    flex-direction: column;
  }

  .review-media__visual {
    width: 100%;
    max-height: 18rem;
  }
}
</style>
