import { readFileSync } from 'fs';
import { resolve } from 'path';

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
  '2026-02-16': '春节',
  '2026-04-06': '清明节',
  '2026-05-01': '劳动节',
  '2026-06-19': '端午节',
  '2026-09-25': '中秋节',
  '2026-10-01': '国庆节'
};

const GTA6_DATE = '2026-11-19';

function chinaToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;

  return `${y}-${m}-${d}`;
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromDate = new Date(Date.UTC(fy!, (fm ?? 1) - 1, fd!));
  const toDate = new Date(Date.UTC(ty!, (tm ?? 1) - 1, td!));
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

function nextDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(dt.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

function loadHolidayCalendar(year: number): HolidayCalendar | null {
  try {
    const path = resolve(process.cwd(), `data/china-holiday-${year}.json`);
    return JSON.parse(readFileSync(path, 'utf-8')) as HolidayCalendar;
  } catch {
    return null;
  }
}

function buildHolidayPeriods(holidayDates: string[]): HolidayPeriod[] {
  if (holidayDates.length === 0) return [];
  const sorted = [...holidayDates].sort();
  const periods: HolidayPeriod[] = [];

  let start = sorted[0]!;
  let end = sorted[0]!;

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i]!;
    if (current === nextDate(end)) {
      end = current;
    } else {
      periods.push({
        name: HOLIDAY_NAME_BY_START_DATE[start] ?? '节假日',
        start,
        end
      });
      start = current;
      end = current;
    }
  }

  periods.push({
    name: HOLIDAY_NAME_BY_START_DATE[start] ?? '节假日',
    start,
    end
  });

  return periods;
}

export interface CountdownInfo {
  holiday: { name: string; days: number } | null;
  gta6: { days: number; isSoon: boolean };
  isHolidayToday: boolean;
  currentHolidayName: string | null;
}

export function getCountdownInfo(): CountdownInfo {
  const today = chinaToday();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const calendar = loadHolidayCalendar(currentYear);
  const holidayPeriods = buildHolidayPeriods(calendar?.holiday_overrides ?? []);

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
