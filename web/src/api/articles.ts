import type {
  JournalArticleAssetResponse,
  JournalEntry,
  JournalRichDocument,
} from '../types';
import { requestJson, requestWithoutResponse, jsonRequest } from './client';

export function fetchArticle(id: number): Promise<JournalEntry> {
  return requestJson<JournalEntry>(`/api/me/articles/${id}`);
}

export function createArticle(input: {
  title: string;
  richBody: JournalRichDocument;
  tags: string[];
  aiGenerated: boolean;
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>('/api/me/articles', jsonRequest('POST', input));
}

export function updateArticle(id: number, input: {
  title: string;
  richBody: JournalRichDocument;
  tags: string[];
  aiGenerated: boolean;
}): Promise<JournalEntry> {
  return requestJson<JournalEntry>(
    `/api/me/articles/${id}`,
    jsonRequest('PATCH', input),
  );
}

export function uploadArticleAsset(
  id: number,
  file: File,
  role: 'cover' | 'inline',
): Promise<JournalArticleAssetResponse> {
  const form = new FormData();
  form.append('role', role);
  form.append('file', file);
  return requestJson<JournalArticleAssetResponse>(
    `/api/me/articles/${id}/assets`,
    { method: 'POST', body: form },
  );
}

export function deleteArticleAsset(id: number, assetId: number): Promise<void> {
  return requestWithoutResponse(`/api/me/articles/${id}/assets/${assetId}`, { method: 'DELETE' });
}
