export interface CallbackData {
  type: 'cancel' | 'done' | 'snooze5';
  id: number;
}

export function parseCallbackData(data: string | undefined): CallbackData | null {
  if (!data) return null;
  const parts = data.split(':');
  if (parts.length !== 3 || parts[0] !== 'reminder') return null;
  const [, action, idStr] = parts;
  const id = parseInt(idStr!, 10);
  if (isNaN(id)) return null;
  if (action !== 'cancel' && action !== 'done' && action !== 'snooze5') return null;
  return { type: action as CallbackData['type'], id };
}

export interface RecurringCallbackData {
  type: 'pause' | 'cancel' | 'done' | 'skip';
  ruleId: number;
  runId: number | null;
}

export function parseRecurringCallbackData(data: string | undefined): RecurringCallbackData | null {
  if (!data) return null;
  const parts = data.split(':');
  if (parts.length < 3 || parts[0] !== 'recur') return null;
  const [, action, ruleIdStr, runIdStr] = parts;
  const ruleId = parseInt(ruleIdStr!, 10);
  if (isNaN(ruleId)) return null;

  if (action === 'pause') {
    return { type: 'pause', ruleId, runId: null };
  }

  if (action === 'cancel') {
    const runId = runIdStr ? parseInt(runIdStr, 10) : null;
    return { type: 'cancel', ruleId, runId: runId === 0 ? null : runId };
  }

  if (action === 'done' || action === 'skip') {
    const runId = runIdStr ? parseInt(runIdStr, 10) : null;
    if (runId === null || isNaN(runId)) return null;
    return { type: action, ruleId, runId };
  }

  return null;
}

export interface NaturalCancelCallbackData {
  kind: 'once' | 'recurring';
  id: number;
}

export function parseNaturalCancelCallbackData(data: string | undefined): NaturalCancelCallbackData | null {
  if (!data) return null;
  const parts = data.split(':');
  if (parts.length !== 3 || parts[0] !== 'nlcancel') return null;
  const [, kind, idStr] = parts;
  if (kind !== 'once' && kind !== 'recur') return null;
  const id = parseInt(idStr!, 10);
  if (isNaN(id)) return null;
  return { kind: kind === 'once' ? 'once' : 'recurring', id };
}

export type VitaminAction = 'eaten' | 'snooze';

export function parseVitaminCallbackData(data: string | undefined): VitaminAction | null {
  if (!data) return null;
  if (data === 'vitamin:eaten') return 'eaten';
  if (data === 'vitamin:snooze') return 'snooze';
  return null;
}

export interface StartggWatchCallbackData {
  eventRowId: number;
  playerId: number;
}

export function parseStartggWatchCallbackData(data: string | undefined): StartggWatchCallbackData | null {
  if (!data) return null;
  const parts = data.split(':');
  if (parts.length !== 4 || parts[0] !== 'sgwatch' || parts[1] !== 'add') return null;
  const eventRowId = parseInt(parts[2]!, 10);
  const playerId = parseInt(parts[3]!, 10);
  if (isNaN(eventRowId) || isNaN(playerId)) return null;
  return { eventRowId, playerId };
}

export type MasturbationCallback =
  | { type: 'add' }
  | { type: 'stats' }
  | { type: 'refresh' }
  | { type: 'undo'; recordId: number };

export function parseMasturbationCallbackData(data: string | undefined): MasturbationCallback | null {
  if (!data) return null;
  const parts = data.split(':');
  if (parts[0] !== 'masturbation') return null;
  const action = parts[1];
  if (parts.length === 2 && action === 'add') return { type: 'add' };
  if (parts.length === 2 && action === 'stats') return { type: 'stats' };
  if (parts.length === 2 && action === 'refresh') return { type: 'refresh' };
  if (action === 'undo') {
    if (parts.length !== 3) return null;
    const recordId = Number(parts[2]);
    if (!Number.isInteger(recordId) || recordId <= 0) return null;
    return { type: 'undo', recordId };
  }
  return null;
}
