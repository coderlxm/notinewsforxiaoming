<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import {
  exchangeResumeShareToken,
  fetchPublicResume,
  JournalRequestError,
  unlockResume,
} from '../../api';
import type { JournalPublicResume } from '../../types';
import { showMessage } from '../../utils/message';
import JournalLoading from '../ui/JournalLoading.vue';
import MarkdownResumeViewer from './MarkdownResumeViewer.vue';
import PdfResumeViewer from './PdfResumeViewer.vue';
import ResumeAccessGate from './ResumeAccessGate.vue';

const route = useRoute();
const router = useRouter();
const loading = shallowRef(true);
const busy = shallowRef(false);
const unlockError = shallowRef<string | null>(null);
const loadError = shallowRef<string | null>(null);
const content = shallowRef<JournalPublicResume | null>(null);
const enteredViaShareToken = shallowRef(false);

const locked = computed(() => content.value?.kind === 'locked');
const resume = computed(() => content.value?.kind === 'resume' ? content.value : null);
const fixedShareUrl = computed(() => (
  !enteredViaShareToken.value
  && (resume.value?.accessMode === 'protected' || resume.value?.accessMode === 'public')
    ? `${window.location.origin}/resume`
    : null
));

onMounted(() => {
  void load(route.hash);
});

onBeforeRouteUpdate((to, from) => {
  if (to.name === 'resume' && to.hash !== '' && to.hash !== from.hash) {
    void load(to.hash);
  }
});

async function load(hash: string): Promise<void> {
  loading.value = true;
  loadError.value = null;
  content.value = null;
  const token = readShareToken(hash);
  try {
    if (token !== null) {
      enteredViaShareToken.value = true;
      content.value = await exchangeResumeShareToken(token);
      await router.replace({ path: route.path, query: route.query, hash: '' });
    } else {
      content.value = await fetchPublicResume();
    }
  } catch (reason) {
    handleLoadFailure(reason);
    return;
  }
  loading.value = false;
}

function readShareToken(hash: string): string | null {
  if (!hash.startsWith('#token=')) return null;
  return hash.slice('#token='.length);
}

function handleLoadFailure(reason: unknown): void {
  loading.value = false;
  if (reason instanceof JournalRequestError && reason.status === 404) {
    void router.replace('/404');
    return;
  }
  loadError.value = reason instanceof Error ? reason.message : String(reason);
}

async function unlock(password: string): Promise<void> {
  busy.value = true;
  unlockError.value = null;
  try {
    content.value = await unlockResume(password);
  } catch (reason) {
    if (reason instanceof JournalRequestError && reason.status === 401) {
      unlockError.value = '简历访问口令不正确';
    } else if (reason instanceof JournalRequestError && reason.status === 404) {
      handleLoadFailure(reason);
    } else {
      unlockError.value = reason instanceof Error ? reason.message : String(reason);
    }
  } finally {
    busy.value = false;
  }
}

async function copyResumeLink(): Promise<void> {
  if (fixedShareUrl.value === null) return;
  await navigator.clipboard.writeText(fixedShareUrl.value);
  showMessage({ message: '简历地址已复制', type: 'success' });
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
</script>

<template>
  <main class="resume-view">
    <div v-if="loading" class="resume-view__loading">
      <JournalLoading variant="reading" label="正在打开简历…" />
    </div>

    <ResumeAccessGate
      v-else-if="locked"
      :busy="busy"
      :error="unlockError"
      @unlock="unlock"
    />

    <template v-else-if="resume">
      <div class="resume-view__toolbar">
        <RouterLink class="text-button" to="/about">← 返回关于我</RouterLink>
        <div class="resume-view__actions">
          <button
            v-if="fixedShareUrl"
            class="button button--quiet"
            type="button"
            @click="copyResumeLink"
          >
            复制地址
          </button>
          <a class="button button--quiet" :href="resume.downloadUrl">下载原文件</a>
        </div>
      </div>

      <div class="resume-view__meta">
        <span class="resume-view__format">{{ resume.format === 'markdown' ? 'Markdown' : 'PDF' }}</span>
        <span class="resume-view__separator" aria-hidden="true">·</span>
        <span>更新于 {{ formatDate(resume.updatedAt) }}</span>
        <span class="resume-view__name" :title="resume.originalName">{{ resume.originalName }}</span>
      </div>

      <MarkdownResumeViewer v-if="resume.format === 'markdown'" :html="resume.renderedHtml" />
      <PdfResumeViewer v-else :src="resume.contentUrl" />
    </template>

    <div v-else-if="loadError" class="resume-view__error" role="alert">
      {{ loadError }}
    </div>
  </main>
</template>

<style scoped>
.resume-view {
  width: min(calc(100% - (var(--page-gutter) * 2)), 960px);
  margin: 0 auto;
  padding: clamp(1.6rem, 4vw, 3rem) 0 5rem;
}

.resume-view__loading {
  display: grid;
  min-height: 55vh;
}

.resume-view__toolbar {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.resume-view__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.resume-view__meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.6rem 0 1.4rem;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.74rem;
}

.resume-view__format {
  color: var(--accent-strong);
  font-weight: 700;
}

.resume-view__separator {
  color: var(--border-strong);
}

.resume-view__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resume-view__error {
  margin: 2rem auto 0;
  max-width: var(--reading-width);
  color: var(--danger);
  font-size: 0.9rem;
}

@media (max-width: 599px) {
  .resume-view {
    padding-top: 1rem;
  }

  .resume-view__meta {
    flex-wrap: wrap;
  }
}
</style>
