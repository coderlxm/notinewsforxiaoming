import { readonly, shallowRef } from 'vue';
import {
  fetchPrivateEntry,
  publishEntry as publishEntryRequest,
  updateEntryChannel,
  updateEntryContent,
  updateEntryPublishedTime,
  updateEntryVisibility,
  updatePublishedWebEntry,
  updateDraft as updateDraftRequest,
} from '../api';
import type { JournalEntry, JournalPlainChannel, JournalVisibility } from '../types';
import { markPublishProbe } from '../utils/publishProbe';

interface EntryPublisherInput {
  contentText: string;
  uploadId: string;
  removedAssetIds: number[];
  channel: JournalPlainChannel;
  visibility?: JournalVisibility;
  sourceCreatedAt?: string;
}

export function useEntryPublisher() {
  const entry = shallowRef<JournalEntry | null>(null);
  const loading = shallowRef(false);
  const submitting = shallowRef<'draft' | 'publish' | null>(null);
  const error = shallowRef<string | null>(null);

  function exposeError(reason: unknown): void {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }

  async function load(id: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      entry.value = await fetchPrivateEntry(id);
    } catch (reason) {
      exposeError(reason);
    } finally {
      loading.value = false;
    }
  }

  async function submit(
    action: 'draft' | 'publish',
    input: EntryPublisherInput,
  ): Promise<JournalEntry | null> {
    submitting.value = action;
    error.value = null;
    try {
      const saved = entry.value === null
        ? await publishEntryRequest({
            contentText: input.contentText,
            uploadId: input.uploadId,
            action,
            channel: input.channel,
            visibility: action === 'publish' ? input.visibility : undefined,
            sourceCreatedAt: action === 'publish' ? input.sourceCreatedAt : undefined,
          })
        : await updateDraftRequest(entry.value.id, {
            contentText: input.contentText,
            uploadId: input.uploadId,
            removedAssetIds: input.removedAssetIds,
            action,
            channel: input.channel,
            visibility: action === 'publish' ? input.visibility : undefined,
            sourceCreatedAt: action === 'publish' ? input.sourceCreatedAt : undefined,
          });
      entry.value = saved;
      return saved;
    } catch (reason) {
      exposeError(reason);
      return null;
    } finally {
      submitting.value = null;
    }
  }

  function saveDraft(input: EntryPublisherInput): Promise<JournalEntry | null> {
    return submit('draft', input);
  }

  async function publish(input: EntryPublisherInput): Promise<JournalEntry | null> {
    markPublishProbe('ENTRY_REQUEST_STARTED');
    const published = await submit('publish', input);
    if (published) markPublishProbe('ENTRY_REQUEST_COMPLETED');
    return published;
  }

  async function updatePublished(input: EntryPublisherInput): Promise<JournalEntry | null> {
    const current = entry.value;
    if (!current) throw new Error('Published entry must be loaded before editing.');
    submitting.value = 'publish';
    error.value = null;
    try {
      if (current.sourceKind === 'web') {
        const updated = await updatePublishedWebEntry(current.id, {
          contentText: input.contentText,
          uploadId: input.uploadId,
          removedAssetIds: input.removedAssetIds,
          channel: input.channel,
          visibility: input.visibility!,
          sourceCreatedAt: input.sourceCreatedAt!,
        });
        entry.value = updated;
        return updated;
      }
      await updateEntryContent(current.id, input.contentText);
      await updateEntryChannel(current.id, input.channel);
      await updateEntryVisibility(current.id, input.visibility!);
      const updated = await updateEntryPublishedTime(current.id, input.sourceCreatedAt!);
      entry.value = updated;
      return updated;
    }
    catch (reason) {
      exposeError(reason);
      return null;
    }
    finally {
      submitting.value = null;
    }
  }

  return {
    entry: readonly(entry),
    loading: readonly(loading),
    submitting: readonly(submitting),
    error: readonly(error),
    load,
    saveDraft,
    publish,
    updatePublished,
  };
}
