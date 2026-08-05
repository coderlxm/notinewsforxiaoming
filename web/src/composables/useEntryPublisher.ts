import { readonly, shallowRef } from 'vue';
import {
  fetchPrivateEntry,
  publishEntry as publishEntryRequest,
  updateDraft as updateDraftRequest,
} from '../api';
import type { JournalEntry, JournalPlainChannel, JournalVisibility } from '../types';

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

  function publish(input: EntryPublisherInput): Promise<JournalEntry | null> {
    return submit('publish', input);
  }

  return {
    entry: readonly(entry),
    loading: readonly(loading),
    submitting: readonly(submitting),
    error: readonly(error),
    load,
    saveDraft,
    publish,
  };
}
