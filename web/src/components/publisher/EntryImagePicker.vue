<script setup lang="ts">
import { onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue';
import type { JournalAsset } from '../../types';

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
const selectionError = shallowRef<string | null>(null);
const fileInput = useTemplateRef<HTMLInputElement>('fileInput');
const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const maximumFileSize = 20 * 1024 * 1024;

watch(files, (nextFiles) => {
  previews.value.forEach((preview) => {
    if (!nextFiles.includes(preview.file)) URL.revokeObjectURL(preview.url);
  });
  previews.value = nextFiles.map((file) => {
    const existing = previews.value.find(preview => preview.file === file);
    return existing ?? { file, url: URL.createObjectURL(file) };
  });
}, { immediate: true });

function selectImages(event: Event): void {
  const input = event.target as HTMLInputElement;
  const selected = [...(input.files ?? [])];
  input.value = '';
  selectionError.value = null;
  if (selected.length === 0) return;

  if (props.existingAssets.length + files.value.length + selected.length > 10) {
    selectionError.value = '每条内容最多选择 10 张图片。';
    return;
  }
  const unsupported = selected.find(file => !acceptedTypes.has(file.type));
  if (unsupported) {
    selectionError.value = `${unsupported.name} 不是支持的图片格式。`;
    return;
  }
  const oversized = selected.find(file => file.size > maximumFileSize);
  if (oversized) {
    selectionError.value = `${oversized.name} 超过 20 MB。`;
    return;
  }

  files.value = [...files.value, ...selected];
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
      <div>
        <h2 id="entry-images-label" class="image-picker__label">图片</h2>
        <p class="image-picker__hint">支持 JPEG、PNG、WebP、GIF，最多 10 张，每张不超过 20 MB。</p>
      </div>
      <button
        class="button button--quiet"
        type="button"
        :disabled="disabled || existingAssets.length + files.length >= 10"
        @click="fileInput?.click()"
      >
        选择图片
      </button>
      <input
        ref="fileInput"
        class="image-picker__input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        :disabled="disabled"
        @change="selectImages"
      >
    </div>

    <p v-if="selectionError" class="notice notice--error" role="alert">{{ selectionError }}</p>

    <div v-if="existingAssets.length || previews.length" class="image-picker__grid">
      <figure v-for="asset in existingAssets" :key="`asset-${asset.id}`" class="image-picker__item">
        <img :src="asset.previewUrl ?? asset.url" :alt="asset.originalName ?? '草稿图片'">
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
        <img :src="preview.url" :alt="preview.file.name">
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
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.image-picker__label,
.image-picker__hint {
  margin: 0;
}

.image-picker__label {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.image-picker__hint {
  margin-top: 0.25rem;
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.5;
}

.image-picker__input {
  display: none;
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

.image-picker__item img {
  width: 100%;
  aspect-ratio: 1;
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
  .image-picker__heading {
    align-items: end;
  }

  .image-picker__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
