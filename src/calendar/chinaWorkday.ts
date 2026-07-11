import { readFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import { bjDate, getChinaDayOfWeek } from '../utils/time.js';

interface HolidayCalendar {
  timezone: string;
  year: number;
  holiday_overrides: string[];
  workday_overrides: string[];
}

const holidayCalendarSchema = z.object({
  timezone: z.literal('Asia/Shanghai'),
  year: z.number().int(),
  holiday_overrides: z.array(z.string()),
  workday_overrides: z.array(z.string()),
});

function loadCalendarStrict(year: number): HolidayCalendar {
  const path = resolve(process.cwd(), `data/china-holiday-${year}.json`);
  const calendar = holidayCalendarSchema.parse(JSON.parse(readFileSync(path, 'utf-8')));
  if (calendar.year !== year) {
    throw new Error(`中国工作日日历年份不匹配：期望 ${year}，实际 ${calendar.year}`);
  }
  return calendar;
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

export function isChinaWorkdayStrict(date: Date): boolean {
  const dateStr = bjDate(date);
  const year = parseInt(dateStr.slice(0, 4), 10);
  const calendar = loadCalendarStrict(year);
  if (calendar.workday_overrides.includes(dateStr)) return true;
  if (calendar.holiday_overrides.includes(dateStr)) return false;
  const dow = getChinaDayOfWeek(date);
  return dow >= 1 && dow <= 5;
}
