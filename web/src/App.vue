<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import {
  computed,
  onMounted,
  onUnmounted,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router';
import NotFoundView from './components/NotFoundView.vue';
import PublicDiscoveryDetailOverlay from './components/discovery/PublicDiscoveryDetailOverlay.vue';
import PublicSearchBar from './components/discovery/PublicSearchBar.vue';
import {
  normalizePublicSearchQuery,
  publicSearchPath,
} from './components/discovery/discoveryRoutes';
import PublicChannelNavigation from './components/journal/PublicChannelNavigation.vue';
import ThemeModeControl from './components/ui/ThemeModeControl.vue';
import { useAdminContributions } from './composables/useAdminContributions';
import { isJournalChannel, publicFeedPath } from './journalChannels';
import { useSessionStore } from './stores/session';
import { useSiteProfileStore } from './stores/siteProfile';
import {
  isProtectedJournalEntry,
  type AssetView,
  type JournalChannel,
  type JournalDiscoveryListItem,
  type JournalEntry,
  type ProtectedJournalEntryPreview,
  type PublicJournalFeedItem,
} from './types';
import { showMessage } from './utils/message';

type AppRoute =
  | { name: 'public'; key: string; channel: JournalChannel; tag: string }
  | { name: 'about'; key: string }
  | { name: 'search'; key: string; query: string }
  | { name: 'archive'; key: string }
  | { name: 'archive-month'; key: string; year: string; month: string }
  | { name: 'detail'; key: string; publicId: string }
  | { name: 'private'; key: string; entryId: number | null; assetView: AssetView; page: number }
  | { name: 'entry-new'; key: string }
  | { name: 'entry-edit'; key: string; entryId: number }
  | { name: 'article-new'; key: string }
  | { name: 'article-edit'; key: string; articleId: number }
  | { name: 'settings'; key: string }
  | { name: 'contribution-inbox'; key: string }
  | { name: 'contribution-review'; key: string; publicId: string }
  | { name: 'not-found'; key: string };

type FeedRoute = Extract<AppRoute, { name: 'public' | 'private' }>;
type DiscoveryRoute = Extract<AppRoute, { name: 'search' | 'archive' | 'archive-month' }>;
type DiscoveryOverlayRoute = Extract<AppRoute, { name: 'search' | 'archive-month' }>;
type ScrollDirection = -1 | 0 | 1;

const HEADER_ALWAYS_VISIBLE_TOP = 24;
const HEADER_HIDE_DISTANCE = 112;
const HEADER_SHOW_DISTANCE = 64;
const PUBLIC_FEED_CACHE_LIMIT = 30;
const MAX_PUBLIC_SEARCH_QUERY_LENGTH = 80;

interface OverlayContext {
  entry: PublicJournalFeedItem;
  origin: FeedRoute;
  originPath: string;
}

interface DiscoveryOverlayContext {
  entry: JournalDiscoveryListItem;
  loadedEntry?: JournalEntry;
  origin: DiscoveryOverlayRoute;
  originLocation: RouteLocationNormalizedLoaded;
  originPath: string;
  originTitle: string;
  accessScope: string;
}

const currentRoute = useRoute();
const router = useRouter();
const session = useSessionStore();
const siteProfile = useSiteProfileStore();
const contributionInbox = useAdminContributions();
const isMobile = useMediaQuery('(max-width: 599px)');
const isMobileOrTablet = useMediaQuery('(max-width: 1024px)');
const { ownerAuthenticated } = storeToRefs(session);
const { profile, loadError: profileLoadError } = storeToRefs(siteProfile);
const overlayContext = shallowRef<OverlayContext | null>(null);
const discoveryOverlayContext = shallowRef<DiscoveryOverlayContext | null>(null);
const directPublicEntry = shallowRef<JournalEntry | null>(null);
const revealedPublicEntries = shallowRef<ReadonlyMap<string, JournalEntry>>(new Map());
const discoveryAccessRevision = shallowRef(0);
const contentScroll = useTemplateRef<HTMLDivElement>('contentScroll');
const profileBio = useTemplateRef<HTMLParagraphElement>('profileBio');
const profileBioOverflow = shallowRef(0);
const headerHidden = shallowRef(false);
const defaultAssetView = computed<AssetView>(() => isMobile.value ? 'waterfall' : 'table');
const headerCollapsed = computed(() => isMobileOrTablet.value && headerHidden.value);
const feedScrollPositions = new Map<string, number>();
let previousContentScrollTop = 0;
let headerScrollDistance = 0;
let headerScrollDirection: ScrollDirection = 0;
let pendingFeedScrollTop: number | null = null;
let profileBioResizeObserver: ResizeObserver | null = null;
let profileErrorMessage: ReturnType<typeof showMessage> | null = null;

watch(profileLoadError, (error) => {
  profileErrorMessage?.close();
  profileErrorMessage = error
    ? showMessage({ message: `公开资料加载失败：${error}`, type: 'error', duration: 0 })
    : null;
}, { immediate: true });

const route = computed<AppRoute>(() => {
  if (currentRoute.name === 'public') {
    const channelQuery = currentRoute.query.channel;
    const channel = channelQuery === undefined
      ? 'life'
      : typeof channelQuery === 'string' && isJournalChannel(channelQuery)
        ? channelQuery
        : null;
    if (channel === null) return { name: 'not-found', key: currentRoute.fullPath };
    const tag = typeof currentRoute.query.tag === 'string' ? currentRoute.query.tag : '';
    return { name: 'public', key: `public:${channel}:${tag}`, channel, tag };
  }
  if (currentRoute.name === 'private') {
    const entry = currentRoute.query.entry;
    const view = currentRoute.query.view;
    const page = currentRoute.query.page;
    if (entry !== undefined && (typeof entry !== 'string' || !/^[1-9]\d*$/.test(entry))) {
      return { name: 'not-found', key: currentRoute.fullPath };
    }
    if (view !== undefined && view !== 'table' && view !== 'waterfall') {
      return { name: 'not-found', key: currentRoute.fullPath };
    }
    if (page !== undefined && (typeof page !== 'string' || !/^[1-9]\d*$/.test(page))) {
      return { name: 'not-found', key: currentRoute.fullPath };
    }
    const assetView = view ?? defaultAssetView.value;
    return {
      name: 'private',
      key: 'private',
      entryId: entry === undefined ? null : Number(entry),
      assetView,
      page: assetView === 'table' && page !== undefined ? Number(page) : 1,
    };
  }
  if (currentRoute.name === 'about') {
    return { name: 'about', key: 'about' };
  }
  if (currentRoute.name === 'search') {
    const query = currentRoute.query.q;
    if (query !== undefined && typeof query !== 'string') {
      return { name: 'not-found', key: currentRoute.fullPath };
    }
    const normalizedQuery = normalizePublicSearchQuery(query ?? '');
    if (Array.from(normalizedQuery).length > MAX_PUBLIC_SEARCH_QUERY_LENGTH) {
      return { name: 'not-found', key: currentRoute.fullPath };
    }
    return {
      name: 'search',
      key: `search:${normalizedQuery}`,
      query: normalizedQuery,
    };
  }
  if (currentRoute.name === 'archive') {
    return { name: 'archive', key: 'archive' };
  }
  if (currentRoute.name === 'archive-month') {
    const year = String(currentRoute.params.year);
    const month = String(currentRoute.params.month);
    return {
      name: 'archive-month',
      key: `archive-month:${year}:${month}`,
      year,
      month,
    };
  }
  if (currentRoute.name === 'article-new') {
    return { name: 'article-new', key: 'article-new' };
  }
  if (currentRoute.name === 'entry-new') {
    return { name: 'entry-new', key: 'entry-new' };
  }
  if (currentRoute.name === 'entry-edit') {
    const entryId = Number(currentRoute.params.entryId);
    return { name: 'entry-edit', key: `entry-edit:${entryId}`, entryId };
  }
  if (currentRoute.name === 'article-edit') {
    const articleId = Number(currentRoute.params.articleId);
    return { name: 'article-edit', key: `article-edit:${articleId}`, articleId };
  }
  if (currentRoute.name === 'settings') {
    return { name: 'settings', key: 'settings' };
  }
  if (currentRoute.name === 'contribution-inbox') {
    return { name: 'contribution-inbox', key: 'contribution-inbox' };
  }
  if (currentRoute.name === 'contribution-review') {
    const publicId = String(currentRoute.params.publicId);
    return { name: 'contribution-review', key: `contribution-review:${publicId}`, publicId };
  }
  if (currentRoute.name === 'detail') {
    const publicId = String(currentRoute.params.publicId);
    return { name: 'detail', key: `detail:${publicId}`, publicId };
  }
  return { name: 'not-found', key: currentRoute.fullPath };
});

const activeOverlayContext = computed(() => {
  const context = overlayContext.value;
  if (!context) return null;
  if (
    context.origin.name === 'public'
    && route.value.name === 'detail'
    && route.value.publicId === context.entry.publicId
  ) return context;
  if (
    context.origin.name === 'private'
    && route.value.name === 'private'
    && route.value.entryId === context.entry.id
  ) return context;
  return null;
});

const activeDiscoveryOverlayContext = computed(() => {
  const context = discoveryOverlayContext.value;
  if (
    context
    && route.value.name === 'detail'
    && route.value.publicId === context.entry.publicId
  ) return context;
  return null;
});

const directPublicOverlayEntry = computed(() => {
  const currentRoute = route.value;
  const entry = directPublicEntry.value;
  if (
    currentRoute.name !== 'detail'
    || activeOverlayContext.value
    || activeDiscoveryOverlayContext.value
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
  if (route.value.name === 'public' || route.value.name === 'private') return route.value;
  return null;
});
const publicFeedRoute = computed(() => {
  const background = backgroundFeedRoute.value;
  return background?.name === 'public' ? background : null;
});
const publicShellActive = computed(() =>
  publicFeedRoute.value !== null
  || route.value.name === 'about'
  || route.value.name === 'search'
  || route.value.name === 'archive'
  || route.value.name === 'archive-month'
  || route.value.name === 'detail',
);
const discoveryBackgroundRoute = computed<DiscoveryRoute | null>(() => {
  if (activeDiscoveryOverlayContext.value) return activeDiscoveryOverlayContext.value.origin;
  if (
    route.value.name === 'search'
    || route.value.name === 'archive'
    || route.value.name === 'archive-month'
  ) return route.value;
  return null;
});
const routedViewLocation = computed<RouteLocationNormalizedLoaded>(() =>
  activeDiscoveryOverlayContext.value?.originLocation ?? router.currentRoute.value,
);
const discoveryAudience = computed(() => {
  if (!session.authenticationChecked) return 'checking';
  return ownerAuthenticated.value ? 'admin' : 'visitor';
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
      || currentRoute.fullPath === context.originPath
    )
  ) return context.accessScope;
  return discoveryAccessScope.value;
});

