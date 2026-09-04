import type {
  JournalPlainChannel,
  JournalRichDocument,
} from '../types';
import { requestJson, jsonRequest } from './client';

export type JournalTagSuggestionRequest =
  | {
      kind: 'entry';
      channel: JournalPlainChannel;
      title: string | null;
      contentText: string;
    }
  | {
      kind: 'article';
      channel: 'article';
      title: string;
      richBody: JournalRichDocument;
      existingTags: string[];
    };

export interface JournalTagSuggestionResponse {
  tags: string[];
}

export interface JournalTopicSuggestionRequest {
  contentText: string;
}

export interface JournalTopicSuggestionResponse {
  topic: string;
}

export function requestTagSuggestions(
  input: JournalTagSuggestionRequest,
): Promise<JournalTagSuggestionResponse> {
  return requestJson<JournalTagSuggestionResponse>(
    '/api/me/tag-suggestions',
    jsonRequest('POST', input),
  );
}

export function requestTopicSuggestion(
  input: JournalTopicSuggestionRequest,
): Promise<JournalTopicSuggestionResponse> {
  return requestJson<JournalTopicSuggestionResponse>(
    '/api/me/topic-suggestion',
    jsonRequest('POST', input),
  );
}
