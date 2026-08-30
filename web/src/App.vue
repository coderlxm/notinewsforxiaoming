<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import {
  computed,
  onMounted,
  onUnmounted,
  useTemplateRef,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { publicFeedPath } from './journalChannels';
import AppHeader from './components/app/AppHeader.vue';
import AppRouteViewport from './components/app/AppRouteViewport.vue';
import PublicChannelNavigation from './components/journal/PublicChannelNavigation.vue';
import { useAppRoute } from './composables/useAppRoute';
import { useAppScrollRestoration } from './composables/useAppScrollRestoration';
import { useDiscoveryEntryOverlay } from './composables/useDiscoveryEntryOverlay';
import { useFeedEntryOverlay } from './composables/useFeedEntryOverlay';
import { useSessionStore } from './stores/session';
import { useSiteProfileStore } from './stores/siteProfile';
import type {
  AssetView,
  JournalChannel,
  JournalDiscoveryListItem,
  JournalEntry,
} from './types';

interface AppRouteViewportInstance {
  scrollContainer: HTMLDivElement | null;
}

const currentRoute = useRoute();
const router = useRouter();
const session = useSessionStore();
const siteProfile = useSiteProfileStore();
const isMobile = useMediaQuery('(max-width: 599px)');
const { ownerAuthenticated, authenticationChecked } = storeToRefs(session);
const { profile, loadError: profileLoadError } = storeToRefs(siteProfile);

const defaultAssetView = computed<AssetView>(() => isMobile.value ? 'waterfall' : 'table');
const { route, publicShellActive, isPrivateRoute, isAssetRoute } = useAppRoute(
  currentRoute,
  defaultAssetView,
);

function navigate(path: string): void {
  const nextUrl = new URL(path, window.location.origin);
  void router.push({
    path: nextUrl.pathname,
    query: Object.fromEntries(nextUrl.searchParams),
  });
}

const routeViewport = useTemplateRef<AppRouteViewportInstance>('routeViewport');

const discoveryOverlay = useDiscoveryEntryOverlay({
  router,
  route,
  currentRoute,
  ownerAuthenticated,
  authenticationChecked,
});

const feedOverlay = useFeedEntryOverlay({
  router,
  route,
  currentRoute,
  navigate,
  ownerAuthenticated,
  isDiscoveryOverlayActive: () => discoveryOverlay.activeDiscoveryOverlayContext.value !== null,
});

const { restoreFeedScroll, dispose: disposeScrollRestoration } = useAppScrollRestoration({
  router,
  getScrollContainer: () => routeViewport.value?.scrollContainer ?? null,
  isOverlayTransition: (fromPath, toPath) =>
    feedOverlay.isOverlayHistoryTransition(fromPath, toPath)
    || discoveryOverlay.isOverlayHistoryTransition(fromPath, toPath),
  feedRouteKeyForPath: path => feedOverlay.feedRouteKeyForPath(path),
});

const {
  publicFeedRoute,
  backgroundFeedRoute,
  overlayEntryId,
  overlayEntry,
  overlayProtectedEntry,
  directPrivateOverlay,
  revealedPublicEntries,
  directPublicOverlayEntry,
  activeOverlayContext,
  openEntry,
  closeOverlay,
  removeDeletedOverlay,
  changeAssetView,
  changePrivatePage,
  handlePublicDetailLoaded,
  handlePublicDetailUnlocked: recordPublicDetailUnlocked,
  handlePublicInteractionsChange,
  returnFromDetail,
} = feedOverlay;

const {
  routedViewLocation,
  activeDiscoveryOverlayContext,
  discoveryBackgroundRoute,
  renderedDiscoveryAccessScope,
  openDiscoveryEntry: openDiscoveryOverlayEntry,
  closeDiscoveryOverlay,
  handleDiscoveryDetailLoaded,
  handleDiscoveryDetailUnlocked: recordDiscoveryDetailUnlocked,
  selectDiscoveryTag,
} = discoveryOverlay;

async function openDiscoveryEntry(entry: JournalDiscoveryListItem): Promise<void> {
  feedOverlay.clearOverlay();
  await openDiscoveryOverlayEntry(entry);
}

function handlePublicDetailUnlocked(entry: JournalEntry): void {
  recordPublicDetailUnlocked(entry);
  discoveryOverlay.bumpAccessRevision();
}

function handleDiscoveryDetailUnlocked(entry: JournalEntry): void {
  recordDiscoveryDetailUnlocked(entry);
  handlePublicDetailUnlocked(entry);
}

const showProfileNavigation = computed(() => isPrivateRoute.value || ownerAuthenticated.value);
const publicNavActive = computed(() =>
  route.value.name === 'public' || route.value.name === 'detail',
);
const photosActive = computed(() =>
  route.value.name === 'photos' || route.value.name === 'photo-album',
);
const gamesActive = computed(() =>
  route.value.name === 'games',
);
const photoImmersiveActive = computed(() => photosActive.value);
const gameImmersiveActive = computed(() => gamesActive.value);
const immersiveActive = computed(() => photosActive.value || gamesActive.value);

function changePublicChannel(channel: JournalChannel): void {
  navigate(publicFeedPath(channel));
}

function openAbout(): void {
  navigate('/about');
}

function openPhotos(): void {
  navigate('/photos');
}

function openGames(): void {
  navigate('/games');
}

onMounted(() => {
  void session.load();
  void siteProfile.load();
});

onUnmounted(() => {
  disposeScrollRestoration();
  discoveryOverlay.dispose();
});
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'app-shell--photo-immersive': photoImmersiveActive,
      'app-shell--game-immersive': gameImmersiveActive,
    }"
  >
    <AppHeader
      v-if="!immersiveActive"
      :profile="profile"
      :profile-load-error="profileLoadError"
      :public-mode="publicShellActive"
      :show-navigation="showProfileNavigation"
      :public-nav-active="publicNavActive"
      :private-context="isPrivateRoute"
      :asset-active="isAssetRoute"
      :owner-authenticated="ownerAuthenticated"
      @navigate="navigate"
    />

    <div
      class="app-main"
      :class="{
        'app-main--public': publicShellActive,
        'app-main--photo-immersive': photoImmersiveActive,
        'app-main--game-immersive': gameImmersiveActive,
      }"
    >
      <PublicChannelNavigation
        v-if="publicShellActive"
        :key="immersiveActive ? 'immersive' : 'fixed'"
        :channel="publicFeedRoute?.channel ?? null"
        :about-active="route.name === 'about'"
        :photos-active="photosActive"
        :games-active="gamesActive"
        :immersive="immersiveActive"
        @select="changePublicChannel"
        @select-about="openAbout"
        @select-photos="openPhotos"
        @select-games="openGames"
      />

      <AppRouteViewport
        ref="routeViewport"
        class="app-route-viewport"
        :route="route"
        :routed-view-location="routedViewLocation"
        :owner-authenticated="ownerAuthenticated"
        :background-feed-route="backgroundFeedRoute"
        :overlay-entry-id="overlayEntryId"
        :overlay-entry="overlayEntry"
        :overlay-protected-entry="overlayProtectedEntry"
        :direct-private-overlay="directPrivateOverlay"
        :revealed-public-entries="revealedPublicEntries"
        :direct-public-overlay-entry="directPublicOverlayEntry"
        :feed-overlay-active="activeOverlayContext !== null"
        :active-discovery-overlay-context="activeDiscoveryOverlayContext"
        :discovery-background-route="discoveryBackgroundRoute"
        :rendered-discovery-access-scope="renderedDiscoveryAccessScope"
        :raw-not-found="currentRoute.name === 'not-found'"
        @layout-ready="restoreFeedScroll"
        @open-entry="openEntry"
        @close-overlay="closeOverlay"
        @remove-deleted-overlay="removeDeletedOverlay"
        @change-asset-view="changeAssetView"
        @change-page="changePrivatePage"
        @detail-loaded="handlePublicDetailLoaded"
        @detail-unlocked="handlePublicDetailUnlocked"
        @interactions-change="handlePublicInteractionsChange"
        @return-to-feed="returnFromDetail"
        @open-discovery-entry="openDiscoveryEntry"
        @close-discovery-overlay="closeDiscoveryOverlay"
        @discovery-detail-loaded="handleDiscoveryDetailLoaded"
        @discovery-detail-unlocked="handleDiscoveryDetailUnlocked"
        @select-discovery-tag="selectDiscoveryTag"
      />
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

