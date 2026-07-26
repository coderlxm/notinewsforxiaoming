<script setup lang="ts">
import { useTemplateRef } from 'vue';

defineProps<{
  disabled: boolean;
}>();

const emit = defineEmits<{
  select: [files: File[]];
}>();

const fileInput = useTemplateRef<HTMLInputElement>('fileInput');

function openPicker(): void {
  fileInput.value?.click();
}

function handleSelection(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files?.length) emit('select', Array.from(input.files));
  input.value = '';
}
</script>

<template>
  <div class="contribution-picker">
    <input
      ref="fileInput"
      class="contribution-picker__input"
      type="file"
      name="assets[]"
      accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime"
      multiple
      :disabled="disabled"
      @change="handleSelection"
    >
    <button
      class="contribution-picker__button"
      type="button"
      :disabled="disabled"
      @click="openPicker"
    >
      <span class="contribution-picker__plus" aria-hidden="true">＋</span>
      选择照片或视频
    </button>
  </div>
</template>
