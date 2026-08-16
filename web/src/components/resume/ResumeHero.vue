<script setup lang="ts">
import { computed } from 'vue';
import type { JournalPublicResume, SiteContactItem, SiteProfile } from '../../types';
import { showMessage } from '../../utils/message';
import AboutContactIcon from '../about/AboutContactIcon.vue';

const props = defineProps<{
  profile: SiteProfile | null;
  resume: Extract<JournalPublicResume, { kind: 'resume' }>;
}>();

const isPdf = computed(() => props.resume.format === 'pdf');
const pageCount = computed(() => (props.resume.format === 'pdf' ? props.resume.previewPages.length : 0));

const visibleContacts = computed(() =>
  props.profile?.contactItems.filter((item) => item.enabled && item.value.trim()) ?? [],
);

const formattedDate = computed(() => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(props.resume.updatedAt)));

function contactHref(item: SiteContactItem): string | undefined {
  if (item.kind === 'email') return `mailto:${item.value}`;
  if (item.url) return item.url;
  return undefined;
}

async function copyContact(item: SiteContactItem): Promise<void> {
  await navigator.clipboard.writeText(item.value);
  showMessage({ message: `已复制${item.label}`, type: 'success' });
}
</script>

<template>
  <!-- 桌面端 PDF 模式：紧凑精炼元信息条，杜绝与桌面端大尺寸 PDF 内部大标题重复 -->
  <header v-if="isPdf" class="resume-hero resume-hero--desktop-compact">
    <div class="resume-hero__compact-left">
      <img
        v-if="profile?.avatarUrl"
        class="resume-hero__compact-avatar"
        :src="profile.avatarUrl"
        alt="小明同学"
      >
      <div class="resume-hero__compact-copy">
        <span class="resume-hero__compact-name">小明同学</span>
        <span class="resume-hero__compact-separator">/</span>
        <span class="resume-hero__compact-title">个人简历</span>
      </div>
    </div>

    <div class="resume-hero__compact-meta">
      <span class="resume-hero__meta-badge">PDF ({{ pageCount }}P)</span>
      <span class="resume-hero__meta-separator">·</span>
      <span>更新于 {{ formattedDate }}</span>
      <span class="resume-hero__meta-separator">·</span>
      <span class="resume-hero__meta-filename" :title="resume.originalName">{{ resume.originalName }}</span>
    </div>
  </header>

  <!-- 移动端（全部格式）或桌面端 Markdown：完整个人名片与联系方式 -->
  <header class="resume-hero" :class="{ 'resume-hero--mobile-only': isPdf }">
    <div class="resume-hero__profile">
      <img
        v-if="profile?.avatarUrl"
        class="resume-hero__avatar"
        :src="profile.avatarUrl"
        alt="小明同学"
      >
      <div class="resume-hero__identity">
        <div class="resume-hero__title-row">
          <h1 class="resume-hero__name">小明同学</h1>
          <span class="resume-hero__tag">RESUME</span>
        </div>
        <p v-if="profile?.bio" class="resume-hero__bio">{{ profile.bio }}</p>
      </div>
    </div>

    <div v-if="visibleContacts.length" class="resume-hero__contacts">
      <template v-for="item in visibleContacts" :key="item.kind">
        <button
          v-if="item.kind === 'wechat' || !contactHref(item)"
          class="resume-hero__pill"
          type="button"
          :title="`点击复制 ${item.label}: ${item.value}`"
          @click="copyContact(item)"
        >
          <AboutContactIcon class="resume-hero__pill-icon" :kind="item.kind" />
          <span class="resume-hero__pill-label">{{ item.label }}:</span>
          <span class="resume-hero__pill-value">{{ item.value }}</span>
        </button>
        <a
          v-else
          class="resume-hero__pill"
          :href="contactHref(item)"
          :target="item.kind === 'email' ? undefined : '_blank'"
          :rel="item.kind === 'email' ? undefined : 'noopener noreferrer'"
          :title="`${item.label}: ${item.value}`"
        >
          <AboutContactIcon class="resume-hero__pill-icon" :kind="item.kind" />
          <span class="resume-hero__pill-label">{{ item.label }}:</span>
          <span class="resume-hero__pill-value">{{ item.value }}</span>
          <span v-if="item.kind !== 'email'" class="resume-hero__pill-arrow" aria-hidden="true">↗</span>
        </a>
      </template>
    </div>

    <div class="resume-hero__meta">
      <span class="resume-hero__meta-badge">{{ isPdf ? `PDF (${pageCount}P)` : 'Markdown' }}</span>
      <span class="resume-hero__meta-separator" aria-hidden="true">·</span>
      <span>更新于 {{ formattedDate }}</span>
      <span class="resume-hero__meta-separator" aria-hidden="true">·</span>
      <span class="resume-hero__meta-filename" :title="resume.originalName">{{ resume.originalName }}</span>
    </div>
  </header>
