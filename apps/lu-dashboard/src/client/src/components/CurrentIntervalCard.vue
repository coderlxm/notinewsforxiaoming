<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import type { CurrentInterval } from '../../../shared/dashboard'
import { formatDuration } from '../analytics'

dayjs.extend(utc)
dayjs.extend(timezone)

const props = defineProps<{ current: CurrentInterval }>()
const lastTime = computed(() => props.current.lastOccurredAt
  ? dayjs(props.current.lastOccurredAt).tz('Asia/Shanghai').format('MM 月 DD 日 HH:mm')
  : null)
</script>

<template>
  <section class="current-interval-card">
    <p class="eyebrow">距上次</p>
    <strong>{{ current.minutes === null ? '还没有记录' : formatDuration(current.minutes) }}</strong>
    <p v-if="lastTime">上次：{{ lastTime }}</p>
  </section>
</template>
