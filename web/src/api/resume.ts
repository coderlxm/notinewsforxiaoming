import type {
  JournalPublicResume,
  JournalResumeAccessInput,
  JournalResumeAccessUpdateResponse,
  JournalAdminResumeSummary,
} from '../types';
import { requestJson, requestWithoutResponse, jsonRequest } from './client';

export function fetchPublicResume(): Promise<JournalPublicResume> {
  return requestJson<JournalPublicResume>('/api/resume');
}

export function unlockResume(password: string): Promise<JournalPublicResume> {
  return requestJson<JournalPublicResume>(
    '/api/resume/unlock',
    jsonRequest('POST', { password }),
  );
}

export function exchangeResumeShareToken(token: string): Promise<JournalPublicResume> {
  return requestJson<JournalPublicResume>('/api/resume/share-session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchAdminResume(): Promise<JournalAdminResumeSummary | null> {
  return requestJson<JournalAdminResumeSummary | null>('/api/me/resume');
}

export function uploadResume(file: File): Promise<JournalAdminResumeSummary> {
  const form = new FormData();
  form.append('resume', file);
  return requestJson<JournalAdminResumeSummary>('/api/me/resume', { method: 'PUT', body: form });
}

export function updateResumeAccess(
  input: JournalResumeAccessInput,
): Promise<JournalResumeAccessUpdateResponse> {
  return requestJson<JournalResumeAccessUpdateResponse>(
    '/api/me/resume/access',
    jsonRequest('PUT', input),
  );
}

export function deleteResume(): Promise<void> {
  return requestWithoutResponse('/api/me/resume', { method: 'DELETE' });
}
