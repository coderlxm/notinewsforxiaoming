<script setup lang="ts">
import { onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import type { DashboardRange } from '../../../shared/dashboard'
import { useDashboard } from '../useDashboard'

import CalendarHeatmap from './CalendarHeatmap.vue'
import CurrentIntervalCard from './CurrentIntervalCard.vue'
import IntervalStats from './IntervalStats.vue'
import RecentRecords from './RecentRecords.vue'
import SummaryCards from './SummaryCards.vue'
import TrendChart from './TrendChart.vue'
import WeekdayTimeHeatmap from './WeekdayTimeHeatmap.vue'

const emit = defineEmits<{ (e: 'logout'): void }>()
defineProps<{ sessionError: string | null }>()

dayjs.extend(utc)
dayjs.extend(timezone)

const ranges: DashboardRange[] = [30, 90, 365]
const theme = ref<'dark' | 'light'>('dark')
const { analytics, error, generatedAt, loading, range, refresh, setRange } = useDashboard()

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme.value
}

function formatGeneratedAt(value: string) {
  return dayjs(value).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm')
}

onMounted(async () => {
  document.documentElement.dataset.theme = theme.value
  await refresh()
})
</script>

<template>
  <div class="dashboard-shell">
    <header class="dashboard-header">
      <div class="header-brand">
        <span class="brand-dot" />
        <h1>撸了吗</h1>
        <span class="header-tag">DASHBOARD</span>
        <span v-if="generatedAt" class="header-updated">
          <span class="updated-label">UPDATED</span>
          <span class="mono-number">{{ formatGeneratedAt(generatedAt) }}</span>
        </span>
      </div>
      <div class="header-actions">
        <div class="range-switch" role="group" aria-label="统计周期选择">
          <button
            v-for="r in ranges"
            :key="r"
            :class="{ active: r === range }"
            type="button"
            @click="setRange(r)"
          >
            {{ r }}d
          </button>
        </div>
        <button type="button" class="btn-ghost" @click="toggleTheme">
          {{ theme === 'dark' ? '浅色' : '深色' }}
        </button>
        <button type="button" class="btn-ghost" :disabled="loading" @click="refresh">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
        <button type="button" class="btn-ghost" @click="emit('logout')">
          退出
        </button>
      </div>
    </header>

    <main class="dashboard-content">
      <p v-if="error || sessionError" class="error-message" role="alert">{{ error || sessionError }}</p>
      <template v-if="analytics">
        <div class="dashboard-viewport">
          <!-- 左栏：核心状态、指标与记录明细 -->
          <aside class="viewport-sidebar">
            <CurrentIntervalCard :current="analytics.current" />
            <SummaryCards :summary="analytics.summary" />
            <IntervalStats :current="analytics.current" :intervals="analytics.intervals" />
            <RecentRecords :records="analytics.recent" />
          </aside>

          <!-- 右栏：全景热力与多维图表 -->
          <section class="viewport-main">
            <CalendarHeatmap :data="analytics.calendar" :theme="theme" />
            <div class="viewport-charts">
              <TrendChart :data="analytics.trend" :theme="theme" />
              <WeekdayTimeHeatmap :data="analytics.weekdayTime" :theme="theme" />
            </div>
          </section>
        </div>
      </template>
      <div v-else-if="loading" class="dashboard-skeleton" aria-label="正在载入数据">
        <div class="skeleton-box" /><div class="skeleton-box" /><div class="skeleton-box" /><div class="skeleton-box" />
      </div>
    </main>
  </div>
</template>
