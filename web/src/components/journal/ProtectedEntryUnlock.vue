<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';
import type { ProtectedJournalEntryPreview } from '../../types';

const props = defineProps<{
  entry: ProtectedJournalEntryPreview;
  busy: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  unlock: [password: string];
}>();

const password = shallowRef('');
const submittedPassword = shallowRef('');
const canSubmit = computed(() => /^\d{6}$/.test(password.value) && !props.busy);
const visibleError = computed(() => password.value === submittedPassword.value ? props.error : null);

function updatePassword(event: Event): void {
  password.value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
}

function submit(): void {
  submittedPassword.value = password.value;
  emit('unlock', password.value);
}
</script>

<template>
  <section class="protected-access" aria-labelledby="protected-access-title">
    <div class="protected-access__mark" aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none">
        <path d="M19 29v-7c0-8 5.4-14 13-14s13 6 13 14v7" />
        <rect x="12" y="28" width="40" height="29" rx="7" />
        <circle cx="32" cy="41" r="3.5" />
        <path d="M32 44.5v5" />
      </svg>
    </div>
    <div class="protected-access__copy">
      <span class="protected-access__eyebrow">PASSWORD PROTECTED</span>
      <h1 id="protected-access-title">这是一条加密内容</h1>
      <p>请输入访问密码后查看</p>
    </div>
    <form class="protected-access__form" @submit.prevent="submit">
      <label for="protected-entry-password">访问密码</label>
      <input
        id="protected-entry-password"
        :value="password"
        class="protected-access__input"
        type="password"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="6"
        autocomplete="off"
        placeholder="请输入 6 位数字密码"
        :aria-invalid="visibleError ? 'true' : undefined"
        :aria-describedby="visibleError ? 'protected-entry-password-error' : undefined"
        :disabled="busy"
        @input="updatePassword"
      >
      <p v-if="visibleError" id="protected-entry-password-error" class="protected-access__error" role="alert">
        {{ visibleError }}
      </p>
      <button
        class="button button--primary protected-access__submit"
        type="submit"
        :disabled="!canSubmit"
        :aria-busy="busy"
      >
        <JournalLoading v-if="busy" variant="inline" label="正在打开…" />
        <template v-else>查看内容</template>
      </button>
    </form>
  </section>
</template>

<style scoped>
.protected-access {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1.25rem 1.4rem;
  width: min(100%, 42rem);
  margin: 1rem auto 0;
  padding: clamp(1.4rem, 4vw, 2.5rem);
  border-radius: var(--radius-card);
  background:
    radial-gradient(circle at 100% 0, color-mix(in srgb, var(--accent) 11%, transparent), transparent 34%),
    var(--surface-card);
  box-shadow: inset 0 0 0 1px var(--border-subtle);
}

.protected-access__mark {
  display: grid;
  width: 4rem;
  height: 4rem;
  border-radius: 1.1rem;
  background: var(--accent-soft);
  color: var(--accent);
  place-items: center;
}

.protected-access__mark svg {
  width: 2.15rem;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}

.protected-access__copy {
  align-self: center;
}

.protected-access__eyebrow {
  color: var(--accent);
  font-family: var(--font-condensed);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.protected-access__copy h1 {
  margin: 0.3rem 0 0;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: clamp(1.45rem, 4vw, 2rem);
}

.protected-access__copy p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
}

.protected-access__form {
  display: grid;
  grid-column: 1 / -1;
  gap: 0.55rem;
}

.protected-access__form label {
  color: var(--text-secondary);
  font-size: 0.76rem;
  font-weight: 700;
}

.protected-access__input {
  width: 100%;
  height: 3rem;
  padding: 0 0.95rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.85rem;
  outline: none;
  background: var(--surface-page);
  color: var(--text-primary);
  font: inherit;
  letter-spacing: 0.24em;
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.protected-access__input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
}

.protected-access__input[aria-invalid='true'] {
  border-color: var(--danger);
}

.protected-access__error {
  margin: 0;
  color: var(--danger);
  font-size: 0.74rem;
}

.protected-access__submit {
  min-height: 2.8rem;
  margin-top: 0.25rem;
}

@media (max-width: 599px) {
  .protected-access {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    margin-top: 0;
  }

  .protected-access__mark {
    width: 3.5rem;
    height: 3.5rem;
  }

  .protected-access__form {
    grid-column: 1;
  }
}
</style>
