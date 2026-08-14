<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { useJournalErrorMessage } from '../../../composables/useJournalErrorMessage';
import { useJournalApi } from '../../../composables/useJournalApi';
import { journalChannels, publicFeedPath } from '../../../journalChannels';
import { useSiteProfileStore } from '../../../stores/siteProfile';
import {
  isProtectedJournalEntry,
  type JournalChannel,
  type JournalEntry,
  type ProtectedJournalEntryPreview,
  type PublicJournalFeedItem,
} from '../../../types';
import JournalPullRefresh from '../../ui/JournalPullRefresh.vue';
import JournalDetailOverlay from '../JournalDetailOverlay.vue';
import PublicFeedHeader from './PublicFeedHeader.vue';
import PublicFeedResults from './PublicFeedResults.vue';

const props = defineProps<{
  channel: JournalChannel;
  initialTag: string;
  overlayEntryId?: number;
  overlayEntry?: JournalEntry;
  overlayProtectedEntry?: ProtectedJournalEntryPreview;
  revealedPublicEntries?: ReadonlyMap<string, JournalEntry>;
}>();

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: PublicJournalFeedItem];
  closeOverlay: [];
  removeDeletedOverlay: [];
}>();

const journal = useJournalApi();
const router = useRouter();
const siteProfile = useSiteProfileStore();
const initialLoadPending = shallowRef(true);
const refreshing = shallowRef(false);
const refreshRequestComplete = shallowRef(false);
const paginationLayoutPending = shallowRef(false);
const feedLayoutReady = shallowRef(false);

const isOverlay = computed(() =>
  props.overlayEntryId !== undefined || props.overlayProtectedEntry !== undefined,
);
const currentOverlayEntry = computed(() => {
  if (props.overlayProtectedEntry) {
    return journal.detail.value?.publicId === props.overlayProtectedEntry.publicId
      ? journal.detail.value
      : null;
  }
  if (props.overlayEntryId === undefined) return null;
  const currentEntry = journal.entries.value.find(entry => entry.id === props.overlayEntryId)
    ?? (journal.detail.value?.id === props.overlayEntryId ? journal.detail.value : null);
  if (currentEntry) return currentEntry;
  if (props.overlayEntry?.id === props.overlayEntryId) return props.overlayEntry;
  return null;
});
const overlayVisible = computed(() => isOverlay.value && (
  currentOverlayEntry.value !== null
  || props.overlayProtectedEntry !== undefined
));
const feedEntries = computed<readonly PublicJournalFeedItem[]>(() => {
  const revealedEntries = props.revealedPublicEntries;
  if (!revealedEntries?.size) return journal.publicEntries.value;
  return journal.publicEntries.value.map(entry => revealedEntries.get(entry.publicId) ?? entry);
});
const publicChannelTags = computed<readonly string[]>(() => {
  if (siteProfile.profile === null) return [];
  return siteProfile.profile.channelTags[props.channel];
});
const publicLayout = computed(() =>
  journalChannels.find(item => item.value === props.channel)!.layout,
);
const paginationLoading = computed(() =>
  journal.loadingMore.value || paginationLayoutPending.value,
);
const entriesLoading = computed(() =>
  initialLoadPending.value || refreshing.value,
);
const paginationFailed = computed(() => journal.error.value !== null);
const infiniteLoading = computed(() => paginationLoading.value);
const infiniteFinished = computed(() =>
  journal.nextCursor.value === null || paginationFailed.value,
);
const infiniteDisabled = computed(() =>
  !feedLayoutReady.value
  || initialLoadPending.value
  || refreshing.value
  || paginationFailed.value,
);
const refreshDisabled = computed(() =>
  isOverlay.value
  || initialLoadPending.value
  || journal.loadingMore.value
  || paginationLayoutPending.value,
);

useJournalErrorMessage(journal.error, () =>
  feedEntries.value.length === 0
  || (isOverlay.value && currentOverlayEntry.value === null));

onMounted(async () => {
  try {
    await journal.loadPublic({ channel: props.channel, tag: props.initialTag });
  } finally {
    initialLoadPending.value = false;
  }
});

function isArticleEntry(entry: PublicJournalFeedItem): entry is JournalEntry {
  return !isProtectedJournalEntry(entry) && entry.bodyFormat === 'rich';
}

function selectTag(tag: string): void {
  void router.push(publicFeedPath(props.channel, tag));
}

function selectPublicChannelTag(tag: string): void {
  if (tag === props.initialTag) return;
  void router.push(publicFeedPath(props.channel, tag));
}

