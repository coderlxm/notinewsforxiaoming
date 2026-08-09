<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type { JournalVisibility } from '../../types';

const visibility = defineModel<JournalVisibility>({ required: true });
const accessPassword = defineModel<string>('accessPassword', { default: '' });

const props = withDefaults(defineProps<{
  disabled: boolean;
  hasExistingPassword?: boolean;
  allowProtected?: boolean;
}>(), {
  hasExistingPassword: false,
  allowProtected: true,
});

const passwordVisible = shallowRef(false);
const replacingPassword = shallowRef(false);
const passwordFieldVisible = computed(() => visibility.value === 'protected'
  && (!props.hasExistingPassword || replacingPassword.value));

function handlePasswordInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = input.value.replace(/\D/g, '').slice(0, 6);
  input.value = value;
  accessPassword.value = value;
}
</script>

<template>
  <fieldset class="visibility-field" :disabled="disabled">
    <legend class="visibility-field__label">发布范围</legend>
    <label class="visibility-field__option">
      <input v-model="visibility" type="radio" value="public">
      <span>
        <strong>公开</strong>
        <small>显示在公开信息流、RSS 和 JSON Feed</small>
      </span>
    </label>
    <label v-if="allowProtected" class="visibility-field__option">
      <input v-model="visibility" type="radio" value="protected">
      <span>
        <strong>加密</strong>
        <small>公开列表显示脱敏预告，知道密码的人可以查看</small>
      </span>
    </label>
    <label class="visibility-field__option">
      <input v-model="visibility" type="radio" value="private">
      <span>
        <strong>私有</strong>
        <small>只保存在“我的全部记录”中</small>
      </span>
    </label>

    <div v-if="visibility === 'protected'" class="visibility-field__password">
      <div v-if="hasExistingPassword && !replacingPassword" class="visibility-field__password-status">
        <span>已设置访问密码</span>
        <button type="button" :disabled="disabled" @click="replacingPassword = true">修改密码</button>
      </div>
      <label v-else class="field">
        <span class="field__label">访问密码</span>
        <span class="visibility-field__password-input">
          <input
            :value="accessPassword"
            :type="passwordVisible ? 'text' : 'password'"
            inputmode="numeric"
            autocomplete="new-password"
            maxlength="6"
            placeholder="请输入 6 位数字"
            :disabled="disabled"
            @input="handlePasswordInput"
          >
          <button type="button" :disabled="disabled" @click="passwordVisible = !passwordVisible">
            {{ passwordVisible ? '隐藏' : '显示' }}
          </button>
        </span>
        <small v-if="accessPassword && !/^\d{6}$/.test(accessPassword)" class="visibility-field__error">
          请输入 6 位数字密码
        </small>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.visibility-field {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.visibility-field__label {
  margin-bottom: 0.1rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.visibility-field__option {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.65rem;
  background: var(--surface-card);
  cursor: pointer;
}

.visibility-field__option:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.visibility-field__option input {
  flex: none;
  margin: 0.18rem 0 0;
  accent-color: var(--accent);
}

.visibility-field__option span {
  display: grid;
  gap: 0.18rem;
}

.visibility-field__option strong {
  font-size: 0.86rem;
}

.visibility-field__option small {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.45;
}

.visibility-field__password {
  grid-column: 1 / -1;
}

.visibility-field__password-status,
.visibility-field__password-input {
  display: flex;
  align-items: center;
}

.visibility-field__password-status {
  justify-content: space-between;
  padding: 0.75rem;
  border-radius: 0.65rem;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 0.74rem;
}

.visibility-field__password-status button,
.visibility-field__password-input button {
  border: 0;
  background: transparent;
  color: var(--accent-strong);
  cursor: pointer;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 700;
}

.visibility-field__password-input {
  position: relative;
}

.visibility-field__password-input input {
  width: 100%;
  padding-right: 3.5rem;
}

.visibility-field__password-input button {
  position: absolute;
  right: 0.75rem;
}

.visibility-field__error {
  color: var(--danger);
  font-size: 0.7rem;
}

@media (min-width: 1181px) {
  .visibility-field {
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  }

  .visibility-field__label {
    grid-column: 1 / -1;
  }
}
</style>
