<script setup lang="ts">
import type { MasturbationRecord } from '../../../shared/dashboard'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

const props = defineProps<{ records: MasturbationRecord[] }>()

dayjs.extend(utc)
dayjs.extend(timezone)

function parseTimeInfo(value: string) {
  const time = dayjs(value).tz('Asia/Shanghai')
  const today = dayjs().tz('Asia/Shanghai').startOf('day')
  const isToday = time.isSame(today, 'day')
  const isYesterday = time.isSame(today.subtract(1, 'day'), 'day')

  const label = isToday ? '今天' : isYesterday ? '昨天' : time.format('MM-DD')
  const clock = time.format('HH:mm:ss')
  return { label, clock, isToday }
}
</script>

<template>
  <section class="panel recent-records-container">
    <div class="panel-header">
      <h2>最近记录 RECENT LOGS</h2>
      <span class="panel-badge">{{ records.length }} ITEMS</span>
    </div>
    <div v-if="records.length === 0" class="empty-state">暂无记录</div>
    <div v-else class="records-table-scroll">
      <table class="records-table">
        <thead>
          <tr>
            <th>时段</th>
            <th>发生时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in records" :key="record.id">
            <td>
              <span class="time-tag" :class="{ today: parseTimeInfo(record.occurredAt).isToday }">
                {{ parseTimeInfo(record.occurredAt).label }}
              </span>
            </td>
            <td class="mono-number">{{ parseTimeInfo(record.occurredAt).clock }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
