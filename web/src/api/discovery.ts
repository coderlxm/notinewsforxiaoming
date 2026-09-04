import type {
  JournalDiscoveryArchiveMonthResponse,
  JournalDiscoveryArchiveOverview,
  JournalDiscoverySearchResponse,
} from '../types';
import { requestJson } from './client';

export function fetchPublicDiscoverySearch(options: {
  query: string;
  cursor?: string;
}): Promise<JournalDiscoverySearchResponse> {
  const params = new URLSearchParams({ q: options.query });
  if (options.cursor) params.set('cursor', options.cursor);
  return requestJson<JournalDiscoverySearchResponse>(
    `/api/discovery/search?${params.toString()}`,
  );
}

export function fetchPublicDiscoveryArchive(): Promise<JournalDiscoveryArchiveOverview> {
  return requestJson<JournalDiscoveryArchiveOverview>('/api/discovery/archive');
}

export function fetchPublicDiscoveryArchiveMonth(options: {
  year: number;
  month: number;
  cursor?: string;
}): Promise<JournalDiscoveryArchiveMonthResponse> {
  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  const query = params.size ? `?${params.toString()}` : '';
  return requestJson<JournalDiscoveryArchiveMonthResponse>(
    `/api/discovery/archive/${options.year}/${String(options.month).padStart(2, '0')}${query}`,
  );
}
