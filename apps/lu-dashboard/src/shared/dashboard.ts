export type DashboardRange = 30 | 90 | 365

export interface CalendarPoint {
  date: string
  count: number
}

export interface TrendPoint {
  date: string
  count: number
  average7: number
}

export interface WeekdayTimePoint {
  weekday: number
  period: string
  count: number
}

export interface MasturbationRecord {
  id: number
  occurredAt: string
}

export interface DashboardResponse {
  generatedAt: string
  timezone: 'Asia/Shanghai'
  records: MasturbationRecord[]
}

export interface DashboardSummary {
  totalCount: number
  todayCount: number
  last7Count: number
  last30Count: number
  last30ActiveDays: number
}

export interface DashboardIntervals {
  medianMinutes: number | null
  longestMinutes: number | null
  count: number
}

export interface CurrentInterval {
  minutes: number | null
  lastOccurredAt: string | null
}

export interface DashboardAnalytics {
  current: CurrentInterval
  summary: DashboardSummary
  calendar: CalendarPoint[]
  trend: TrendPoint[]
  weekdayTime: WeekdayTimePoint[]
  intervals: DashboardIntervals
  recent: MasturbationRecord[]
}
