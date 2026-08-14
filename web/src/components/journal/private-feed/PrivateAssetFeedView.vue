<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, reactive, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useJournalErrorMessage } from '../../../composables/useJournalErrorMessage';
import { useJournalApi } from '../../../composables/useJournalApi';
import { usePrivateAssetTable } from '../../../composables/usePrivateAssetTable';
import { journalChannels } from '../../../journalChannels';
import { useSessionStore } from '../../../stores/session';
import {
  emptyFeedFilters,
  isProtectedJournalEntry,
  type AssetView,
  type FeedFilters,
  type JournalEntry,
  type JournalPlainChannel,
  type ProtectedJournalEntryPreview,
  type PublicJournalFeedItem,
} from '../../../types';
import { showMessage } from '../../../utils/message';
import JournalPullRefresh from '../../ui/JournalPullRefresh.vue';
import type { AccessSettingsInput } from '../accessSettings';
import AssetManagementToolbar from '../AssetManagementToolbar.vue';
import JournalDetailOverlay from '../JournalDetailOverlay.vue';
import LoginView from '../LoginView.vue';
import PrivateAssetHeader from '../PrivateAssetHeader.vue';
import PrivateAssetTableResults from '../PrivateAssetTableResults.vue';
import PrivateWaterfallResults from '../PrivateWaterfallResults.vue';
import PublishedTimeDialog from '../PublishedTimeDialog.vue';

const props = withDefaults(defineProps<{
  assetView: AssetView;
  page: number;
  overlayEntryId?: number;
  overlayEntry?: JournalEntry;
  overlayProtectedEntry?: ProtectedJournalEntryPreview;
  directOverlay?: boolean;
}>(), {
  overlayEntryId: undefined,
  overlayEntry: undefined,
  overlayProtectedEntry: undefined,
  directOverlay: false,
});

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: PublicJournalFeedItem];
  closeOverlay: [];
  removeDeletedOverlay: [];
  changeAssetView: [view: AssetView];
  changePage: [page: number];
}>();

const filters = reactive<FeedFilters>(emptyFeedFilters());
const session = useSessionStore();
const journal = useJournalApi();
const table = usePrivateAssetTable();
const router = useRouter();
const initialLoadPending = shallowRef(true);
const listReplacing = shallowRef(false);
const refreshing = shallowRef(false);
const authenticating = shallowRef(false);
const refreshRequestComplete = shallowRef(false);
const paginationLayoutPending = shallowRef(false);
const feedLayoutReady = shallowRef(false);
const tablePublishedTimeEntry = shallowRef<JournalEntry | null>(null);
const toolbarRevision = shallowRef(0);
const waterfallLoaded = shallowRef(false);
const tableLoaded = shallowRef(false);
let removeRouteAfterEach: (() => void) | null = null;

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
  || (props.directOverlay && journal.authenticationState.value === 'authenticated')
));
const feedEntries = computed<readonly JournalEntry[]>(() => journal.entries.value);
const paginationLoading = computed(() =>
  journal.loadingMore.value || paginationLayoutPending.value,
);
const entriesLoading = computed(() =>
  initialLoadPending.value || listReplacing.value || refreshing.value,
);
const paginationFailed = computed(() => journal.error.value !== null);
const infiniteLoading = computed(() => paginationLoading.value);
const infiniteFinished = computed(() =>
  journal.nextCursor.value === null || paginationFailed.value,
);
const infiniteDisabled = computed(() =>
  !feedLayoutReady.value
  || initialLoadPending.value
  || listReplacing.value
  || refreshing.value
  || paginationFailed.value,
);
const refreshDisabled = computed(() =>
  isOverlay.value
  || initialLoadPending.value
  || listReplacing.value
  || journal.loadingMore.value
  || paginationLayoutPending.value
  || (props.assetView === 'table' && table.loading.value)
  || journal.authenticationState.value !== 'authenticated',
);

watch(() => journal.authenticationState.value, (state) => {
  if (state !== 'checking') session.setAuthenticated(state === 'authenticated');
});

useJournalErrorMessage(journal.error, () =>
  feedEntries.value.length === 0
  || (isOverlay.value && currentOverlayEntry.value === null));

