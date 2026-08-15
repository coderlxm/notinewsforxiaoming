<script setup lang="ts">
import type { DashboardSummary } from '../../../shared/dashboard'

defineProps<{ summary: DashboardSummary }>()
</script>

<template>
  <div class="summary-grid">
    <div class="metric-cell">
      <div class="metric-label">今天 TODAY</div>
      <div class="metric-value mono-number">{{ summary.todayCount }}</div>
    </div>
    <div class="metric-cell">
      <div class="metric-label">近 7 天 7D</div>
      <div class="metric-value mono-number">{{ summary.last7Count }}</div>
    </div>
    <div class="metric-cell">
      <div class="metric-label">近 30 天 ({{ summary.last30ActiveDays }}d活跃)</div>
      <div class="metric-value mono-number">{{ summary.last30Count }}</div>
    </div>
    <div class="metric-cell">
      <div class="metric-label">历史总计 TOTAL</div>
      <div class="metric-value mono-number">{{ summary.totalCount }}</div>
    </div>
  </div>
</template>
