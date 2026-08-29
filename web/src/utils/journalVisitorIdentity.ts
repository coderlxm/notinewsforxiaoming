const visitorIdStorageKey = 'journal.visitor-id.v1';
const visitorNameStorageKey = 'journal.visitor-name.v1';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  }
  catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  window.localStorage.setItem(key, value);
}

export function getOrCreateJournalVisitorId(): string | null {
  const existing = readStorage(visitorIdStorageKey);
  if (existing) return existing;
  const generated = typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : null;
  if (!generated) return null;
  try {
    writeStorage(visitorIdStorageKey, generated);
  }
  catch {
    return null;
  }
  return generated;
}

export function getRememberedJournalVisitorName(): string {
  return readStorage(visitorNameStorageKey) ?? '';
}

export function rememberJournalVisitorName(name: string): void {
  try {
    writeStorage(visitorNameStorageKey, name);
  }
  catch {
    return;
  }
}
