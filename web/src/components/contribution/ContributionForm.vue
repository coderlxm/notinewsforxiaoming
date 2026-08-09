<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { useContributionForm } from '../../composables/useContributionForm';
import type { ContributionSuccessResult } from '../../composables/useContributionSubmit';
import { useContributionSubmit } from '../../composables/useContributionSubmit';
import { showMessage } from '../../utils/message';
import ContributionMediaList from './ContributionMediaList.vue';
import ContributionMediaPicker from './ContributionMediaPicker.vue';
import ContributionSubmitBar from './ContributionSubmitBar.vue';

const props = defineProps<{
  token: string;
  expiresAt: string | null;
}>();

const emit = defineEmits<{
  submitted: [result: ContributionSuccessResult];
}>();

const {
  senderName,
  contentText,
  media,
  totalBytes,
  videoCount,
  photoCount,
  hasUnsentContent,
  validationErrors,
  canSubmit,
  addFiles,
  removeMedia,
  moveMedia,
  payload,
} = useContributionForm();
const {
  status,
  uploadPercent,
  error,
  result,
  isSubmitting,
  wakeLockActive,
  submit,
} = useContributionSubmit();

function preventLeave(event: BeforeUnloadEvent): void {
  event.preventDefault();
  event.returnValue = '';
}

watch(
  [hasUnsentContent, isSubmitting],
  ([hasContent, submitting]) => {
    if (hasContent || submitting) {
      window.addEventListener('beforeunload', preventLeave);
    } else {
      window.removeEventListener('beforeunload', preventLeave);
    }
  },
  { immediate: true },
);

watch(result, (submittedResult) => {
  if (submittedResult) emit('submitted', submittedResult);
});

watch(validationErrors, (messages, previousMessages) => {
  if (!messages.length || messages.join('\n') === previousMessages.join('\n')) return;
  showMessage({ message: messages.join('；'), type: 'error' });
});

function handleSubmit(): void {
  if (!canSubmit.value || isSubmitting.value) return;
  void submit(props.token, payload());
}

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', preventLeave);
});
</script>

<template>
  <form class="contribution-form" @submit.prevent="handleSubmit">
    <section class="contribution-card contribution-form__section">
      <div class="contribution-field">
        <label class="contribution-field__label" for="contribution-sender-name">
          怎么称呼你
        </label>
        <input
          id="contribution-sender-name"
          v-model="senderName"
          class="contribution-field__control"
          name="senderName"
          type="text"
          autocomplete="name"
          maxlength="24"
          placeholder="例如：阿明"
          :disabled="isSubmitting"
          required
        >
      </div>

      <div class="contribution-field">
        <div class="contribution-field__heading">
          <label class="contribution-field__label" for="contribution-content">
            想说的话
          </label>
          <span class="contribution-field__count">{{ contentText.length }}/2000</span>
        </div>
        <textarea
          id="contribution-content"
          v-model="contentText"
          class="contribution-field__control contribution-field__textarea"
          name="contentText"
          maxlength="2000"
          rows="5"
          placeholder="写下这段回忆、发生的事情，或者任何你想留下的话…"
          :disabled="isSubmitting"
        ></textarea>
      </div>
    </section>

    <section class="contribution-card contribution-form__section">
      <div class="contribution-section-heading">
        <div>
          <h2 class="contribution-section-heading__title">照片与短视频</h2>
          <p class="contribution-section-heading__description">
            最多 30 项，其中视频最多 5 段，全部文件合计不超过 500 MiB。
          </p>
        </div>
        <span v-if="media.length" class="contribution-count-badge">{{ media.length }}/30</span>
      </div>

      <ContributionMediaPicker
        :disabled="isSubmitting"
        @select="addFiles"
      />

      <ContributionMediaList
        :media="media"
        :total-bytes="totalBytes"
        :photo-count="photoCount"
        :video-count="videoCount"
        :disabled="isSubmitting"
        @remove="removeMedia"
        @move="moveMedia"
      />

      <div class="contribution-format-note">
        <p>照片：JPG、PNG、WebP、HEIC/HEIF，每张不超过 40 MiB、50 MP。</p>
        <p>视频：MP4 或 MOV，每段不超过 500 MiB、5 分钟，支持现代手机拍摄的 HEVC、HDR 视频。</p>
        <p>照片会整理为适合 Journal 展示的尺寸，不作为原片保存。</p>
      </div>
    </section>

    <p v-if="expiresAt" class="contribution-expiry-note">
      这条链接将在 {{ new Date(expiresAt).toLocaleString('zh-CN', {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) }} 到期。
    </p>
    <p v-else class="contribution-expiry-note">
      这是一条长期投稿链接，在创建者主动撤销前持续有效。
    </p>

    <ContributionSubmitBar
      :status="status"
      :upload-percent="uploadPercent"
      :error-message="error"
      :disabled="!canSubmit"
      :wake-lock-active="wakeLockActive"
      @submit="handleSubmit"
    />
  </form>
</template>
