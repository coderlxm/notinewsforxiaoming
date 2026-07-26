<script setup lang="ts">
import { computed } from 'vue';
import type { AdminContributionSummary } from '../../types';
import { formatEntryTime } from '../../utils/formatters';

const props = defineProps<{
  contributions: readonly AdminContributionSummary[];
}>();

const emit = defineEmits<{
  select: [publicId: string];
}>();

const cards = computed(() => props.contributions.map(contribution => ({
  ...contribution,
  submittedAtLabel: formatEntryTime(contribution.submittedAt),
  contentSummary: contribution.contentText.trim() || '仅包含媒体',
  mediaSummary: [
    contribution.photoCount ? `${contribution.photoCount} 张照片` : '',
    contribution.videoCount ? `${contribution.videoCount} 段视频` : '',
  ].filter(Boolean).join(' · ') || '纯文字',
})));
</script>

<template>
  <div class="contribution-list">
    <button
      v-for="contribution in cards"
      :key="contribution.publicId"
      class="contribution-card"
      type="button"
      @click="emit('select', contribution.publicId)"
    >
      <span class="contribution-card__heading">
        <strong>{{ contribution.senderName }}</strong>
        <time :datetime="contribution.submittedAt">{{ contribution.submittedAtLabel }}</time>
      </span>
      <span class="contribution-card__copy">{{ contribution.contentSummary }}</span>
      <span
        v-if="contribution.assets.length"
        class="contribution-card__previews"
        :class="{ 'contribution-card__previews--single': contribution.assets.length === 1 }"
        aria-hidden="true"
      >
        <img
          v-for="asset in contribution.assets"
          :key="asset.id"
          :src="asset.previewUrl"
          alt=""
          loading="lazy"
        >
      </span>
      <span class="contribution-card__footer">
        <span>{{ contribution.mediaSummary }}</span>
        <span>整理 →</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.contribution-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.contribution-card {
  display: grid;
  min-width: 0;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: border-color 140ms ease, transform 140ms ease;
}

.contribution-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.contribution-card__heading,
.contribution-card__footer {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.contribution-card__heading strong {
  overflow: hidden;
  font-family: var(--font-serif);
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contribution-card__heading time,
.contribution-card__footer {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.contribution-card__heading time {
  flex: none;
}

.contribution-card__copy {
  display: -webkit-box;
  min-height: 2.8rem;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.contribution-card__previews {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem;
  overflow: hidden;
  border-radius: var(--radius-media);
}

.contribution-card__previews--single {
  grid-template-columns: 1fr;
}

.contribution-card__previews img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: var(--surface-muted);
  object-fit: cover;
}

.contribution-card__footer span:last-child {
  color: var(--accent-strong);
  font-weight: 650;
}

@media (max-width: 699px) {
  .contribution-list {
    grid-template-columns: 1fr;
  }
}
</style>
