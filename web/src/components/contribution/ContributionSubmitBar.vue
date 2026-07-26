<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue';
import type { ContributionSubmitStatus } from '../../composables/useContributionSubmit';

const props = defineProps<{
  status: ContributionSubmitStatus;
  uploadPercent: number;
  errorMessage: string;
  disabled: boolean;
  wakeLockActive: boolean;
}>();

const emit = defineEmits<{
  submit: [];
}>();

const errorElement = useTemplateRef<HTMLElement>('errorElement');

watch(
  () => props.errorMessage,
  async (message) => {
    if (!message) return;
    await nextTick();
    errorElement.value?.focus();
  },
);
</script>

<template>
  <div
    class="contribution-submit-bar"
    :aria-busy="status === 'uploading' || status === 'processing'"
  >
    <div
      v-if="status === 'uploading'"
      class="contribution-submit-status"
      aria-live="polite"
    >
      <div class="contribution-submit-status__line">
        <span>正在上传</span>
        <span>{{ uploadPercent }}%</span>
      </div>
      <progress
        class="contribution-progress"
        :value="uploadPercent"
        max="100"
        aria-label="投稿上传进度"
      >
        {{ uploadPercent }}%
      </progress>
    </div>

    <p
      v-else-if="status === 'processing'"
      class="contribution-submit-status contribution-submit-status--processing"
      aria-live="polite"
    >
      <span class="contribution-status-dot" aria-hidden="true"></span>
      文件已上传，服务器正在整理…
    </p>

    <p
      v-else-if="status === 'failed'"
      ref="errorElement"
      class="contribution-submit-error"
      role="alert"
      tabindex="-1"
    >
      {{ errorMessage }}
    </p>

    <p
      v-if="status === 'uploading' || status === 'processing'"
      class="contribution-submit-notice"
    >
      {{ wakeLockActive
        ? '屏幕常亮已开启，完成前请勿手动锁屏或切走页面。'
        : '请保持页面打开，完成前不要锁屏或切走。' }}
    </p>

    <button
      class="contribution-submit-button"
      type="submit"
      :disabled="disabled || status === 'uploading' || status === 'processing'"
      @click.prevent="emit('submit')"
    >
      {{ status === 'uploading'
        ? '正在上传…'
        : status === 'processing'
          ? '正在整理…'
          : '送给小明' }}
    </button>
  </div>
</template>
