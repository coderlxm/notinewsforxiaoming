<script setup lang="ts">
import type { MasturbationRecord } from '../../../shared/dashboard'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

defineProps<{ records: MasturbationRecord[] }>()

dayjs.extend(utc)
dayjs.extend(timezone)

function formatTime(value: string) {
  const time = dayjs(value).tz('Asia/Shanghai')
  const today = dayjs().tz('Asia/Shanghai').startOf('day')
  const label = time.isSame(today, 'day')
    ? '今天'
    : time.isSame(today.subtract(1, 'day'), 'day') ? '昨天' : time.format('MM 月 DD 日')
  return `${label} ${time.format('HH:mm')}`
}
</script>

<template>
  <section class="recent-records panel">
    <h2>最近记录</h2>
    <p v-if="records.length === 0" class="empty">暂无记录</p>
    <table v-else class="table">
      <thead>
        <tr>
          <th>发生时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in records" :key="record.id">
          <td>{{ formatTime(record.occurredAt) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
