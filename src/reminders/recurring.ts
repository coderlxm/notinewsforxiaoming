import rrulePkg from 'rrule';
import type { Weekday } from 'rrule';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import schedule from 'node-schedule';

const { RRule, rrulestr, datetime } = rrulePkg as {
  RRule: typeof import('rrule')['RRule'];
  rrulestr: typeof import('rrule')['rrulestr'];
  datetime: typeof import('rrule')['datetime'];
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

export function buildRRuleText(spec: RecurrenceSpec, baseAt: Date = new Date()): string {
  const freq = freqToRRule(spec.freq);
  const byweekday = spec.byweekday.length > 0
    ? spec.byweekday.map(weekdayToRRule)
    : null;
  const bymonthday = spec.bymonthday.length > 0
    ? spec.bymonthday
    : null;

  const [hourStr, minuteStr] = spec.time.split(':');
  const tzid = spec.timezone || TZ;
  const baseTz = dayjs(baseAt).tz(tzid);
  const rule = new RRule({
    freq,
    byweekday,
    bymonthday,
    byhour: parseInt(hourStr!, 10),
    byminute: parseInt(minuteStr!, 10),
    bysecond: 0,
    dtstart: datetime(
      baseTz.year(),
      baseTz.month() + 1,
      baseTz.date(),
      baseTz.hour(),
      baseTz.minute(),
      baseTz.second(),
    ),
    tzid,
  });

  return rule.toString();
}

function toScheduleDayOfWeek(rruleWeekday: number): number {
  // rrule: 0=MO..6=SU, node-schedule: 0=SU..6=SA
  return (rruleWeekday + 1) % 7;
}

function firstNumber(values: unknown, field: string): number {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`Missing ${field} in recurring rule`);
  }
  const n = Number(values[0]);
  if (!Number.isInteger(n)) {
    throw new Error(`Invalid ${field} in recurring rule`);
  }
  return n;
}

function numberArray(values: unknown, field: string): number[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`Missing ${field} in recurring rule`);
  }
  const arr = values.map(v => Number(v)).filter(v => Number.isInteger(v));
  if (arr.length === 0) {
    throw new Error(`Invalid ${field} in recurring rule`);
  }
  return arr;
}

function buildScheduleRule(options: Record<string, unknown>): schedule.RecurrenceRule {
  const tzid = String(options.tzid || TZ);
  const freq = Number(options.freq);
  const hour = firstNumber(options.byhour, 'byhour');
  const minute = firstNumber(options.byminute, 'byminute');
  const second = firstNumber(options.bysecond, 'bysecond');

  const rule = new schedule.RecurrenceRule();
  rule.tz = tzid;
  rule.hour = hour;
  rule.minute = minute;
  rule.second = second;

  if (freq === RRule.DAILY) {
    return rule;
  }

  if (freq === RRule.WEEKLY) {
    const byweekday = numberArray(options.byweekday, 'byweekday');
    rule.dayOfWeek = byweekday.map(toScheduleDayOfWeek);
    return rule;
  }

  if (freq === RRule.MONTHLY) {
    rule.date = numberArray(options.bymonthday, 'bymonthday');
    return rule;
  }

  throw new Error(`Unsupported recurring freq: ${freq}`);
}

export function getNextTrigger(
  rruleText: string,
  after: Date = new Date(),
  inclusive = true,
): Date {
  const rule = rrulestr(rruleText);
  const options = (rule as unknown as { options?: Record<string, unknown> }).options ?? {};
  const recurrence = buildScheduleRule(options);
  const base = inclusive ? new Date(after.getTime() - 1000) : after;
  const next = recurrence.nextInvocationDate(base);
  if (!next) throw new Error(`No next trigger for rrule: ${rruleText}`);
  return next;
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
