<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type { JournalVisibility } from '../../types';
import type { AccessSettingsInput } from './accessSettings';

const props = defineProps<{
  visibility: JournalVisibility;
  busy: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [settings: AccessSettingsInput];
}>();

const selectedVisibility = shallowRef<JournalVisibility>(props.visibility);
const accessPassword = shallowRef('');
const passwordVisible = shallowRef(false);
const replacingPassword = shallowRef(false);
const visibilityOptions: Array<{
  value: JournalVisibility;
  label: string;
  description: string;
}> = [
  { value: 'public', label: '公开', description: '进入公开信息流和订阅源' },
  { value: 'protected', label: '加密', description: '知道密码的人可以查看' },
  { value: 'private', label: '私有', description: '只在我的全部记录中可见' },
];

const isExistingProtected = computed(() => props.visibility === 'protected');
const passwordFieldVisible = computed(() => selectedVisibility.value === 'protected'
  && (!isExistingProtected.value || replacingPassword.value));
const passwordValid = computed(() => /^\d{6}$/.test(accessPassword.value));
const hasChange = computed(() => selectedVisibility.value !== props.visibility
  || (selectedVisibility.value === 'protected' && replacingPassword.value && passwordValid.value));
const canSave = computed(() => {
  if (props.busy || !hasChange.value) return false;
  if (selectedVisibility.value !== 'protected') return true;
  if (isExistingProtected.value && !replacingPassword.value) return true;
  return passwordValid.value;
});

function selectVisibility(visibility: JournalVisibility): void {
  selectedVisibility.value = visibility;
  accessPassword.value = '';
  replacingPassword.value = false;
}

function beginReplacingPassword(): void {
  replacingPassword.value = true;
}

function handlePasswordInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = input.value.replace(/\D/g, '').slice(0, 6);
  input.value = value;
  accessPassword.value = value;
}

function save(): void {
  if (!canSave.value) return;
  emit('save', {
    visibility: selectedVisibility.value,
    ...(selectedVisibility.value === 'protected' && passwordFieldVisible.value
      ? { accessPassword: accessPassword.value }
      : {}),
  });
}
</script>

<template>
  <Teleport to="body">
    <div class="access-dialog" role="presentation" @mousedown.self="emit('close')">
      <section
        class="access-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-dialog-title"
      >
        <header class="access-dialog__header">
          <div>
            <h2 id="access-dialog-title">访问权限</h2>
            <p>设置这条内容可以被谁打开。</p>
          </div>
          <button class="access-dialog__close" type="button" :disabled="busy" aria-label="关闭" @click="emit('close')">×</button>
        </header>

        <fieldset class="access-dialog__options" :disabled="busy">
          <legend class="sr-only">选择访问权限</legend>
          <label
            v-for="option in visibilityOptions"
            :key="option.value"
            class="access-dialog__option"
            :class="{ 'access-dialog__option--selected': selectedVisibility === option.value }"
          >
            <input
              :checked="selectedVisibility === option.value"
              type="radio"
              name="access-visibility"
              :value="option.value"
              @change="selectVisibility(option.value)"
            >
            <span>
              <strong>{{ option.label }}</strong>
              <small>{{ option.description }}</small>
            </span>
          </label>
        </fieldset>

        <div v-if="selectedVisibility === 'protected'" class="access-dialog__password-area">
          <template v-if="isExistingProtected && !replacingPassword">
            <div class="access-dialog__password-status">
              <span>已设置访问密码</span>
              <button type="button" :disabled="busy" @click="beginReplacingPassword">修改密码</button>
            </div>
          </template>
          <label v-else class="field access-dialog__password">
            <span class="field__label">访问密码</span>
            <span class="access-dialog__password-input">
              <input
                :value="accessPassword"
                :type="passwordVisible ? 'text' : 'password'"
                inputmode="numeric"
                autocomplete="new-password"
                maxlength="6"
                placeholder="请输入 6 位数字"
                :disabled="busy"
                @input="handlePasswordInput"
              >
              <button type="button" :disabled="busy" @click="passwordVisible = !passwordVisible">
                {{ passwordVisible ? '隐藏' : '显示' }}
              </button>
            </span>
            <small v-if="accessPassword && !passwordValid" class="access-dialog__error">请输入 6 位数字密码</small>
          </label>
        </div>

        <footer class="access-dialog__actions">
          <button class="button button--quiet" type="button" :disabled="busy" @click="emit('close')">取消</button>
          <button class="button button--primary" type="button" :disabled="!canSave" :aria-busy="busy" @click="save">
            保存
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.access-dialog {
  position: fixed;
  z-index: 2200;
  inset: 0;
  display: grid;
  padding: 1rem;
  background: rgb(12 12 12 / 42%);
  place-items: center;
}

.access-dialog__panel {
  display: grid;
  width: min(100%, 25rem);
  gap: 1rem;
  padding: 1.1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 20%);
}

.access-dialog__header,
.access-dialog__password-status,
.access-dialog__actions,
.access-dialog__password-input {
  display: flex;
  align-items: center;
}

.access-dialog__header {
  justify-content: space-between;
  gap: 1rem;
}

.access-dialog__header h2,
.access-dialog__header p {
  margin: 0;
}

.access-dialog__header h2 {
  font-size: 1rem;
}

.access-dialog__header p {
  margin-top: 0.2rem;
  color: var(--text-muted);
  font-size: 0.74rem;
}

.access-dialog__close {
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 1.15rem;
}

.access-dialog__options {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.access-dialog__option {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.7rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.7rem;
  cursor: pointer;
}

.access-dialog__option--selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.access-dialog__option input {
  margin: 0.2rem 0 0;
  accent-color: var(--accent);
}

.access-dialog__option span {
  display: grid;
  gap: 0.12rem;
}

.access-dialog__option strong {
  font-size: 0.84rem;
}

.access-dialog__option small,
.access-dialog__password-status {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.access-dialog__password-status {
  justify-content: space-between;
  padding: 0.75rem;
  border-radius: 0.7rem;
  background: var(--surface-muted);
}

.access-dialog__password-status button,
.access-dialog__password-input button {
  border: 0;
  background: transparent;
  color: var(--accent-strong);
  cursor: pointer;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 700;
}

.access-dialog__password-input {
  position: relative;
}

.access-dialog__password-input input {
  width: 100%;
  padding-right: 3.5rem;
}

.access-dialog__password-input button {
  position: absolute;
  right: 0.75rem;
}

.access-dialog__error {
  color: var(--danger);
  font-size: 0.7rem;
}

.access-dialog__actions {
  justify-content: flex-end;
  gap: 0.55rem;
}

.access-dialog__actions .button {
  min-width: 5rem;
}
</style>
