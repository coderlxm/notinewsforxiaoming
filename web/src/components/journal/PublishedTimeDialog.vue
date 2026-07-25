<script setup lang="ts">
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { computed, onMounted, shallowRef, useId, useTemplateRef, watch } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';

dayjs.extend(utc);
dayjs.extend(timezone);

const props = defineProps<{
  sourceCreatedAt: string;
  busy: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [sourceCreatedAt: string];
}>();

const timeZone = 'Asia/Shanghai';
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const titleId = useId();
const date = shallowRef('');
const time = shallowRef('');
const initialDate = dayjs(props.sourceCreatedAt).tz(timeZone).format('YYYY-MM-DD');
const initialTime = dayjs(props.sourceCreatedAt).tz(timeZone).format('HH:mm');

const currentPublishedTime = computed(() =>
  dayjs(props.sourceCreatedAt).tz(timeZone).format('YYYY年M月D日 HH:mm'));
const selectedSourceCreatedAt = computed(() => {
  if (!date.value || !time.value) return null;
  return dayjs.tz(`${date.value} ${time.value}`, timeZone)
    .second(0)
    .millisecond(0)
    .utc()
    .toISOString();
});
const canSave = computed(() =>
  !props.busy
  && selectedSourceCreatedAt.value !== null
  && (date.value !== initialDate || time.value !== initialTime));

function fillForm(sourceCreatedAt: string): void {
  const publishedTime = dayjs(sourceCreatedAt).tz(timeZone);
  date.value = publishedTime.format('YYYY-MM-DD');
  time.value = publishedTime.format('HH:mm');
}

function save(): void {
  emit('save', selectedSourceCreatedAt.value!);
}

function handleBackdropClick(event: MouseEvent): void {
  if (event.target === dialog.value && !props.busy) emit('close');
}

fillForm(props.sourceCreatedAt);

watch(() => props.sourceCreatedAt, (sourceCreatedAt) => {
  fillForm(sourceCreatedAt);
  emit('close');
});

onMounted(() => dialog.value!.showModal());
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="published-time-dialog"
      :aria-labelledby="titleId"
      aria-modal="true"
      @cancel="busy ? $event.preventDefault() : emit('close')"
      @click="handleBackdropClick"
    >
      <form class="published-time-dialog__panel" @submit.prevent="save">
        <header class="published-time-dialog__header">
          <div>
            <h2 :id="titleId" class="published-time-dialog__title">修改发布时间</h2>
            <p class="published-time-dialog__current">
              当前发布时间：{{ currentPublishedTime }}
            </p>
          </div>
          <button
            class="published-time-dialog__close"
            type="button"
            aria-label="关闭"
            :disabled="busy"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div class="published-time-dialog__fields">
          <label class="published-time-dialog__field">
            <span>日期</span>
            <input v-model="date" type="date" required :disabled="busy">
          </label>
          <label class="published-time-dialog__field">
            <span>时间</span>
            <input v-model="time" type="time" required step="60" :disabled="busy">
          </label>
        </div>

        <p class="published-time-dialog__note">
          时区：Asia/Shanghai。修改后将按新时间重新归档。
        </p>

        <footer class="published-time-dialog__actions">
          <button class="button button--quiet" type="button" :disabled="busy" @click="emit('close')">
            取消
          </button>
          <button
            class="button button--primary"
            type="submit"
            :disabled="!canSave"
            :aria-busy="busy"
          >
            <JournalLoading v-if="busy" variant="inline" label="保存中…" />
            <template v-else>保存时间</template>
          </button>
        </footer>
      </form>
    </dialog>
  </Teleport>
</template>

<style scoped>
.published-time-dialog {
  width: min(31rem, calc(100vw - 2rem));
  max-width: none;
  margin: auto;
  padding: 0;
  border: 0;
  border-radius: 1rem;
  background: transparent;
  color: var(--text-primary);
}

.published-time-dialog::backdrop {
  background: rgb(22 22 20 / 60%);
}

.published-time-dialog__panel {
  display: grid;
  gap: 1.25rem;
  padding: 1.4rem;
  border: 1px solid var(--border-strong);
  border-radius: 1rem;
  background: var(--surface-card);
  box-shadow: 0 24px 64px rgb(17 17 15 / 32%);
}

.published-time-dialog__header,
.published-time-dialog__fields,
.published-time-dialog__actions {
  display: flex;
}

.published-time-dialog__header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.published-time-dialog__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.3rem;
}

.published-time-dialog__current,
.published-time-dialog__note {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.55;
}

.published-time-dialog__close {
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 1.5rem;
}

.published-time-dialog__close:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.published-time-dialog__fields {
  gap: 0.75rem;
}

.published-time-dialog__field {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.4rem;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.published-time-dialog__field input {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-strong);
  border-radius: 0.65rem;
  background: var(--surface-card);
  color: var(--text-primary);
  font: inherit;
}

.published-time-dialog__note {
  margin: 0;
}

.published-time-dialog__actions {
  justify-content: flex-end;
  gap: 0.6rem;
}

.published-time-dialog__actions .button {
  min-height: 2.5rem;
}

.published-time-dialog__close:focus-visible,
.published-time-dialog__field input:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

@media (max-width: 520px) {
  .published-time-dialog__fields {
    flex-direction: column;
  }
}
</style>
