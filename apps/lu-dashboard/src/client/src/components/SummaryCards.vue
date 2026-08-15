<script setup lang="ts">
import type { DashboardSummary } from '../../../shared/dashboard'

defineProps<{ summary: DashboardSummary }>()
</script>

<template>
  <div class="summary-cards">
    <div class="summary-card">
      <div class="value">{{ summary.todayCount }}</div>
      <div class="label">今天</div>
    </div>
    <div class="summary-card">
      <div class="value">{{ summary.last7Count }}</div>
      <div class="label">近 7 天</div>
    </div>
    <div class="summary-card">
      <div class="value">{{ summary.last30Count }}</div>
      <div class="label">近 30 天 · {{ summary.last30ActiveDays }} 个活跃日</div>
    </div>
    <div class="summary-card">
      <div class="value">{{ summary.totalCount }}</div>
      <div class="label">历史总计</div>
    </div>
  </div>
</template>
