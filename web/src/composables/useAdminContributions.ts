import { readonly, shallowRef } from 'vue';
import {
  deleteAdminContribution,
  deleteAdminContributionAsset,
  fetchAdminContribution,
  fetchAdminContributions,
  publishAdminContribution,
} from '../api';
import type {
  AdminContributionDetail,
  AdminContributionSummary,
  JournalEntry,
  JournalVisibility,
} from '../types';

type AdminContributionMutation = 'delete' | 'delete-asset' | 'publish';

const contributions = shallowRef<AdminContributionSummary[]>([]);
const pendingCount = shallowRef(0);
const listLoading = shallowRef(false);
const listError = shallowRef<string | null>(null);
const detail = shallowRef<AdminContributionDetail | null>(null);
const detailLoading = shallowRef(false);
const detailError = shallowRef<string | null>(null);
const mutation = shallowRef<AdminContributionMutation | null>(null);
let detailRequestSequence = 0;

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function updateSummary(updated: AdminContributionDetail): void {
  const photoCount = updated.assets.filter(asset => asset.kind === 'photo').length;
  const videoCount = updated.assets.filter(asset => asset.kind === 'video').length;
  contributions.value = contributions.value.map(contribution =>
    contribution.publicId === updated.publicId
      ? {
          ...contribution,
          contentText: updated.contentText,
          photoCount,
          videoCount,
          assets: updated.assets.slice(0, 4),
        }
      : contribution,
  );
}

function removeFromInbox(publicId: string): void {
  const next = contributions.value.filter(contribution => contribution.publicId !== publicId);
  if (next.length === contributions.value.length) return;
  contributions.value = next;
  pendingCount.value -= 1;
  if (detail.value?.publicId === publicId) detail.value = null;
}

export function useAdminContributions() {
  async function loadInbox(): Promise<void> {
    listLoading.value = true;
    listError.value = null;
    try {
      const response = await fetchAdminContributions();
      contributions.value = response.contributions;
      pendingCount.value = response.pendingCount;
    }
    catch (reason) {
      listError.value = messageFrom(reason);
    }
    finally {
      listLoading.value = false;
    }
  }

  async function loadContribution(publicId: string): Promise<void> {
    const requestSequence = ++detailRequestSequence;
    detail.value = null;
    detailLoading.value = true;
    detailError.value = null;
    try {
      const loaded = await fetchAdminContribution(publicId);
      if (requestSequence === detailRequestSequence) detail.value = loaded;
    }
    catch (reason) {
      if (requestSequence === detailRequestSequence) detailError.value = messageFrom(reason);
    }
    finally {
      if (requestSequence === detailRequestSequence) detailLoading.value = false;
    }
  }

  async function removeAsset(publicId: string, assetId: number): Promise<void> {
    mutation.value = 'delete-asset';
    detailError.value = null;
    try {
      const updated = await deleteAdminContributionAsset(publicId, assetId);
      detail.value = updated;
      updateSummary(updated);
    }
    catch (reason) {
      detailError.value = messageFrom(reason);
    }
    finally {
      mutation.value = null;
    }
  }

  async function publishContribution(
    publicId: string,
    input: {
      contentText: string;
      assetIds: number[];
      sourceCreatedAt: string;
      visibility: JournalVisibility;
    },
  ): Promise<JournalEntry | null> {
    mutation.value = 'publish';
    detailError.value = null;
    try {
      const entry = await publishAdminContribution(publicId, input);
      removeFromInbox(publicId);
      return entry;
    }
    catch (reason) {
      detailError.value = messageFrom(reason);
      return null;
    }
    finally {
      mutation.value = null;
    }
  }

  async function removeContribution(publicId: string): Promise<boolean> {
    mutation.value = 'delete';
    detailError.value = null;
    try {
      await deleteAdminContribution(publicId);
      removeFromInbox(publicId);
      return true;
    }
    catch (reason) {
      detailError.value = messageFrom(reason);
      return false;
    }
    finally {
      mutation.value = null;
    }
  }

  function clear(): void {
    detailRequestSequence += 1;
    contributions.value = [];
    pendingCount.value = 0;
    listError.value = null;
    detail.value = null;
    detailError.value = null;
  }

  return {
    contributions: readonly(contributions),
    pendingCount: readonly(pendingCount),
    listLoading: readonly(listLoading),
    listError: readonly(listError),
    detail: readonly(detail),
    detailLoading: readonly(detailLoading),
    detailError: readonly(detailError),
    mutation: readonly(mutation),
    loadInbox,
    loadContribution,
    removeAsset,
    publishContribution,
    removeContribution,
    clear,
  };
}
