<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type {
  JournalAdminResumeSummary,
  JournalResumeAccessInput,
  JournalResumeAccessMode,
} from '../../types';

const props = defineProps<{
  summary: JournalAdminResumeSummary;
  busy: boolean;
  shareUrl: string | null;
}>();

const emit = defineEmits<{
  update: [input: JournalResumeAccessInput];
  copyShareUrl: [];
}>();

type TemporaryPreset = '1h' | '24h' | '3d' | '7d' | 'custom';

const presetOptions: Array<{ value: TemporaryPreset; label: string }> = [
  { value: '1h', label: '1 小时' },
  { value: '24h', label: '24 小时' },
  { value: '3d', label: '3 天' },
  { value: '7d', label: '7 天' },
  { value: 'custom', label: '自定义' },
];

const presetDurations: Record<Exclude<TemporaryPreset, 'custom'>, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const maxTemporaryMs = 30 * 24 * 60 * 60 * 1000;
const modeLabels: Record<JournalResumeAccessMode, string> = {
  private: '仅自己可见',
  protected: '访问口令',
  temporary: '限时链接',
  public: '完全公开',
};

const selectedMode = shallowRef<JournalResumeAccessMode>(props.summary.accessMode);
const password = shallowRef('');
const presetValue = shallowRef<TemporaryPreset>('24h');
const customExpiresAt = shallowRef('');

const passwordValid = computed(() => /^\d{6}$/.test(password.value));

const temporaryExpiresAt = computed<string | null>(() => {
  if (selectedMode.value !== 'temporary') return null;
  const selectedPreset = presetValue.value;
  if (selectedPreset === 'custom') {
    if (!customExpiresAt.value) return null;
    const date = new Date(customExpiresAt.value);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getTime() > Date.now() + maxTemporaryMs) return null;
    return date.toISOString();
  }
  return new Date(Date.now() + presetDurations[selectedPreset]).toISOString();
});

const canSave = computed(() => {
  if (props.busy) return false;
  if (selectedMode.value === 'protected') return passwordValid.value;
  if (selectedMode.value === 'temporary') return temporaryExpiresAt.value !== null;
  return true;
});

