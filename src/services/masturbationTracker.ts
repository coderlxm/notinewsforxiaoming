import {
  findLatestRecord,
  findRecordsInRange,
  type MasturbationRecord,
} from './masturbationRepository.js';
import { bj } from '../utils/time.js';

export interface MasturbationSummary {
  todayCount: number;
  sevenDayCount: number;
  sevenDayActiveDays: number;
  thirtyDayCount: number;
  thirtyDayActiveDays: number;
  latest: MasturbationRecord | undefined;
  dailyCounts: Array<{ date: string; count: number }>;
}

function countActiveDays(records: MasturbationRecord[]): number {
  const days = new Set<string>();
  for (const record of records) {
    days.add(bj(record.occurred_at).format('YYYY-MM-DD'));
  }
  return days.size;
}

export function buildSummary(now: Date = new Date()): MasturbationSummary {
  const today = bj(now).startOf('day');
  const tomorrow = today.add(1, 'day');
  const sevenStart = today.subtract(6, 'day');
  const thirtyStart = today.subtract(29, 'day');

  const todayRecords = findRecordsInRange(today.toISOString(), tomorrow.toISOString());
  const sevenRecords = findRecordsInRange(sevenStart.toISOString(), tomorrow.toISOString());
  const thirtyRecords = findRecordsInRange(thirtyStart.toISOString(), tomorrow.toISOString());
  const latest = findLatestRecord();

  const sevenDayCountByDate = new Map<string, number>();
  for (const record of sevenRecords) {
    const date = bj(record.occurred_at).format('YYYY-MM-DD');
    sevenDayCountByDate.set(date, (sevenDayCountByDate.get(date) ?? 0) + 1);
  }

  const dailyCounts: Array<{ date: string; count: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const day = today.subtract(i, 'day');
    dailyCounts.push({
      date: day.format('MM-DD'),
      count: sevenDayCountByDate.get(day.format('YYYY-MM-DD')) ?? 0,
    });
  }

  return {
    todayCount: todayRecords.length,
    sevenDayCount: sevenRecords.length,
    sevenDayActiveDays: countActiveDays(sevenRecords),
    thirtyDayCount: thirtyRecords.length,
    thirtyDayActiveDays: countActiveDays(thirtyRecords),
    latest,
    dailyCounts,
  };
}

export function formatSinceLatest(latest: MasturbationRecord, now: Date = new Date()): string {
  const from = bj(latest.occurred_at);
  const to = bj(now);
  const totalMinutes = to.diff(from, 'minute');
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  if (days > 0 && hours > 0) {
    return `${days} 天 ${hours} 小时`;
  }
  if (days > 0) {
    return `${days} 天`;
  }
  if (hours > 0) {
    return `${hours} 小时`;
  }
  const minutes = Math.max(totalMinutes, 0);
  return `${minutes} 分钟`;
}
