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
  const firstDate = props.data[0].date
  const today = props.data[props.data.length - 1].date
  const foreground = props.theme === 'dark' ? '#a9b8b4' : '#5f6865'
  const empty = props.theme === 'dark' ? '#20282b' : '#ece8e4'
  return {
    backgroundColor: 'transparent',
    aria: { show: true, description: '最近一年每天的记录次数日历图' },
    tooltip: {
      formatter: (params: unknown) => {
        const value = (params as { value: [string, number] }).value
        return `${value[0]} · ${value[1]} 次`
      },
    },
    visualMap: {
      type: 'piecewise',
      min: 0,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      textStyle: { color: foreground },
      pieces: [
        { value: 0, label: '0', color: empty },
        { value: 1, label: '1', color: '#5f3934' },
        { value: 2, label: '2', color: '#9c574b' },
        { value: 3, label: '3', color: '#cf715f' },
        { min: 4, label: '4+', color: '#f08a72' },
      ],
    },
    calendar: {
      range: [firstDate, today],
      cellSize: [16, 16],
      top: 28,
      left: 46,
      right: 20,
      bottom: 58,
      yearLabel: { show: false },
      monthLabel: { color: foreground },
      dayLabel: { color: foreground, firstDay: 1 },
      splitLine: { show: false },
      itemStyle: { color: empty, borderColor: props.theme === 'dark' ? '#121719' : '#faf8f5', borderWidth: 2 },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: props.data.map((item) => ({
          value: [item.date, item.count],
          itemStyle: item.date === today ? { borderColor: '#f4d6cf', borderWidth: 2 } : undefined,
        })),
      },
    ],
  }
})
</script>

<template>
  <section class="panel calendar-panel">
    <h2>最近一年</h2>
    <div class="calendar-scroll">
      <EChart :key="theme" class="calendar-chart" style="height: 230px" :option="option" :theme="theme" />
    </div>
  </section>
</template>

<style scoped>
.calendar-scroll { overflow-x: auto; }
.calendar-chart { min-width: 960px; height: 230px; }
</style>
