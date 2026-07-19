export function formatEntryTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function formatFileSize(value: number | null): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat('zh-CN', {
    style: 'unit',
    unit: value >= 1_048_576 ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: 1,
  }).format(value >= 1_048_576 ? value / 1_048_576 : value / 1024);
}

export function formatStructuredValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  return JSON.stringify(value, null, 2);
}
