<script setup lang="ts">
import { useFileDialog } from '@vueuse/core';
import { shallowRef } from 'vue';
import type { JournalAdminResumeSummary } from '../../types';

const props = defineProps<{
  summary: JournalAdminResumeSummary | null;
  busy: boolean;
}>();

const emit = defineEmits<{
  upload: [file: File];
  delete: [];
}>();

const pendingFile = shallowRef<File | null>(null);
const {
  open,
  reset,
  onChange: onFileChange,
} = useFileDialog({
  accept: '.md,.markdown,.pdf,text/markdown,application/pdf',
  multiple: false,
  reset: true,
});

onFileChange((files) => {
  const file = files?.item(0) ?? null;
  pendingFile.value = file;
});

function chooseFile(): void {
  open();
}

function submitUpload(): void {
  const file = pendingFile.value;
  if (!file || props.busy) return;
  pendingFile.value = null;
  reset();
  emit('upload', file);
}

function discardPending(): void {
  pendingFile.value = null;
  reset();
}

function requestDelete(): void {
  if (!window.confirm('确定下线并删除当前简历吗？此操作无法恢复。')) return;
  emit('delete');
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<template>
  <div class="resume-file-panel">
    <div v-if="pendingFile" class="resume-file-panel__pending">
      <div class="resume-file-panel__pending-copy">
        <span class="resume-file-panel__pending-name" :title="pendingFile.name">{{ pendingFile.name }}</span>
        <span class="resume-file-panel__meta">{{ formatBytes(pendingFile.size) }}</span>
      </div>
      <div class="resume-file-panel__actions">
        <button
          class="button button--primary"
          type="button"
          :disabled="busy"
          :aria-busy="busy"
          @click="submitUpload"
        >
          上传简历
        </button>
        <button class="button button--quiet" type="button" :disabled="busy" @click="discardPending">
          取消
        </button>
      </div>
    </div>

    <div v-else-if="summary" class="resume-file-panel__existing">
      <div class="resume-file-panel__existing-copy">
        <span class="resume-file-panel__name" :title="summary.originalName">{{ summary.originalName }}</span>
        <span class="resume-file-panel__meta">
          {{ summary.format === 'markdown' ? 'Markdown' : 'PDF' }} · 更新于 {{ formatDate(summary.updatedAt) }}
        </span>
      </div>
      <div class="resume-file-panel__actions">
        <RouterLink class="button button--quiet" to="/resume">查看</RouterLink>
        <button class="button button--quiet" type="button" :disabled="busy" @click="chooseFile">
          替换
        </button>
        <button class="button button--quiet resume-file-panel__delete" type="button" :disabled="busy" @click="requestDelete">
          下线
        </button>
      </div>
    </div>

    <div v-else class="resume-file-panel__empty">
      <div class="resume-file-panel__empty-copy">
        <span class="resume-file-panel__title">尚未上传简历</span>
        <span class="resume-file-panel__meta">支持 Markdown（.md / .markdown，≤ 1 MB）或 PDF（≤ 10 MB），新文件会直接替换当前简历。</span>
      </div>
      <button class="button button--quiet" type="button" @click="chooseFile">选择文件</button>
    </div>
  </div>
</template>

<style scoped>
.resume-file-panel {
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.resume-file-panel__pending,
.resume-file-panel__existing,
.resume-file-panel__empty {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.resume-file-panel__pending-copy,
.resume-file-panel__existing-copy,
.resume-file-panel__empty-copy {
  display: grid;
  min-width: 0;
  gap: 0.22rem;
}

.resume-file-panel__name,
.resume-file-panel__pending-name,
.resume-file-panel__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
  font-weight: 700;
}

.resume-file-panel__meta {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.5;
}

.resume-file-panel__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.5rem;
}

.resume-file-panel__delete:hover {
  color: var(--danger);
}

@media (max-width: 520px) {
  .resume-file-panel__pending,
  .resume-file-panel__existing,
  .resume-file-panel__empty {
    align-items: stretch;
    flex-direction: column;
  }

  .resume-file-panel__actions {
    flex-wrap: wrap;
  }
}
</style>
