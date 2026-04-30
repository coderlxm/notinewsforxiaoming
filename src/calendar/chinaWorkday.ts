import { readFileSync } from 'fs';
import { resolve } from 'path';

interface HolidayCalendar {
  timezone: string;
  year: number;
  holiday_overrides: string[];
  workday_overrides: string[];
}

function chinaDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;

  return `${y}-${m}-${d}`;
}

function chinaDayOfWeek(date: Date): number {
  const [y, m, d] = chinaDateString(date).split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d!)).getUTCDay();
}

function loadCalendar(year: number): HolidayCalendar | null {
  try {
    const path = resolve(process.cwd(), `data/china-holiday-${year}.json`);
    return JSON.parse(readFileSync(path, 'utf-8')) as HolidayCalendar;
  } catch {
    console.warn(`[calendar] no holiday data for ${year}, using default weekday logic`);
    return null;
  }
}

export function isChinaWorkday(date: Date): boolean {
  const dateStr = chinaDateString(date);
  const year = parseInt(dateStr.slice(0, 4), 10);
  const calendar = loadCalendar(year);

  if (calendar) {
    if (calendar.workday_overrides.includes(dateStr)) return true;
    if (calendar.holiday_overrides.includes(dateStr)) return false;
  }

  const dow = chinaDayOfWeek(date);
  return dow >= 1 && dow <= 5;
}
