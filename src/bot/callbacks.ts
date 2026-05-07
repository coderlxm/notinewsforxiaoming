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
