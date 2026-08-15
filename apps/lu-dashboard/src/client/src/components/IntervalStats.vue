<script setup lang="ts">
import type { CurrentInterval, DashboardIntervals } from '../../../shared/dashboard'
import { formatDuration } from '../analytics'

defineProps<{ current: CurrentInterval; intervals: DashboardIntervals }>()
</script>

<template>
  <section class="panel">
    <h2>间隔摘要</h2>
    <div class="interval-stats">
      <div class="stat">
        <span class="label">当前间隔</span>
        <span class="value">{{ formatDuration(current.minutes) }}</span>
      </div>
      <div class="stat">
        <span class="label">中位间隔</span>
        <span class="value">{{ formatDuration(intervals.medianMinutes) }}</span>
      </div>
      <div class="stat">
        <span class="label">最长间隔</span>
        <span class="value">{{ formatDuration(intervals.longestMinutes) }}</span>
      </div>
    </div>
  </section>
</template>
