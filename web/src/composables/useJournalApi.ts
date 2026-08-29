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
  setEntryReaction,
  unlockPublicEntry,
  updateEntryContent,
  updateEntryChannel,
  updateEntryPinned,
  updateEntryPublishedTime,
  updateEntryVisibility,
} from '../api';
import { isProtectedJournalEntry } from '../types';
import type {
  FeedFilters,
  JournalChannel,
  JournalEntry,
  JournalInteractionSummary,
  JournalPlainChannel,
  ProtectedJournalEntryPreview,
  PublicJournalFeedItem,
  JournalVisibility,
} from '../types';
import { showMessage } from '../utils/message';
import { getOrCreateJournalVisitorId } from '../utils/journalVisitorIdentity';

type AuthenticationState = 'checking' | 'authenticated' | 'anonymous';

export function useJournalApi() {
  const entries = ref<JournalEntry[]>([]);
  const publicEntries = ref<PublicJournalFeedItem[]>([]);
  const detail = shallowRef<JournalEntry | null>(null);
  const protectedDetail = shallowRef<ProtectedJournalEntryPreview | null>(null);
  const onThisDayEntries = ref<JournalEntry[]>([]);
  const nextCursor = shallowRef<string | null>(null);
  const error = shallowRef<string | null>(null);
  const loading = shallowRef(false);
  const loadingMore = shallowRef(false);
  const unlocking = shallowRef(false);
  const unlockError = shallowRef<string | null>(null);
  const mutationEntryId = shallowRef<number | null>(null);
  const reactionPendingPublicId = shallowRef<string | null>(null);
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

  function selectProtectedDetail(entry: ProtectedJournalEntryPreview): void {
    detail.value = null;
    protectedDetail.value = entry;
    unlockError.value = null;
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
      const feed = await fetchPublicFeed({
        ...options,
        visitorId: getOrCreateJournalVisitorId(),
      });
      publicEntries.value = feed.entries;
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
    unlockError.value = null;
    detail.value = null;
    protectedDetail.value = null;
    try {
      const response = await fetchPublicEntry(publicId, getOrCreateJournalVisitorId());
      if (isProtectedJournalEntry(response)) protectedDetail.value = response;
      else detail.value = response;
    }
    catch (reason) {
      exposeError(reason);
    }
    finally {
      loading.value = false;
    }
  }

  async function unlockDetail(password: string): Promise<void> {
    const protectedEntry = protectedDetail.value;
    if (!protectedEntry) return;
    unlocking.value = true;
    unlockError.value = null;
    try {
      const unlockedEntry = await unlockPublicEntry(
        protectedEntry.publicId,
        password,
        getOrCreateJournalVisitorId(),
      );
      detail.value = unlockedEntry;
      publicEntries.value = publicEntries.value.map(entry =>
        entry.publicId === unlockedEntry.publicId ? unlockedEntry : entry,
      );
      protectedDetail.value = null;
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        unlockError.value = '访问密码不正确';
      }
      else exposeError(reason);
    }
    finally {
      unlocking.value = false;
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

  function setAuthenticationState(authenticated: boolean): void {
    authenticationState.value = authenticated ? 'authenticated' : 'anonymous';
  }

  async function refreshOnThisDay(): Promise<void> {
    try {
      const onThisDay = await fetchOnThisDay();
      onThisDayEntries.value = onThisDay.entries;
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
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
      const feed = await fetchPublicFeed({
        ...options,
        cursor: nextCursor.value,
        visitorId: getOrCreateJournalVisitorId(),
      });
      publicEntries.value = [...publicEntries.value, ...feed.entries];
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

  async function authenticate(password: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await loginRequest(password);
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

  async function setVisibility(
    entry: JournalEntry,
    visibility: JournalVisibility,
    accessPassword?: string,
  ): Promise<JournalEntry | null> {
    mutationEntryId.value = entry.id;
    error.value = null;
    try {
      const updated = await updateEntryVisibility(entry.id, visibility, accessPassword);
      replaceEntry(updated);
      return updated;
    }
    catch (reason) {
      if (reason instanceof JournalRequestError && reason.status === 401) {
        authenticationState.value = 'anonymous';
      }
      exposeError(reason);
      return null;
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

  function removeEntryFromResults(id: number): void {
    entries.value = entries.value.filter(entry => entry.id !== id);
  }

  function replacePublicInteractions(
    publicId: string,
    summary: JournalInteractionSummary,
  ): void {
    publicEntries.value = publicEntries.value.map(entry => (
      entry.publicId === publicId && !isProtectedJournalEntry(entry)
      ? { ...entry, interactions: summary }
      : entry
    ));
    if (detail.value?.publicId === publicId) {
      detail.value = { ...detail.value, interactions: summary };
    }
  }

  function replacePrivateInteractions(id: number, summary: JournalInteractionSummary): void {
    entries.value = entries.value.map(entry => entry.id === id
      ? { ...entry, interactions: summary }
      : entry);
    if (detail.value?.id === id) {
      detail.value = { ...detail.value, interactions: summary };
    }
  }

  function mergeRevealedPublicEntries(
    revealedEntries: ReadonlyMap<string, JournalEntry> | undefined,
  ): void {
    if (!revealedEntries?.size) return;
    publicEntries.value = publicEntries.value.map(entry => (
      revealedEntries.get(entry.publicId) ?? entry
    ));
  }

  async function togglePublicEntryReaction(publicId: string): Promise<void> {
    if (reactionPendingPublicId.value !== null) return;
    const entry = publicEntries.value.find(item => item.publicId === publicId);
    if (!entry || isProtectedJournalEntry(entry)) return;
    const target = !entry.interactions.viewerReacted;
    const previous = entry.interactions;
    const applySummary = (summary: JournalInteractionSummary): void => {
      publicEntries.value = publicEntries.value.map(item => (
        item.publicId === publicId && !isProtectedJournalEntry(item)
        ? { ...item, interactions: summary }
        : item
      ));
    };
    reactionPendingPublicId.value = publicId;
    applySummary({
      ...previous,
      reactionCount: previous.reactionCount + (target ? 1 : -1),
      viewerReacted: target,
    });
    const visitorId = getOrCreateJournalVisitorId();
    if (!visitorId) {
      applySummary(previous);
      reactionPendingPublicId.value = null;
      showMessage({ message: '浏览器匿名身份不可用，无法保存点赞。', type: 'error' });
      return;
    }
    try {
      const response = await setEntryReaction(publicId, visitorId, target);
      applySummary({
        ...entry.interactions,
        reactionCount: response.reactionCount,
        viewerReacted: response.viewerReacted,
      });
    }
    catch (reason) {
      applySummary(previous);
      showMessage({
        message: reason instanceof Error ? reason.message : String(reason),
        type: 'error',
      });
    }
    finally {
      reactionPendingPublicId.value = null;
    }
  }

  return {
    entries: shallowReadonly(entries),
    publicEntries: shallowReadonly(publicEntries),
    detail: shallowReadonly(detail),
    protectedDetail: shallowReadonly(protectedDetail),
    onThisDayEntries: shallowReadonly(onThisDayEntries),
    nextCursor: readonly(nextCursor),
    error: readonly(error),
    loading: readonly(loading),
    loadingMore: readonly(loadingMore),
    unlocking: readonly(unlocking),
    unlockError: readonly(unlockError),
    mutationEntryId: readonly(mutationEntryId),
    reactionPendingPublicId: readonly(reactionPendingPublicId),
    authenticationState: readonly(authenticationState),
    loadPublic,
    loadPublicDetail,
    unlockDetail,
    loadPrivateDetail,
    selectDetail,
    selectProtectedDetail,
    loadPrivate,
    setAuthenticationState,
    refreshOnThisDay,
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
    removeEntryFromResults,
    replacePublicInteractions,
    replacePrivateInteractions,
    mergeRevealedPublicEntries,
    togglePublicEntryReaction,
  };
}