const overlayEntryId = computed(() => {
  const contextEntry = activeOverlayContext.value?.entry;
  if (contextEntry && !isProtectedJournalEntry(contextEntry)) return contextEntry.id;
  if (directPublicOverlayEntry.value) return directPublicOverlayEntry.value.id;
  if (route.value.name === 'private') return route.value.entryId ?? undefined;
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
  route.value.name === 'private'
  && route.value.entryId !== null
  && activeOverlayContext.value === null,
);
const isContributionRoute = computed(() =>
  route.value.name === 'contribution-inbox' || route.value.name === 'contribution-review',
);
const isAssetRoute = computed(() =>
  route.value.name === 'private'
  || route.value.name === 'entry-new'
  || route.value.name === 'entry-edit'
  || route.value.name === 'article-new'
  || route.value.name === 'article-edit'
  || route.value.name === 'settings',
);
const isPrivateRoute = computed(() =>
  isAssetRoute.value || isContributionRoute.value,
);
const showProfileNavigation = computed(() => isPrivateRoute.value || ownerAuthenticated.value);
const profileBioStyle = computed(() => {
  if (profileBioOverflow.value <= 0) return undefined;
  const duration = Math.max(8, profileBioOverflow.value / 10.8);
  return {
    '--profile-bio-distance': `-${profileBioOverflow.value}px`,
    '--profile-bio-duration': `${duration.toFixed(2)}s`,
  };
});

function measureProfileBio(): void {
  const element = profileBio.value;
  profileBioOverflow.value = element
    ? Math.max(0, element.scrollWidth - element.clientWidth)
    : 0;
}

watch(() => route.value.key, () => {
  directPublicEntry.value = null;
});

watch(profileBio, (element, previousElement) => {
  if (!profileBioResizeObserver) return;
  if (previousElement) profileBioResizeObserver.unobserve(previousElement);
  if (element) {
    profileBioResizeObserver.observe(element);
    measureProfileBio();
  }
}, { flush: 'post' });

watch(() => profile.value?.bio, measureProfileBio, { flush: 'post' });

watch(ownerAuthenticated, (authenticated) => {
  if (authenticated) {
    void contributionInbox.loadInbox();
    return;
  }
  overlayContext.value = null;
  directPublicEntry.value = null;
  contributionInbox.clear();
}, { immediate: true });

watch(() => route.value.name, (name, previousName) => {
  if (
    name === 'contribution-inbox'
    && previousName !== 'contribution-inbox'
    && ownerAuthenticated.value
  ) {
    void contributionInbox.loadInbox();
  }
});

function persistentFeedKey(path: string): string | null {
  const url = new URL(path, window.location.origin);
  if (url.pathname === '/') {
    const channel = url.searchParams.get('channel') ?? 'life';
    const tag = url.searchParams.get('tag') ?? '';
    if (!isJournalChannel(channel)) return null;
    return `public:${channel}:${tag}`;
  }
  if (url.pathname === '/me') return 'private';
  if (url.pathname === '/search') {
    const queryValues = url.searchParams.getAll('q');
    if (queryValues.length > 1) return null;
    const query = normalizePublicSearchQuery(queryValues[0] ?? '');
    if (Array.from(query).length > MAX_PUBLIC_SEARCH_QUERY_LENGTH) return null;
    return `discovery:${publicSearchPath(query)}`;
  }
  if (
    url.pathname === '/archive'
    || /^\/archive\/\d{4}\/(?:0[1-9]|1[0-2])$/.test(url.pathname)
  ) {
    return `discovery:${url.pathname}`;
  }
  return null;
}

function persistentFeedRouteKey(feedRoute: FeedRoute): string | null {
  if (feedRoute.name === 'private') return 'private';
  return `public:${feedRoute.channel}:${feedRoute.tag}`;
}

function pathMatchesOverlayContext(path: string, context: OverlayContext): boolean {
  const url = new URL(path, window.location.origin);
  if (context.origin.name === 'public') {
    return url.pathname === `/p/${encodeURIComponent(context.entry.publicId)}`;
  }
  if (isProtectedJournalEntry(context.entry)) {
    throw new Error('Protected previews require a public feed origin.');
  }
  return url.pathname === '/me' && url.searchParams.get('entry') === String(context.entry.id);
}

function pathMatchesDiscoveryOverlayContext(
  path: string,
  context: DiscoveryOverlayContext,
): boolean {
  const url = new URL(path, window.location.origin);
  return url.pathname === `/p/${encodeURIComponent(context.entry.publicId)}`;
}

function isOverlayHistoryTransition(fromPath: string, toPath: string): boolean {
  const context = overlayContext.value;
  if (context && (
    (pathMatchesOverlayContext(fromPath, context) && toPath === context.originPath)
    || (fromPath === context.originPath && pathMatchesOverlayContext(toPath, context))
  )) return true;

  const discoveryContext = discoveryOverlayContext.value;
  return discoveryContext !== null && (
    (
      pathMatchesDiscoveryOverlayContext(fromPath, discoveryContext)
      && toPath === discoveryContext.originPath
    )
    || (
      fromPath === discoveryContext.originPath
      && pathMatchesDiscoveryOverlayContext(toPath, discoveryContext)
    )
  );
}

async function navigate(path: string): Promise<void> {
  const nextUrl = new URL(path, window.location.origin);
  await router.push({
    path: nextUrl.pathname,
    query: Object.fromEntries(nextUrl.searchParams),
  });
}

function privateFeedPath(options: {
  assetView: AssetView;
  page: number;
  entryId?: number;
}): string {
  const search = new URLSearchParams();
  search.set('view', options.assetView);
  if (options.assetView === 'table' && options.page > 1) search.set('page', String(options.page));
  if (options.entryId !== undefined) search.set('entry', String(options.entryId));
  const query = search.toString();
  return query ? `/me?${query}` : '/me';
}

function revealHeader(): void {
  headerHidden.value = false;
  headerScrollDistance = 0;
  headerScrollDirection = 0;
}

function resetHeaderScrollTracking(scrollTop: number): void {
  previousContentScrollTop = scrollTop;
  headerScrollDistance = 0;
  headerScrollDirection = 0;
}

function handleContentScroll(event: Event): void {
  const scrollTop = Math.max(0, (event.currentTarget as HTMLDivElement).scrollTop);
  const delta = scrollTop - previousContentScrollTop;
  previousContentScrollTop = scrollTop;

  if (!isMobileOrTablet.value || scrollTop <= HEADER_ALWAYS_VISIBLE_TOP) {
    revealHeader();
    return;
  }
  if (delta === 0) return;

  const direction: ScrollDirection = delta > 0 ? 1 : -1;
  if (direction !== headerScrollDirection) {
    headerScrollDirection = direction;
    headerScrollDistance = 0;
  }
  headerScrollDistance += Math.abs(delta);

  if (direction === 1 && headerScrollDistance >= HEADER_HIDE_DISTANCE) {
    headerHidden.value = true;
    headerScrollDistance = 0;
  }
  else if (direction === -1 && headerScrollDistance >= HEADER_SHOW_DISTANCE) {
    revealHeader();
  }
}

function handleRouteChange(nextPath: string, currentPath: string): void {
  if (currentPath === nextPath) return;
  const nextUrl = new URL(nextPath, window.location.origin);
  const currentUrl = new URL(currentPath, window.location.origin);
  if (
    nextUrl.pathname === currentUrl.pathname
    && nextUrl.search === currentUrl.search
  ) return;
  revealHeader();
  if (isOverlayHistoryTransition(currentPath, nextPath)) {
    return;
  }

  const context = overlayContext.value;
  const currentFeedRouteKey = context && pathMatchesOverlayContext(currentPath, context)
    ? persistentFeedRouteKey(context.origin)
    : persistentFeedKey(currentPath);
  const nextFeedRouteKey = context && pathMatchesOverlayContext(nextPath, context)
    ? persistentFeedRouteKey(context.origin)
    : persistentFeedKey(nextPath);

  if (currentFeedRouteKey) {
    feedScrollPositions.set(currentFeedRouteKey, contentScroll.value!.scrollTop);
  }

  if (nextFeedRouteKey && nextFeedRouteKey !== currentFeedRouteKey) {
    pendingFeedScrollTop = feedScrollPositions.get(nextFeedRouteKey) ?? 0;
  }
  else pendingFeedScrollTop = null;
  if (pendingFeedScrollTop === null) {
    contentScroll.value!.scrollTo({ top: 0, behavior: 'auto' });
    resetHeaderScrollTracking(0);
  }
}

async function openEntry(entry: PublicJournalFeedItem): Promise<void> {
  const origin = backgroundFeedRoute.value;
  if (!origin) throw new Error('Journal overlay requires a visible feed origin.');

  overlayContext.value = {
    entry,
    origin,
    originPath: currentRoute.fullPath,
  };
  if (isProtectedJournalEntry(entry)) {
    if (origin.name !== 'public') throw new Error('Protected previews require a public feed origin.');
    await router.push(`/p/${encodeURIComponent(entry.publicId)}`);
    return;
  }
  const path = origin.name === 'public'
    ? `/p/${encodeURIComponent(entry.publicId)}`
    : privateFeedPath({ assetView: origin.assetView, page: origin.page, entryId: entry.id });
  await router.push(path);
}

async function openDiscoveryEntry(entry: JournalDiscoveryListItem): Promise<void> {
  const origin = route.value;
  if (origin.name !== 'search' && origin.name !== 'archive-month') {
    throw new Error('Discovery overlay requires a searchable list origin.');
  }

  const previousContext = discoveryOverlayContext.value;
  const loadedEntry = previousContext?.originPath === currentRoute.fullPath
    && previousContext.entry.publicId === entry.publicId
    ? previousContext.loadedEntry
    : undefined;
  overlayContext.value = null;
  discoveryOverlayContext.value = {
    entry,
    ...(loadedEntry ? { loadedEntry } : {}),
    origin,
    originLocation: router.currentRoute.value,
    originPath: currentRoute.fullPath,
    originTitle: document.title,
    accessScope: renderedDiscoveryAccessScope.value,
  };
  await router.push({
    name: 'detail',
    params: { publicId: entry.publicId },
    state: entry.kind === 'protected' && !loadedEntry
      ? { journalDetailFromFeed: true, journalProtectedPreview: entry }
      : { journalDetailFromFeed: true },
  });
}

function changeAssetView(assetView: AssetView): void {
  if (route.value.name !== 'private') return;
  void router.push(privateFeedPath({
    assetView,
    page: 1,
    ...(route.value.entryId === null ? {} : { entryId: route.value.entryId }),
  }));
}

function changePrivatePage(page: number): void {
  if (route.value.name !== 'private') return;
  void router.push(privateFeedPath({ assetView: 'table', page }));
}

function changePublicChannel(channel: JournalChannel): void {
  void navigate(publicFeedPath(channel));
}

function openAbout(): void {
  void navigate('/about');
}

function closeOverlay(): void {
  if (activeOverlayContext.value) {
    router.back();
    return;
  }
  if (directPublicOverlayEntry.value) {
    const state = window.history.state as { journalDetailFromFeed?: boolean } | null;
    if (state?.journalDetailFromFeed === true) {
      router.back();
      return;
    }
    navigate(publicFeedPath(directPublicOverlayEntry.value.channel));
    return;
  }
  if (route.value.name !== 'private' || route.value.entryId === null) return;
  void router.replace(privateFeedPath({ assetView: route.value.assetView, page: route.value.page }));
}

function closeDiscoveryOverlay(): void {
  if (!activeDiscoveryOverlayContext.value) return;
  router.back();
}

function selectDiscoveryTag(channel: JournalChannel, tag: string): void {
  void router.push(publicFeedPath(channel, tag));
}

async function removeDeletedOverlay(): Promise<void> {
  const context = activeOverlayContext.value;
  const current = route.value;
  const returnPath = context?.originPath
    ?? (current.name === 'private'
      ? privateFeedPath({ assetView: current.assetView, page: current.page })
      : '/me');
  overlayContext.value = null;
  await router.replace(returnPath);
  if (context) router.back();
}

function returnFromDetail(): void {
  const state = window.history.state as { journalDetailFromFeed?: boolean } | null;
  if (state?.journalDetailFromFeed === true) {
    router.back();
    return;
  }
  const entry = directPublicEntry.value;
  if (!entry) throw new Error('Journal detail must load before resolving its channel.');
  navigate(publicFeedPath(entry.channel));
}

function handlePublicDetailLoaded(entry: JournalEntry): void {
  if (route.value.name !== 'detail' || route.value.publicId !== entry.publicId) return;
  directPublicEntry.value = entry;
}

function handlePublicDetailUnlocked(entry: JournalEntry): void {
  revealedPublicEntries.value = new Map(revealedPublicEntries.value).set(entry.publicId, entry);
  discoveryAccessRevision.value += 1;
}

function handleDiscoveryDetailLoaded(entry: JournalEntry): void {
  const context = activeDiscoveryOverlayContext.value;
  if (!context || context.entry.publicId !== entry.publicId) return;
  discoveryOverlayContext.value = { ...context, loadedEntry: entry };
}

function handleDiscoveryDetailUnlocked(entry: JournalEntry): void {
  handleDiscoveryDetailLoaded(entry);
  handlePublicDetailUnlocked(entry);
}

function restoreFeedScroll(): void {
  if (pendingFeedScrollTop === null) return;

  const scrollTop = pendingFeedScrollTop;
  pendingFeedScrollTop = null;
  contentScroll.value!.scrollTo({ top: scrollTop, behavior: 'auto' });
  resetHeaderScrollTracking(scrollTop);
}

useEventListener(contentScroll, 'scroll', handleContentScroll, { passive: true });
useEventListener('resize', revealHeader, { passive: true });

const removeAfterEach = router.afterEach((to, from) => {
  if (to.fullPath !== from.fullPath) handleRouteChange(to.fullPath, from.fullPath);
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

onMounted(() => {
  profileBioResizeObserver = new ResizeObserver(measureProfileBio);
  if (profileBio.value) {
    profileBioResizeObserver.observe(profileBio.value);
    measureProfileBio();
  }
  void session.load();
  void siteProfile.load();
});
onUnmounted(() => {
  profileBioResizeObserver?.disconnect();
  profileErrorMessage?.close();
  removeAfterEach();
});
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--header-hidden': headerCollapsed }">
    <div class="profile-bar">
      <header class="profile" :class="{ 'profile--public': publicShellActive }">
        <div class="profile__identity">
          <button class="profile__home" type="button" aria-label="返回公开首页" @click="navigate('/')">
            <img v-if="profile" class="profile__avatar" :src="profile.avatarUrl" alt="小明同学">
            <span
              v-else
              class="profile__avatar-placeholder"
              :class="{ 'profile__avatar-placeholder--error': profileLoadError }"
              aria-hidden="true"
            />
          </button>
          <div class="profile__copy">
            <button class="profile__name" type="button" @click="navigate('/')">小明同学</button>
            <p
              v-if="profile?.bio"
              ref="profileBio"
              class="profile__bio"
              :class="{ 'profile__bio--scrolling': profileBioOverflow > 0 }"
              :style="profileBioStyle"
            >
              <span class="profile__bio-text">{{ profile.bio }}</span>
            </p>
            <span
              v-else-if="!profile && !profileLoadError"
              class="profile__bio-skeleton"
              role="status"
              aria-label="正在读取公开资料"
            />
          </div>
        </div>
        <div v-if="publicShellActive" class="profile__search">
          <PublicSearchBar @focus-requested="revealHeader" />
        </div>
        <div class="profile__actions">
          <nav v-if="showProfileNavigation" class="profile__nav" aria-label="主导航">
            <button
              v-if="isPrivateRoute"
              class="profile__nav-link"
              :class="{ 'profile__nav-link--active': route.name === 'public' || route.name === 'detail' }"
              type="button"
              :aria-current="route.name === 'public' || route.name === 'detail' ? 'page' : undefined"
              @click="navigate('/')"
            >
              公开记录
            </button>
            <button
              v-if="isPrivateRoute || ownerAuthenticated"
              class="profile__nav-link"
              :class="{ 'profile__nav-link--active': isAssetRoute }"
              type="button"
              :aria-current="isAssetRoute ? 'page' : undefined"
              @click="navigate('/me')"
            >
              我的资产
            </button>
            <button
              v-if="isPrivateRoute || ownerAuthenticated"
              class="profile__nav-link profile__nav-link--inbox"
              :class="{ 'profile__nav-link--active': isContributionRoute }"
              type="button"
              :aria-current="isContributionRoute ? 'page' : undefined"
              @click="navigate('/me/contributions')"
            >
              <span>朋友投稿</span>
              <span
                v-if="contributionInbox.pendingCount.value"
                class="profile__nav-count"
                :aria-label="`${contributionInbox.pendingCount.value} 份待处理投稿`"
              >
                {{ contributionInbox.pendingCount.value }}
              </span>
            </button>
          </nav>
          <ThemeModeControl />
        </div>
      </header>
    </div>

    <div class="app-main" :class="{ 'app-main--public': publicShellActive }">
      <PublicChannelNavigation
        v-if="publicShellActive"
        :channel="publicFeedRoute?.channel ?? null"
        :about-active="route.name === 'about'"
        @select="changePublicChannel"
        @select-about="openAbout"
      />

      <div ref="contentScroll" class="app-scroll">
        <RouterView v-slot="{ Component }" :route="routedViewLocation">
          <KeepAlive v-if="session.ownerAuthenticated" :max="1">
            <component
              :is="Component"
              v-if="backgroundFeedRoute?.name === 'private'"
              :key="backgroundFeedRoute.key"
              mode="private"
              :asset-view="backgroundFeedRoute.assetView"
              :page="backgroundFeedRoute.page"
              :overlay-entry-id="overlayEntryId"
              :overlay-entry="overlayEntry"
              :overlay-protected-entry="overlayProtectedEntry"
              :direct-overlay="directPrivateOverlay"
              @layout-ready="restoreFeedScroll"
              @change-asset-view="changeAssetView"
              @change-page="changePrivatePage"
              @open-entry="openEntry"
              @close-overlay="closeOverlay"
              @remove-deleted-overlay="removeDeletedOverlay"
            />
          </KeepAlive>
          <component
            :is="Component"
            v-else-if="backgroundFeedRoute?.name === 'private'"
            :key="backgroundFeedRoute.key"
            mode="private"
            :asset-view="backgroundFeedRoute.assetView"
            :page="backgroundFeedRoute.page"
            :overlay-entry-id="overlayEntryId"
            :overlay-entry="overlayEntry"
            :overlay-protected-entry="overlayProtectedEntry"
            :direct-overlay="directPrivateOverlay"
            @layout-ready="restoreFeedScroll"
            @change-asset-view="changeAssetView"
            @change-page="changePrivatePage"
            @open-entry="openEntry"
            @close-overlay="closeOverlay"
            @remove-deleted-overlay="removeDeletedOverlay"
          />

          <KeepAlive v-if="session.ownerAuthenticated" :max="PUBLIC_FEED_CACHE_LIMIT">
            <component
              :is="Component"
              v-if="backgroundFeedRoute?.name === 'public'"
              :key="backgroundFeedRoute.key"
              mode="public"
              :channel="backgroundFeedRoute.channel"
              :initial-tag="backgroundFeedRoute.tag"
              :overlay-entry-id="overlayEntryId"
              :overlay-entry="overlayEntry"
              :overlay-protected-entry="overlayProtectedEntry"
              :revealed-public-entries="revealedPublicEntries"
              @layout-ready="restoreFeedScroll"
              @open-entry="openEntry"
              @close-overlay="closeOverlay"
              @remove-deleted-overlay="removeDeletedOverlay"
            />
          </KeepAlive>
          <KeepAlive v-else :max="PUBLIC_FEED_CACHE_LIMIT">
            <component
              :is="Component"
              v-if="backgroundFeedRoute?.name === 'public'"
              :key="backgroundFeedRoute.key"
              mode="public"
              :channel="backgroundFeedRoute.channel"
              :initial-tag="backgroundFeedRoute.tag"
              :overlay-entry-id="overlayEntryId"
              :overlay-entry="overlayEntry"
              :overlay-protected-entry="overlayProtectedEntry"
              :revealed-public-entries="revealedPublicEntries"
              @layout-ready="restoreFeedScroll"
              @open-entry="openEntry"
              @close-overlay="closeOverlay"
              @remove-deleted-overlay="removeDeletedOverlay"
            />
          </KeepAlive>

          <component
            :is="Component"
            v-if="route.name === 'detail'
              && !activeOverlayContext
              && !activeDiscoveryOverlayContext
              && !directPublicOverlayEntry"
            :key="route.key"
            mode="public"
            :detail-id="route.publicId"
            @detail-loaded="handlePublicDetailLoaded"
            @detail-unlocked="handlePublicDetailUnlocked"
            @return-to-feed="returnFromDetail"
          />
          <component
            :is="Component"
            v-else-if="discoveryBackgroundRoute"
            :key="`${discoveryBackgroundRoute.key}:${renderedDiscoveryAccessScope}`"
            :access-scope="renderedDiscoveryAccessScope"
            @layout-ready="restoreFeedScroll"
            @open-entry="openDiscoveryEntry"
          />
          <NotFoundView
            v-else-if="route.name === 'not-found' && currentRoute.name !== 'not-found'"
            :key="route.key"
          />
          <component
            :is="Component"
            v-else-if="backgroundFeedRoute === null"
            :key="route.key"
          />
        </RouterView>

        <PublicDiscoveryDetailOverlay
          v-if="activeDiscoveryOverlayContext"
          :key="activeDiscoveryOverlayContext.entry.publicId"
          :entry="activeDiscoveryOverlayContext.entry"
          :loaded-entry="activeDiscoveryOverlayContext.loadedEntry"
          @close="closeDiscoveryOverlay"
          @loaded="handleDiscoveryDetailLoaded"
          @unlocked="handleDiscoveryDetailUnlocked"
          @select-tag="selectDiscoveryTag"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  --public-sidebar-width: 180px;
  --public-layout-gap: 1.75rem;

  display: grid;
  height: 100dvh;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.profile-bar {
  display: grid;
  z-index: 20;
  grid-template-rows: 1fr;
  overflow: hidden;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-page);
  transition: grid-template-rows 200ms ease, border-color 200ms ease;
}

.app-shell--header-hidden .profile-bar {
  grid-template-rows: 0fr;
  border-bottom-color: transparent;
}

.app-main {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
}

.app-main--public {
  width: min(calc(100% - (var(--workspace-gutter) * 2)), var(--workspace-width));
  margin: 0 auto;
  grid-template-columns: var(--public-sidebar-width) minmax(0, 1fr);
  gap: var(--public-layout-gap);
}

.app-scroll {
  display: flex;
  min-width: 0;
  flex-direction: column;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-width: none;
}

.app-scroll::-webkit-scrollbar {
  display: none;
}

.app-scroll > * {
  flex-shrink: 0;
}

.profile {
  display: grid;
  min-height: 0;
  grid-template-areas: "identity actions";
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.9rem;
  width: min(calc(100% - (var(--workspace-gutter) * 2)), var(--workspace-width));
  margin: 0 auto;
  padding: 1.15rem 0 1rem;
  transition: opacity 180ms ease, transform 200ms ease;
}

.profile--public {
  grid-template-areas: "identity search actions";
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 40rem) minmax(0, 1fr);
}

.app-shell--header-hidden .profile {
  transform: translateY(-0.75rem);
  opacity: 0;
  pointer-events: none;
}

.profile__home,
.profile__name,
.profile__nav-link {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.profile__home {
  flex: 0 0 auto;
  padding: 0;
  border-radius: 50%;
}

.profile__avatar,
.profile__avatar-placeholder {
  display: block;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--border-strong);
}

.profile__avatar {
  object-fit: cover;
}

.profile__avatar-placeholder,
.profile__bio-skeleton {
  background: var(--surface-muted);
  animation: profile-skeleton-pulse 1.4s ease-in-out infinite;
}

.profile__avatar-placeholder--error {
  background: var(--danger-soft);
  animation: none;
}

.profile__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.9rem;
  grid-area: identity;
}

