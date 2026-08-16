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
  const foreground = props.theme === 'dark' ? '#94a3b8' : '#64748b'
  const empty = props.theme === 'dark' ? '#141820' : '#f1f5f9'
  const colors = props.theme === 'dark'
    ? [empty, '#312e81', '#6366f1', '#a5b4fc']
    : [empty, '#c7d2fe', '#6366f1', '#3730a3']

  const values = props.data.map((point) => [point.weekday - 1, periods.indexOf(point.period), point.count])

  return {
    backgroundColor: 'transparent',
    aria: { show: true, description: '星期和时段的记录次数热力图' },
    tooltip: {
      backgroundColor: props.theme === 'dark' ? '#0e1217' : '#ffffff',
      borderColor: props.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: props.theme === 'dark' ? '#f0f6fc' : '#0f172a', fontSize: 12 },
      formatter: (params: unknown) => {
        const value = (params as { value: [number, number, number] }).value
        return `${weekdays[value[0]]} · ${periods[value[1]]}<br/><strong>${value[2]}</strong> 次记录`
      },
    },
    grid: {
      left: 6,
      right: 12,
      top: 8,
      bottom: 34,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: weekdays,
      axisLabel: { color: foreground, fontSize: 10.5 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: true, areaStyle: { color: props.theme === 'dark' ? ['transparent', 'rgba(255,255,255,0.01)'] : ['transparent', 'rgba(0,0,0,0.01)'] } },
    },
    yAxis: {
      type: 'category',
      data: periods,
      axisLabel: { color: foreground, fontSize: 10.5 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: true, areaStyle: { color: props.theme === 'dark' ? ['transparent', 'rgba(255,255,255,0.01)'] : ['transparent', 'rgba(0,0,0,0.01)'] } },
    },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: foreground, fontSize: 10 },
      inRange: {
        color: colors,
      },
    },
    series: [
      {
        type: 'heatmap',
        data: values,
        label: {
          show: true,
          color: props.theme === 'dark' ? '#f0f6fc' : '#0f172a',
          fontSize: 11,
          fontFamily: 'monospace',
          formatter: (params: unknown) => {
            const value = (params as { value: [number, number, number] }).value
            return value[2] > 0 ? String(value[2]) : ''
          },
        },
        itemStyle: {
          borderColor: props.theme === 'dark' ? '#090b0e' : '#ffffff',
          borderWidth: 2,
          borderRadius: 4,
        },
      },
    ],
  }
})
</script>

<template>
  <section class="panel chart-panel">
    <div class="panel-header">
      <h2>时间分布 PERIOD & WEEKDAY</h2>
      <span class="panel-badge">PATTERN</span>
    </div>
    <div class="chart-panel-body">
      <EChart :key="theme" :option="option" :theme="theme" style="width: 100%; height: 100%; min-height: 200px" />
    </div>
  </section>
</template>