.app-shell--photo-immersive,
.app-shell--game-immersive {
  --photo-canvas: #0c0c0c;
  --photo-surface: #171717;
  --photo-surface-hover: #222;
  --photo-text-primary: #fff;
  --photo-text-secondary: rgb(255 255 255 / 70%);
  --photo-text-muted: rgb(255 255 255 / 45%);
  --photo-glass-bg: rgb(20 20 20 / 75%);
  --photo-border: rgb(255 255 255 / 8%);
  --photo-gap: clamp(0.5rem, 0.8vw, 0.8rem);
  --photo-edge: clamp(1rem, 2.2vw, 2.5rem);
  --surface-page: var(--photo-canvas);
  --surface-card: var(--photo-surface);
  --surface-muted: var(--photo-surface-hover);
  --text-primary: var(--photo-text-primary);
  --text-muted: var(--photo-text-secondary);
  --border-subtle: var(--photo-border);
  --border-strong: rgb(255 255 255 / 18%);

  grid-template-rows: minmax(0, 1fr);
  background: var(--photo-canvas);
  color: var(--photo-text-primary);
}

.app-shell--game-immersive {
  background: #090a0f;
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

.app-main--photo-immersive,
.app-main--game-immersive {
  width: 100%;
  margin: 0;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  background: var(--photo-canvas);
}

.app-main--game-immersive {
  background: #090a0f;
}

.app-main--photo-immersive > .app-route-viewport,
.app-main--game-immersive > .app-route-viewport {
  grid-column: 1;
}

@media (max-width: 799px) {
  .app-main--public {
    width: 100%;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0;
  }

  .app-main--public > .app-route-viewport {
    grid-row: 1;
  }
}
</style>