async function loadTablePage(page: number): Promise<void> {
  await table.load({ page, filters });
  if (table.error.value !== null) return;
  tableLoaded.value = true;
  const lastPage = Math.max(1, Math.ceil(table.total.value / table.pageSize));
  if (page > lastPage) emit('changePage', lastPage);
}

async function loadWaterfall(): Promise<void> {
  await journal.refreshPrivateFeed(filters);
  if (journal.error.value === null) waterfallLoaded.value = true;
}

async function loadPrivateResults(): Promise<void> {
  if (props.assetView === 'table') await loadTablePage(props.page);
  else await loadWaterfall();
}

function invalidateInactiveView(): void {
  if (props.assetView === 'table') waterfallLoaded.value = false;
  else tableLoaded.value = false;
}

async function loadDirectPrivateDetail(): Promise<void> {
  if (
    !props.directOverlay
    || props.overlayEntryId === undefined
    || journal.authenticationState.value !== 'authenticated'
  ) return;
  await journal.loadPrivateDetail(props.overlayEntryId);
}

onMounted(async () => {
  removeRouteAfterEach = router.afterEach((to, from) => {
    if (to.name !== 'private' || journal.authenticationState.value !== 'authenticated') return;
    const view = to.query.view === 'table' || to.query.view === 'waterfall'
      ? to.query.view
      : props.assetView;
    const previousView = from.query.view === 'table' || from.query.view === 'waterfall'
      ? from.query.view
      : props.assetView;
    const page = typeof to.query.page === 'string' ? Number(to.query.page) : 1;
    const previousPage = typeof from.query.page === 'string' ? Number(from.query.page) : 1;
    if (from.name === 'private' && view === previousView && page === previousPage) return;
    if (
      from.name === 'entry-edit'
      && !(window.history.state as { journalAssetChanged?: boolean } | null)?.journalAssetChanged
    ) return;
    if (view === 'table') {
      if (!tableLoaded.value || table.page.value !== page) void loadTablePage(page);
    }
    else if (!waterfallLoaded.value) void loadWaterfall();
  });
  try {
    await session.load();
    journal.setAuthenticationState(session.ownerAuthenticated);
    if (session.ownerAuthenticated) {
      await loadPrivateResults();
    }
    await loadDirectPrivateDetail();
  } finally {
    initialLoadPending.value = false;
  }
});

onActivated(async () => {
  if (
    initialLoadPending.value
    || journal.authenticationState.value !== 'authenticated'
  ) return;
  await loadDirectPrivateDetail();
});

onBeforeUnmount(() => {
  removeRouteAfterEach?.();
});

async function applyFilters(nextFilters: FeedFilters): Promise<void> {
  Object.assign(filters, nextFilters);
  waterfallLoaded.value = false;
  tableLoaded.value = false;
  feedLayoutReady.value = false;
  listReplacing.value = true;
  try {
    if (props.assetView === 'table') {
      if (props.page !== 1) emit('changePage', 1);
      else await loadTablePage(1);
    }
    else await loadWaterfall();
  } finally {
    listReplacing.value = false;
  }
}