function selectPreset(preset: TemporaryPreset): void {
  presetValue.value = preset;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function save(): void {
  if (!canSave.value) return;
  if (selectedMode.value === 'protected') {
    emit('update', { accessMode: 'protected', password: password.value });
    return;
  }
  if (selectedMode.value === 'temporary') {
    if (!temporaryExpiresAt.value) return;
    emit('update', { accessMode: 'temporary', expiresAt: temporaryExpiresAt.value });
    return;
  }
  emit('update', { accessMode: selectedMode.value });
}
</script>

<template>
  <div class="resume-access-panel">
    <div class="resume-access-panel__heading">
      <span class="resume-access-panel__title">访问权限</span>
      <span class="resume-access-panel__current">当前：{{ modeLabels[summary.accessMode] }}</span>
    </div>

    <div class="resume-access-panel__options">
      <label class="resume-access-panel__option">
        <input v-model="selectedMode" type="radio" value="private" :disabled="busy">
        <span>
          <strong>仅自己可见</strong>
          <small>保存后立即撤销当前口令会话或限时链接</small>
        </span>
      </label>
      <label class="resume-access-panel__option">
        <input v-model="selectedMode" type="radio" value="protected" :disabled="busy">
        <span>
          <strong>访问口令</strong>
          <small>访问「关于我」入口后输入 6 位口令解锁，页面不回显已有口令</small>
        </span>
      </label>
      <label class="resume-access-panel__option">
        <input v-model="selectedMode" type="radio" value="temporary" :disabled="busy">
        <span>
          <strong>限时链接</strong>
          <small>生成带随机 token 的限时地址，到期后自动失效</small>
        </span>
      </label>
      <label class="resume-access-panel__option">
        <input v-model="selectedMode" type="radio" value="public" :disabled="busy">
        <span>
          <strong>完全公开</strong>
          <small>任何人都可以访问并下载</small>
        </span>
      </label>
    </div>

    <div v-if="selectedMode === 'protected'" class="resume-access-panel__detail">
      <label class="field resume-access-panel__password">
        <span class="field__label">访问口令</span>
        <input
          v-model="password"
          type="password"
          inputmode="numeric"
          maxlength="6"
          autocomplete="new-password"
          placeholder="6 位数字口令"
          :aria-invalid="password ? !passwordValid : undefined"
        >
      </label>
      <small v-if="password && !passwordValid" class="resume-access-panel__error">
        请输入 6 位数字口令
      </small>
    </div>

    <div v-if="selectedMode === 'temporary'" class="resume-access-panel__detail">
      <div class="resume-access-panel__presets">
        <button
          v-for="preset in presetOptions"
          :key="preset.value"
          class="resume-access-panel__preset"
          :class="{ 'resume-access-panel__preset--active': presetValue === preset.value }"
          type="button"
          :disabled="busy"
          @click="selectPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>
      <label v-if="presetValue === 'custom'" class="field resume-access-panel__custom">
        <span class="field__label">自定义到期时间（不超过 30 天）</span>
        <input v-model="customExpiresAt" type="datetime-local" :disabled="busy">
      </label>
      <div v-if="summary.temporaryShare" class="resume-access-panel__share-times">
        <span>创建：{{ formatDateTime(summary.temporaryShare.createdAt) }}</span>
        <span>到期：{{ formatDateTime(summary.temporaryShare.expiresAt) }}</span>
        <small>重新生成限时链接会立即替换旧链接。</small>
      </div>
      <label v-if="shareUrl" class="field resume-access-panel__generated-link">
        <span class="field__label">本次生成的限时链接</span>
        <span class="resume-access-panel__link-row">
          <input :value="shareUrl" type="text" readonly>
          <button
            class="button button--quiet"
            type="button"
            :disabled="busy"
            @click="emit('copyShareUrl')"
          >
            复制链接
          </button>
        </span>
        <small>完整链接只在本次生成后显示；离开页面后需要重新生成。</small>
      </label>
    </div>

    <p v-if="selectedMode === 'public'" class="resume-access-panel__public-hint">
      任何访客都可以从「关于我」进入、阅读并下载这份简历。
    </p>

    <div class="resume-access-panel__save">
      <button
        class="button button--primary"
        type="button"
        :disabled="!canSave"
        :aria-busy="busy"
        @click="save"
      >
        保存权限
      </button>
    </div>
  </div>
</template>

<style scoped>
.resume-access-panel {
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.resume-access-panel__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.resume-access-panel__title {
  font-size: 0.9rem;
  font-weight: 700;
}

.resume-access-panel__current {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.resume-access-panel__options {
  display: grid;
  gap: 0.55rem;
}

.resume-access-panel__option {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.6rem;
  cursor: pointer;
}

.resume-access-panel__option:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.resume-access-panel__option input {
  flex: none;
  margin: 0.18rem 0 0;
  accent-color: var(--accent);
}

.resume-access-panel__option span {
  display: grid;
  gap: 0.16rem;
}

.resume-access-panel__option strong {
  font-size: 0.84rem;
}

.resume-access-panel__option small {
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.45;
}

.resume-access-panel__detail {
  display: grid;
  gap: 0.5rem;
}

.resume-access-panel__password input,
.resume-access-panel__custom input,
.resume-access-panel__generated-link input {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-strong);
  border-radius: 0.65rem;
  background: var(--surface-card);
  color: var(--text-primary);
  font: inherit;
}

.resume-access-panel__password input:focus-visible,
.resume-access-panel__custom input:focus-visible,
.resume-access-panel__generated-link input:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.resume-access-panel__error {
  color: var(--danger);
  font-size: 0.74rem;
}

.resume-access-panel__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.resume-access-panel__preset {
  min-height: 2.4rem;
  padding: 0 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-page);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.76rem;
}

.resume-access-panel__preset:hover {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.resume-access-panel__preset--active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.resume-access-panel__preset:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.resume-access-panel__share-times {
  display: grid;
  gap: 0.14rem;
  color: var(--text-muted);
  font-size: 0.74rem;
}

.resume-access-panel__share-times small {
  color: var(--text-muted);
}

.resume-access-panel__link-row {
  display: flex;
  min-width: 0;
  gap: 0.5rem;
}

.resume-access-panel__link-row input {
  min-width: 0;
  flex: 1 1 auto;
}

.resume-access-panel__generated-link small {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.resume-access-panel__public-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.74rem;
}

.resume-access-panel__save {
  display: flex;
  justify-content: flex-end;
}
</style>
