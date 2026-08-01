<script setup lang="ts">
import { useDropZone, useEventListener, useFileDialog } from '@vueuse/core';
import { InfoFilled } from '@element-plus/icons-vue';
import { ElTooltip } from 'element-plus';
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue';
import type { JournalAsset } from '../../types';
import { showMessage } from '../../utils/message';

interface LocalPreview {
  file: File;
  url: string;
}

const props = defineProps<{
  existingAssets: readonly JournalAsset[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  removeExisting: [assetId: number];
}>();

const files = defineModel<File[]>({ required: true });
const previews = shallowRef<LocalPreview[]>([]);
const dropZone = useTemplateRef<HTMLButtonElement>('dropZone');
const acceptedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'];
const acceptedTypes = new Set(acceptedMimeTypes);
const maximumMediaCount = 10;
const maximumVideoCount = 5;
const maximumFileSize = 20 * 1024 * 1024;
const maximumVideoSize = 500 * 1024 * 1024;
const imageCount = computed(() => props.existingAssets.length + files.value.length);
const videoCount = computed(() => [...props.existingAssets, ...files.value].filter(item => item instanceof File ? item.type.startsWith('video/') : item.kind === 'video').length);
const imageLimitReached = computed(() => imageCount.value >= maximumMediaCount);
const pickerDisabled = computed(() => props.disabled || imageLimitReached.value);

const { open: openFileDialog, onChange } = useFileDialog({
  accept: acceptedMimeTypes.join(','),
  multiple: true,
  reset: true,
});

const { isOverDropZone } = useDropZone(dropZone, {
  multiple: true,
  onDrop(droppedFiles) {
    if (pickerDisabled.value || droppedFiles === null) return;
    addImages(droppedFiles);
  },
});

const dropZoneActive = computed(() => isOverDropZone.value && !pickerDisabled.value);

function showSelectionError(message: string): void {
  showMessage({ message, type: 'error' });
}

watch(files, (nextFiles) => {
  previews.value.forEach((preview) => {
    if (!nextFiles.includes(preview.file)) URL.revokeObjectURL(preview.url);
  });
  previews.value = nextFiles.map((file) => {
    const existing = previews.value.find(preview => preview.file === file);
    return existing ?? { file, url: URL.createObjectURL(file) };
  });
}, { immediate: true });

function addImages(selected: File[]): void {
  if (selected.length === 0) return;

  if (imageCount.value + selected.length > maximumMediaCount) {
    showSelectionError('每条内容最多选择 10 项媒体。');
    return;
  }
  const unsupported = selected.find(file => !acceptedTypes.has(file.type));
  if (unsupported) {
    showSelectionError(`${unsupported.name} 不是支持的图片或视频格式。`);
    return;
  }
  const oversized = selected.find(file => file.size > (file.type.startsWith('video/') ? maximumVideoSize : maximumFileSize));
  if (oversized) {
    showSelectionError(`${oversized.name} 超过${oversized.type.startsWith('video/') ? ' 500 MiB' : ' 20 MB'}。`);
    return;
  }
  if (videoCount.value + selected.filter(file => file.type.startsWith('video/')).length > maximumVideoCount) {
    showSelectionError('每条内容最多选择 5 段视频。');
    return;
  }

  files.value = [...files.value, ...selected];
}

function handlePaste(event: ClipboardEvent): void {
  if (event.clipboardData === null) return;

  const clipboardImages = [...event.clipboardData.items]
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'));

  if (clipboardImages.length === 0) return;

  event.preventDefault();
  if (props.disabled) {
    showSelectionError('保存或发布期间不能添加图片。');
    return;
  }

  const pastedFiles: File[] = [];
  for (const item of clipboardImages) {
    const file = item.getAsFile();
    if (file === null) {
      showSelectionError('无法读取剪贴板图片。');
      return;
    }
    pastedFiles.push(file);
  }
  addImages(pastedFiles);
}

useEventListener(document, 'paste', handlePaste);

onChange((selectedFiles) => {
  if (selectedFiles === null) return;
  addImages([...selectedFiles]);
});

function selectImages(): void {
  if (pickerDisabled.value) return;
  openFileDialog();
}

function removeLocal(file: File): void {
  files.value = files.value.filter(candidate => candidate !== file);
}

onBeforeUnmount(() => {
  previews.value.forEach(preview => URL.revokeObjectURL(preview.url));
});
</script>

<template>
  <section class="image-picker" aria-labelledby="entry-images-label">
      <div class="image-picker__heading">
        <h2 id="entry-images-label" class="image-picker__label">图片与视频</h2>
        <ElTooltip
          effect="light"
          placement="top"
          :show-arrow="false"
          popper-class="image-picker__tooltip"
        >
          <template #content>
            图片支持 JPEG、PNG、WebP、GIF；视频支持 MP4、MOV。最多 10 项，其中视频最多 5 段；可使用 Ctrl / Command + V 粘贴图片。
          </template>
          <button class="image-picker__hint-trigger" type="button" aria-label="查看图片与视频上传说明">
            <InfoFilled aria-hidden="true" />
          </button>
        </ElTooltip>
      </div>

    <button
      ref="dropZone"
      class="image-picker__drop-zone"
      :class="{
        'image-picker__drop-zone--over': dropZoneActive,
        'image-picker__drop-zone--limit': imageLimitReached,
        'image-picker__drop-zone--disabled': disabled,
      }"
      type="button"
      :disabled="pickerDisabled"
      aria-describedby="entry-images-hint"
      @click="selectImages"
    >
      <strong v-if="imageLimitReached" class="image-picker__drop-title">已达到 10 项上限</strong>
      <strong v-else-if="disabled" class="image-picker__drop-title">图片选择暂不可用</strong>
      <strong v-else-if="dropZoneActive" class="image-picker__drop-title">松开以添加图片</strong>
      <template v-else>
        <strong class="image-picker__drop-title image-picker__drop-title--desktop">拖拽媒体到这里，点击选择，或直接粘贴图片</strong>
        <strong class="image-picker__drop-title image-picker__drop-title--mobile">点击选择媒体</strong>
      </template>
      <span class="image-picker__drop-hint">图片将在保存草稿或发布时上传</span>
    </button>

    <div v-if="existingAssets.length || previews.length" class="image-picker__grid">
      <figure v-for="asset in existingAssets" :key="`asset-${asset.id}`" class="image-picker__item">
        <video
          v-if="asset.kind === 'video'"
          :src="asset.url"
          :poster="asset.previewUrl ?? undefined"
          muted
          preload="metadata"
        />
        <img v-else :src="asset.previewUrl ?? asset.url" :alt="asset.originalName ?? '草稿图片'">
        <button
          class="image-picker__remove"
          type="button"
          :disabled="disabled"
          :aria-label="`移除 ${asset.originalName ?? '图片'}`"
          @click="emit('removeExisting', asset.id)"
        >
          移除
        </button>
      </figure>
      <figure v-for="preview in previews" :key="preview.url" class="image-picker__item">
        <video v-if="preview.file.type.startsWith('video/')" :src="preview.url" muted preload="metadata"></video>
        <img v-else :src="preview.url" :alt="preview.file.name">
        <button
          class="image-picker__remove"
          type="button"
          :disabled="disabled"
          :aria-label="`移除 ${preview.file.name}`"
          @click="removeLocal(preview.file)"
        >
          移除
        </button>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.image-picker {
  display: grid;
  gap: 0.75rem;
}

