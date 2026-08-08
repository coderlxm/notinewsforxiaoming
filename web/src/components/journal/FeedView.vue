<script setup lang="ts">
import { List } from 'vant';
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, reactive, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import ArticleCardContent from '../article/ArticleCardContent.vue';
import PublicArticleFeed from '../article/PublicArticleFeed.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import JournalPullRefresh from '../ui/JournalPullRefresh.vue';
import { useDeferredLoading } from '../../composables/useDeferredLoading';
import { useJournalApi } from '../../composables/useJournalApi';
import { usePrivateAssetTable } from '../../composables/usePrivateAssetTable';
import { journalChannels, publicFeedPath } from '../../journalChannels';
import { useSessionStore } from '../../stores/session';
import { useSiteProfileStore } from '../../stores/siteProfile';
import {
  emptyFeedFilters,
  type AssetView,
  type FeedFilters,
  type JournalChannel,
  type JournalEntry,
  type JournalPlainChannel,
  type JournalVisibility,
} from '../../types';
import { showMessage } from '../../utils/message';
import AssetManagementToolbar from './AssetManagementToolbar.vue';
import EntryCard from './EntryCard.vue';
import JournalDetailOverlay from './JournalDetailOverlay.vue';
import LoginView from './LoginView.vue';
import PrivateAssetHeader from './PrivateAssetHeader.vue';
import PrivateAssetTableResults from './PrivateAssetTableResults.vue';
import PrivateWaterfallResults from './PrivateWaterfallResults.vue';
import PublicChannelTagNavigation from './PublicChannelTagNavigation.vue';
import PublishedTimeDialog from './PublishedTimeDialog.vue';
import WaterfallFeed from './WaterfallFeed.vue';

const props = withDefaults(defineProps<{
  mode: 'public' | 'private';
  detailId?: string;
  initialTag?: string;
  channel?: JournalChannel;
  overlayEntryId?: number;
  overlayEntry?: JournalEntry;
  directOverlay?: boolean;
  assetView?: AssetView;
  page?: number;
}>(), {
  detailId: undefined,
  initialTag: '',
  channel: 'life',
  overlayEntryId: undefined,
  overlayEntry: undefined,
  directOverlay: false,
  assetView: 'waterfall',
  page: 1,
});

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: JournalEntry];
  detailLoaded: [entry: JournalEntry];
  closeOverlay: [];
  removeDeletedOverlay: [];
  returnToFeed: [];
  changeAssetView: [view: AssetView];
  changePage: [page: number];
}>();

const filters = reactive<FeedFilters>({
  ...emptyFeedFilters(),
  tag: props.initialTag,
});
const journal = useJournalApi();
const table = usePrivateAssetTable();
const router = useRouter();
const session = useSessionStore();
const siteProfile = useSiteProfileStore();
const initialLoadPending = shallowRef(true);
const listReplacing = shallowRef(false);
const refreshing = shallowRef(false);
const refreshRequestComplete = shallowRef(false);
const paginationLayoutPending = shallowRef(false);
const feedLayoutReady = shallowRef(false);
const tablePublishedTimeEntry = shallowRef<JournalEntry | null>(null);
const toolbarRevision = shallowRef(0);
const waterfallLoaded = shallowRef(false);
const tableLoaded = shallowRef(false);
let terminalErrorMessage: ReturnType<typeof showMessage> | null = null;
let removeRouteAfterEach: (() => void) | null = null;

const isDetail = computed(() => props.mode === 'public' && props.detailId !== undefined);
const isOverlay = computed(() => props.overlayEntryId !== undefined);
const currentOverlayEntry = computed(() => {
  if (props.overlayEntryId === undefined) return null;
  const currentEntry = journal.entries.value.find(entry => entry.id === props.overlayEntryId)
    ?? (journal.detail.value?.id === props.overlayEntryId ? journal.detail.value : null);
  if (currentEntry) return currentEntry;
  if (props.overlayEntry?.id === props.overlayEntryId) return props.overlayEntry;
  return null;
});
const overlayVisible = computed(() => isOverlay.value && (
  currentOverlayEntry.value !== null
  || (props.directOverlay && journal.authenticationState.value === 'authenticated')
));
const detailPreparing = computed(() => isDetail.value && initialLoadPending.value);
const deferredDetailLoading = useDeferredLoading(detailPreparing);
const publicChannelTags = computed<readonly string[]>(() => {
  if (siteProfile.profile === null) return [];
  return siteProfile.profile.channelTags[props.channel];
});
const publicTagNavigationVisible = computed(() =>
  publicChannelTags.value.length > 0 || props.initialTag.length > 0,
);
const publicLayout = computed(() =>
  journalChannels.find(item => item.value === props.channel)!.layout,
);
const paginationLoading = computed(() =>
  journal.loadingMore.value || paginationLayoutPending.value,
);
const entriesLoading = computed(() =>
  initialLoadPending.value || listReplacing.value || refreshing.value,
);
const paginationFailed = computed(() => journal.error.value !== null);
const paginationFinishedText = computed(() =>
  props.mode === 'public' && props.channel === 'article'
    ? '已经看到全部文章'
    : '已经看到全部记录',
);
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
  isDetail.value
  || isOverlay.value
  || initialLoadPending.value
  || listReplacing.value
  || journal.loadingMore.value
  || paginationLayoutPending.value
  || (props.mode === 'private' && props.assetView === 'table' && table.loading.value)
  || (props.mode === 'private' && journal.authenticationState.value !== 'authenticated'),
);

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

