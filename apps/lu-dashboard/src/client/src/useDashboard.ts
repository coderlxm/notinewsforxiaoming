import { computed, readonly, ref, shallowRef } from 'vue'
import type { DashboardRange, MasturbationRecord } from '../../shared/dashboard'
import { buildAnalytics } from './analytics'
import { getDashboard } from './api'

export function useDashboard() {
  const records = shallowRef<MasturbationRecord[] | null>(null)
  const generatedAt = ref<string | null>(null)
  const range = ref<DashboardRange>(90)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const analytics = computed(() => records.value ? buildAnalytics(records.value, range.value) : null)

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const response = await getDashboard()
      records.value = response.records
      generatedAt.value = response.generatedAt
    } catch (cause) {
      error.value = (cause as Error).message
    } finally {
      loading.value = false
    }
  }

  function setRange(value: DashboardRange) {
    range.value = value
  }

  return {
    analytics,
    error: readonly(error),
    generatedAt: readonly(generatedAt),
    loading: readonly(loading),
    range: readonly(range),
    refresh,
    setRange,
  }
}
