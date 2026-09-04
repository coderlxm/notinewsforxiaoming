import type {
  AdminContributionDetail,
  AdminContributionLink,
  ContributionLinkLifetime,
  AdminContributionListResponse,
  JournalEntry,
  JournalVisibility,
} from '../types';
import { requestJson, requestWithoutResponse, jsonRequest } from './client';

export function fetchAdminContributionLink(): Promise<{ link: AdminContributionLink | null }> {
  return requestJson<{ link: AdminContributionLink | null }>('/api/private/contribution-link');
}

export function createAdminContributionLink(
  lifetime: ContributionLinkLifetime,
): Promise<{ link: AdminContributionLink }> {
  return requestJson<{ link: AdminContributionLink }>(
    '/api/private/contribution-link',
    jsonRequest('POST', { lifetime }),
  );
}

export function revokeAdminContributionLink(): Promise<void> {
  return requestWithoutResponse('/api/private/contribution-link', { method: 'DELETE' });
}

export function fetchAdminContributions(): Promise<AdminContributionListResponse> {
  return requestJson<AdminContributionListResponse>('/api/private/contributions');
}

export function fetchAdminContribution(publicId: string): Promise<AdminContributionDetail> {
  return requestJson<AdminContributionDetail>(
    `/api/private/contributions/${encodeURIComponent(publicId)}`,
  );
}

export function publishAdminContribution(
  publicId: string,
  input: {
    contentText: string;
    assetIds: number[];
    sourceCreatedAt: string;
    visibility: JournalVisibility;
  },
): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/private/contributions/${encodeURIComponent(publicId)}/publish`,
    jsonRequest('POST', input),
  );
}

export function deleteAdminContributionAsset(
  publicId: string,
  assetId: number,
): Promise<AdminContributionDetail> {
  return requestJson<AdminContributionDetail>(
    `/api/private/contributions/${encodeURIComponent(publicId)}/assets/${assetId}`,
    { method: 'DELETE' },
  );
}

export function deleteAdminContribution(publicId: string): Promise<void> {
  return requestWithoutResponse(
    `/api/private/contributions/${encodeURIComponent(publicId)}`,
    { method: 'DELETE' },
  );
}