function openEntry(entry: PublicJournalFeedItem): void {
  if (isProtectedJournalEntry(entry)) {
    if (entry.entryType === 'record') {
      journal.selectProtectedDetail(entry);
      emit('openEntry', entry);
      return;
    }
    void router.push({
      name: 'detail',
      params: { publicId: entry.publicId },
      state: {
        journalDetailFromFeed: true,
        journalProtectedPreview: entry,
      },
    });
    return;
  }
  if (isArticleEntry(entry)) {
    void router.push({
      name: 'detail',
      params: { publicId: entry.publicId },
      state: { journalDetailFromFeed: true },
    });
    return;
  }
  journal.selectDetail(entry);
  emit('openEntry', entry);
}

async function unlockDetail(password: string): Promise<void> {
  await journal.unlockDetail(password);
}

async function loadMore(): Promise<void> {
  const previousEntryCount = feedEntries.value.length;
  paginationLayoutPending.value = true;

  await journal.loadMorePublic({ channel: props.channel, tag: props.initialTag });

  if (journal.error.value || feedEntries.value.length === previousEntryCount) {
    paginationLayoutPending.value = false;
  }
}

function finishRefresh(): void {
  refreshRequestComplete.value = false;
  refreshing.value = false;
}

function finishRefreshIfReady(): void {
  if (!refreshRequestComplete.value || !feedLayoutReady.value) return;
  finishRefresh();
}

async function refreshFeed(): Promise<void> {
  feedLayoutReady.value = false;
  refreshing.value = true;
  refreshRequestComplete.value = false;

  await journal.loadPublic({ channel: props.channel, tag: props.initialTag });

  refreshRequestComplete.value = true;
  if (journal.error.value || feedEntries.value.length === 0) {
    finishRefresh();
    return;
  }
  finishRefreshIfReady();
}

async function handleLayoutReady(): Promise<void> {
  emit('layoutReady');
  if (paginationLayoutPending.value && !journal.loadingMore.value) {
    paginationLayoutPending.value = false;
  }
  if (!feedLayoutReady.value) {
    await nextTick();
    feedLayoutReady.value = true;
  }
  finishRefreshIfReady();
}
</script>

<template>
  <JournalPullRefresh
    v-model="refreshing"
    :disabled="refreshDisabled"
    @refresh="refreshFeed"
  >
    <main class="feed feed--public">
      <PublicFeedHeader
        :tags="publicChannelTags"
        :active-tag="initialTag"
        :refreshing="refreshing"
        :refresh-disabled="refreshDisabled"
        @select="selectPublicChannelTag"
        @open-archive="router.push('/archive')"
        @refresh="refreshFeed"
      />

      <PublicFeedResults
        :entries="feedEntries"
        :loading="entriesLoading"
        :loading-more="paginationLoading"
        :finished="infiniteFinished"
        :disabled="infiniteDisabled"
        :layout="publicLayout"
        :initial-loading="initialLoadPending"
        :error="journal.error.value"
        :initial-tag="initialTag"
        :mutation-entry-id="journal.mutationEntryId.value"
        @load="loadMore"
        @layout-ready="handleLayoutReady"
        @open-entry="openEntry"
        @select-tag="selectTag"
      />
    </main>
  </JournalPullRefresh>

  <JournalDetailOverlay
    v-if="overlayVisible"
    :entry="currentOverlayEntry ?? undefined"
    :protected-entry="overlayProtectedEntry && journal.protectedDetail.value?.publicId === overlayProtectedEntry.publicId
      ? journal.protectedDetail.value
      : undefined"
    mode="public"
    :busy="currentOverlayEntry !== null && journal.mutationEntryId.value === currentOverlayEntry.id"
    :loading="overlayProtectedEntry !== undefined && journal.loading.value"
    :unlocking="journal.unlocking.value"
    :unlock-error="journal.unlockError.value"
    @close="emit('closeOverlay')"
    @unlock="unlockDetail"
    @select-tag="selectTag"
  />
</template>

<style scoped>
.feed {
  display: grid;
  gap: 1rem;
  width: min(calc(100% - (var(--workspace-gutter) * 2)), var(--workspace-width));
  margin: 0 auto;
  padding: 1.3rem 0 4rem;
}

.feed--public {
  width: 100%;
}

@media (max-width: 599px) {
  .feed--public {
    gap: 0.55rem;
    padding-top: 0.65rem;
  }
}

@media (max-width: 799px) {
  .feed--public {
    width: calc(100% - (var(--workspace-gutter) * 2));
  }
}
</style>
