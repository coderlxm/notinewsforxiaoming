<script setup lang="ts">
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { computed, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAdminContributions } from '../../composables/useAdminContributions';
import type { AdminContributionAsset, JournalVisibility } from '../../types';
import JournalLoading from '../ui/JournalLoading.vue';
import AdminContributionReviewForm from './AdminContributionReviewForm.vue';

dayjs.extend(utc);
dayjs.extend(timezone);

const props = defineProps<{
  publicId: string;
}>();

const timeZone = 'Asia/Shanghai';
const router = useRouter();
const inbox = useAdminContributions();
const contentText = shallowRef('');
const assets = shallowRef<AdminContributionAsset[]>([]);
const visibility = shallowRef<JournalVisibility>('private');
const publishedAt = shallowRef('');

const busy = computed(() => inbox.mutation.value !== null);
const canPublish = computed(() =>
  !busy.value
  && publishedAt.value.length > 0
  && (contentText.value.trim().length > 0 || assets.value.length > 0),
);

function initializeForm(): void {
  const contribution = inbox.detail.value;
  if (!contribution || contribution.publicId !== props.publicId) return;
  contentText.value = contribution.contentText;
  assets.value = [...contribution.assets].sort((left, right) => left.sortOrder - right.sortOrder);
  visibility.value = 'private';
  publishedAt.value = dayjs(contribution.submittedAt).tz(timeZone).format('YYYY-MM-DDTHH:mm');
}

watch(() => props.publicId, async (publicId) => {
  contentText.value = '';
  assets.value = [];
  visibility.value = 'private';
  publishedAt.value = '';
  await inbox.loadContribution(publicId);
  if (props.publicId === publicId) initializeForm();
}, { immediate: true });

function moveAsset(assetId: number, direction: -1 | 1): void {
  const index = assets.value.findIndex(asset => asset.id === assetId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= assets.value.length) return;
  const reordered = [...assets.value];
  const [asset] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, asset!);
  assets.value = reordered;
}

async function removeAsset(assetId: number): Promise<void> {
  const asset = assets.value.find(candidate => candidate.id === assetId);
  if (!asset || !window.confirm(`确定删除“${asset.sourceName}”吗？删除后不能恢复。`)) return;
  await inbox.removeAsset(props.publicId, assetId);
  if (!inbox.detail.value?.assets.some(candidate => candidate.id === assetId)) {
    assets.value = assets.value.filter(candidate => candidate.id !== assetId);
  }
}

async function publish(): Promise<void> {
  if (!canPublish.value) return;
  const entry = await inbox.publishContribution(props.publicId, {
    contentText: contentText.value.trim(),
    assetIds: assets.value.map(asset => asset.id),
    sourceCreatedAt: dayjs.tz(publishedAt.value, timeZone).utc().toISOString(),
    visibility: visibility.value,
  });
  if (!entry) return;
  await router.push({ name: 'contribution-inbox' });
}

async function removeContribution(): Promise<void> {
  if (!window.confirm('确定删除整份投稿吗？其中尚未发布的素材也会被删除。')) return;
  const removed = await inbox.removeContribution(props.publicId);
  if (removed) await router.push({ name: 'contribution-inbox' });
}
</script>

<template>
  <main class="contribution-review">
    <div class="contribution-review__heading">
      <button class="text-button" type="button" @click="router.push({ name: 'contribution-inbox' })">
        ← 返回投稿箱
      </button>
      <span>整理投稿</span>
    </div>

    <header class="contribution-review__intro">
      <h1>整理为 Journal 记录</h1>
      <p>检查正文与素材顺序，再选择私有保存或公开发布。</p>
    </header>

    <p v-if="inbox.detailError.value" class="notice notice--error" role="alert">
      {{ inbox.detailError.value }}
    </p>
    <div v-if="inbox.detailLoading.value" class="contribution-review__loading">
      <JournalLoading variant="reading" label="正在打开投稿…" />
    </div>
    <AdminContributionReviewForm
      v-else-if="inbox.detail.value"
      v-model:content-text="contentText"
      v-model:visibility="visibility"
      v-model:published-at="publishedAt"
      :contribution="inbox.detail.value"
      :assets="assets"
      :busy="busy"
      :can-publish="canPublish"
      :publishing="inbox.mutation.value === 'publish'"
      :deleting="inbox.mutation.value === 'delete'"
      @move-asset="moveAsset"
      @remove-asset="removeAsset"
      @publish="publish"
      @delete-contribution="removeContribution"
    />
  </main>
</template>

<style scoped>
.contribution-review {
  display: grid;
  gap: 1.15rem;
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--editor-width));
  margin: 0 auto;
  padding: 1.3rem 0 4rem;
}

.contribution-review__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.15rem;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.contribution-review__intro h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.35rem;
}

.contribution-review__intro p {
  margin: 0.3rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.contribution-review__loading {
  min-height: 50vh;
}
</style>
