<script setup lang="ts">
import { storeToRefs } from 'pinia';
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ArticleEditorView from './components/article/ArticleEditorView.vue';
import FeedView from './components/journal/FeedView.vue';
import EntryPublisherView from './components/publisher/EntryPublisherView.vue';
import SiteProfileSettingsView from './components/settings/SiteProfileSettingsView.vue';
import { useAdminContributions } from './composables/useAdminContributions';
import { useSessionStore } from './stores/session';
import { useSiteProfileStore } from './stores/siteProfile';
import type { JournalEntry } from './types';
import { showMessage } from './utils/message';

type AppRoute =
  | { name: 'public'; key: string; tag: string }
  | { name: 'detail'; key: string; publicId: string }
  | { name: 'private'; key: string; entryId: number | null }
  | { name: 'entry-new'; key: string }
  | { name: 'entry-edit'; key: string; entryId: number }
  | { name: 'article-new'; key: string }
  | { name: 'article-edit'; key: string; articleId: number }
  | { name: 'settings'; key: string }
  | { name: 'contribution-inbox'; key: string }
  | { name: 'contribution-review'; key: string; publicId: string }
  | { name: 'not-found'; key: string };

type FeedRoute = Extract<AppRoute, { name: 'public' | 'private' }>;

interface OverlayContext {
  entry: JournalEntry;
  origin: FeedRoute;
  originPath: string;
}

const AdminContributionInboxView = defineAsyncComponent(
  () => import('./components/contribution/AdminContributionInboxView.vue'),
);
const AdminContributionReviewView = defineAsyncComponent(
  () => import('./components/contribution/AdminContributionReviewView.vue'),
);

