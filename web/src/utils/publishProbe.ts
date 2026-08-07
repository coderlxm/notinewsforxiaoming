export type PublishProbeStage =
  | 'SUBMIT_ENTERED'
  | 'UPLOAD_REQUEST_STARTED'
  | 'UPLOAD_REQUEST_COMPLETED'
  | 'ENTRY_REQUEST_STARTED'
  | 'ENTRY_REQUEST_COMPLETED'
  | 'NAVIGATION_STARTED';

export interface PublishProbeRecord {
  attemptId: string;
  pageId: string;
  stage: PublishProbeStage;
  startedAt: number;
  updatedAt: number;
}

const storageKey = 'journal-publish-probe';
const pageId = crypto.randomUUID();
const storedRecord = sessionStorage.getItem(storageKey);
const previousRecord = storedRecord
  ? JSON.parse(storedRecord) as PublishProbeRecord
  : null;
let activeRecord: PublishProbeRecord | null = null;

function store(record: PublishProbeRecord): void {
  sessionStorage.setItem(storageKey, JSON.stringify(record));
}

export function previousPublishProbe(): PublishProbeRecord | null {
  return previousRecord?.pageId === pageId ? null : previousRecord;
}

export function beginPublishProbe(): void {
  const now = Date.now();
  activeRecord = {
    attemptId: crypto.randomUUID(),
    pageId,
    stage: 'SUBMIT_ENTERED',
    startedAt: now,
    updatedAt: now,
  };
  store(activeRecord);
}

export function markPublishProbe(stage: PublishProbeStage): void {
  if (!activeRecord) return;
  activeRecord = { ...activeRecord, stage, updatedAt: Date.now() };
  store(activeRecord);
}

export function clearPublishProbe(): void {
  activeRecord = null;
  sessionStorage.removeItem(storageKey);
}