</template>

<style scoped>
.resume-hero {
  display: grid;
  gap: 1.25rem;
  margin-bottom: 2rem;
  padding-bottom: 1.6rem;
  border-bottom: 1px solid var(--border-subtle);
}

/* 桌面端 PDF 紧凑面包屑 */
.resume-hero--desktop-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-bottom: 0.9rem;
  flex-wrap: wrap;
}

@media (max-width: 599px) {
  .resume-hero--desktop-compact {
    display: none;
  }
}

.resume-hero--mobile-only {
  display: none;
}

@media (max-width: 599px) {
  .resume-hero--mobile-only {
    display: grid;
    margin-bottom: 1.25rem;
    padding-bottom: 1.25rem;
  }
}

.resume-hero__compact-left {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.resume-hero__compact-avatar {
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 1px var(--border-strong);
}

.resume-hero__compact-copy {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-serif);
  font-size: 0.95rem;
  font-weight: 750;
}

.resume-hero__compact-name {
  color: var(--text-primary);
}

.resume-hero__compact-separator {
  color: var(--border-strong);
  font-weight: 400;
}

.resume-hero__compact-title {
  color: var(--text-muted);
}

.resume-hero__compact-meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.72rem;
  flex-wrap: wrap;
}

/* 完整版头部 */
.resume-hero__profile {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.resume-hero__avatar {
  width: 4.5rem;
  height: 4.5rem;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 1px var(--border-strong);
}

.resume-hero__identity {
  min-width: 0;
  display: grid;
  gap: 0.25rem;
}

.resume-hero__title-row {
  display: flex;
  align-items: baseline;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.resume-hero__name {
  margin: 0;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: clamp(1.75rem, 3.5vw, 2.25rem);
  font-weight: 750;
  line-height: 1.2;
}

.resume-hero__tag {
  color: var(--accent-strong);
  font-family: var(--font-condensed);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.resume-hero__bio {
  margin: 0;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  line-height: 1.5;
}

.resume-hero__contacts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.resume-hero__pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-card);
  color: var(--text-primary);
  font-size: 0.75rem;
  text-decoration: none;
  cursor: pointer;
  transition: border-color 140ms ease, transform 140ms ease, background-color 140ms ease;
}

.resume-hero__pill:hover {
  border-color: var(--accent);
  background: var(--surface-muted);
  transform: translateY(-1px);
}

.resume-hero__pill-icon {
  width: 0.95rem;
  height: 0.95rem;
  flex: none;
  color: var(--accent-strong);
}

.resume-hero__pill-label {
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.resume-hero__pill-value {
  font-weight: 600;
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resume-hero__pill-arrow {
  color: var(--text-muted);
  font-size: 0.68rem;
  margin-left: 0.1rem;
}

.resume-hero__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.72rem;
}

.resume-hero__meta-badge {
  padding: 0.12rem 0.45rem;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-family: var(--font-condensed);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.resume-hero__meta-separator {
  color: var(--border-strong);
}

.resume-hero__meta-filename {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 599px) {
  .resume-hero {
    gap: 1rem;
    margin-bottom: 1.25rem;
    padding-bottom: 1rem;
  }

  .resume-hero__avatar {
    width: 3.4rem;
    height: 3.4rem;
  }

  .resume-hero__name {
    font-size: 1.45rem;
  }

  .resume-hero__contacts {
    gap: 0.4rem;
  }

  .resume-hero__pill {
    font-size: 0.72rem;
  }
}
</style>
