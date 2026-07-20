<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';
import { formatFileSize } from '../../utils/formatters';
import type { JournalAsset } from '../../types';

const props = defineProps<{
  assets: readonly JournalAsset[];
  busy: boolean;
  busyLabel: string | null;
}>();

const emit = defineEmits<{
  uploadCover: [file: File];
  removeAsset: [asset: JournalAsset];
}>();

const cover = computed(() => props.assets.find((asset) => asset.sourceKind === 'web' && asset.role === 'cover') ?? null);
const inlineAssets = computed(() => props.assets.filter((asset) => asset.sourceKind === 'web' && asset.role === 'inline'));

const coverInput = shallowRef<HTMLInputElement | null>(null);

function pickCover(): void {
  coverInput.value?.click();
}

function onCoverChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (file) emit('uploadCover', file);
}

</script>

<template>
  <section class="media-panel" :aria-busy="busy">
    <header class="media-panel__header">
      <div>
        <h2 class="media-panel__title">封面与文中图片</h2>
        <p class="media-panel__hint">JPEG / PNG / WebP / GIF，单文件上限 20 MB。</p>
      </div>
      <JournalLoading v-if="busyLabel" variant="inline" :label="busyLabel" />
    </header>

    <div class="media-panel__cover">
      <figure v-if="cover" class="media-panel__cover-figure">
        <img :src="cover.url" :alt="cover.originalName ?? '封面'">
        <button class="text-button media-panel__cover-replace" type="button" :disabled="busy" @click="pickCover">替换封面</button>
        <button class="text-button media-panel__cover-remove" type="button" :disabled="busy" @click="emit('removeAsset', cover)">删除封面</button>
      </figure>
      <div v-else class="media-panel__cover-empty">
        <button class="button button--quiet" type="button" :disabled="busy" @click="pickCover">上传封面</button>
      </div>
      <input ref="coverInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="onCoverChange">
    </div>

    <div class="media-panel__inline">
      <div class="media-panel__inline-actions">
        <strong>文中图片</strong>
        <span class="media-panel__inline-count">{{ inlineAssets.length }} 张；上传和插入请使用正文工具栏</span>
      </div>
      <ul v-if="inlineAssets.length" class="media-panel__inline-list">
        <li v-for="asset in inlineAssets" :key="asset.id" class="media-panel__inline-item">
          <img :src="asset.url" :alt="asset.originalName ?? `inline-${asset.id}`" loading="lazy">
          <div class="media-panel__inline-meta">
            <span class="media-panel__inline-name">{{ asset.originalName ?? '未命名' }}</span>
            <span class="media-panel__inline-size">{{ formatFileSize(asset.byteSize) ?? '—' }}</span>
          </div>
          <button class="text-button" type="button" :disabled="busy" @click="emit('removeAsset', asset)">删除</button>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.media-panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.media-panel__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.1rem;
}

.media-panel__header {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.media-panel__hint {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.media-panel__cover {
  display: grid;
  gap: 0.6rem;
}

.media-panel__cover-figure {
  position: relative;
  margin: 0;
}

.media-panel__cover-figure img {
  display: block;
  width: 100%;
  max-height: 18rem;
  object-fit: cover;
  border-radius: 0.7rem;
}

.media-panel__cover-remove {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
}

.media-panel__cover-replace {
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
}

.media-panel__cover-empty {
  display: grid;
  place-items: center;
  min-height: 8rem;
  border: 1px dashed var(--border-strong);
  border-radius: 0.7rem;
  background: var(--surface-muted);
}

.media-panel__inline-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.media-panel__inline-count {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.media-panel__inline-list {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.media-panel__inline-item {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  gap: 0.6rem;
  align-items: center;
}

.media-panel__inline-item img {
  width: 3rem;
  height: 3rem;
  object-fit: cover;
  border-radius: 0.4rem;
}

.media-panel__inline-meta {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.media-panel__inline-name {
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-panel__inline-size {
  color: var(--text-muted);
  font-size: 0.74rem;
}
</style>
