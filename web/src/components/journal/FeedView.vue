<script setup lang="ts">
import { List } from 'vant';
import { computed, nextTick, onActivated, onMounted, reactive, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import ArticleCardContent from '../article/ArticleCardContent.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import JournalPullRefresh from '../ui/JournalPullRefresh.vue';
import { useDeferredLoading } from '../../composables/useDeferredLoading';
import { useJournalApi } from '../../composables/useJournalApi';
import { useSessionStore } from '../../stores/session';
import { emptyFeedFilters, type FeedFilters, type JournalEntry, type JournalVisibility } from '../../types';
import EntryCard from './EntryCard.vue';
import EntryFilters from './EntryFilters.vue';
import JournalDetailOverlay from './JournalDetailOverlay.vue';
import LoginView from './LoginView.vue';
import OnThisDay from './OnThisDay.vue';
import WaterfallFeed from './WaterfallFeed.vue';

const props = withDefaults(defineProps<{
  mode: 'public' | 'private';
  detailId?: string;
  initialTag?: string;
  overlayEntryId?: number;
  overlayEntry?: JournalEntry;
  directOverlay?: boolean;
}>(), {
  detailId: undefined,
  initialTag: '',
  overlayEntryId: undefined,
  overlayEntry: undefined,
  directOverlay: false,
});

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: JournalEntry];
  detailLoaded: [entry: JournalEntry];
  closeOverlay: [];
  removeDeletedOverlay: [];
  returnToFeed: [];
}>();

const filters = reactive<FeedFilters>({
  ...emptyFeedFilters(),
  tag: props.initialTag,
});
const journal = useJournalApi();
const router = useRouter();
const session = useSessionStore();
const initialLoadPending = shallowRef(true);
const listReplacing = shallowRef(false);
const loggingOut = shallowRef(false);
const refreshing = shallowRef(false);
const refreshRequestComplete = shallowRef(false);
const paginationLayoutPending = shallowRef(false);
const feedLayoutReady = shallowRef(false);

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
const listTitle = computed(() => {
  if (props.mode === 'private') return '我的全部记录';
  if (props.initialTag) return `#${props.initialTag}`;
  return '最近记录';
});
const paginationLoading = computed(() =>
  journal.loadingMore.value || paginationLayoutPending.value,
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
  isDetail.value
  || isOverlay.value
  || initialLoadPending.value
  || listReplacing.value
  || journal.loadingMore.value
  || paginationLayoutPending.value
  || loggingOut.value
  || (props.mode === 'private' && journal.authenticationState.value !== 'authenticated'),
);

