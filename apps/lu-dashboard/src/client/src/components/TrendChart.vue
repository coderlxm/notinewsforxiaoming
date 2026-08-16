<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import type { TrendPoint } from '../../../shared/dashboard'
import EChart from './EChart.vue'

const props = defineProps<{
  data: TrendPoint[]
  theme: 'dark' | 'light'
}>()

const option = computed<EChartsCoreOption>(() => {
  const foreground = props.theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = props.theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)'
  const barColor = props.theme === 'dark' ? '#4f46e5' : '#6366f1'
  const lineColor = props.theme === 'dark' ? '#38bdf8' : '#0284c7'
  const areaColor = props.theme === 'dark' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)'

  return {
    backgroundColor: 'transparent',
    aria: { show: true, description: '每天记录次数和七日移动平均趋势图' },
    tooltip: {
      trigger: 'axis',
      backgroundColor: props.theme === 'dark' ? '#0e1217' : '#ffffff',
      borderColor: props.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      textStyle: { color: props.theme === 'dark' ? '#f0f6fc' : '#0f172a', fontSize: 12 },
    },
    grid: { left: 20, right: 10, top: 10, bottom: 18, containLabel: true },
    xAxis: {
      type: 'category',
      data: props.data.map((point) => point.date.slice(5)),
      axisLabel: { color: foreground, fontSize: 10.5 },
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      axisLabel: { color: foreground, fontSize: 10.5 },
      splitLine: { lineStyle: { color: grid, type: 'dashed' } },
    },
    series: [
      {
        name: '单日频次',
        type: 'bar',
        barMaxWidth: 14,
        data: props.data.map((point) => point.count),
        itemStyle: {
          color: barColor,
          borderRadius: [3, 3, 0, 0],
        },
      },
      {
        name: '7 日移动平均',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: props.data.map((point) => Number(point.average7.toFixed(2))),
        lineStyle: { color: lineColor, width: 2 },
        areaStyle: {
          color: areaColor,
        },
      },
    ],
  }
})
</script>

<template>
  <section class="panel chart-panel">
    <div class="panel-header">
      <h2>变化趋势 TREND & AVERAGE</h2>
      <span class="panel-badge">7-DAY MA</span>
    </div>
    <div class="chart-panel-body">
      <EChart :key="theme" :option="option" :theme="theme" style="width: 100%; height: 100%; min-height: 200px" />
    </div>
  </section>
</template>