async function loadMore(): Promise<void> {
  const previousEntryCount = feedEntries.value.length;
  paginationLayoutPending.value = true;

  await journal.loadMorePrivate(filters);

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
  if (props.assetView === 'table') {
    await loadTablePage(props.page);
    return;
  }

  feedLayoutReady.value = false;
  refreshing.value = true;
  refreshRequestComplete.value = false;

  await loadWaterfall();

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

async function authenticate(password: string): Promise<void> {
  feedLayoutReady.value = false;
  listReplacing.value = true;
  authenticating.value = true;
  try {
    await journal.authenticate(password);
  } finally {
    authenticating.value = false;
    listReplacing.value = false;
  }
}

function selectTag(tag: string): void {
  toolbarRevision.value += 1;
  void applyFilters({ ...filters, tag });
}

function isArticleEntry(entry: JournalEntry): boolean {
  return entry.bodyFormat === 'rich';
}

function editArticle(id: number): void {
  void router.push({
    name: 'article-edit',
    params: { articleId: id },
    state: { journalReturnPath: router.currentRoute.value.fullPath },
  });
}

function editDraft(entry: JournalEntry): void {
  void router.push({
    name: 'entry-edit',
    params: { entryId: entry.id },
    state: { journalReturnPath: router.currentRoute.value.fullPath },
  });
}

function editEntry(entry: JournalEntry): void {
  if (isArticleEntry(entry)) editArticle(entry.id);
  else editDraft(entry);
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
  if (entry.publicationStatus === 'draft') {
    editDraft(entry);
    return;
  }
  journal.selectDetail(entry);
  emit('openEntry', entry);
}

async function unlockDetail(password: string): Promise<void> {
  await journal.unlockDetail(password);
}

function changeAssetView(view: AssetView): void {
  feedLayoutReady.value = false;
  emit('changeAssetView', view);
}

function changeTablePage(page: number): void {
  emit('changePage', page);
}

function editTablePublishedTime(entry: JournalEntry): void {
  tablePublishedTimeEntry.value = entry;
}

async function saveTablePublishedTime(sourceCreatedAt: string): Promise<void> {
  const entry = tablePublishedTimeEntry.value;
  if (!entry) return;
  await setPublishedTime(entry, sourceCreatedAt);
  if (journal.error.value === null) tablePublishedTimeEntry.value = null;
}

async function saveContent(entry: JournalEntry, contentText: string): Promise<void> {
  await journal.saveContent(entry, contentText);
  if (journal.error.value === null) {
    invalidateInactiveView();
    feedLayoutReady.value = false;
    if (props.assetView === 'table') await loadTablePage(props.page);
    else await loadWaterfall();
  }
}

async function setPublishedTime(entry: JournalEntry, sourceCreatedAt: string): Promise<void> {
  await journal.setPublishedTime(entry, sourceCreatedAt);
  if (journal.error.value === null) {
    invalidateInactiveView();
    feedLayoutReady.value = false;
    if (props.assetView === 'table') await loadTablePage(props.page);
    else await loadWaterfall();
  }
}

async function saveAccessSettings(entry: JournalEntry, settings: AccessSettingsInput): Promise<void> {
  const updated = await journal.setVisibility(entry, settings.visibility, settings.accessPassword);
  if (!updated) return;

  invalidateInactiveView();
  const remainsVisible = filters.visibility === 'all' || filters.visibility === updated.visibility;
  if (props.assetView === 'table') {
    if (remainsVisible) table.replaceEntry(updated);
    else table.removeEntry(updated.id);
  }
  else if (!remainsVisible) {
    journal.removeEntryFromResults(updated.id);
  }
  showMessage({ message: '访问权限已更新', type: 'success' });
}

async function setPinned(entry: JournalEntry, pinned: boolean): Promise<void> {
  await journal.setPinned(entry, pinned);
  if (journal.error.value === null) {
    invalidateInactiveView();
    feedLayoutReady.value = false;
    if (props.assetView === 'table') await loadTablePage(props.page);
    else await loadWaterfall();
  }
}

async function setChannel(entry: JournalEntry, channel: JournalPlainChannel): Promise<void> {
  await journal.setChannel(entry, channel);
  if (journal.error.value === null) {
    invalidateInactiveView();
    const target = journalChannels.find(item => item.value === channel)!;
    showMessage({ message: `已移动到“${target.label}”频道`, type: 'success' });
    if (props.assetView === 'table') await loadTablePage(props.page);
  }
}

async function deleteEntry(entry: JournalEntry): Promise<void> {
  await journal.deleteEntry(entry);
  if (journal.error.value === null) invalidateInactiveView();
  if (journal.error.value === null && props.assetView === 'table') {
    await loadTablePage(props.page);
  }
  if (journal.error.value === null && props.overlayEntryId === entry.id) emit('removeDeletedOverlay');
}
</script>

<template>
  <JournalPullRefresh
    v-model="refreshing"
    :class="{ 'feed__pull-refresh--table': assetView === 'table' }"
    :disabled="refreshDisabled"
    @refresh="refreshFeed"
  >
    <main
      class="feed"
      :class="{ 'feed--private-table': assetView === 'table' }"
    >
      <PrivateAssetHeader
        :authenticated="session.authenticationChecked && session.ownerAuthenticated"
        :refreshing="refreshing"
        :refresh-disabled="refreshDisabled"
        @refresh="refreshFeed"
        @create-entry="router.push({ name: 'entry-new' })"
        @create-article="router.push({ name: 'article-new' })"
        @open-settings="router.push({ name: 'settings' })"
      />

      <LoginView
        v-if="session.authenticationChecked && !session.ownerAuthenticated"
        :busy="authenticating"
        @login="authenticate"
      />

      <AssetManagementToolbar
        v-if="session.authenticationChecked && session.ownerAuthenticated"
        :key="toolbarRevision"
        :filters="filters"
        :view="assetView"
        @apply="applyFilters"
        @change-view="changeAssetView"
      />

      <div
        v-if="session.authenticationChecked && session.ownerAuthenticated"
        class="feed__entries"
      >
        <PrivateWaterfallResults
          v-if="assetView === 'waterfall'"
          :entries="journal.entries.value"
          :loading="entriesLoading"
          :loading-more="paginationLoading"
          :finished="infiniteFinished"
          :disabled="infiniteDisabled"
          :mutation-entry-id="journal.mutationEntryId.value"
          @load="loadMore"
          @layout-ready="handleLayoutReady"
          @open-entry="openEntry"
          @continue-draft="editDraft"
          @select-tag="selectTag"
          @edit-article="editArticle"
          @save-content="saveContent"
          @set-published-time="setPublishedTime"
          @save-access-settings="saveAccessSettings"
          @set-pinned="setPinned"
          @set-channel="setChannel"
          @delete-entry="deleteEntry"
        />
        <PrivateAssetTableResults
          v-else
          :entries="table.entries.value"
          :page="page"
          :page-size="table.pageSize"
          :total="table.total.value"
          :loading="entriesLoading || table.loading.value"
          :error="table.error.value"
          :mutation-entry-id="journal.mutationEntryId.value"
          @change-page="changeTablePage"
          @view="openEntry"
          @edit="editEntry"
          @edit-published-time="editTablePublishedTime"
          @set-pinned="setPinned"
          @save-access-settings="saveAccessSettings"
          @delete-entry="deleteEntry"
          @select-tag="selectTag"
          @set-channel="setChannel"
        />
      </div>
    </main>
  </JournalPullRefresh>

  <JournalDetailOverlay
    v-if="overlayVisible"
    :entry="currentOverlayEntry ?? undefined"
    :protected-entry="overlayProtectedEntry && journal.protectedDetail.value?.publicId === overlayProtectedEntry.publicId
      ? journal.protectedDetail.value
      : undefined"
    mode="private"
    :busy="currentOverlayEntry !== null && journal.mutationEntryId.value === currentOverlayEntry.id"
    :loading="(directOverlay || overlayProtectedEntry !== undefined) && journal.loading.value"
    :unlocking="journal.unlocking.value"
    :unlock-error="journal.unlockError.value"
    @close="emit('closeOverlay')"
    @unlock="unlockDetail"
    @select-tag="selectTag"
    @edit="editArticle($event.id)"
    @continue-draft="editDraft"
    @save-content="saveContent"
    @set-published-time="setPublishedTime"
    @save-access-settings="saveAccessSettings"
    @set-pinned="setPinned"
    @set-channel="setChannel"
    @delete-entry="deleteEntry"
  />

  <PublishedTimeDialog
    v-if="tablePublishedTimeEntry"
    :source-created-at="tablePublishedTimeEntry.sourceCreatedAt"
    :busy="journal.mutationEntryId.value === tablePublishedTimeEntry.id"
    @close="tablePublishedTimeEntry = null"
    @save="saveTablePublishedTime"
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

.feed__pull-refresh--table {
  height: 100%;
  min-height: 0;
}

.feed--private-table {
  height: 100%;
  min-height: 0;
  grid-template-rows: auto auto minmax(0, 1fr);
  padding-bottom: 1.3rem;
  overflow: hidden;
}

.feed--private-table .feed__entries {
  min-height: 0;
}

.feed__entries {
  display: grid;
  gap: 0.75rem;
}
</style>
