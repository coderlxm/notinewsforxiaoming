<script setup lang="ts">
import type { AdminContributionAsset, AdminContributionDetail, JournalVisibility } from '../../types';
import { formatEntryTime } from '../../utils/formatters';
import EntryVisibilityField from '../publisher/EntryVisibilityField.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import AdminContributionMediaList from './AdminContributionMediaList.vue';

const props = defineProps<{
  contribution: AdminContributionDetail;
  assets: readonly AdminContributionAsset[];
  busy: boolean;
  canPublish: boolean;
  publishing: boolean;
  deleting: boolean;
}>();

const contentText = defineModel<string>('contentText', { required: true });
const visibility = defineModel<JournalVisibility>('visibility', { required: true });
const publishedAt = defineModel<string>('publishedAt', { required: true });

const emit = defineEmits<{
  moveAsset: [assetId: number, direction: -1 | 1];
  removeAsset: [assetId: number];
  publish: [];
  deleteContribution: [];
}>();

function forwardMove(assetId: number, direction: -1 | 1): void {
  emit('moveAsset', assetId, direction);
}
</script>

<template>
  <form class="review-form" @submit.prevent="emit('publish')">
    <section class="review-form__source" aria-labelledby="contribution-source-title">
      <div>
        <span id="contribution-source-title">来自</span>
        <strong>{{ props.contribution.senderName }}</strong>
      </div>
      <time :datetime="props.contribution.submittedAt">
        {{ formatEntryTime(props.contribution.submittedAt) }} 送达
      </time>
    </section>

    <label class="field review-form__content">
      <span class="field__label">正文</span>
      <textarea
        v-model="contentText"
        rows="9"
        maxlength="2000"
        placeholder="整理朋友留下的文字"
        :disabled="busy"
      />
      <span class="review-form__counter">{{ contentText.length }} / 2000</span>
    </label>

    <AdminContributionMediaList
      :assets="assets"
      :disabled="busy"
      @move="forwardMove"
      @remove="emit('removeAsset', $event)"
    />

    <label class="field">
      <span class="field__label">发布时间</span>
      <input v-model="publishedAt" type="datetime-local" required :disabled="busy">
      <span class="review-form__hint">按 Asia/Shanghai 记录，默认使用朋友送达时间。</span>
    </label>

    <EntryVisibilityField v-model="visibility" :disabled="busy" :allow-protected="false" />

    <div class="review-form__actions">
      <button
        class="review-form__delete"
        type="button"
        :disabled="busy"
        :aria-busy="deleting"
        @click="emit('deleteContribution')"
      >
        <JournalLoading v-if="deleting" variant="inline" label="删除中…" />
        <template v-else>删除整份投稿</template>
      </button>
      <button
        class="button button--primary"
        type="submit"
        :disabled="!canPublish"
        :aria-busy="publishing"
      >
        <JournalLoading v-if="publishing" variant="inline" label="发布中…" />
        <template v-else>{{ visibility === 'private' ? '保存为私有记录' : '公开发布' }}</template>
      </button>
    </div>
  </form>
</template>

<style scoped>
.review-form {
  display: grid;
  gap: 1.15rem;
}

.review-form__source {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.review-form__source > div {
  display: grid;
  gap: 0.18rem;
}

.review-form__source span,
.review-form__source time,
.review-form__counter,
.review-form__hint {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.review-form__source strong {
  font-family: var(--font-serif);
  font-size: 1rem;
}

.review-form__content textarea {
  width: 100%;
  min-height: 12rem;
  resize: vertical;
  line-height: 1.7;
}

.review-form__counter {
  justify-self: end;
}

.review-form__hint {
  line-height: 1.45;
}

.review-form__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.25rem;
}

.review-form__delete {
  min-height: 2.25rem;
  padding: 0.5rem 0;
  border: 0;
  background: transparent;
  color: var(--danger);
  cursor: pointer;
  font-size: 0.76rem;
}

@media (max-width: 599px) {
  .review-form__source,
  .review-form__actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .review-form__actions .button,
  .review-form__delete {
    width: 100%;
  }
}
</style>
