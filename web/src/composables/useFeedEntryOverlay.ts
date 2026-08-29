import {
  computed,
  readonly,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue';
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router';
import {
  pathMatchesOverlayContext,
  persistentFeedKey,
  persistentFeedRouteKey,
  privateFeedPath,
} from '../app/appRoute';
import type { AppRoute, FeedRoute, OverlayContext } from '../app/appRouteTypes';
import { publicFeedPath } from '../journalChannels';
import {
  isProtectedJournalEntry,
  type AssetView,
  type JournalEntry,
  type JournalInteractionSummary,
  type ProtectedJournalEntryPreview,
  type PublicJournalFeedItem,
} from '../types';

export interface UseFeedEntryOverlayOptions {
  router: Router;
  route: ComputedRef<AppRoute>;
  currentRoute: RouteLocationNormalizedLoaded;
  ownerAuthenticated: Readonly<Ref<boolean>>;
  navigate: (path: string) => void;
  isDiscoveryOverlayActive: () => boolean;
}

export function useFeedEntryOverlay(options: UseFeedEntryOverlayOptions) {
  const overlayContext = shallowRef<OverlayContext | null>(null);
  const directPublicEntry = shallowRef<JournalEntry | null>(null);
  const revealedPublicEntries = shallowRef<ReadonlyMap<string, JournalEntry>>(new Map());

  const activeOverlayContext = computed(() => {
    const context = overlayContext.value;
    if (!context) return null;
    if (
      context.origin.name === 'public'
      && options.route.value.name === 'detail'
      && options.route.value.publicId === context.entry.publicId
    ) return context;
    if (
      context.origin.name === 'private'
      && options.route.value.name === 'private'
      && options.route.value.entryId === context.entry.id
    ) return context;
    return null;
  });

  const directPublicOverlayEntry = computed(() => {
    const currentRoute = options.route.value;
    const entry = directPublicEntry.value;
    if (
      currentRoute.name !== 'detail'
      || activeOverlayContext.value
      || options.isDiscoveryOverlayActive()
      || entry?.publicId !== currentRoute.publicId
      || entry.bodyFormat !== 'plain'
    ) return null;
    return entry;
  });

  const backgroundFeedRoute = computed<FeedRoute | null>(() => {
    if (activeOverlayContext.value) return activeOverlayContext.value.origin;
    if (directPublicOverlayEntry.value) {
      const channel = directPublicOverlayEntry.value.channel;
      return { name: 'public', key: `public:${channel}:`, channel, tag: '' };
    }
    if (options.route.value.name === 'public' || options.route.value.name === 'private') {
      return options.route.value;
    }
    return null;
  });

  const publicFeedRoute = computed(() => {
    const background = backgroundFeedRoute.value;
    return background?.name === 'public' ? background : null;
  });

  const overlayEntryId = computed(() => {
    const contextEntry = activeOverlayContext.value?.entry;
    if (contextEntry && !isProtectedJournalEntry(contextEntry)) return contextEntry.id;
    if (directPublicOverlayEntry.value) return directPublicOverlayEntry.value.id;
    if (options.route.value.name === 'private') return options.route.value.entryId ?? undefined;
    return undefined;
  });

  const overlayEntry = computed(() => {
    const entry = activeOverlayContext.value?.entry;
    if (entry && !isProtectedJournalEntry(entry)) return entry;
    return directPublicOverlayEntry.value ?? undefined;
  });

  const overlayProtectedEntry = computed<ProtectedJournalEntryPreview | undefined>(() => {
    const entry = activeOverlayContext.value?.entry;
    return entry && isProtectedJournalEntry(entry) ? entry : undefined;
  });

  const directPrivateOverlay = computed(() =>
    options.route.value.name === 'private'
    && options.route.value.entryId !== null
    && activeOverlayContext.value === null,
  );

  function clearOverlay(): void {
    overlayContext.value = null;
  }

  async function openEntry(entry: PublicJournalFeedItem): Promise<void> {
    const origin = backgroundFeedRoute.value;
    if (!origin) throw new Error('Journal overlay requires a visible feed origin.');

    overlayContext.value = {
      entry,
      origin,
      originPath: options.currentRoute.fullPath,
    };
    if (isProtectedJournalEntry(entry)) {
      if (origin.name !== 'public') throw new Error('Protected previews require a public feed origin.');
      await options.router.push(`/p/${encodeURIComponent(entry.publicId)}`);
      return;
    }
    const path = origin.name === 'public'
      ? `/p/${encodeURIComponent(entry.publicId)}`
      : privateFeedPath({ assetView: origin.assetView, page: origin.page, entryId: entry.id });
    await options.router.push(path);
  }

  function closeOverlay(): void {
    if (activeOverlayContext.value) {
      options.router.back();
      return;
    }
    if (directPublicOverlayEntry.value) {
      const state = window.history.state as { journalDetailFromFeed?: boolean } | null;
      if (state?.journalDetailFromFeed === true) {
        options.router.back();
        return;
      }
      options.navigate(publicFeedPath(directPublicOverlayEntry.value.channel));
      return;
    }
    if (options.route.value.name !== 'private' || options.route.value.entryId === null) return;
    void options.router.replace(privateFeedPath({
      assetView: options.route.value.assetView,
      page: options.route.value.page,
    }));
  }

  async function removeDeletedOverlay(): Promise<void> {
    const context = activeOverlayContext.value;
    const current = options.route.value;
    const returnPath = context?.originPath
      ?? (current.name === 'private'
        ? privateFeedPath({ assetView: current.assetView, page: current.page })
        : '/me');
    overlayContext.value = null;
    await options.router.replace(returnPath);
    if (context) options.router.back();
  }

  function returnFromDetail(): void {
    const state = window.history.state as { journalDetailFromFeed?: boolean } | null;
    if (state?.journalDetailFromFeed === true) {
      options.router.back();
      return;
    }
    const entry = directPublicEntry.value;
    if (!entry) throw new Error('Journal detail must load before resolving its channel.');
    options.navigate(publicFeedPath(entry.channel));
  }

  function handlePublicDetailLoaded(entry: JournalEntry): void {
    if (options.route.value.name !== 'detail' || options.route.value.publicId !== entry.publicId) return;
    directPublicEntry.value = entry;
  }

  function handlePublicDetailUnlocked(entry: JournalEntry): void {
    revealedPublicEntries.value = new Map(revealedPublicEntries.value).set(entry.publicId, entry);
    if (
      options.route.value.name === 'detail'
      && options.route.value.publicId === entry.publicId
    ) {
      directPublicEntry.value = entry;
    }
  }

  function handlePublicInteractionsChange(
    publicId: string,
    summary: JournalInteractionSummary,
  ): void {
    const entry = directPublicEntry.value;
    if (entry?.publicId !== publicId) return;
    const updated = { ...entry, interactions: summary };
    directPublicEntry.value = updated;
    revealedPublicEntries.value = new Map(revealedPublicEntries.value).set(publicId, updated);
  }

  function changeAssetView(assetView: AssetView): void {
    if (options.route.value.name !== 'private') return;
    void options.router.push(privateFeedPath({
      assetView,
      page: 1,
      ...(options.route.value.entryId === null ? {} : { entryId: options.route.value.entryId }),
    }));
  }

  function changePrivatePage(page: number): void {
    if (options.route.value.name !== 'private') return;
    void options.router.push(privateFeedPath({ assetView: 'table', page }));
  }

  function feedRouteKeyForPath(path: string): string | null {
    const context = overlayContext.value;
    if (context && pathMatchesOverlayContext(path, context)) {
      return persistentFeedRouteKey(context.origin);
    }
    return persistentFeedKey(path);
  }

  function isOverlayHistoryTransition(fromPath: string, toPath: string): boolean {
    const context = overlayContext.value;
    if (context && (
      (pathMatchesOverlayContext(fromPath, context) && toPath === context.originPath)
      || (fromPath === context.originPath && pathMatchesOverlayContext(toPath, context))
    )) return true;
    return false;
  }

  watch(() => options.route.value.key, () => {
    directPublicEntry.value = null;
  });

  watch(options.ownerAuthenticated, (authenticated) => {
    if (authenticated) return;
    overlayContext.value = null;
    directPublicEntry.value = null;
  }, { immediate: true });

  return {
    revealedPublicEntries: readonly(revealedPublicEntries),
    activeOverlayContext,
    directPublicOverlayEntry,
    backgroundFeedRoute,
    publicFeedRoute,
    overlayEntryId,
    overlayEntry,
    overlayProtectedEntry,
    directPrivateOverlay,
    openEntry,
    closeOverlay,
    removeDeletedOverlay,
    returnFromDetail,
    handlePublicDetailLoaded,
    handlePublicDetailUnlocked,
    handlePublicInteractionsChange,
    changeAssetView,
    changePrivatePage,
    clearOverlay,
    feedRouteKeyForPath,
    isOverlayHistoryTransition,
  };
}
