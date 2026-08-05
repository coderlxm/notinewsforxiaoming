<script setup lang="ts">
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { shallowRef } from 'vue';

dayjs.extend(utc);
dayjs.extend(timezone);

const timeZone = 'Asia/Shanghai';
const enabled = defineModel<boolean>('enabled', { required: true });
const value = defineModel<string>('value', { required: true });

defineProps<{
  disabled: boolean;
}>();

const date = shallowRef('');
const time = shallowRef('');

function combine(): string {
  return dayjs.tz(`${date.value} ${time.value}`, timeZone)
    .second(0)
    .millisecond(0)
    .utc()
    .toISOString();
}

function fillNow(): void {
  const now = dayjs().tz(timeZone).second(0).millisecond(0);
  date.value = now.format('YYYY-MM-DD');
  time.value = now.format('HH:mm');
  value.value = combine();
}

function updateEnabled(event: Event): void {
  enabled.value = (event.target as HTMLInputElement).checked;
  if (enabled.value) {
    if (date.value && time.value) value.value = combine();
    else fillNow();
  }
  else {
    value.value = '';
  }
}

function updateDate(event: Event): void {
  date.value = (event.target as HTMLInputElement).value;
  updateValue();
}

function updateTime(event: Event): void {
  time.value = (event.target as HTMLInputElement).value;
  updateValue();
}

function updateValue(): void {
  if (!enabled.value) return;
  value.value = date.value && time.value ? combine() : '';
}
</script>

<template>
  <fieldset class="published-time-field" :disabled="disabled">
    <legend class="published-time-field__label">发布时间</legend>
    <label class="published-time-field__option">
      <input :checked="enabled" type="checkbox" @change="updateEnabled">
      <span>
        <strong>指定发布时间</strong>
        <small>勾选后自定义归档时间，不勾选则按当前时间</small>
      </span>
    </label>
    <div v-if="enabled" class="published-time-field__inputs">
      <label class="published-time-field__input">
        <span>日期</span>
        <input :value="date" type="date" required :disabled="disabled" @input="updateDate">
      </label>
      <label class="published-time-field__input">
        <span>时间</span>
        <input :value="time" type="time" required step="60" :disabled="disabled" @input="updateTime">
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.published-time-field {
  display: grid;
  align-content: start;
  gap: 0.55rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.published-time-field__label {
  margin-bottom: 0.1rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.published-time-field__option {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.65rem;
  background: var(--surface-card);
  cursor: pointer;
}

.published-time-field__option:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.published-time-field__option input {
  flex: none;
  margin: 0.18rem 0 0;
  accent-color: var(--accent);
}

.published-time-field__option span {
  display: grid;
  gap: 0.18rem;
}

.published-time-field__option strong {
  font-size: 0.86rem;
}

.published-time-field__option small {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.45;
}

.published-time-field__inputs {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.65rem;
  background: var(--surface-card);
}

.published-time-field__input {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.4rem;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.published-time-field__input input {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-strong);
  border-radius: 0.65rem;
  background: var(--surface-card);
  color: var(--text-primary);
  font: inherit;
}

.published-time-field__input input:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

@media (max-width: 520px) {
  .published-time-field__inputs {
    flex-direction: column;
  }
}
</style>
