<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { RouterView, type RouteLocationNormalizedLoaded } from 'vue-router';
import { PUBLIC_FEED_CACHE_LIMIT } from '../../app/appRoute';
import type {
  AppRoute,
  DiscoveryOverlayContext,
  DiscoveryRoute,
  FeedRoute,
} from '../../app/appRouteTypes';
import type {
  AssetView,
  JournalChannel,
  JournalDiscoveryListItem,
  JournalEntry,
  ProtectedJournalEntryPreview,
  PublicJournalFeedItem,
} from '../../types';
import NotFoundView from '../NotFoundView.vue';
import PublicDiscoveryDetailOverlay from '../discovery/PublicDiscoveryDetailOverlay.vue';

defineProps<{
  route: AppRoute;
  routedViewLocation: RouteLocationNormalizedLoaded;
  ownerAuthenticated: boolean;
  backgroundFeedRoute: FeedRoute | null;
  overlayEntryId: number | undefined;
  overlayEntry: JournalEntry | undefined;
  overlayProtectedEntry: ProtectedJournalEntryPreview | undefined;
  directPrivateOverlay: boolean;
  revealedPublicEntries: ReadonlyMap<string, JournalEntry>;
  directPublicOverlayEntry: JournalEntry | null;
  feedOverlayActive: boolean;
  activeDiscoveryOverlayContext: DiscoveryOverlayContext | null;
  discoveryBackgroundRoute: DiscoveryRoute | null;
  renderedDiscoveryAccessScope: string;
  rawNotFound: boolean;
}>();

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: PublicJournalFeedItem];
  closeOverlay: [];
  removeDeletedOverlay: [];
  changeAssetView: [view: AssetView];
  changePage: [page: number];
  detailLoaded: [entry: JournalEntry];
  detailUnlocked: [entry: JournalEntry];
  returnToFeed: [];
  openDiscoveryEntry: [entry: JournalDiscoveryListItem];
  closeDiscoveryOverlay: [];
  discoveryDetailLoaded: [entry: JournalEntry];
  discoveryDetailUnlocked: [entry: JournalEntry];
  selectDiscoveryTag: [channel: JournalChannel, tag: string];
}>();

const scrollContainer = useTemplateRef<HTMLDivElement>('scrollContainer');

defineExpose({ scrollContainer });

function forwardDiscoveryTag(channel: JournalChannel, tag: string): void {
  emit('selectDiscoveryTag', channel, tag);
}
</script>

<template>
  <div ref="scrollContainer" class="app-scroll">
    <RouterView v-slot="{ Component }" :route="routedViewLocation">
      <KeepAlive v-if="ownerAuthenticated" :max="1">
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
          @layout-ready="emit('layoutReady')"
          @change-asset-view="emit('changeAssetView', $event)"
          @change-page="emit('changePage', $event)"
          @open-entry="emit('openEntry', $event)"
          @close-overlay="emit('closeOverlay')"
          @remove-deleted-overlay="emit('removeDeletedOverlay')"
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
        @layout-ready="emit('layoutReady')"
        @change-asset-view="emit('changeAssetView', $event)"
        @change-page="emit('changePage', $event)"
        @open-entry="emit('openEntry', $event)"
        @close-overlay="emit('closeOverlay')"
        @remove-deleted-overlay="emit('removeDeletedOverlay')"
      />

      <KeepAlive v-if="ownerAuthenticated" :max="PUBLIC_FEED_CACHE_LIMIT">
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
          @layout-ready="emit('layoutReady')"
          @open-entry="emit('openEntry', $event)"
          @close-overlay="emit('closeOverlay')"
          @remove-deleted-overlay="emit('removeDeletedOverlay')"
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
          @layout-ready="emit('layoutReady')"
          @open-entry="emit('openEntry', $event)"
          @close-overlay="emit('closeOverlay')"
          @remove-deleted-overlay="emit('removeDeletedOverlay')"
        />
      </KeepAlive>

      <component
        :is="Component"
        v-if="route.name === 'detail'
          && !feedOverlayActive
          && !activeDiscoveryOverlayContext
          && !directPublicOverlayEntry"
        :key="route.key"
        mode="public"
        :detail-id="route.publicId"
        @detail-loaded="emit('detailLoaded', $event)"
        @detail-unlocked="emit('detailUnlocked', $event)"
        @return-to-feed="emit('returnToFeed')"
      />
      <component
        :is="Component"
        v-else-if="discoveryBackgroundRoute"
        :key="`${discoveryBackgroundRoute.key}:${renderedDiscoveryAccessScope}`"
        :access-scope="renderedDiscoveryAccessScope"
        @layout-ready="emit('layoutReady')"
        @open-entry="emit('openDiscoveryEntry', $event)"
      />
      <NotFoundView
        v-else-if="route.name === 'not-found' && !rawNotFound"
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
      @close="emit('closeDiscoveryOverlay')"
      @loaded="emit('discoveryDetailLoaded', $event)"
      @unlocked="emit('discoveryDetailUnlocked', $event)"
      @select-tag="forwardDiscoveryTag"
    />
  </div>
</template>

<style scoped>
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
</style>
