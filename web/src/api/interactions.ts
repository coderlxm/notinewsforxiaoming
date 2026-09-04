import type {
  JournalAdminCommentDeletionResponse,
  JournalAdminCommentMutationResponse,
  JournalAdminCommentStatus,
  JournalAdminInteractionsResponse,
  JournalPublicInteractionsResponse,
  JournalReactionResponse,
  JournalVisitorCommentResponse,
} from '../types';
import { requestJson, jsonRequest, withVisitorId } from './client';

export function fetchEntryInteractions(
  publicId: string,
  visitorId?: string | null,
): Promise<JournalPublicInteractionsResponse> {
  return requestJson<JournalPublicInteractionsResponse>(
    `/api/entries/${encodeURIComponent(publicId)}/interactions`,
    withVisitorId({}, visitorId),
  );
}

export function setEntryReaction(
  publicId: string,
  visitorId: string | null,
  reacted: boolean,
): Promise<JournalReactionResponse> {
  return requestJson<JournalReactionResponse>(
    `/api/entries/${encodeURIComponent(publicId)}/reaction`,
    withVisitorId({ method: reacted ? 'PUT' : 'DELETE' }, visitorId),
  );
}

export function createEntryComment(
  publicId: string,
  visitorId: string | null,
  input: { authorName: string; content: string; website: string },
): Promise<JournalVisitorCommentResponse> {
  return requestJson<JournalVisitorCommentResponse>(
    `/api/entries/${encodeURIComponent(publicId)}/comments`,
    withVisitorId(jsonRequest('POST', input), visitorId),
  );
}

export function fetchAdminEntryInteractions(
  entryId: number,
): Promise<JournalAdminInteractionsResponse> {
  return requestJson<JournalAdminInteractionsResponse>(
    `/api/me/entries/${entryId}/interactions`,
  );
}

export function createOwnerCommentReply(
  entryId: number,
  input: { parentId: number; content: string },
): Promise<JournalAdminCommentMutationResponse> {
  return requestJson<JournalAdminCommentMutationResponse>(
    `/api/me/entries/${entryId}/comments`,
    jsonRequest('POST', input),
  );
}

export function updateAdminCommentStatus(
  commentId: number,
  status: JournalAdminCommentStatus,
): Promise<JournalAdminCommentMutationResponse> {
  return requestJson<JournalAdminCommentMutationResponse>(
    `/api/me/comments/${commentId}/status`,
    jsonRequest('PATCH', { status }),
  );
}

export function deleteAdminComment(
  commentId: number,
): Promise<JournalAdminCommentDeletionResponse> {
  return requestJson<JournalAdminCommentDeletionResponse>(
    `/api/me/comments/${commentId}`,
    { method: 'DELETE' },
  );
}
