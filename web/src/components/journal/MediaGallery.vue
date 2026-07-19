<script setup lang="ts">
import { computed } from 'vue';
import type { JournalAsset } from '../../types';
import { formatFileSize } from '../../utils/formatters';

const props = defineProps<{
  assets: JournalAsset[];
}>();

type DisplayAsset = JournalAsset & {
  displayType: 'image' | 'video' | 'audio' | 'file';
  sizeLabel: string | null;
};

const displayAssets = computed<DisplayAsset[]>(() => props.assets.map(asset => {
  let displayType: DisplayAsset['displayType'] = 'file';
  if (asset.kind === 'photo' || (asset.kind === 'sticker' && asset.mimeType?.startsWith('image/'))) {
    displayType = 'image';
  }
  else if (
    ['video', 'video_note', 'animation'].includes(asset.kind)
    || (asset.kind === 'sticker' && asset.mimeType?.startsWith('video/'))
  ) {
    displayType = 'video';
  }
  else if (['voice', 'audio'].includes(asset.kind)) {
    displayType = 'audio';
  }

  return {
    ...asset,
    displayType,
    sizeLabel: formatFileSize(asset.byteSize),
  };
}));

const visualAssets = computed(() => displayAssets.value.filter(asset =>
  asset.displayType === 'image' || asset.displayType === 'video',
));
const audioAssets = computed(() => displayAssets.value.filter(asset => asset.displayType === 'audio'));
const fileAssets = computed(() => displayAssets.value.filter(asset => asset.displayType === 'file'));
</script>

<template>
  <section v-if="displayAssets.length" class="media" aria-label="记录附件">
    <div
      v-if="visualAssets.length"
      class="media__visuals"
      :class="{ 'media__visuals--single': visualAssets.length === 1 }"
    >
      <figure v-for="asset in visualAssets" :key="asset.id" class="media__visual">
        <img
          v-if="asset.displayType === 'image'"
          class="media__image"
          :class="{ 'media__image--sticker': asset.kind === 'sticker' }"
          :src="asset.url"
          :alt="asset.originalName ?? asset.kind"
          loading="lazy"
        >
        <video
          v-else
          class="media__video"
          :class="{ 'media__video--round': asset.kind === 'video_note' }"
          :src="asset.url"
          controls
          preload="metadata"
        />
      </figure>
    </div>

    <div v-if="audioAssets.length" class="media__audios">
      <div v-for="asset in audioAssets" :key="asset.id" class="media__audio-row">
        <div class="media__audio-copy">
          <span class="media__audio-kind">{{ asset.kind === 'voice' ? '语音' : '音频' }}</span>
          <strong v-if="asset.originalName" class="media__audio-name">{{ asset.originalName }}</strong>
        </div>
        <audio class="media__audio" :src="asset.url" controls preload="metadata" />
      </div>
    </div>

    <div v-if="fileAssets.length" class="media__files">
      <a
        v-for="asset in fileAssets"
        :key="asset.id"
        class="media__file"
        :href="asset.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="media__file-icon" aria-hidden="true">↗</span>
        <span class="media__file-copy">
          <strong>{{ asset.originalName ?? asset.kind }}</strong>
          <small>{{ [asset.mimeType, asset.sizeLabel].filter(Boolean).join(' · ') }}</small>
        </span>
      </a>
    </div>
  </section>
</template>

<style scoped>
.media {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.9rem;
}

.media__visuals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-media);
  background: var(--surface-muted);
}

.media__visuals--single {
  grid-template-columns: 1fr;
}

.media__visual {
  display: grid;
  min-height: 9rem;
  margin: 0;
  place-items: center;
  overflow: hidden;
}

.media__image,
.media__video {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 34rem;
  object-fit: cover;
  background: var(--surface-muted);
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

.media__file-copy small {
  margin-top: 0.15rem;
  color: var(--text-muted);
}

@media (max-width: 520px) {
  .media__visuals {
    border-right: 0;
    border-left: 0;
    border-radius: 0;
  }
}
</style>