watch(() => journal.authenticationState.value, (state) => {
  if (state !== 'checking') session.setAuthenticated(state === 'authenticated');
});

watch(() => journal.error.value, (error) => {
  if (!error) {
    terminalErrorMessage?.close();
    terminalErrorMessage = null;
    return;
  }
  const terminal = isDetail.value
    || journal.entries.value.length === 0
    || (isOverlay.value && currentOverlayEntry.value === null);
  if (terminal) {
    terminalErrorMessage?.close();
    terminalErrorMessage = showMessage({ message: error, type: 'error', duration: 0 });
    return;
  }
  terminalErrorMessage?.close();
  terminalErrorMessage = null;
  showMessage({ message: error, type: 'error' });
});

async function loadDirectPrivateDetail(): Promise<void> {
  if (
    !props.directOverlay
    || props.overlayEntryId === undefined
    || journal.authenticationState.value !== 'authenticated'
  ) return;
  await journal.loadPrivateDetail(props.overlayEntryId);
}

onMounted(async () => {
  if (props.mode === 'private') {
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
  }
  try {
    if (isDetail.value) {
      await journal.loadPublicDetail(props.detailId as string);
      if (journal.detail.value) emit('detailLoaded', journal.detail.value);
      return;
    }
    if (props.mode === 'public') {
      await journal.loadPublic({ channel: props.channel, tag: props.initialTag });
      return;
    }
    await journal.loadPrivateContext();
    if (journal.authenticationState.value === 'authenticated') {
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
    || props.mode !== 'private'
    || journal.authenticationState.value !== 'authenticated'
  ) return;
  await loadDirectPrivateDetail();
});

onBeforeUnmount(() => {
  terminalErrorMessage?.close();
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
  const previousEntryCount = journal.entries.value.length;
  paginationLayoutPending.value = true;

  if (props.mode === 'public') {
    await journal.loadMorePublic({ channel: props.channel, tag: props.initialTag });
  }
  else {
    await journal.loadMorePrivate(filters);
  }

  if (journal.error.value || journal.entries.value.length === previousEntryCount) {
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
  if (props.mode === 'private' && props.assetView === 'table') {
    await loadTablePage(props.page);
    return;
  }

  feedLayoutReady.value = false;
  refreshing.value = true;
  refreshRequestComplete.value = false;

  if (props.mode === 'public') {
    await journal.loadPublic({ channel: props.channel, tag: props.initialTag });
  }
  else await loadWaterfall();

  refreshRequestComplete.value = true;
  if (journal.error.value || journal.entries.value.length === 0) {
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
  try {
    await journal.authenticate(password);
    if (journal.authenticationState.value === 'authenticated') {
      await loadPrivateResults();
    }
    await loadDirectPrivateDetail();
  } finally {
    listReplacing.value = false;
  }
}

async function selectTag(tag: string): Promise<void> {
  if (props.mode === 'public') {
    const channel = isDetail.value ? journal.detail.value!.channel : props.channel;
    await router.push(publicFeedPath(channel, tag));
    return;
  }
  toolbarRevision.value += 1;
  await applyFilters({ ...filters, tag });
}

async function selectPublicChannelTag(tag: string): Promise<void> {
  if (tag === props.initialTag) return;
  await router.push(publicFeedPath(props.channel, tag));
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

function openEntry(entry: JournalEntry): void {
  if (props.mode === 'private' && entry.publicationStatus === 'draft') {
    editDraft(entry);
    return;
  }
  if (props.mode === 'public' && isArticleEntry(entry)) {
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

function isArticleEntry(entry: JournalEntry): boolean {
  return entry.bodyFormat === 'rich';
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

async function setVisibility(entry: JournalEntry, visibility: JournalVisibility): Promise<void> {
  await journal.setVisibility(entry, visibility);
  if (journal.error.value === null) {
    invalidateInactiveView();
    feedLayoutReady.value = false;
    if (props.assetView === 'table') await loadTablePage(props.page);
    else await loadWaterfall();
  }
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
    :class="{ 'feed__pull-refresh--table': mode === 'private' && assetView === 'table' }"
    :allow-overflow="isDetail"
    :disabled="refreshDisabled"
    @refresh="refreshFeed"
  >
    <main
      class="feed"
      :class="{
        'feed--detail': isDetail,
        'feed--public': mode === 'public',
        'feed--private-table': mode === 'private' && assetView === 'table',
      }"
    >
      <div v-if="isDetail" class="feed__detail-heading">
        <button class="text-button" type="button" @click="emit('returnToFeed')">← 返回信息流</button>
        <span>永久记录</span>
      </div>

      <template v-else-if="mode === 'private'">
        <PrivateAssetHeader
          :authenticated="journal.authenticationState.value === 'authenticated'"
          :refreshing="refreshing"
          :refresh-disabled="refreshDisabled"
          @refresh="refreshFeed"
          @create-entry="router.push({ name: 'entry-new' })"
          @create-article="router.push({ name: 'article-new' })"
          @open-settings="router.push({ name: 'settings' })"
        />
      </template>

      <div
        v-else-if="!isDetail"
        class="feed__public-intro"
        :class="{ 'feed__public-intro--without-tags': !publicTagNavigationVisible }"
      >
        <div class="feed__public-heading">
          <PublicChannelTagNavigation
            class="feed__public-tags"
            :tags="publicChannelTags"
            :active-tag="initialTag"
            @select="selectPublicChannelTag"
          />
          <button
            class="text-button feed__public-refresh"
            type="button"
            :disabled="refreshDisabled || refreshing"
            :aria-busy="refreshing"
            @click="refreshFeed"
          >
            <JournalLoading v-if="refreshing" variant="inline" label="刷新中…" />
            <template v-else>刷新</template>
          </button>
        </div>
      </div>

      <LoginView
        v-if="mode === 'private' && journal.authenticationState.value === 'anonymous'"
        :busy="journal.loading.value"
        @login="authenticate"
      />

      <AssetManagementToolbar
        v-if="mode === 'private' && journal.authenticationState.value !== 'anonymous'"
        :key="toolbarRevision"
        :filters="filters"
        :view="assetView"
        @apply="applyFilters"
        @change-view="changeAssetView"
      />

      <div v-if="isDetail" class="feed__reading-stage" :aria-busy="detailPreparing">
        <Transition name="feed-stage" mode="out-in">
          <JournalLoading v-if="deferredDetailLoading.visible.value && !journal.error.value" key="loading" variant="reading" label="正在展开记录…" />
          <ArticleCardContent
            v-else-if="journal.detail.value && isArticleEntry(journal.detail.value)"
            key="article-detail"
            :entry="journal.detail.value"
            :linkable="false"
            display="full"
            anchored
            show-year
            @select-tag="selectTag"
          />
          <EntryCard
            v-else-if="journal.detail.value"
            key="entry-detail"
            :entry="journal.detail.value"
            :linkable="false"
            show-year
            @select-tag="selectTag"
            @open-entry="openEntry"
            @continue-draft="editDraft"
            @save-content="saveContent"
            @set-published-time="setPublishedTime"
            @set-visibility="setVisibility"
            @set-pinned="setPinned"
            @delete-entry="deleteEntry"
          />
          <div v-else key="reserve" class="feed__reading-reserve" aria-hidden="true"></div>
        </Transition>
      </div>

      <div v-else-if="mode === 'public'" class="feed__entries">
        <List
          class="feed__infinite-list"
          :loading="infiniteLoading"
          :finished="infiniteFinished"
          :disabled="infiniteDisabled"
          :immediate-check="false"
          :offset="320"
          @load="loadMore"
        >
          <PublicArticleFeed
            v-if="mode === 'public' && publicLayout === 'article'"
            :entries="journal.entries.value"
            :loading="entriesLoading"
            @layout-ready="handleLayoutReady"
            @open-entry="openEntry"
            @select-tag="selectTag"
          />
          <WaterfallFeed
            v-else
            :entries="journal.entries.value"
            :loading="entriesLoading"
            :mode="mode"
            :mutation-entry-id="journal.mutationEntryId.value"
            @layout-ready="handleLayoutReady"
            @open-entry="openEntry"
            @continue-draft="editDraft"
            @select-tag="selectTag"
            @edit-article="editArticle"
            @save-content="saveContent"
            @set-published-time="setPublishedTime"
            @set-visibility="setVisibility"
            @set-pinned="setPinned"
            @set-channel="setChannel"
            @delete-entry="deleteEntry"
          />
          <p
            v-if="!initialLoadPending && !listReplacing && !journal.entries.value.length && !journal.error.value"
            class="feed__empty"
          >
            {{ initialTag
                ? '这个标签下还没有公开内容。'
                : '这里还没有公开记录。' }}
          </p>

          <template #loading>
            <div v-if="paginationLoading" class="feed__pagination-loading">
              <JournalLoading variant="inline" label="正在读取更早记录…" />
            </div>
          </template>

          <template #finished>
            <p
              v-if="!infiniteLoading && !paginationFailed && journal.entries.value.length"
              class="feed__pagination-finished"
            >
              {{ paginationFinishedText }}
            </p>
          </template>
        </List>
      </div>

      <div
        v-else-if="journal.authenticationState.value !== 'anonymous'"
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
          @set-visibility="setVisibility"
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
          @set-visibility="setVisibility"
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
    :mode="mode"
    :busy="currentOverlayEntry !== null && journal.mutationEntryId.value === currentOverlayEntry.id"
    :loading="directOverlay && journal.loading.value"
    @close="emit('closeOverlay')"
    @select-tag="selectTag"
    @edit="editArticle($event.id)"
    @continue-draft="editDraft"
    @save-content="saveContent"
    @set-published-time="setPublishedTime"
    @set-visibility="setVisibility"
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

.feed--detail {
  width: min(calc(100% - (var(--page-gutter) * 2)), 1100px);
}

.feed--public:not(.feed--detail) {
  width: 100%;
}

.feed__public-heading,
.feed__private-heading,
.feed__detail-heading {
  padding: 0 0.15rem;
}

.feed__private-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  min-height: 3.5rem;
}

.feed__public-heading {
  display: flex;
  min-width: 0;
  min-height: 1.5rem;
  align-items: center;
  gap: 0.75rem;
  justify-content: space-between;
}

.feed__public-intro {
  position: sticky;
  z-index: 4;
  top: 0;
  display: grid;
  min-width: 0;
  gap: 0.55rem;
  padding: 0.35rem 0;
  background: var(--surface-page);
}

.feed__public-tags {
  flex: 1 1 auto;
  min-width: 0;
}

.feed__public-refresh {
  flex: 0 0 auto;
  margin-left: auto;
}

.feed__private-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.feed__detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.feed__eyebrow {
  margin: 0;
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.17em;
}

.text-button:disabled {
  cursor: wait;
  opacity: 0.55;
  text-decoration: none;
}

.feed__title {
  margin: 0.18rem 0 0;
  font-family: var(--font-serif);
  font-size: clamp(1.35rem, 4vw, 1.75rem);
  font-weight: 680;
}

.feed__entries {
  display: grid;
  gap: 0.75rem;
}

.feed__infinite-list {
  display: grid;
  gap: 0.75rem;
}

.feed__reading-stage,
.feed__reading-reserve {
  min-height: clamp(20rem, 48vh, 34rem);
}

.feed__reading-stage {
  display: grid;
}

.feed__empty {
  padding: 3rem 1rem;
  color: var(--text-muted);
  text-align: center;
}

.feed-stage-enter-active {
  transition: opacity var(--dur-content-enter) var(--ease-card), transform var(--dur-content-enter) var(--ease-card);
}

.feed-stage-leave-active {
  transition: opacity var(--dur-loading-exit) var(--ease-card);
}

.feed-stage-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.feed-stage-leave-to {
  opacity: 0;
}

.feed__pagination-loading,
.feed__pagination-finished {
  margin: 0;
  padding: 0.75rem 1rem 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  text-align: center;
}

@media (max-width: 599px) {
  .feed--public:not(.feed--detail) {
    gap: 0.55rem;
    padding-top: 0.65rem;
  }

  .feed__public-intro {
    padding: 0;
  }

  .feed__public-intro--without-tags {
    display: none;
  }

  .feed__public-refresh {
    display: none;
  }

  .feed__private-heading {
    align-items: stretch;
    flex-direction: column;
    gap: 0.85rem;
  }

  .feed__private-actions {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .feed__private-actions .button {
    min-width: 0;
    min-height: 2.5rem;
    padding: 0.5rem 0.2rem;
    font-size: clamp(0.72rem, 3.5vw, 0.8rem);
    white-space: nowrap;
  }
}

@media (max-width: 799px) {
  .feed--public:not(.feed--detail) {
    width: calc(100% - (var(--workspace-gutter) * 2));
  }
}

</style>
