export function normalizePublicSearchQuery(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

export function publicSearchPath(query: string): string {
  const normalizedQuery = normalizePublicSearchQuery(query);
  if (!normalizedQuery) return '/search';
  return `/search?${new URLSearchParams({ q: normalizedQuery }).toString()}`;
}

export function publicArchiveMonthPath(year: number, month: number): string {
  return `/archive/${year}/${String(month).padStart(2, '0')}`;
}

export function discoveryErrorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
