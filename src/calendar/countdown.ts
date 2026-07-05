import { readFileSync } from 'fs';
import { resolve } from 'path';
import { bjDate, diffBjDays, isBjWeekend, shiftBjDate } from '../utils/time.js';

interface HolidayCalendar {
  timezone: string;
  year: number;
  holiday_overrides: string[];
  workday_overrides: string[];
}

interface HolidayPeriod {
  name: string;
  start: string;
  end: string;
}

const HOLIDAY_NAME_BY_START_DATE: Record<string, string> = {
  '2026-01-01': '元旦',
  '2026-02-15': '春节',
  '2026-04-04': '清明节',
  '2026-05-01': '劳动节',
  '2026-06-19': '端午节',
  '2026-09-25': '中秋节',
  '2026-10-01': '国庆节'
};

const GTA6_DATE = '2026-11-19';

function daysBetween(from: string, to: string): number {
  return diffBjDays(from, to);
}

function nextDate(date: string): string {
  return shiftBjDate(date, 1);
}

function prevDate(date: string): string {
  return shiftBjDate(date, -1);
}

function isWeekend(date: string): boolean {
  return isBjWeekend(date);
}

function loadHolidayCalendar(year: number): HolidayCalendar | null {
  try {
    const path = resolve(process.cwd(), `data/china-holiday-${year}.json`);
    return JSON.parse(readFileSync(path, 'utf-8')) as HolidayCalendar;
  } catch {
    return null;
  }
}

function buildHolidayPeriods(holidayDates: string[], workdayOverrides: string[]): HolidayPeriod[] {
  if (holidayDates.length === 0) return [];
  const holidaySet = new Set(holidayDates);
  const workdaySet = new Set(workdayOverrides);
  const visitedOverride = new Set<string>();
  const periods: HolidayPeriod[] = [];
  const sortedOverrides = [...holidayDates].sort();

  const isNonWorkday = (date: string): boolean => {
    if (workdaySet.has(date)) return false;
    if (holidaySet.has(date)) return true;
    return isWeekend(date);
  };

  for (const anchor of sortedOverrides) {
    if (visitedOverride.has(anchor)) continue;

    let start = anchor;
    let end = anchor;

    while (isNonWorkday(prevDate(start))) {
      start = prevDate(start);
    }
    while (isNonWorkday(nextDate(end))) {
      end = nextDate(end);
    }

    let cursor = start;
    while (cursor <= end) {
      if (holidaySet.has(cursor)) {
        visitedOverride.add(cursor);
      }
      cursor = nextDate(cursor);
    }

    periods.push({
      name: HOLIDAY_NAME_BY_START_DATE[start] ?? HOLIDAY_NAME_BY_START_DATE[anchor] ?? '节假日',
      start,
      end
    });
  }

  return periods.sort((a, b) => a.start.localeCompare(b.start));
}

export interface CountdownInfo {
  holiday: { name: string; days: number } | null;
  gta6: { days: number; isSoon: boolean };
  isHolidayToday: boolean;
  currentHolidayName: string | null;
}

export function getCountdownInfo(): CountdownInfo {
  const today = bjDate();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const calendar = loadHolidayCalendar(currentYear);
  const holidayPeriods = buildHolidayPeriods(calendar?.holiday_overrides ?? [], calendar?.workday_overrides ?? []);

  let currentHoliday: HolidayPeriod | null = null;
  for (const h of holidayPeriods) {
    if (today >= h.start && today <= h.end) {
      currentHoliday = h;
      break;
    }
  }

  let nextHoliday: { name: string; days: number } | null = null;
  for (const h of holidayPeriods) {
    if (h.start > today) {
      nextHoliday = { name: h.name, days: daysBetween(today, h.start) };
      break;
    }
  }

  const gta6Days = daysBetween(today, GTA6_DATE);

  return {
    holiday: nextHoliday,
    gta6: { days: gta6Days, isSoon: gta6Days >= 0 && gta6Days < 30 },
    isHolidayToday: currentHoliday !== null,
    currentHolidayName: currentHoliday?.name ?? null,
  };
}
