import rrulePkg from 'rrule';
import type { Weekday } from 'rrule';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

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

export function buildRRuleText(spec: RecurrenceSpec): string {
  const freq = freqToRRule(spec.freq);
  const byweekday = spec.byweekday.length > 0
    ? spec.byweekday.map(weekdayToRRule)
    : null;
  const bymonthday = spec.bymonthday.length > 0
    ? spec.bymonthday
    : null;

  const [hourStr, minuteStr] = spec.time.split(':');
  const tzid = spec.timezone || TZ;
  const nowTz = dayjs().tz(tzid);
  const rule = new RRule({
    freq,
    byweekday,
    bymonthday,
    byhour: parseInt(hourStr!, 10),
    byminute: parseInt(minuteStr!, 10),
    bysecond: 0,
    dtstart: datetime(
      nowTz.year(),
      nowTz.month() + 1,
      nowTz.date(),
      nowTz.hour(),
      nowTz.minute(),
      nowTz.second(),
    ),
    tzid,
  });

  return rule.toString();
}

function normalizePseudoUtcToRealUtc(pseudoUtc: Date): Date {
  const localTz = dayjs.tz.guess();
  const wallClock = dayjs.utc(pseudoUtc).format('YYYY-MM-DD HH:mm:ss');
  return dayjs.tz(wallClock, localTz).utc().toDate();
}

export function getNextTrigger(
  rruleText: string,
  after: Date = new Date(),
  inclusive = true,
): Date {
  const rule = rrulestr(rruleText);
  const next = rule.after(after, inclusive);
  if (!next) throw new Error(`No next trigger for rrule: ${rruleText}`);
  return normalizePseudoUtcToRealUtc(next);
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
