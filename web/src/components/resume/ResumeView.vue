<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, shallowRef } from 'vue';
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import {
  exchangeResumeShareToken,
  fetchPublicResume,
  JournalRequestError,
  unlockResume,
} from '../../api';
import { useSiteProfileStore } from '../../stores/siteProfile';
import type { JournalPublicResume } from '../../types';
import JournalLoading from '../ui/JournalLoading.vue';
import MarkdownResumeViewer from './MarkdownResumeViewer.vue';
import PdfResumeViewer from './PdfResumeViewer.vue';
import ResumeAccessGate from './ResumeAccessGate.vue';
import ResumeFloatingDock from './ResumeFloatingDock.vue';
import ResumeHero from './ResumeHero.vue';

const route = useRoute();
const router = useRouter();
const siteProfile = useSiteProfileStore();
const { profile } = storeToRefs(siteProfile);

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
      <ResumeHero :profile="profile" :resume="resume" />

      <section class="resume-view__content">
        <MarkdownResumeViewer
          v-if="resume.format === 'markdown'"
          :html="resume.renderedHtml"
        />
        <PdfResumeViewer
          v-else
          :pages="resume.previewPages"
          :content-url="resume.contentUrl"
          :download-url="resume.downloadUrl"
          :original-name="resume.originalName"
          :updated-at="resume.updatedAt"
        />
      </section>

      <ResumeFloatingDock
        :format="resume.format"
        :download-url="resume.downloadUrl"
        :share-url="fixedShareUrl"
        :content-url="resume.format === 'pdf' ? resume.contentUrl : undefined"
      />
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
  padding: clamp(1.8rem, 4vw, 3.2rem) 0 6.5rem;
}

.resume-view__loading {
  display: grid;
  min-height: 55vh;
}

.resume-view__content {
  width: 100%;
}

.resume-view__error {
  margin: 2rem auto 0;
  max-width: var(--reading-width);
  color: var(--danger);
  font-size: 0.9rem;
}

@media (max-width: 599px) {
  .resume-view {
    padding-top: 1.2rem;
    padding-bottom: 5.5rem;
  }
}
</style>
