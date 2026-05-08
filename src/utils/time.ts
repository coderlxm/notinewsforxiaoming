import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

export function bj(input?: string | Date): dayjs.Dayjs {
  return dayjs(input).tz(TZ);
}

export function bjFormat(input: string | Date, format = 'YYYY-MM-DD HH:mm'): string {
  return bj(input).format(format);
}

export function getChinaDayOfWeek(): number {
  return bj().day();
}

export function formatShortDisplay(iso: string): string {
  const t = bj(iso);
  const now = bj();
  if (t.format('YYYY-MM-DD') === now.format('YYYY-MM-DD')) {
    return t.format('HH:mm');
  }
  return t.format('MM-DD HH:mm');
}
