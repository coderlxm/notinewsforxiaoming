import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import type {
  CalendarPoint,
  DashboardAnalytics,
  DashboardIntervals,
  DashboardRange,
  MasturbationRecord,
  TrendPoint,
  WeekdayTimePoint,
} from '../../shared/dashboard'

dayjs.extend(utc)
dayjs.extend(timezone)

const TIMEZONE = 'Asia/Shanghai'
const DAY_MS = 86_400_000
const PERIODS = ['凌晨', '上午', '下午', '晚上'] as const

function timeOf(record: MasturbationRecord) {
  return dayjs(record.occurredAt).tz(TIMEZONE)
}

function dateKey(value: dayjs.Dayjs) {
  return value.format('YYYY-MM-DD')
}

function fillDays(start: dayjs.Dayjs, length: number, counts: Map<string, number>): CalendarPoint[] {
  return Array.from({ length }, (_, index) => {
    const date = dateKey(start.add(index, 'day'))
    return { date, count: counts.get(date) ?? 0 }
  })
}

function intervals(records: MasturbationRecord[]): number[] {
  return records.slice(1).map((record, index) => (
    timeOf(record).valueOf() - timeOf(records[index]).valueOf()
  ) / 60_000)
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function intervalSummary(records: MasturbationRecord[]): DashboardIntervals {
  const values = intervals(records)
  return {
    medianMinutes: values.length === 0 ? null : median(values),
    longestMinutes: values.length === 0 ? null : Math.max(...values),
    count: values.length,
  }
}

function periodIndex(hour: number) {
  if (hour < 6) return 0
  if (hour < 12) return 1
  if (hour < 18) return 2
  return 3
}

export function buildAnalytics(
  records: MasturbationRecord[],
  range: DashboardRange,
  now = dayjs().tz(TIMEZONE),
): DashboardAnalytics {
  const today = now.startOf('day')
  const sortedRecords = [...records].sort((left, right) => (
    timeOf(left).valueOf() - timeOf(right).valueOf()
  ))
  const counts = new Map<string, number>()

  for (const record of sortedRecords) {
    const key = dateKey(timeOf(record))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const recent30Start = today.subtract(29, 'day')
  const recent30 = sortedRecords.filter((record) => timeOf(record).valueOf() >= recent30Start.valueOf())
  const rangeStart = today.subtract(range - 1, 'day')
  const rangeRecords = sortedRecords.filter((record) => timeOf(record).valueOf() >= rangeStart.valueOf())
  const calendarStart = today.subtract(364, 'day')
  const calendar = fillDays(calendarStart, 365, counts)
  const dailyTrend = fillDays(rangeStart, range, counts)
  const trend: TrendPoint[] = dailyTrend.map((point, index) => {
    const window = dailyTrend.slice(Math.max(0, index - 6), index + 1)
    const average7 = window.reduce((sum, item) => sum + item.count, 0) / window.length
    return { ...point, average7 }
  })

  const weekdayTime: WeekdayTimePoint[] = Array.from({ length: 7 }, (_, weekdayIndex) => (
    PERIODS.map((period) => ({ weekday: weekdayIndex + 1, period, count: 0 }))
  )).flat()

  for (const record of rangeRecords) {
    const time = timeOf(record)
    const weekday = time.day() === 0 ? 7 : time.day()
    const index = (weekday - 1) * PERIODS.length + periodIndex(time.hour())
    weekdayTime[index].count += 1
  }

  const lastRecord = sortedRecords.at(-1)

  return {
    current: {
      minutes: lastRecord ? now.diff(timeOf(lastRecord), 'millisecond') / 60_000 : null,
      lastOccurredAt: lastRecord?.occurredAt ?? null,
    },
    summary: {
      totalCount: sortedRecords.length,
      todayCount: counts.get(dateKey(today)) ?? 0,
      last7Count: fillDays(today.subtract(6, 'day'), 7, counts).reduce((sum, item) => sum + item.count, 0),
      last30Count: recent30.length,
      last30ActiveDays: new Set(recent30.map((record) => dateKey(timeOf(record)))).size,
    },
    calendar,
    trend,
    weekdayTime,
    intervals: intervalSummary(rangeRecords),
    recent: sortedRecords.slice(-20).reverse(),
  }
}

export function formatDuration(minutes: number | null) {
  if (minutes === null) return '数据不足'
  const wholeMinutes = Math.floor(minutes)
  const days = Math.floor(wholeMinutes / 1_440)
  const hours = Math.floor((wholeMinutes % 1_440) / 60)
  const remainder = wholeMinutes % 60
  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${remainder} 分钟`
  return `${remainder} 分钟`
}