.profile__copy {
  min-width: 0;
}

.profile__search {
  width: min(100%, 40rem);
  min-width: 0;
  justify-self: center;
  grid-area: search;
}

.profile__name {
  padding: 0;
  font-family: var(--font-serif);
  font-size: 1.05rem;
  font-weight: 750;
  letter-spacing: 0.02em;
}

.profile__bio {
  margin: 0.14rem 0 0;
  overflow: hidden;
  color: var(--text-muted);
  font-family: var(--font-serif);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile__bio--scrolling {
  text-overflow: clip;
  mask-image: linear-gradient(to right, transparent, #000 0.4rem, #000 calc(100% - 0.4rem), transparent);
}

.profile__bio--scrolling .profile__bio-text {
  display: block;
  width: max-content;
  animation: profile-bio-pan var(--profile-bio-duration) linear infinite;
}

.profile__bio-skeleton {
  display: block;
  width: 13.5rem;
  height: 0.74rem;
  margin-top: 0.26rem;
  border-radius: 999px;
}

.profile__nav {
  display: flex;
  align-self: stretch;
  align-items: center;
  gap: 1rem;
}

.profile__actions {
  display: flex;
  align-self: stretch;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  grid-area: actions;
}

.profile__nav-link {
  min-height: 2.5rem;
  padding: 0.25rem 0;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 0.78rem;
  transition: border-color 140ms ease, color 140ms ease;
}

.profile__nav-link--active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}

.profile__nav-link--inbox {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.profile__nav-count {
  display: grid;
  min-width: 1.15rem;
  height: 1.15rem;
  padding: 0 0.28rem;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 750;
  line-height: 1;
  place-items: center;
}

@keyframes profile-skeleton-pulse {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

@keyframes profile-bio-pan {
  0%,
  15% {
    transform: translateX(0);
    opacity: 1;
  }

  60%,
  80% {
    transform: translateX(var(--profile-bio-distance));
    opacity: 1;
  }

  84% {
    transform: translateX(var(--profile-bio-distance));
    opacity: 0;
  }

  85% {
    transform: translateX(0);
    opacity: 0;
  }

  90%,
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (min-width: 1280px) {
  .profile--public {
    grid-template-areas: "identity . content";
    grid-template-columns: var(--public-sidebar-width) var(--public-layout-gap) minmax(0, 1fr);
    gap: 0;
  }

  .profile--public .profile__search,
  .profile--public .profile__actions {
    grid-area: content;
  }

  .profile--public .profile__actions {
    justify-self: end;
  }
}

@media (min-width: 600px) and (max-width: 1279px) {
  .profile--public {
    grid-template-columns: minmax(8rem, 13rem) minmax(14rem, 1fr) auto;
    gap: 0.65rem;
  }

  .profile__identity {
    gap: 0.55rem;
  }

  .profile__avatar,
  .profile__avatar-placeholder {
    width: 2.65rem;
    height: 2.65rem;
  }

  .profile__name,
  .profile__nav-link {
    white-space: nowrap;
  }

  .profile__name {
    font-size: 0.96rem;
  }

  .profile__search {
    width: 80%;
  }

  .profile__actions {
    gap: 0.4rem;
  }

  .profile__nav {
    gap: 0.65rem;
  }

  .profile__nav-link {
    font-size: 0.72rem;
  }
}

@media (max-width: 599px) {
  .profile {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.45rem;
    padding: 0.8rem 0 0.72rem;
  }

  .profile--public {
    grid-template-areas:
      "identity actions"
      "search search";
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 0.55rem;
  }

  .profile__search {
    width: 100%;
  }

  .profile__identity {
    gap: 0.55rem;
  }

  .profile__avatar,
  .profile__avatar-placeholder {
    width: 2.35rem;
    height: 2.35rem;
  }

  .profile__bio-skeleton {
    width: min(13.5rem, 100%);
  }

  .profile__name {
    font-size: 0.92rem;
    white-space: nowrap;
  }

  .profile__actions {
    grid-column: auto;
    justify-self: end;
    gap: 0.25rem;
  }

  .profile__nav {
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .profile__nav-link {
    min-height: 2.25rem;
    font-size: 0.7rem;
    white-space: nowrap;
  }

  .profile__nav-link--inbox {
    position: relative;
  }

  .profile__nav-count {
    position: absolute;
    top: -0.05rem;
    right: -0.45rem;
  }
}

@media (max-width: 799px) {
  .app-main--public {
    width: 100%;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0;
  }

  .app-main--public > .app-scroll {
    grid-row: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile-bar,
  .profile {
    transition: none;
  }
}
</style>