watch(() => journal.authenticationState.value, (state) => {
  if (state !== 'checking') session.setAuthenticated(state === 'authenticated');
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
  try {
    if (isDetail.value) {
      await journal.loadPublicDetail(props.detailId as string);
      if (journal.detail.value) emit('detailLoaded', journal.detail.value);
      return;
    }
    if (props.mode === 'public') {
      await journal.loadPublic({ tag: props.initialTag });
      return;
    }
    await journal.loadPrivate(filters);
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
  await journal.refreshPrivateFeed(filters);
  await loadDirectPrivateDetail();
});

async function applyFilters(nextFilters: FeedFilters): Promise<void> {
  Object.assign(filters, nextFilters);
  feedLayoutReady.value = false;
  listReplacing.value = true;
  try {
    await journal.loadPrivate(filters);
  } finally {
    listReplacing.value = false;
  }
}

async function loadMore(): Promise<void> {
  const previousEntryCount = journal.entries.value.length;
  paginationLayoutPending.value = true;

  if (props.mode === 'public') {
    await journal.loadMorePublic({ tag: props.initialTag });
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

async function refreshFeed(): Promise<void> {
  feedLayoutReady.value = false;
  refreshing.value = true;
  refreshRequestComplete.value = false;

  if (props.mode === 'public') {
    await journal.loadPublic({ tag: props.initialTag });
  }
  else {
    await journal.refreshPrivateFeed(filters);
  }

  refreshRequestComplete.value = true;
  if (journal.error.value || journal.entries.value.length === 0) finishRefresh();
}

async function handleLayoutReady(): Promise<void> {
  emit('layoutReady');
  if (refreshRequestComplete.value) finishRefresh();
  if (paginationLayoutPending.value && !journal.loadingMore.value) {
    paginationLayoutPending.value = false;
  }
  if (!feedLayoutReady.value) {
    await nextTick();
    feedLayoutReady.value = true;
  }
}

async function authenticate(password: string): Promise<void> {
  feedLayoutReady.value = false;
  listReplacing.value = true;
  try {
    await journal.authenticate(password, filters);
    await loadDirectPrivateDetail();
  } finally {
    listReplacing.value = false;
  }
}

async function selectTag(tag: string): Promise<void> {
  if (props.mode === 'public') {
    await router.push({ name: 'public', query: { tag } });
    return;
  }
  filters.tag = tag;
  feedLayoutReady.value = false;
  listReplacing.value = true;
  try {
    await journal.loadPrivate(filters);
  } finally {
    listReplacing.value = false;
  }
}

async function logout(): Promise<void> {
  loggingOut.value = true;
  try {
    await journal.logout();
  } finally {
    loggingOut.value = false;
  }
}

function editArticle(id: number): void {
  void router.push({ name: 'article-edit', params: { articleId: id } });
}

function editDraft(entry: JournalEntry): void {
  void router.push({ name: 'entry-edit', params: { entryId: entry.id } });
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

function isArticleEntry(entry: JournalEntry): boolean {
  return entry.bodyFormat === 'rich';
}

async function saveContent(entry: JournalEntry, contentText: string): Promise<void> {
  await journal.saveContent(entry, contentText);
  if (journal.error.value === null) {
    feedLayoutReady.value = false;
    await journal.loadPrivate(filters);
  }
}

async function setPublishedTime(entry: JournalEntry, sourceCreatedAt: string): Promise<void> {
  await journal.setPublishedTime(entry, sourceCreatedAt);
  if (journal.error.value === null) {
    feedLayoutReady.value = false;
    await journal.loadPrivate(filters);
  }
}

async function setVisibility(entry: JournalEntry, visibility: JournalVisibility): Promise<void> {
  await journal.setVisibility(entry, visibility);
  if (journal.error.value === null) {
    feedLayoutReady.value = false;
    await journal.loadPrivate(filters);
  }
}

async function setPinned(entry: JournalEntry, pinned: boolean): Promise<void> {
  await journal.setPinned(entry, pinned);
  if (journal.error.value === null) {
    feedLayoutReady.value = false;
    await journal.loadPrivate(filters);
  }
}

async function deleteEntry(entry: JournalEntry): Promise<void> {
  await journal.deleteEntry(entry);
  if (journal.error.value === null && props.overlayEntryId === entry.id) emit('removeDeletedOverlay');
}
</script>

<template>
  <JournalPullRefresh v-model="refreshing" :disabled="refreshDisabled" @refresh="refreshFeed">
    <main class="feed" :class="{ 'feed--detail': isDetail }">
      <div v-if="isDetail" class="feed__detail-heading">
        <button class="text-button" type="button" @click="emit('returnToFeed')">← 返回信息流</button>
        <span>永久记录</span>
      </div>

      <template v-else-if="mode === 'private'">
        <div class="feed__private-heading">
          <div>
            <span class="feed__eyebrow">PERSONAL ARCHIVE</span>
            <h1 class="feed__title">{{ listTitle }}</h1>
          </div>
          <div class="feed__private-actions">
            <button
              v-if="journal.authenticationState.value === 'authenticated'"
              class="button button--quiet"
              type="button"
              :disabled="refreshDisabled || refreshing"
              :aria-busy="refreshing"
              @click="refreshFeed"
            >
              <JournalLoading v-if="refreshing" variant="inline" label="刷新中…" />
              <template v-else>刷新</template>
            </button>
            <button
              v-if="journal.authenticationState.value === 'authenticated'"
              class="button button--quiet"
              type="button"
              @click="router.push({ name: 'entry-new' })"
            >
              发布内容
            </button>
            <button
              v-if="journal.authenticationState.value === 'authenticated'"
              class="button button--quiet"
              type="button"
              @click="router.push({ name: 'article-new' })"
            >
              写文章
            </button>
            <button
              v-if="journal.authenticationState.value === 'authenticated'"
              class="button button--quiet"
              type="button"
              :disabled="journal.loading.value"
              :aria-busy="loggingOut"
              @click="logout"
            >
              <JournalLoading v-if="loggingOut" variant="inline" label="退出中…" />
              <template v-else>退出登录</template>
            </button>
          </div>
        </div>
      </template>

      <div v-else class="feed__public-heading">
        <div>
          <h1 class="feed__eyebrow">PUBLIC NOTES</h1>
          <div v-if="initialTag" class="feed__title-row">
            <h2 class="feed__title">{{ listTitle }}</h2>
            <button
              class="text-button"
              type="button"
              @click="router.push({ name: 'public' })"
            >
              清除标签
            </button>
          </div>
        </div>
        <button
          class="text-button"
          type="button"
          :disabled="refreshDisabled || refreshing"
          :aria-busy="refreshing"
          @click="refreshFeed"
        >
          <JournalLoading v-if="refreshing" variant="inline" label="刷新中…" />
          <template v-else>刷新</template>
        </button>
      </div>

      <p v-if="!isDetail && !overlayVisible && journal.error.value" class="notice notice--error" role="alert">{{ journal.error.value }}</p>

      <LoginView
        v-if="mode === 'private' && journal.authenticationState.value === 'anonymous'"
        :busy="journal.loading.value"
        @login="authenticate"
      />

      <template v-else-if="mode === 'private' && journal.authenticationState.value === 'authenticated'">
        <EntryFilters :filters="filters" @apply="applyFilters" />
        <OnThisDay
          :entries="journal.onThisDayEntries.value"
          :mutation-entry-id="journal.mutationEntryId.value"
          @open-entry="openEntry"
          @edit-article="editArticle"
          @select-tag="selectTag"
          @save-content="saveContent"
          @set-published-time="setPublishedTime"
          @set-visibility="setVisibility"
          @set-pinned="setPinned"
          @delete-entry="deleteEntry"
        />
      </template>

      <div v-if="isDetail" class="feed__reading-stage" :aria-busy="detailPreparing">
        <Transition name="feed-stage" mode="out-in">
          <JournalLoading v-if="deferredDetailLoading.visible.value && !journal.error.value" key="loading" variant="reading" label="正在展开记录…" />
          <p v-else-if="journal.error.value" key="error" class="notice notice--error" role="alert">{{ journal.error.value }}</p>
          <ArticleCardContent
            v-else-if="journal.detail.value && isArticleEntry(journal.detail.value)"
            key="article-detail"
            :entry="journal.detail.value"
            :linkable="false"
            display="full"
            @select-tag="selectTag"
          />
          <EntryCard
            v-else-if="journal.detail.value"
            key="entry-detail"
            :entry="journal.detail.value"
            :linkable="false"
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

      <div
        v-else-if="mode === 'public' || journal.authenticationState.value !== 'anonymous'"
        class="feed__entries"
      >
        <List
          class="feed__infinite-list"
          :loading="infiniteLoading"
          :finished="infiniteFinished"
          :disabled="infiniteDisabled"
          :immediate-check="false"
          :offset="320"
          @load="loadMore"
        >
          <WaterfallFeed
            :entries="journal.entries.value"
            :loading="initialLoadPending || listReplacing || refreshing"
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
            @delete-entry="deleteEntry"
          />

          <p
            v-if="!initialLoadPending && !listReplacing && !journal.entries.value.length && !journal.error.value"
            class="feed__empty"
          >
            {{ mode === 'private' ? '没有符合当前筛选条件的记录。' : '这里还没有公开记录。' }}
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
              已经看到全部记录
            </p>
          </template>
        </List>
      </div>
    </main>
  </JournalPullRefresh>

  <JournalDetailOverlay
    v-if="overlayVisible"
    :entry="currentOverlayEntry ?? undefined"
    :mode="mode"
    :busy="currentOverlayEntry !== null && journal.mutationEntryId.value === currentOverlayEntry.id"
    :loading="directOverlay && journal.loading.value"
    :error="journal.error.value"
    @close="emit('closeOverlay')"
    @select-tag="selectTag"
    @edit="editArticle($event.id)"
    @continue-draft="editDraft"
    @save-content="saveContent"
    @set-published-time="setPublishedTime"
    @set-visibility="setVisibility"
    @set-pinned="setPinned"
    @delete-entry="deleteEntry"
  />
</template>

<style scoped>
.feed {
  display: grid;
  gap: 1rem;
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--canvas-width));
  margin: 0 auto;
  padding: 1.3rem 0 4rem;
}

.feed--detail {
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--reading-width));
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
  min-height: 1.5rem;
  align-items: center;
  justify-content: space-between;
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

.feed__title-row {
  display: flex;
  align-items: baseline;
  gap: 1rem;
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

</style>
