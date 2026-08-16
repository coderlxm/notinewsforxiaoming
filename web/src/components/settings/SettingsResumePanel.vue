<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import {
  deleteResume as deleteResumeRequest,
  fetchAdminResume,
  updateResumeAccess,
  uploadResume,
} from '../../api';
import { useSiteProfileStore } from '../../stores/siteProfile';
import type {
  JournalAdminResumeSummary,
  JournalResumeAccessInput,
  JournalResumeAccessUpdateResponse,
} from '../../types';
import { showMessage } from '../../utils/message';
import JournalLoading from '../ui/JournalLoading.vue';
import SettingsResumeAccessPanel from './SettingsResumeAccessPanel.vue';
import SettingsResumeFilePanel from './SettingsResumeFilePanel.vue';

const siteProfile = useSiteProfileStore();
const summary = shallowRef<JournalAdminResumeSummary | null>(null);
const loading = shallowRef(true);
const busy = shallowRef(false);
const error = shallowRef<string | null>(null);
const generatedShareUrl = shallowRef<string | null>(null);

onMounted(async () => {
  try {
    summary.value = await fetchAdminResume();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
});

function exposeError(reason: unknown): void {
  error.value = reason instanceof Error ? reason.message : String(reason);
}

async function handleUpload(file: File): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    const replacing = summary.value !== null;
    summary.value = await uploadResume(file);
    siteProfile.setResumeFromAdmin(summary.value);
    showMessage({
      message: replacing ? '简历已替换，沿用当前访问权限。' : '简历已上传，当前仅自己可见。',
      type: 'success',
    });
  } catch (reason) {
    exposeError(reason);
  } finally {
    busy.value = false;
  }
}

async function handleDelete(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await deleteResumeRequest();
    summary.value = null;
    generatedShareUrl.value = null;
    siteProfile.setResumeFromAdmin(null);
    showMessage({ message: '简历已下线。', type: 'success' });
  } catch (reason) {
    exposeError(reason);
  } finally {
    busy.value = false;
  }
}

async function handleAccess(input: JournalResumeAccessInput): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    const response = await updateResumeAccess(input);
    applyAccessResponse(response);
    siteProfile.setResumeFromAdmin(response.summary);
  } catch (reason) {
    exposeError(reason);
  } finally {
    busy.value = false;
  }
}

function applyAccessResponse(response: JournalResumeAccessUpdateResponse): void {
  summary.value = response.summary;
  generatedShareUrl.value = response.shareUrl;
  if (response.shareUrl !== null) {
    showMessage({ message: '限时链接已生成。', type: 'success' });
    return;
  }
  showMessage({ message: '简历权限已更新。', type: 'success' });
}

async function copyGeneratedShareUrl(): Promise<void> {
  if (generatedShareUrl.value === null) return;
  try {
    await navigator.clipboard.writeText(generatedShareUrl.value);
    showMessage({ message: '限时链接已复制。', type: 'success' });
  } catch (reason) {
    exposeError(reason);
  }
}
</script>

<template>
  <section class="resume-panel" aria-labelledby="resume-settings-title">
    <div class="resume-panel__heading">
      <h2 id="resume-settings-title">个人简历</h2>
      <p>上传一份 Markdown 或 PDF 简历，并控制它在「关于我」与独立页面中的可见性。</p>
    </div>

    <JournalLoading v-if="loading" variant="reading" label="正在读取简历…" />

    <template v-else>
      <SettingsResumeFilePanel
        :summary="summary"
        :busy="busy"
        @upload="handleUpload"
        @delete="handleDelete"
      />
      <SettingsResumeAccessPanel
        v-if="summary"
        :summary="summary"
        :busy="busy"
        :share-url="generatedShareUrl"
        @update="handleAccess"
        @copy-share-url="copyGeneratedShareUrl"
      />
    </template>

    <p v-if="error" class="resume-panel__error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.resume-panel,
.resume-panel__heading {
  display: grid;
}

.resume-panel {
  gap: 1.1rem;
}

.resume-panel__heading {
  gap: 0.25rem;
}

.resume-panel__heading h2 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.1rem;
}

.resume-panel__heading p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.resume-panel__error {
  margin: 0;
  color: var(--danger);
  font-size: 0.78rem;
}
</style>
