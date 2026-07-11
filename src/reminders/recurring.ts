import rrulePkg from 'rrule';
import type { Weekday } from 'rrule';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import type { RecurringRule } from './repository.js';
import { isChinaWorkdayStrict } from '../calendar/chinaWorkday.js';

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
  calendarFilter: 'china_workday' | null;
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
  });

  return rule.toString();
}

function getRRuleTimezone(rruleText: string): string {
  const match = rruleText.match(/^DTSTART;TZID=([^:]+):/m);
  if (match?.[1]) return match[1];
  return TZ;
}

function normalizeRRuleText(rruleText: string): string {
  return rruleText.replace(
    /^DTSTART;TZID=[^:]+:(\d{8}T\d{6})/m,
    'DTSTART:$1Z',
  );
}

function toPseudoUtc(date: Date, tzid: string): Date {
  const wallClock = dayjs(date).tz(tzid).format('YYYY-MM-DD HH:mm:ss');
  return dayjs.utc(wallClock).toDate();
}

function fromPseudoUtc(date: Date, tzid: string): Date {
  const wallClock = dayjs.utc(date).format('YYYY-MM-DD HH:mm:ss');
  return dayjs.tz(wallClock, tzid).utc().toDate();
}

export function getNextTrigger(
  rruleText: string,
  timezoneName: string,
  after: Date = new Date(),
  inclusive = true,
  calendarFilter: 'china_workday' | null = null,
): Date {
  const normalizedText = normalizeRRuleText(rruleText);
  const rule = rrulestr(normalizedText);
  const tzid = timezoneName || getRRuleTimezone(rruleText);
  const pseudoAfter = toPseudoUtc(after, tzid);
  let next = rule.after(pseudoAfter, inclusive);
  while (next) {
    const triggerAt = fromPseudoUtc(next, tzid);
    if (calendarFilter === null || isChinaWorkdayStrict(triggerAt)) {
      return triggerAt;
    }
    next = rule.after(next, false);
  }
  throw new Error(`No next trigger for rrule: ${normalizedText}`);
}

export function describeRecurrence(spec: RecurrenceSpec): string {
  const time = spec.time;
  if (spec.calendarFilter === 'china_workday') return `每个中国工作日 ${time}`;
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

export interface RecurringOccurrence {
  rule: RecurringRule;
  triggerAt: Date;
}

export function getOccurrencesInRange(
  rule: RecurringRule,
  start: Date,
  end: Date,
): RecurringOccurrence[] {
  const results: RecurringOccurrence[] = [];
  const MAX_OCCURRENCES = 100;

  let inclusive = true;
  let cursor = start;

  while (results.length <= MAX_OCCURRENCES) {
    const next = getNextTrigger(rule.rrule_text, rule.timezone, cursor, inclusive, rule.calendar_filter);
    if (next > end) break;
    if (results.length === MAX_OCCURRENCES) {
      throw new Error(`循环提醒「${rule.text}」在范围内展开超过 ${MAX_OCCURRENCES} 次，请缩小查询范围。`);
    }
    results.push({ rule, triggerAt: next });
    cursor = next;
    inclusive = false;
  }

  return results;
}
