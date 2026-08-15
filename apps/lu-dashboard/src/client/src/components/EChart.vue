<script setup lang="ts">
import { onBeforeUnmount, onMounted, onUpdated, ref } from 'vue'
import { init, use } from 'echarts/core'
import type { ECharts, EChartsCoreOption } from 'echarts/core'
import { BarChart, HeatmapChart, LineChart } from 'echarts/charts'
import {
  AriaComponent,
  CalendarComponent,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'

use([
  AriaComponent,
  BarChart,
  CalendarComponent,
  GridComponent,
  HeatmapChart,
  LineChart,
  SVGRenderer,
  TooltipComponent,
  VisualMapComponent,
])

const props = defineProps<{ option: EChartsCoreOption; theme: 'dark' | 'light' }>()

const el = ref<HTMLElement | null>(null)
let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

function render() {
  if (!chart) return
  chart.setOption(props.option)
}

onMounted(() => {
  if (!el.value) return
  chart = init(el.value, props.theme === 'dark' ? 'dark' : undefined, { renderer: 'svg' })
  render()
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(el.value)
})

onUpdated(() => {
  if (!chart) return
  chart.clear()
  render()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="chart" />
</template>

<style scoped>
.chart {
  width: 100%;
  height: 320px;
}
</style>
