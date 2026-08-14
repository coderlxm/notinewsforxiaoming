<script setup lang="ts">
import { computed } from 'vue';
import type {
  AssetView,
  JournalChannel,
  JournalEntry,
  ProtectedJournalEntryPreview,
  PublicJournalFeedItem,
} from '../../types';
import PrivateAssetFeedView from './private-feed/PrivateAssetFeedView.vue';
import PublicEntryDetailView from './public-detail/PublicEntryDetailView.vue';
import PublicFeedView from './public-feed/PublicFeedView.vue';

const props = withDefaults(defineProps<{
  mode: 'public' | 'private';
  detailId?: string;
  initialTag?: string;
  channel?: JournalChannel;
  overlayEntryId?: number;
  overlayEntry?: JournalEntry;
  overlayProtectedEntry?: ProtectedJournalEntryPreview;
  revealedPublicEntries?: ReadonlyMap<string, JournalEntry>;
  directOverlay?: boolean;
  assetView?: AssetView;
  page?: number;
}>(), {
  detailId: undefined,
  initialTag: '',
  channel: 'life',
  overlayEntryId: undefined,
  overlayEntry: undefined,
  overlayProtectedEntry: undefined,
  revealedPublicEntries: undefined,
  directOverlay: false,
  assetView: 'waterfall',
  page: 1,
});

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: PublicJournalFeedItem];
  detailLoaded: [entry: JournalEntry];
  detailUnlocked: [entry: JournalEntry];
  closeOverlay: [];
  removeDeletedOverlay: [];
  returnToFeed: [];
  changeAssetView: [view: AssetView];
  changePage: [page: number];
}>();

const isDetail = computed(() => props.mode === 'public' && props.detailId !== undefined);
</script>

<template>
  <PrivateAssetFeedView
    v-if="mode === 'private'"
    :asset-view="assetView"
    :page="page"
    :overlay-entry-id="overlayEntryId"
    :overlay-entry="overlayEntry"
    :overlay-protected-entry="overlayProtectedEntry"
    :direct-overlay="directOverlay"
    @layout-ready="emit('layoutReady')"
    @open-entry="emit('openEntry', $event)"
    @close-overlay="emit('closeOverlay')"
    @remove-deleted-overlay="emit('removeDeletedOverlay')"
    @change-asset-view="emit('changeAssetView', $event)"
    @change-page="emit('changePage', $event)"
  />
  <PublicEntryDetailView
    v-else-if="isDetail"
    :detail-id="detailId as string"
    @detail-loaded="emit('detailLoaded', $event)"
    @detail-unlocked="emit('detailUnlocked', $event)"
    @return-to-feed="emit('returnToFeed')"
  />
  <PublicFeedView
    v-else
    :channel="channel"
    :initial-tag="initialTag"
    :overlay-entry-id="overlayEntryId"
    :overlay-entry="overlayEntry"
    :overlay-protected-entry="overlayProtectedEntry"
    :revealed-public-entries="revealedPublicEntries"
    @layout-ready="emit('layoutReady')"
    @open-entry="emit('openEntry', $event)"
    @close-overlay="emit('closeOverlay')"
    @remove-deleted-overlay="emit('removeDeletedOverlay')"
  />
</template>
