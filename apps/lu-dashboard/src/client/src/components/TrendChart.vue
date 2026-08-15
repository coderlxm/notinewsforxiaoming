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
  const foreground = props.theme === 'dark' ? '#a9b8b4' : '#5f6865'
  const grid = props.theme === 'dark' ? '#293236' : '#ded9d4'
  return {
    backgroundColor: 'transparent',
    aria: { show: true, description: '每天记录次数和七日移动平均趋势图' },
    tooltip: { trigger: 'axis' },
    grid: { left: 42, right: 16, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: props.data.map((point) => point.date.slice(5)),
      axisLabel: { color: foreground },
      axisLine: { lineStyle: { color: grid } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      axisLabel: { color: foreground },
      splitLine: { lineStyle: { color: grid } },
    },
    series: [
      {
        name: '次数',
        type: 'bar',
        data: props.data.map((point) => point.count),
        itemStyle: { color: '#f08a72' },
      },
      {
        name: '7 日平均',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: props.data.map((point) => Number(point.average7.toFixed(2))),
        lineStyle: { color: '#f4d6cf', width: 2 },
      },
    ],
  }
})
</script>

<template>
  <section class="panel">
    <h2>变化趋势</h2>
    <EChart :key="theme" :option="option" :theme="theme" />
  </section>
</template>