const currentRoute = useRoute();
const router = useRouter();
const session = useSessionStore();
const siteProfile = useSiteProfileStore();
const contributionInbox = useAdminContributions();
const { ownerAuthenticated } = storeToRefs(session);
const { profile, loadError: profileLoadError } = storeToRefs(siteProfile);
const overlayContext = shallowRef<OverlayContext | null>(null);
const directPublicEntry = shallowRef<JournalEntry | null>(null);
const contentScroll = useTemplateRef<HTMLDivElement>('contentScroll');
const profileBio = useTemplateRef<HTMLParagraphElement>('profileBio');
const profileBioOverflow = shallowRef(0);
const feedScrollPositions = new Map<string, number>();
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
    const tag = typeof currentRoute.query.tag === 'string' ? currentRoute.query.tag : '';
    return { name: 'public', key: `public:${tag}`, tag };
  }
  if (currentRoute.name === 'private') {
    const entry = currentRoute.query.entry;
    if (entry !== undefined && (typeof entry !== 'string' || !/^[1-9]\d*$/.test(entry))) {
      return { name: 'not-found', key: currentRoute.fullPath };
    }
    return { name: 'private', key: 'private', entryId: entry === undefined ? null : Number(entry) };
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

const directPublicOverlayEntry = computed(() => {
  const currentRoute = route.value;
  const entry = directPublicEntry.value;
  if (
    currentRoute.name !== 'detail'
    || activeOverlayContext.value
    || entry?.publicId !== currentRoute.publicId
    || entry.bodyFormat !== 'plain'
  ) return null;
  return entry;
});

const backgroundFeedRoute = computed<FeedRoute | null>(() => {
  if (activeOverlayContext.value) return activeOverlayContext.value.origin;
  if (directPublicOverlayEntry.value) return { name: 'public', key: 'public:', tag: '' };
  if (route.value.name === 'public' || route.value.name === 'private') return route.value;
  return null;
});

const overlayEntryId = computed(() => {
  if (activeOverlayContext.value) return activeOverlayContext.value.entry.id;
  if (directPublicOverlayEntry.value) return directPublicOverlayEntry.value.id;
  if (route.value.name === 'private') return route.value.entryId ?? undefined;
  return undefined;
});
const overlayEntry = computed(() =>
  activeOverlayContext.value?.entry ?? directPublicOverlayEntry.value ?? undefined,
);

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

function feedRouteKey(path: string): string | null {
  const url = new URL(path, window.location.origin);
  if (url.pathname === '/') return `public:${url.searchParams.get('tag') ?? ''}`;
  if (url.pathname === '/me') return 'private';
  return null;
}

function pathMatchesOverlayContext(path: string, context: OverlayContext): boolean {
  const url = new URL(path, window.location.origin);
  if (context.origin.name === 'public') {
    return url.pathname === `/p/${encodeURIComponent(context.entry.publicId)}`;
  }
  return url.pathname === '/me' && url.searchParams.get('entry') === String(context.entry.id);
}

function isOverlayHistoryTransition(fromPath: string, toPath: string): boolean {
  const context = overlayContext.value;
  if (!context) return false;
  return (
    pathMatchesOverlayContext(fromPath, context) && toPath === context.originPath
  ) || (
    fromPath === context.originPath && pathMatchesOverlayContext(toPath, context)
  );
}

async function navigate(path: string): Promise<void> {
  const nextUrl = new URL(path, window.location.origin);
  await router.push({
    path: nextUrl.pathname,
    query: Object.fromEntries(nextUrl.searchParams),
  });
}

function handleRouteChange(nextPath: string, currentPath: string): void {
  if (currentPath === nextPath) return;
  const nextUrl = new URL(nextPath, window.location.origin);
  const currentUrl = new URL(currentPath, window.location.origin);
  if (
    nextUrl.pathname === currentUrl.pathname
    && nextUrl.search === currentUrl.search
  ) return;
  if (isOverlayHistoryTransition(currentPath, nextPath)) {
    return;
  }

  const context = overlayContext.value;
  const currentFeedRouteKey = context && pathMatchesOverlayContext(currentPath, context)
    ? context.origin.key
    : feedRouteKey(currentPath);
  const nextFeedRouteKey = context && pathMatchesOverlayContext(nextPath, context)
    ? context.origin.key
    : feedRouteKey(nextPath);

  if (currentFeedRouteKey) {
    feedScrollPositions.set(currentFeedRouteKey, contentScroll.value!.scrollTop);
  }

  pendingFeedScrollTop = nextFeedRouteKey && nextFeedRouteKey !== currentFeedRouteKey
    ? feedScrollPositions.get(nextFeedRouteKey) ?? 0
    : null;
  if (pendingFeedScrollTop === null) {
    contentScroll.value!.scrollTo({ top: 0, behavior: 'auto' });
  }
}

async function openEntry(entry: JournalEntry): Promise<void> {
  const origin = backgroundFeedRoute.value;
  if (!origin) throw new Error('Journal overlay requires a visible feed origin.');

  overlayContext.value = {
    entry,
    origin,
    originPath: currentRoute.fullPath,
  };
  const path = origin.name === 'public'
    ? `/p/${encodeURIComponent(entry.publicId)}`
    : `/me?entry=${entry.id}`;
  await router.push(path);
}

function closeOverlay(): void {
  if (activeOverlayContext.value) {
    router.back();
    return;
  }
  if (directPublicOverlayEntry.value) {
    navigate('/');
    return;
  }
  if (route.value.name !== 'private' || route.value.entryId === null) return;
  void router.replace('/me');
}

async function removeDeletedOverlay(): Promise<void> {
  const context = activeOverlayContext.value;
  const returnPath = context?.originPath ?? '/me';
  overlayContext.value = null;
  await router.replace(returnPath);
  if (context) router.back();
}

function returnFromDetail(): void {
  const state = currentRoute.state as { journalDetailFromFeed?: boolean };
  if (state?.journalDetailFromFeed === true) {
    router.back();
    return;
  }
  navigate('/');
}

function handlePublicDetailLoaded(entry: JournalEntry): void {
  if (route.value.name !== 'detail' || route.value.publicId !== entry.publicId) return;
  directPublicEntry.value = entry;
}

function restoreFeedScroll(): void {
  if (pendingFeedScrollTop === null) return;

  const scrollTop = pendingFeedScrollTop;
  pendingFeedScrollTop = null;
  contentScroll.value!.scrollTo({ top: scrollTop, behavior: 'auto' });
}

const removeAfterEach = router.afterEach((to, from) => {
  if (to.fullPath !== from.fullPath) handleRouteChange(to.fullPath, from.fullPath);
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
  <div class="app-shell">
    <div class="profile-bar">
      <header class="profile">
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
      </header>
    </div>

    <div ref="contentScroll" class="app-scroll">
      <KeepAlive :max="3">
        <FeedView
          v-if="backgroundFeedRoute"
          :key="backgroundFeedRoute.key"
          :mode="backgroundFeedRoute.name"
          :initial-tag="backgroundFeedRoute.name === 'public' ? backgroundFeedRoute.tag : ''"
          :overlay-entry-id="overlayEntryId"
          :overlay-entry="overlayEntry"
          :direct-overlay="directPrivateOverlay"
          @layout-ready="restoreFeedScroll"
          @open-entry="openEntry"
          @close-overlay="closeOverlay"
          @remove-deleted-overlay="removeDeletedOverlay"
        />
      </KeepAlive>

      <FeedView
        v-if="route.name === 'detail' && !activeOverlayContext && !directPublicOverlayEntry"
        :key="route.key"
        mode="public"
        :detail-id="route.publicId"
        @detail-loaded="handlePublicDetailLoaded"
        @return-to-feed="returnFromDetail"
      />
      <ArticleEditorView
        v-else-if="route.name === 'article-new'"
        :key="route.key"
      />
      <ArticleEditorView
        v-else-if="route.name === 'article-edit'"
        :key="route.key"
        :article-id="route.articleId"
      />
      <EntryPublisherView
        v-else-if="route.name === 'entry-new'"
        :key="route.key"
      />
      <EntryPublisherView
        v-else-if="route.name === 'entry-edit'"
        :key="route.key"
        :entry-id="route.entryId"
      />
      <SiteProfileSettingsView
        v-else-if="route.name === 'settings'"
        :key="route.key"
      />
      <AdminContributionInboxView
        v-else-if="route.name === 'contribution-inbox'"
      />
      <AdminContributionReviewView
        v-else-if="route.name === 'contribution-review'"
        :public-id="route.publicId"
      />
      <main v-else-if="route.name === 'not-found'" class="not-found">
        <span class="not-found__code">404</span>
        <h1>这条路没有记录</h1>
        <button class="button button--primary" type="button" @click="navigate('/')">返回首页</button>
      </main>

      <footer class="site-footer">
        <span>小明同学的生活记录</span>
        <span aria-hidden="true">·</span>
        <a href="/rss.xml">RSS</a>
        <a href="/feed.json">JSON Feed</a>
        <a href="https://www.qweather.com/" target="_blank" rel="noopener noreferrer">
          天气服务：QWeather
        </a>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  height: 100dvh;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.profile-bar {
  z-index: 20;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-page);
}

.app-scroll {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-color: var(--border-strong) transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.app-scroll::-webkit-scrollbar {
  width: 8px;
}

.app-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.app-scroll::-webkit-scrollbar-thumb {
  border: 2px solid var(--surface-page);
  border-radius: 999px;
  background: var(--border-strong);
}

.app-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.app-scroll > :not(.site-footer) {
  flex-shrink: 0;
}

.profile {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.9rem;
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--canvas-width));
  margin: 0 auto;
  padding: 1.15rem 0 1rem;
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

.profile__copy {
  min-width: 0;
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

.not-found {
  display: grid;
  min-height: 55vh;
  place-content: center;
  justify-items: center;
  text-align: center;
}

.not-found__code {
  color: var(--accent);
  font-family: var(--font-serif);
  font-size: 4rem;
  line-height: 1;
}

.not-found h1 {
  margin: 0.5rem 0 1.2rem;
  font-family: var(--font-serif);
  font-size: 1.35rem;
}

.site-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: auto;
  padding: 1.8rem var(--page-gutter) 2.6rem;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.site-footer a {
  color: inherit;
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

@media (max-width: 599px) {
  .profile {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.45rem;
    padding: 0.8rem 0 0.72rem;
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

  .profile__nav {
    grid-column: auto;
    justify-self: end;
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
</style>
