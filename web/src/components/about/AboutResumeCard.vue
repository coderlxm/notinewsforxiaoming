<script setup lang="ts">
import { computed } from 'vue';
import type { JournalResumeSummary } from '../../types';

const props = defineProps<{
  resume: JournalResumeSummary;
}>();

const formatLabel = computed(() => props.resume.format === 'markdown' ? 'Markdown' : 'PDF');
const formattedDate = computed(() => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(props.resume.updatedAt)));
</script>

<template>
  <RouterLink class="about-resume-card" :to="resume.viewUrl">
    <span class="about-resume-card__copy">
      <span class="about-resume-card__title">个人简历</span>
      <span class="about-resume-card__meta">
        {{ formatLabel }} · 更新于 {{ formattedDate }}
        <span v-if="resume.accessMode === 'protected'" class="about-resume-card__hint">需访问口令</span>
      </span>
    </span>
    <span class="about-resume-card__indicator" aria-hidden="true">→</span>
  </RouterLink>
</template>

<style scoped>
.about-resume-card {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.45rem 0 0.45rem 0.7rem;
  border-left: 2px solid var(--border-subtle);
  color: var(--text-primary);
  text-decoration: none;
  transition: border-color 150ms ease;
}

.about-resume-card:hover,
.about-resume-card:focus-visible {
  border-left-color: var(--accent);
}

.about-resume-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

.about-resume-card__copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.about-resume-card__title {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 750;
  line-height: 1.4;
}

.about-resume-card__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.74rem;
}

.about-resume-card__hint {
  flex: none;
  padding: 0.14rem 0.5rem;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 0.66rem;
}

.about-resume-card__indicator {
  flex: none;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.about-resume-card:hover .about-resume-card__indicator {
  color: var(--accent-strong);
}

@media (max-width: 599px) {
  .about-resume-card {
    gap: 0.75rem;
  }
}
</style>