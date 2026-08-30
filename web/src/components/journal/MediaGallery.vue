<script setup lang="ts">
import { TopRight } from '@element-plus/icons-vue';
import { computed } from 'vue';
import type { JournalAsset } from '../../types';
import { formatFileSize } from '../../utils/formatters';
import {
  resolveJournalCardImageSource,
  resolveJournalMediaType,
} from '../../utils/journalMedia';
import JournalProgressiveImage from '../ui/JournalProgressiveImage.vue';
import JournalProgressiveVideo from '../ui/JournalProgressiveVideo.vue';

const props = withDefaults(defineProps<{
  assets: readonly JournalAsset[];
  display?: 'card' | 'detail';
  maxVisuals?: number;
  cornerSafe?: boolean;
}>(), {
  display: 'detail',
  cornerSafe: false,
});

const emit = defineEmits<{
  open: [];
}>();

type DisplayAsset = JournalAsset & {
  displayType: 'image' | 'video' | 'audio' | 'file';
  sizeLabel: string | null;
  aspectRatio: string | null;
};

const displayAssets = computed<DisplayAsset[]>(() => props.assets.map(asset => {
  return {
    ...asset,
    displayType: resolveJournalMediaType(asset),
    sizeLabel: formatFileSize(asset.byteSize),
    aspectRatio: asset.width && asset.height ? `${asset.width} / ${asset.height}` : null,
  };
}));

const visualAssets = computed(() => displayAssets.value.filter(asset =>
  asset.displayType === 'image' || asset.displayType === 'video',
));
const renderedVisualAssets = computed(() => props.maxVisuals === undefined
  ? visualAssets.value
  : visualAssets.value.slice(0, props.maxVisuals));
const hiddenVisualCount = computed(() => visualAssets.value.length - renderedVisualAssets.value.length);
const audioAssets = computed(() => displayAssets.value.filter(asset => asset.displayType === 'audio'));
const fileAssets = computed(() => displayAssets.value.filter(asset => asset.displayType === 'file'));

function preserveAssetRatio(asset: DisplayAsset): { aspectRatio: string } | undefined {
  if (!asset.aspectRatio || (props.display === 'card' && visualAssets.value.length > 1)) return undefined;
  return { aspectRatio: asset.aspectRatio };
}
</script>

<template>
  <section
    v-if="displayAssets.length"
    class="media"
    :class="[
      `media--${display}`,
      { 'media--corner-safe': cornerSafe && visualAssets.length > 0 },
    ]"
    aria-label="记录附件"
  >
    <div
      v-if="visualAssets.length"
      class="media__visuals"
      :class="{
        'media__visuals--single': visualAssets.length === 1,
        'media__visuals--multiple': visualAssets.length > 1,
      }"
    >
      <figure
        v-for="(asset, index) in renderedVisualAssets"
        :key="asset.id"
        class="media__visual"
        :class="{ 'media__visual--natural': display === 'detail' || visualAssets.length === 1 }"
        :style="preserveAssetRatio(asset)"
      >
        <JournalProgressiveImage
          v-if="asset.displayType === 'image' && display === 'card'"
          class="media__image"
          :class="{ 'media__image--sticker': asset.kind === 'sticker' }"
          :src="resolveJournalCardImageSource(asset)"
          :preview-src="asset.previewUrl!"
          :alt="asset.sourceKind === 'telegram' ? '' : (asset.originalName ?? '')"
          :fit="asset.kind === 'sticker' ? 'contain' : 'cover'"
          loading="lazy"
        />
        <img
          v-else-if="asset.displayType === 'image'"
          class="media__image"
          :class="{ 'media__image--sticker': asset.kind === 'sticker' }"
          :src="asset.url"
          :alt="asset.sourceKind === 'telegram' ? '' : (asset.originalName ?? '')"
          loading="lazy"
        >
        <JournalProgressiveVideo
          v-else-if="display === 'card'"
          class="media__video"
          :class="{ 'media__video--round': asset.kind === 'video_note' }"
          :src="asset.url"
          :preview-src="asset.previewUrl!"
          fit="cover"
          @open="emit('open')"
        />
        <video
          v-else
          class="media__video"
          :class="{ 'media__video--round': asset.kind === 'video_note' }"
          :src="asset.url"
          :poster="asset.previewUrl!"
          controls
          preload="metadata"
        />
        <button
          v-if="hiddenVisualCount > 0 && index === renderedVisualAssets.length - 1"
          class="media__more"
          type="button"
          :aria-label="`还有 ${hiddenVisualCount} 张媒体，查看完整记录`"
          @click="emit('open')"
        >
          +{{ hiddenVisualCount }}
        </button>
      </figure>
    </div>

    <div v-if="display === 'detail' && audioAssets.length" class="media__audios">
      <div v-for="asset in audioAssets" :key="asset.id" class="media__audio-row">
        <div class="media__audio-copy">
          <span class="media__audio-kind">{{ asset.kind === 'voice' ? '语音' : '音频' }}</span>
          <strong v-if="asset.originalName" class="media__audio-name">{{ asset.originalName }}</strong>
        </div>
        <audio class="media__audio" :src="asset.url" controls preload="metadata" />
      </div>
    </div>

    <div v-if="display === 'detail' && fileAssets.length" class="media__files">
      <a
        v-for="asset in fileAssets"
        :key="asset.id"
        class="media__file"
        :href="asset.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="media__file-icon" aria-hidden="true"><TopRight /></span>
        <span class="media__file-copy">
          <strong>{{ asset.originalName ?? asset.kind }}</strong>
          <small v-if="asset.mimeType || asset.sizeLabel">
            {{ [asset.mimeType, asset.sizeLabel].filter(Boolean).join(' · ') }}
          </small>
        </span>
      </a>
    </div>
  </section>
