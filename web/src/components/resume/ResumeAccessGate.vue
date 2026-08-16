<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';

const props = defineProps<{
  busy: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  unlock: [password: string];
}>();

const digits = ref<string[]>(['', '', '', '', '', '']);
const inputs = useTemplateRef<HTMLInputElement[]>('inputRefs');
const submittedPassword = ref('');

const fullCode = computed(() => digits.value.join(''));
const canSubmit = computed(() => /^\d{6}$/.test(fullCode.value) && !props.busy);
const visibleError = computed(() => fullCode.value === submittedPassword.value ? props.error : null);

onMounted(() => {
  focusInput(0);
});

function focusInput(index: number): void {
  void nextTick(() => {
    inputs.value?.[index]?.focus();
  });
}

function handleInput(index: number, event: Event): void {
  const target = event.target as HTMLInputElement;
  const val = target.value.replace(/\D/g, '');
  if (!val) {
    digits.value[index] = '';
    return;
  }
  digits.value[index] = val.slice(-1);
  if (index < 5) {
    focusInput(index + 1);
  } else {
    submit();
  }
}

function handleKeyDown(index: number, event: KeyboardEvent): void {
  if (event.key === 'Backspace') {
    if (!digits.value[index] && index > 0) {
      digits.value[index - 1] = '';
      focusInput(index - 1);
    } else {
      digits.value[index] = '';
    }
  } else if (event.key === 'ArrowLeft' && index > 0) {
    focusInput(index - 1);
  } else if (event.key === 'ArrowRight' && index < 5) {
    focusInput(index + 1);
  }
}

function handlePaste(event: ClipboardEvent): void {
  event.preventDefault();
  const text = event.clipboardData?.getData('text') ?? '';
  const clean = text.replace(/\D/g, '').slice(0, 6);
  if (!clean) return;
  for (let i = 0; i < 6; i++) {
    digits.value[i] = clean[i] ?? '';
  }
  if (clean.length === 6) {
    inputs.value?.[5]?.blur();
    submit();
  } else {
    focusInput(Math.min(clean.length, 5));
  }
}

function submit(): void {
  if (!canSubmit.value) return;
  submittedPassword.value = fullCode.value;
  emit('unlock', fullCode.value);
}
</script>

<template>
  <section class="resume-access" aria-labelledby="resume-access-title">
    <div class="resume-access__mark" aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none">
        <path d="M19 29v-7c0-8 5.4-14 13-14s13 6 13 14v7" />
        <rect x="12" y="28" width="40" height="29" rx="7" />
        <circle cx="32" cy="41" r="3.5" />
        <path d="M32 44.5v5" />
      </svg>
    </div>

    <div class="resume-access__copy">
      <span class="resume-access__eyebrow">PROTECTED RESUME</span>
      <h1 id="resume-access-title">受保护的个人专属简历</h1>
      <p>请输入 6 位数字访问口令查看完整简历</p>
    </div>

    <form class="resume-access__form" @submit.prevent="submit">
      <div class="resume-access__otp-group" @paste="handlePaste">
        <input
          v-for="(digit, idx) in digits"
          :key="idx"
          ref="inputRefs"
          :value="digit"
          class="resume-access__otp-box"
          :class="{ 'resume-access__otp-box--filled': digit !== '' }"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="1"
          autocomplete="off"
          :aria-label="`第 ${idx + 1} 位口令`"
          :disabled="busy"
          @input="handleInput(idx, $event)"
          @keydown="handleKeyDown(idx, $event)"
        >
      </div>

      <div class="resume-access__actions">
        <button
          class="button button--primary resume-access__submit"
          type="submit"
          :disabled="!canSubmit"
          :aria-busy="busy"
        >
          <JournalLoading v-if="busy" variant="inline" label="正在验证…" />
          <template v-else>解锁并查看简历</template>
        </button>
      </div>

      <p v-if="visibleError" class="resume-access__error" role="alert">
        {{ visibleError }}
      </p>
    </form>
  </section>
</template>

<style scoped>
.resume-access {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1.5rem 1.6rem;
  width: min(100%, 40rem);
  margin: 2.5rem auto;
  padding: clamp(1.6rem, 5vw, 2.8rem);
  border-radius: var(--radius-card);
  background:
    radial-gradient(circle at 100% 0, color-mix(in srgb, var(--accent) 9%, transparent), transparent 45%),
    var(--surface-card);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--ink) 8%, transparent), 0 0 0 1px var(--border-subtle);
}

.resume-access__mark {
  display: grid;
  width: 4.2rem;
  height: 4.2rem;
  border-radius: 1.2rem;
  background: var(--accent-soft);
  color: var(--accent);
  place-items: center;
}

.resume-access__mark svg {
  width: 2.2rem;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}

.resume-access__copy {
  align-self: center;
}

.resume-access__eyebrow {
  color: var(--accent);
  font-family: var(--font-condensed);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.resume-access__copy h1 {
  margin: 0.25rem 0 0;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: clamp(1.4rem, 3.5vw, 1.85rem);
  font-weight: 750;
}

.resume-access__copy p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.resume-access__form {
  display: grid;
  grid-column: 1 / -1;
  gap: 1.25rem;
  margin-top: 0.5rem;
}

.resume-access__otp-group {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: clamp(0.4rem, 1.5vw, 0.75rem);
  width: 100%;
  max-width: 26rem;
}

.resume-access__otp-box {
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  outline: none;
  background: var(--surface-page);
  color: var(--text-primary);
  font-family: var(--font-condensed);
  font-size: clamp(1.2rem, 3vw, 1.6rem);
  font-weight: 750;
  text-align: center;
  transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}

.resume-access__otp-box:focus {
  border-color: var(--accent);
  background: var(--surface-card);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  transform: translateY(-2px);
}

.resume-access__otp-box--filled {
  border-color: var(--border-strong);
  background: var(--surface-card);
}

.resume-access__actions {
  display: flex;
  align-items: center;
}

.resume-access__submit {
  min-height: 2.75rem;
  padding: 0.5rem 1.6rem;
  font-size: 0.85rem;
}

.resume-access__error {
  margin: 0;
  color: var(--danger);
  font-size: 0.78rem;
}

@media (max-width: 599px) {
  .resume-access {
    grid-template-columns: 1fr;
    gap: 1.2rem;
    margin: 1rem 0;
    padding: 1.4rem;
  }

  .resume-access__mark {
    width: 3.4rem;
    height: 3.4rem;
  }

  .resume-access__otp-group {
    max-width: 100%;
  }

  .resume-access__submit {
    width: 100%;
  }
}
</style>