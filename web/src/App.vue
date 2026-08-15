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

function changePublicChannel(channel: JournalChannel): void {
  navigate(publicFeedPath(channel));
}

function openAbout(): void {
  navigate('/about');
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
  <div class="app-shell">
    <AppHeader
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

    <div class="app-main" :class="{ 'app-main--public': publicShellActive }">
      <PublicChannelNavigation
        v-if="publicShellActive"
        :channel="publicFeedRoute?.channel ?? null"
        :about-active="route.name === 'about'"
        @select="changePublicChannel"
        @select-about="openAbout"
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
