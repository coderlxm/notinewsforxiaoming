<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import type { CalendarPoint } from '../../../shared/dashboard'
import EChart from './EChart.vue'

const props = defineProps<{
  data: CalendarPoint[]
  theme: 'dark' | 'light'
}>()

const option = computed<EChartsCoreOption>(() => {
  const firstDate = props.data[0]?.date ?? ''
  const today = props.data[props.data.length - 1]?.date ?? ''
  const foreground = props.theme === 'dark' ? '#94a3b8' : '#64748b'
  const empty = props.theme === 'dark' ? '#141820' : '#f1f5f9'
  const border = props.theme === 'dark' ? '#090b0e' : '#ffffff'

  const pieces = props.theme === 'dark'
    ? [
        { value: 0, label: '0', color: empty },
        { value: 1, label: '1', color: '#1e293b' },
        { value: 2, label: '2', color: '#312e81' },
        { value: 3, label: '3', color: '#4f46e5' },
        { min: 4, label: '4+', color: '#818cf8' },
      ]
    : [
        { value: 0, label: '0', color: empty },
        { value: 1, label: '1', color: '#e0e7ff' },
        { value: 2, label: '2', color: '#a5b4fc' },
        { value: 3, label: '3', color: '#6366f1' },
        { min: 4, label: '4+', color: '#4338ca' },
      ]

  return {
    backgroundColor: 'transparent',
    aria: { show: true, description: '最近一年每天的记录次数日历图' },
    tooltip: {
      backgroundColor: props.theme === 'dark' ? '#0e1217' : '#ffffff',
      borderColor: props.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: props.theme === 'dark' ? '#f0f6fc' : '#0f172a', fontSize: 12 },
      formatter: (params: unknown) => {
        const value = (params as { value: [string, number] }).value
        return `<span style="font-family: monospace;">${value[0]}</span><br/><strong>${value[1]}</strong> 次记录`
      },
    },
    visualMap: {
      type: 'piecewise',
      min: 0,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: foreground, fontSize: 11 },
      pieces,
    },
    calendar: {
      range: [firstDate, today],
      cellSize: [13, 13],
      top: 22,
      left: 36,
      right: 16,
      bottom: 40,
      yearLabel: { show: false },
      monthLabel: { color: foreground, fontSize: 10, margin: 8 },
      dayLabel: { color: foreground, firstDay: 1, fontSize: 9, margin: 6 },
      splitLine: { show: false },
      itemStyle: { color: empty, borderColor: border, borderWidth: 2 },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: props.data.map((item) => ({
          value: [item.date, item.count],
          itemStyle: item.date === today ? { borderColor: '#818cf8', borderWidth: 2 } : undefined,
        })),
      },
    ],
  }
})
</script>

<template>
  <section class="panel calendar-panel">
    <div class="panel-header">
      <h2>年度活跃分布 ANNUAL CALENDAR</h2>
      <span class="panel-badge">365 DAYS</span>
    </div>
    <div class="calendar-scroll">
      <EChart :key="theme" class="calendar-chart" :option="option" :theme="theme" />
    </div>
  </section>
</template>

<style scoped>
.calendar-panel {
  flex-shrink: 0;
  height: 195px;
  min-height: 195px;
  overflow: hidden;
}
.calendar-scroll {
  flex: 1;
  width: 100%;
  height: 155px;
  min-height: 155px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}
.calendar-chart {
  min-width: 820px;
  height: 150px;
}
</style>
