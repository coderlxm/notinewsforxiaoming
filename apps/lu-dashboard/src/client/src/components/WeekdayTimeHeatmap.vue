<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import type { WeekdayTimePoint } from '../../../shared/dashboard'
import EChart from './EChart.vue'

const props = defineProps<{
  data: WeekdayTimePoint[]
  theme: 'dark' | 'light'
}>()

const periods = ['凌晨', '上午', '下午', '晚上']
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const option = computed<EChartsCoreOption>(() => {
  const max = Math.max(1, ...props.data.map((point) => point.count))
  const foreground = props.theme === 'dark' ? '#a9b8b4' : '#5f6865'
  const empty = props.theme === 'dark' ? '#20282b' : '#ece8e4'
  const values = props.data.map((point) => [point.weekday - 1, periods.indexOf(point.period), point.count])

  return {
    backgroundColor: 'transparent',
    aria: { show: true, description: '星期和时段的记录次数热力图' },
    tooltip: {
      formatter: (params: unknown) => {
        const value = (params as { value: [number, number, number] }).value
        return `${weekdays[value[0]]} ${periods[value[1]]} · ${value[2]} 次`
      },
    },
    grid: {
      left: 8,
      right: 16,
      top: 8,
      bottom: 54,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: weekdays,
      axisLabel: { color: foreground },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: periods,
      axisLabel: { color: foreground },
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: {
        color: [empty, '#9c574b', '#f08a72'],
      },
    },
    series: [
      {
        type: 'heatmap',
        data: values,
        label: {
          show: true,
          formatter: (params: unknown) => {
            const value = (params as { value: [number, number, number] }).value
            return value[2] > 0 ? String(value[2]) : ''
          },
        },
      },
    ],
  }
})
</script>

<template>
  <section class="panel">
    <h2>时间规律</h2>
    <EChart :key="theme" :option="option" :theme="theme" />
  </section>
</template>
