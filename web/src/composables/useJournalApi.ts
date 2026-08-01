import { readonly, ref, shallowReadonly, shallowRef } from 'vue';
import {
  deleteEntry as deleteEntryRequest,
  fetchOnThisDay,
  fetchPrivateEntry,
  fetchPrivateFeed,
  fetchPublicEntry,
  fetchPublicFeed,
  JournalRequestError,
  login as loginRequest,
  logout as logoutRequest,
  updateEntryContent,
  updateEntryChannel,
  updateEntryPinned,
  updateEntryPublishedTime,
  updateEntryVisibility,
} from '../api';
import type {
  FeedFilters,
  JournalChannel,
  JournalEntry,
  JournalPlainChannel,
  JournalVisibility,
} from '../types';

type AuthenticationState = 'checking' | 'authenticated' | 'anonymous';

export function useJournalApi() {
  const entries = ref<JournalEntry[]>([]);
  const detail = shallowRef<JournalEntry | null>(null);
  const onThisDayEntries = ref<JournalEntry[]>([]);
  const nextCursor = shallowRef<string | null>(null);
  const error = shallowRef<string | null>(null);
  const loading = shallowRef(false);
  const loadingMore = shallowRef(false);
  const mutationEntryId = shallowRef<number | null>(null);
  const authenticationState = shallowRef<AuthenticationState>('checking');

  function exposeError(reason: unknown): void {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }

  function replaceEntry(updated: JournalEntry): void {
    entries.value = entries.value.map(entry => entry.id === updated.id ? updated : entry);
    onThisDayEntries.value = onThisDayEntries.value.map(entry => entry.id === updated.id ? updated : entry);
    if (detail.value?.id === updated.id) detail.value = updated;
  }

  function selectDetail(entry: JournalEntry): void {
    detail.value = entry;
  }

  async function fetchAndReplacePrivateFeed(filters: FeedFilters): Promise<void> {
    const feed = await fetchPrivateFeed({ filters });
    entries.value = feed.entries;
    nextCursor.value = feed.nextCursor;
    authenticationState.value = 'authenticated';
  }

  async function loadPublic(options: { channel: JournalChannel; tag?: string }): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const feed = await fetchPublicFeed(options);
      entries.value = feed.entries;
      nextCursor.value = feed.nextCursor;
    }
    catch (reason) {
      exposeError(reason);
    }
    finally {
      loading.value = false;
    }
  }

  async function loadPublicDetail(publicId: string): Promise<void> {
    loading.value = true;
    error.value = null;
    detail.value = null;
    try {
      detail.value = await fetchPublicEntry(publicId);
    }
    catch (reason) {
      exposeError(reason);
    }
    finally {
      loading.value = false;
    }
  }

  async function loadPrivateDetail(id: number): Promise<void> {
    loading.value = true;
    error.value = null;
    detail.value = null;
    try {
      detail.value = await fetchPrivateEntry(id);
      authenticationState.value = 'authenticated';
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
    }
    finally {
      loading.value = false;
    }
  }

  async function loadPrivate(filters: FeedFilters): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await fetchAndReplacePrivateFeed(filters);

      const onThisDay = await fetchOnThisDay();
      onThisDayEntries.value = onThisDay.entries;
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
    }
    finally {
      loading.value = false;
    }
  }

  async function refreshPrivateFeed(filters: FeedFilters): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await fetchAndReplacePrivateFeed(filters);
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
    }
    finally {
      loading.value = false;
    }
  }

  async function loadMorePublic(options: { channel: JournalChannel; tag?: string }): Promise<void> {
    if (nextCursor.value === null) return;
    loadingMore.value = true;
    error.value = null;
    try {
      const feed = await fetchPublicFeed({ ...options, cursor: nextCursor.value });
      entries.value = [...entries.value, ...feed.entries];
      nextCursor.value = feed.nextCursor;
    }
    catch (reason) {
      exposeError(reason);
    }
    finally {
      loadingMore.value = false;
    }
  }

  async function loadMorePrivate(filters: FeedFilters): Promise<void> {
    if (nextCursor.value === null) return;
    loadingMore.value = true;
    error.value = null;
    try {
      const feed = await fetchPrivateFeed({ cursor: nextCursor.value, filters });
      entries.value = [...entries.value, ...feed.entries];
      nextCursor.value = feed.nextCursor;
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
    }
    finally {
      loadingMore.value = false;
    }
  }

  async function authenticate(password: string, filters: FeedFilters): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await loginRequest(password);
      authenticationState.value = 'authenticated';
      const feed = await fetchPrivateFeed({ filters });
      entries.value = feed.entries;
      nextCursor.value = feed.nextCursor;

      const onThisDay = await fetchOnThisDay();
      onThisDayEntries.value = onThisDay.entries;
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
    }
    finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await logoutRequest();
      authenticationState.value = 'anonymous';
      entries.value = [];
      onThisDayEntries.value = [];
      nextCursor.value = null;
    }
    catch (reason) {
      exposeError(reason);
    }
    finally {
      loading.value = false;
    }
  }

  async function saveContent(entry: JournalEntry, contentText: string): Promise<void> {
    mutationEntryId.value = entry.id;
    error.value = null;
    try {
      replaceEntry(await updateEntryContent(entry.id, contentText));
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
    }
    finally {
      mutationEntryId.value = null;
    }
  }

  async function setVisibility(entry: JournalEntry, visibility: JournalVisibility): Promise<void> {
    mutationEntryId.value = entry.id;
    error.value = null;
    try {
      replaceEntry(await updateEntryVisibility(entry.id, visibility));
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
    }
    finally {
      mutationEntryId.value = null;
    }
  }

  async function setChannel(entry: JournalEntry, channel: JournalPlainChannel): Promise<void> {
    mutationEntryId.value = entry.id;
    error.value = null;
    try {
      replaceEntry(await updateEntryChannel(entry.id, channel));
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
    }
    finally {
      mutationEntryId.value = null;
    }
  }

  async function setPublishedTime(entry: JournalEntry, sourceCreatedAt: string): Promise<void> {
    mutationEntryId.value = entry.id;
    error.value = null;
    try {
      replaceEntry(await updateEntryPublishedTime(entry.id, sourceCreatedAt));
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
    }
    finally {
      mutationEntryId.value = null;
    }
  }

  async function setPinned(entry: JournalEntry, pinned: boolean): Promise<void> {
    mutationEntryId.value = entry.id;
    error.value = null;
    try {
      replaceEntry(await updateEntryPinned(entry.id, pinned));
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
    }
    finally {
      mutationEntryId.value = null;
    }
  }

  async function deleteEntry(entry: JournalEntry): Promise<void> {
    mutationEntryId.value = entry.id;
    error.value = null;
    try {
      await deleteEntryRequest(entry.id);
      entries.value = entries.value.filter(item => item.id !== entry.id);
      onThisDayEntries.value = onThisDayEntries.value.filter(item => item.id !== entry.id);
      if (detail.value?.id === entry.id) detail.value = null;
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
    }
    finally {
      mutationEntryId.value = null;
    }
  }

  return {
    entries: shallowReadonly(entries),
    detail: shallowReadonly(detail),
    onThisDayEntries: shallowReadonly(onThisDayEntries),
    nextCursor: readonly(nextCursor),
    error: readonly(error),
    loading: readonly(loading),
    loadingMore: readonly(loadingMore),
    mutationEntryId: readonly(mutationEntryId),
    authenticationState: readonly(authenticationState),
    loadPublic,
    loadPublicDetail,
    loadPrivateDetail,
    selectDetail,
    loadPrivate,
    refreshPrivateFeed,
    loadMorePublic,
    loadMorePrivate,
    authenticate,
    logout,
    saveContent,
    setChannel,
    setVisibility,
    setPublishedTime,
    setPinned,
    deleteEntry,
  };
}
