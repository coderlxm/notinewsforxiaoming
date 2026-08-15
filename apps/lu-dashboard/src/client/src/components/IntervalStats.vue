<script setup lang="ts">
import type { CurrentInterval, DashboardIntervals } from '../../../shared/dashboard'
import { formatDuration } from '../analytics'

defineProps<{ current: CurrentInterval; intervals: DashboardIntervals }>()
</script>

<template>
  <section class="panel interval-panel">
    <div class="panel-header">
      <h2>间隔统计 INTERVAL METRICS</h2>
      <span class="panel-badge">DURATION</span>
    </div>
    <div class="interval-stats-grid">
      <div class="stat-box">
        <span class="label">当前间隔</span>
        <span class="value mono-number">{{ formatDuration(current.minutes) }}</span>
      </div>
      <div class="stat-box">
        <span class="label">中位间隔</span>
        <span class="value mono-number">{{ formatDuration(intervals.medianMinutes) }}</span>
      </div>
      <div class="stat-box">
        <span class="label">最长间隔</span>
        <span class="value mono-number">{{ formatDuration(intervals.longestMinutes) }}</span>
      </div>
    </div>
  </section>
</template>
