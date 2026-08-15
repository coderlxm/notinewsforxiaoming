import {
  computed,
  shallowRef,
  type ComputedRef,
  type Ref,
} from 'vue';
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router';
import { pathMatchesDiscoveryOverlayContext } from '../app/appRoute';
import type {
  AppRoute,
  DiscoveryOverlayContext,
  DiscoveryRoute,
} from '../app/appRouteTypes';
import { publicFeedPath } from '../journalChannels';
import type {
  JournalChannel,
  JournalDiscoveryListItem,
  JournalEntry,
} from '../types';

export interface UseDiscoveryEntryOverlayOptions {
  router: Router;
  route: ComputedRef<AppRoute>;
  currentRoute: RouteLocationNormalizedLoaded;
  ownerAuthenticated: Readonly<Ref<boolean>>;
  authenticationChecked: Readonly<Ref<boolean>>;
}

export function useDiscoveryEntryOverlay(options: UseDiscoveryEntryOverlayOptions) {
  const discoveryOverlayContext = shallowRef<DiscoveryOverlayContext | null>(null);
  const discoveryAccessRevision = shallowRef(0);

  const activeDiscoveryOverlayContext = computed(() => {
    const context = discoveryOverlayContext.value;
    if (
      context
      && options.route.value.name === 'detail'
      && options.route.value.publicId === context.entry.publicId
    ) return context;
    return null;
  });

  const discoveryBackgroundRoute = computed<DiscoveryRoute | null>(() => {
    if (activeDiscoveryOverlayContext.value) return activeDiscoveryOverlayContext.value.origin;
    if (
      options.route.value.name === 'search'
      || options.route.value.name === 'archive'
      || options.route.value.name === 'archive-month'
    ) return options.route.value;
    return null;
  });

  const routedViewLocation = computed<RouteLocationNormalizedLoaded>(() =>
    activeDiscoveryOverlayContext.value?.originLocation ?? options.router.currentRoute.value,
  );

  const discoveryAudience = computed(() => {
    if (!options.authenticationChecked.value) return 'checking';
    return options.ownerAuthenticated.value ? 'admin' : 'visitor';
  });

  const discoveryAccessScope = computed(() =>
    `${discoveryAudience.value}:${discoveryAccessRevision.value}`,
  );

  const renderedDiscoveryAccessScope = computed(() => {
    const context = discoveryOverlayContext.value;
    if (
      context
      && (
        activeDiscoveryOverlayContext.value
        || options.currentRoute.fullPath === context.originPath
      )
    ) return context.accessScope;
    return discoveryAccessScope.value;
  });

  async function openDiscoveryEntry(entry: JournalDiscoveryListItem): Promise<void> {
    const origin = options.route.value;
    if (origin.name !== 'search' && origin.name !== 'archive-month') {
      throw new Error('Discovery overlay requires a searchable list origin.');
    }

    const previousContext = discoveryOverlayContext.value;
    const loadedEntry = previousContext?.originPath === options.currentRoute.fullPath
      && previousContext.entry.publicId === entry.publicId
      ? previousContext.loadedEntry
      : undefined;
    discoveryOverlayContext.value = {
      entry,
      ...(loadedEntry ? { loadedEntry } : {}),
      origin,
      originLocation: options.router.currentRoute.value,
      originPath: options.currentRoute.fullPath,
      originTitle: document.title,
      accessScope: renderedDiscoveryAccessScope.value,
    };
    await options.router.push({
      name: 'detail',
      params: { publicId: entry.publicId },
      state: entry.kind === 'protected' && !loadedEntry
        ? { journalDetailFromFeed: true, journalProtectedPreview: entry }
        : { journalDetailFromFeed: true },
    });
  }

  function closeDiscoveryOverlay(): void {
    if (!activeDiscoveryOverlayContext.value) return;
    options.router.back();
  }

  function selectDiscoveryTag(channel: JournalChannel, tag: string): void {
    void options.router.push(publicFeedPath(channel, tag));
  }

  function handleDiscoveryDetailLoaded(entry: JournalEntry): void {
    const context = activeDiscoveryOverlayContext.value;
    if (!context || context.entry.publicId !== entry.publicId) return;
    discoveryOverlayContext.value = { ...context, loadedEntry: entry };
  }

  function handleDiscoveryDetailUnlocked(entry: JournalEntry): void {
    handleDiscoveryDetailLoaded(entry);
  }

  function bumpAccessRevision(): void {
    discoveryAccessRevision.value += 1;
  }

  function isOverlayHistoryTransition(fromPath: string, toPath: string): boolean {
    const context = discoveryOverlayContext.value;
    return context !== null && (
      (
        pathMatchesDiscoveryOverlayContext(fromPath, context)
        && toPath === context.originPath
      )
      || (
        fromPath === context.originPath
        && pathMatchesDiscoveryOverlayContext(toPath, context)
      )
    );
  }

  const dispose = options.router.afterEach((to) => {
    const context = discoveryOverlayContext.value;
    if (
      context
      && (
        to.fullPath === context.originPath
        || pathMatchesDiscoveryOverlayContext(to.fullPath, context)
      )
    ) document.title = context.originTitle;
    if (
      context
      && to.fullPath !== context.originPath
      && !pathMatchesDiscoveryOverlayContext(to.fullPath, context)
    ) discoveryOverlayContext.value = null;
  });

  return {
    activeDiscoveryOverlayContext,
    discoveryBackgroundRoute,
    routedViewLocation,
    renderedDiscoveryAccessScope,
    openDiscoveryEntry,
    closeDiscoveryOverlay,
    selectDiscoveryTag,
    handleDiscoveryDetailLoaded,
    handleDiscoveryDetailUnlocked,
    bumpAccessRevision,
    isOverlayHistoryTransition,
    dispose,
  };
}