.image-picker__heading {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.image-picker__label {
  margin: 0;
}

.image-picker__label {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.image-picker__hint-trigger {
  display: grid;
  width: 1.15rem;
  height: 1.15rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  place-items: center;
  background: transparent;
  color: var(--text-muted);
  cursor: help;
}

.image-picker__hint-trigger:hover,
.image-picker__hint-trigger:focus-visible {
  color: var(--accent-strong);
}

.image-picker__hint-trigger:focus-visible {
  outline: 2px solid var(--accent-strong);
  outline-offset: 2px;
}

.image-picker__hint-trigger svg {
  width: 0.95rem;
  height: 0.95rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.35;
}

.image-picker__drop-zone {
  display: grid;
  width: 100%;
  min-height: 8rem;
  align-content: center;
  justify-items: center;
  gap: 0.35rem;
  padding: 1.25rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  text-align: center;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.image-picker__drop-zone:hover:not(:disabled),
.image-picker__drop-zone--over {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.image-picker__drop-zone--limit,
.image-picker__drop-zone--disabled {
  opacity: 0.55;
}

.image-picker__drop-zone--limit {
  cursor: not-allowed;
}

.image-picker__drop-zone--disabled {
  cursor: wait;
}

.image-picker__drop-title {
  font-size: 0.85rem;
  line-height: 1.5;
}

.image-picker__drop-title--mobile {
  display: none;
}

.image-picker__drop-hint {
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.5;
}

.image-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
  gap: 0.7rem;
}

.image-picker__item {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  margin: 0;
}

.image-picker__item img,
.image-picker__item video {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  max-height: 12rem;
  border-radius: var(--radius-media);
  background: var(--surface-muted);
  object-fit: cover;
}

.image-picker__remove {
  min-height: 2.25rem;
  padding: 0.35rem;
  border: 0;
  background: transparent;
  color: var(--danger);
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
}

.image-picker__remove:disabled {
  cursor: wait;
  opacity: 0.55;
}

@media (max-width: 599px) {
  .image-picker__drop-zone {
    min-height: 6.5rem;
    padding: 1rem;
  }

  .image-picker__drop-title--desktop {
    display: none;
  }

  .image-picker__drop-title--mobile {
    display: inline;
  }

  .image-picker__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
