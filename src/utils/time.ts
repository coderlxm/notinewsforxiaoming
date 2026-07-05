import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

function toBj(input?: string | Date): dayjs.Dayjs {
  if (input === undefined) {
    return dayjs().tz(TZ);
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return dayjs.tz(input, TZ);
  }
  return dayjs(input).tz(TZ);
}

export function bj(input?: string | Date): dayjs.Dayjs {
  return toBj(input);
}

export function bjFormat(input: string | Date, format = 'YYYY-MM-DD HH:mm'): string {
  return bj(input).format(format);
}

export function bjDate(input?: string | Date): string {
  return bj(input).format('YYYY-MM-DD');
}

export function shiftBjDate(input: string | Date, days: number): string {
  return bj(input).add(days, 'day').format('YYYY-MM-DD');
}

export function diffBjDays(from: string | Date, to: string | Date): number {
  return bj(to).startOf('day').diff(bj(from).startOf('day'), 'day');
}

export function isBjWeekend(input: string | Date): boolean {
  const day = bj(input).day();
  return day === 0 || day === 6;
}

export function getChinaDayOfWeek(input?: string | Date): number {
  return bj(input).day();
}

export function formatShortDisplay(iso: string): string {
  const t = bj(iso);
  const now = bj();
  if (t.format('YYYY-MM-DD') === now.format('YYYY-MM-DD')) {
    return t.format('HH:mm');
  }
  return t.format('MM-DD HH:mm');
}
