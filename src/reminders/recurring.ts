import rrulePkg from 'rrule';
import type { Weekday } from 'rrule';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

const { RRule, rrulestr } = rrulePkg as {
  RRule: typeof import('rrule')['RRule'];
  rrulestr: typeof import('rrule')['rrulestr'];
};

dayjs.extend(utc);
dayjs.extend(timezone);

export interface RecurrenceSpec {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  byweekday: string[];
  bymonthday: number[];
  time: string;
  timezone: string;
}

const TZ = 'Asia/Shanghai';
const MAX_SEARCH_DAYS = 14;
const MAX_SEARCH_MONTHS = 24;

function freqToRRule(freq: string): number {
  if (freq === 'DAILY') return RRule.DAILY;
  if (freq === 'WEEKLY') return RRule.WEEKLY;
  if (freq === 'MONTHLY') return RRule.MONTHLY;
  throw new Error(`Unsupported freq: ${freq}`);
}

function weekdayToRRule(wd: string): Weekday {
  const map: Record<string, Weekday> = {
    MO: RRule.MO, TU: RRule.TU, WE: RRule.WE,
    TH: RRule.TH, FR: RRule.FR, SA: RRule.SA, SU: RRule.SU
  };
  const v = map[wd.toUpperCase()];
  if (v === undefined) throw new Error(`Invalid weekday: ${wd}`);
  return v;
}

export function buildRRuleText(spec: RecurrenceSpec): string {
  const freq = freqToRRule(spec.freq);
  const byweekday = spec.byweekday.length > 0
    ? spec.byweekday.map(weekdayToRRule)
    : null;
  const bymonthday = spec.bymonthday.length > 0
    ? spec.bymonthday
    : null;

  const [hourStr, minuteStr] = spec.time.split(':');
  const rule = new RRule({
    freq,
    byweekday,
    bymonthday,
    byhour: parseInt(hourStr!, 10),
    byminute: parseInt(minuteStr!, 10),
    bysecond: 0,
    dtstart: new Date(),
    tzid: TZ,
  });

  return rule.toString();
}

function toDayjsWeekday(rruleWeekday: number): number {
  // rrule: 0=MO..6=SU, dayjs: 0=SU..6=SA
  return (rruleWeekday + 1) % 7;
}

function pickTime(options: Record<string, unknown>): { hour: number; minute: number; second: number } {
  const byhour = Array.isArray(options.byhour) ? options.byhour : [];
  const byminute = Array.isArray(options.byminute) ? options.byminute : [];
  const bysecond = Array.isArray(options.bysecond) ? options.bysecond : [];
  const hour = Number(byhour[0] ?? 0);
  const minute = Number(byminute[0] ?? 0);
  const second = Number(bysecond[0] ?? 0);
  return { hour, minute, second };
}

function nextDaily(nowTz: dayjs.Dayjs, hour: number, minute: number, second: number): dayjs.Dayjs {
  let candidate = nowTz.hour(hour).minute(minute).second(second).millisecond(0);
  if (!candidate.isAfter(nowTz)) {
    candidate = candidate.add(1, 'day');
  }
  return candidate;
}

function nextWeekly(nowTz: dayjs.Dayjs, weekdays: number[], hour: number, minute: number, second: number): dayjs.Dayjs {
  const daySet = new Set(weekdays.map(toDayjsWeekday));
  for (let i = 0; i < MAX_SEARCH_DAYS; i += 1) {
    const d = nowTz.add(i, 'day');
    if (!daySet.has(d.day())) continue;
    const candidate = d.hour(hour).minute(minute).second(second).millisecond(0);
    if (candidate.isAfter(nowTz)) {
      return candidate;
    }
  }
  throw new Error('Failed to calculate next weekly trigger');
}

function nextMonthly(nowTz: dayjs.Dayjs, monthdays: number[], hour: number, minute: number, second: number): dayjs.Dayjs {
  const days = monthdays
    .map(v => Number(v))
    .filter(v => Number.isInteger(v) && v >= 1 && v <= 31)
    .sort((a, b) => a - b);
  if (days.length === 0) {
    throw new Error('Monthly rule requires at least one valid month day');
  }

  for (let m = 0; m < MAX_SEARCH_MONTHS; m += 1) {
    const monthBase = nowTz.add(m, 'month').startOf('month');
    const daysInMonth = monthBase.daysInMonth();
    for (const day of days) {
      if (day > daysInMonth) continue;
      const candidate = monthBase.date(day).hour(hour).minute(minute).second(second).millisecond(0);
      if (candidate.isAfter(nowTz)) {
        return candidate;
      }
    }
  }
  throw new Error('Failed to calculate next monthly trigger');
}

export function getNextTrigger(rruleText: string): Date {
  const rule = rrulestr(rruleText) as unknown as { options: Record<string, unknown> };
  const options = rule.options;
  const tzid = String(options.tzid || TZ);
  const nowTz = dayjs().tz(tzid);
  const freq = Number(options.freq);
  const { hour, minute, second } = pickTime(options);

  if (freq === RRule.DAILY) {
    return nextDaily(nowTz, hour, minute, second).utc().toDate();
  }

  if (freq === RRule.WEEKLY) {
    const byweekday = Array.isArray(options.byweekday) ? options.byweekday.map(v => Number(v)) : [];
    return nextWeekly(nowTz, byweekday, hour, minute, second).utc().toDate();
  }

  if (freq === RRule.MONTHLY) {
    const bymonthday = Array.isArray(options.bymonthday) ? options.bymonthday.map(v => Number(v)) : [];
    return nextMonthly(nowTz, bymonthday, hour, minute, second).utc().toDate();
  }

  throw new Error(`Unsupported recurring freq: ${freq}`);
}

export function describeRecurrence(spec: RecurrenceSpec): string {
  const time = spec.time;
  if (spec.freq === 'DAILY') return `每天 ${time}`;

  if (spec.freq === 'WEEKLY') {
    const dayMap: Record<string, string> = {
      MO: '一', TU: '二', WE: '三', TH: '四', FR: '五', SA: '六', SU: '日'
    };
    const days = spec.byweekday.map(d => dayMap[d.toUpperCase()] || d).join('、');
    return `每${days} ${time}`;
  }

  if (spec.freq === 'MONTHLY') {
    const days = spec.bymonthday.join('、');
    return `每月${days}日 ${time}`;
  }

  return '未知规则';
}
