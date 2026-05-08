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
