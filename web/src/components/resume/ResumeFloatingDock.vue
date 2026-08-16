<script setup lang="ts">
import { showMessage } from '../../utils/message';

const props = defineProps<{
  downloadUrl: string;
  shareUrl: string | null;
  format: 'markdown' | 'pdf';
  contentUrl?: string;
}>();

async function copyShareUrl(): Promise<void> {
  if (!props.shareUrl) return;
  await navigator.clipboard.writeText(props.shareUrl);
  showMessage({ message: '简历分享地址已复制', type: 'success' });
}
</script>

<template>
  <aside class="resume-dock" aria-label="简历操作栏">
    <div class="resume-dock__inner">
      <RouterLink class="resume-dock__button resume-dock__button--back" to="/about" title="返回关于我">
        <svg class="resume-dock__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span class="resume-dock__label">关于我</span>
      </RouterLink>

      <span class="resume-dock__divider" aria-hidden="true" />

      <button
        v-if="shareUrl"
        class="resume-dock__button"
        type="button"
        title="复制公开分享链接"
        @click="copyShareUrl"
      >
        <svg class="resume-dock__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span class="resume-dock__label">复制地址</span>
      </button>

      <a
        v-if="format === 'pdf' && contentUrl"
        class="resume-dock__button"
        :href="contentUrl"
        target="_blank"
        rel="noopener noreferrer"
        title="在新窗口查看 PDF 原版"
      >
        <svg class="resume-dock__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        <span class="resume-dock__label">新窗口</span>
      </a>

      <a
        class="resume-dock__button resume-dock__button--primary"
        :href="downloadUrl"
        title="下载原始简历文件"
      >
        <svg class="resume-dock__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span class="resume-dock__label">下载原文件</span>
      </a>
    </div>
  </aside>
</template>

<style scoped>
.resume-dock {
  position: fixed;
  bottom: clamp(1.2rem, 3vw, 2rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  pointer-events: none;
}

.resume-dock__inner {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-card) 88%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--ink) 14%, transparent);
  pointer-events: auto;
}

.resume-dock__divider {
  width: 1px;
  height: 1.1rem;
  margin: 0 0.15rem;
  background: var(--border-subtle);
}

.resume-dock__button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2rem;
  padding: 0.3rem 0.7rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.76rem;
  font-weight: 650;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, transform 140ms ease;
}

.resume-dock__button:hover {
  background: var(--surface-muted);
  color: var(--accent-strong);
  transform: translateY(-1px);
}

.resume-dock__button--back {
  color: var(--text-muted);
}

.resume-dock__button--primary {
  background: var(--accent-strong);
  color: #ffffff;
}

.resume-dock__button--primary:hover {
  background: var(--focus);
  color: #ffffff;
}

.resume-dock__icon {
  width: 0.95rem;
  height: 0.95rem;
  flex: none;
}

@media (max-width: 599px) {
  .resume-dock {
    bottom: 1rem;
    width: calc(100% - 2rem);
    max-width: 24rem;
  }

  .resume-dock__inner {
    justify-content: space-around;
    width: 100%;
    padding: 0.3rem;
  }

  .resume-dock__button {
    padding: 0.3rem 0.5rem;
    font-size: 0.72rem;
  }
}
</style>