</template>

<style scoped>
.media {
  display: grid;
  gap: 0.75rem;
}

.media--corner-safe {
  --media-corner-safe-size: calc(2.75rem + 2px);
  position: relative;
}

.media--corner-safe::before {
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-top: var(--media-corner-safe-size) solid #171816;
  border-left: var(--media-corner-safe-size) solid transparent;
  content: '';
}

.media--corner-safe .media__visuals {
  position: relative;
  z-index: 1;
  clip-path: polygon(
    0 0,
    calc(100% - var(--media-corner-safe-size)) 0,
    100% var(--media-corner-safe-size),
    100% 100%,
    0 100%
  );
}

.media__visuals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.3rem;
}

.media__visuals--single {
  grid-template-columns: 1fr;
}

.media__visual {
  position: relative;
  display: grid;
  min-width: 0;
  margin: 0;
  place-items: center;
  overflow: hidden;
  border-radius: var(--radius-media);
  background: var(--surface-muted);
}

.media__more {
  position: absolute;
  display: grid;
  border: 0;
  background: rgb(0 0 0 / 58%);
  color: #fff;
  cursor: pointer;
  font-size: 1.4rem;
  font-weight: 800;
  inset: 0;
  place-items: center;
  transition: background-color 140ms ease;
}

.media__more:hover {
  background: rgb(0 0 0 / 68%);
}

.media__image,
.media__video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--surface-muted);
}

.media__visual--natural:not([style]) .media__image,
.media__visual--natural:not([style]) .media__video {
  height: auto;
}

.media--card .media__visuals--multiple .media__visual {
  min-height: 0;
  aspect-ratio: auto;
}

.media--card .media__visuals--multiple .media__visual:first-child {
  grid-column: 1 / -1;
  aspect-ratio: auto;
}

.media--card {
  --media-card-max-height: 361px;
  gap: 0;
}

.media--card .media__visuals--single .media__visual {
  width: 100%;
  min-height: 154px;
  max-height: var(--media-card-max-height);
}

.media--card .media__visuals--multiple {
  grid-template-rows: minmax(0, 3fr) minmax(0, 2fr);
  max-height: var(--media-card-max-height);
  aspect-ratio: 4 / 5;
}

.media--card .media__visual {
  border-radius: 0;
}

.media--card .media__audios,
.media--card .media__files {
  gap: 0;
}

.media--detail .media__visuals {
  grid-template-columns: 1fr;
  gap: 0.8rem;
}

.media--detail .media__visual {
  max-height: none;
}

.media__image--sticker {
  max-height: 16rem;
  padding: 1.25rem;
  object-fit: contain;
}

.media__video--round {
  width: min(18rem, 100%);
  aspect-ratio: 1;
  border-radius: 50%;
  object-fit: cover;
}

.media__audios,
.media__files {
  display: grid;
  gap: 0.55rem;
}

.media__audio-row {
  display: grid;
  gap: 0.65rem;
  padding: 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.9rem;
  background: linear-gradient(120deg, var(--accent-soft), var(--surface-muted));
}

.media--card .media__audio-row {
  gap: 0.45rem;
  padding: 0.65rem;
  border: 0;
  border-radius: 0;
}

.media__audio-copy {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  min-width: 0;
}

.media__audio-kind {
  color: var(--accent-strong);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.media__audio-name {
  overflow: hidden;
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media__audio {
  min-width: 0;
  width: 100%;
  height: 2.5rem;
}

.media__file {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.78rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.9rem;
  color: var(--text-primary);
  text-decoration: none;
  transition: border-color 160ms ease, background-color 160ms ease;
}

.media--card .media__file {
  gap: 0.55rem;
  min-height: 2.5rem;
  padding: 0.55rem;
  border: 0;
  border-radius: 0;
}

.media--card .media__audio-row + .media__audio-row,
.media--card .media__file + .media__file,
.media--card .media__files {
  border-top: 1px solid var(--border-subtle);
}

.media__file:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.media__file-icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: none;
  border-radius: 0.6rem;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 800;
  place-items: center;
}

.media__file-icon svg {
  width: 1rem;
  height: 1rem;
}

.media__file-copy {
  display: grid;
  min-width: 0;
}

.media__file-copy strong,
.media__file-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 599px) {
  .media--corner-safe {
    --media-corner-safe-size: calc(2.5rem + 2px);
  }
}

.media__file-copy small {
  margin-top: 0.15rem;
  color: var(--text-muted);
}

@media (max-width: 599px) {
  .media {
    gap: 0.55rem;
  }

  .media__visuals {
    gap: 0.2rem;
  }

  .media--card .media__audio-row,
  .media--card .media__file {
    padding: 0.45rem;
  }

  .media--card .media__file-icon {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .media__file {
    transition: none;
  }
}
</style>
