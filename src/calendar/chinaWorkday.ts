import { readFileSync } from 'fs';
import { resolve } from 'path';
import { bjDate, getChinaDayOfWeek } from '../utils/time.js';

interface HolidayCalendar {
  timezone: string;
  year: number;
  holiday_overrides: string[];
  workday_overrides: string[];
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
  const dateStr = bjDate(date);
  const year = parseInt(dateStr.slice(0, 4), 10);
  const calendar = loadCalendar(year);

  if (calendar) {
    if (calendar.workday_overrides.includes(dateStr)) return true;
    if (calendar.holiday_overrides.includes(dateStr)) return false;
  }

  const dow = getChinaDayOfWeek(date);
  return dow >= 1 && dow <= 5;
}
