<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import type { ContributionSubmitStatus } from '../../composables/useContributionSubmit';
import { showMessage } from '../../utils/message';

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

let statusMessage: ReturnType<typeof showMessage> | null = null;

function closeStatusMessage(): void {
  statusMessage?.close();
  statusMessage = null;
}

watch(
  () => [props.status, props.wakeLockActive] as const,
  ([status, wakeLockActive]) => {
    closeStatusMessage();
    if (status === 'uploading') {
      statusMessage = showMessage({
        message: wakeLockActive
          ? '正在上传，屏幕常亮已开启。完成前请保持页面打开。'
          : '正在上传，请保持页面打开，完成前不要锁屏或切走。',
        type: 'info',
        duration: 0,
      });
    }
    if (status === 'processing') {
      statusMessage = showMessage({
        message: '文件已上传，服务器正在整理…',
        type: 'info',
        duration: 0,
      });
    }
  },
);

watch(
  () => props.errorMessage,
  (error) => {
    if (error) showMessage({ message: error, type: 'error' });
  },
);

onBeforeUnmount(closeStatusMessage);
</script>

<template>
  <div
    class="contribution-submit-bar"
    :aria-busy="status === 'uploading' || status === 'processing'"
  >
    <button
      class="contribution-submit-button"
      type="submit"
      :disabled="disabled || status === 'uploading' || status === 'processing'"
      @click.prevent="emit('submit')"
    >
      {{ status === 'uploading'
        ? `正在上传 ${uploadPercent}%`
        : status === 'processing'
          ? '正在整理…'
          : '送给小明' }}
    </button>
  </div>
</template>
