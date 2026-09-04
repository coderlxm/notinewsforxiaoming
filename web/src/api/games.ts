import type {
  GameImageRole,
  GameInput,
  GameItem,
} from '../../../src/shared/gameProtocol';
import { requestJson, jsonRequest } from './client';

export function fetchGames(): Promise<GameItem[]> {
  return requestJson<GameItem[]>('/api/games');
}

export function createGame(input: GameInput): Promise<GameItem> {
  return requestJson<GameItem>('/api/me/games', jsonRequest('POST', input));
}

export function updateGame(id: string, input: GameInput): Promise<GameItem> {
  return requestJson<GameItem>(
    `/api/me/games/${encodeURIComponent(id)}`,
    jsonRequest('PUT', input),
  );
}

export function uploadGameImage(
  id: string,
  file: File,
  role: GameImageRole,
): Promise<GameItem> {
  const form = new FormData();
  form.append('file', file);
  form.append('role', role);
  return requestJson<GameItem>(
    `/api/me/games/${encodeURIComponent(id)}/images`,
    { method: 'POST', body: form },
  );
}
