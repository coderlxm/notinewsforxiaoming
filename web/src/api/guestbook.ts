import type {
  GuestbookDeletionResponse,
  GuestbookOwnerReplyRequest,
  GuestbookOwnerReplyResponse,
  GuestbookPinnedMutationResponse,
  GuestbookPublicListResponse,
  GuestbookStatus,
  GuestbookStatusMutationResponse,
  GuestbookAdminListResponse,
  GuestbookVisitorCreateRequest,
  GuestbookVisitorCreateResponse,
} from '../../../src/shared/guestbookProtocol';
import { requestJson, jsonRequest, withVisitorId } from './client';

export function fetchPublicGuestbook(): Promise<GuestbookPublicListResponse> {
  return requestJson<GuestbookPublicListResponse>('/api/guestbook');
}

export function createGuestbookMessage(
  visitorId: string | null,
  input: GuestbookVisitorCreateRequest,
): Promise<GuestbookVisitorCreateResponse> {
  return requestJson<GuestbookVisitorCreateResponse>(
    '/api/guestbook',
    withVisitorId(jsonRequest('POST', input), visitorId),
  );
}

export function fetchAdminGuestbook(): Promise<GuestbookAdminListResponse> {
  return requestJson<GuestbookAdminListResponse>('/api/me/guestbook');
}

export function createGuestbookReply(
  id: number,
  input: GuestbookOwnerReplyRequest,
): Promise<GuestbookOwnerReplyResponse> {
  return requestJson<GuestbookOwnerReplyResponse>(
    `/api/me/guestbook/${id}/replies`,
    jsonRequest('POST', input),
  );
}

export function updateGuestbookStatus(
  id: number,
  status: GuestbookStatus,
): Promise<GuestbookStatusMutationResponse> {
  return requestJson<GuestbookStatusMutationResponse>(
    `/api/me/guestbook/${id}/status`,
    jsonRequest('PATCH', { status }),
  );
}

export function updateGuestbookPinned(
  id: number,
  pinned: boolean,
): Promise<GuestbookPinnedMutationResponse> {
  return requestJson<GuestbookPinnedMutationResponse>(
    `/api/me/guestbook/${id}/pinned`,
    jsonRequest('PATCH', { pinned }),
  );
}

export function deleteGuestbookMessage(id: number): Promise<GuestbookDeletionResponse> {
  return requestJson<GuestbookDeletionResponse>(`/api/me/guestbook/${id}`, { method: 'DELETE' });
}
