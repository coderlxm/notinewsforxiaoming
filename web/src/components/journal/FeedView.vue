<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import { useJournalApi } from '../../composables/useJournalApi';
import { emptyFeedFilters, type FeedFilters, type JournalEntry, type JournalVisibility } from '../../types';
import EntryCard from './EntryCard.vue';
import EntryFilters from './EntryFilters.vue';
import LoginView from './LoginView.vue';
import OnThisDay from './OnThisDay.vue';

const props = withDefaults(defineProps<{
  mode: 'public' | 'private';
  detailId?: string;
  initialTag?: string;
}>(), {
  detailId: undefined,
  initialTag: '',
});

const emit = defineEmits<{
  navigate: [path: string];
}>();

const filters = reactive<FeedFilters>({
  ...emptyFeedFilters(),
  tag: props.initialTag,
});
const journal = useJournalApi();

const isDetail = computed(() => props.mode === 'public' && props.detailId !== undefined);
const listTitle = computed(() => {
  if (props.mode === 'private') return '我的全部记录';
  if (props.initialTag) return `#${props.initialTag}`;
  return '最近记录';
});

onMounted(async () => {
  if (isDetail.value) {
    await journal.loadPublicDetail(props.detailId as string);
    return;
  }
  if (props.mode === 'public') {
    await journal.loadPublic({ tag: props.initialTag });
    return;
  }
  await journal.loadPrivate(filters);
});

async function applyFilters(nextFilters: FeedFilters): Promise<void> {
  Object.assign(filters, nextFilters);
  await journal.loadPrivate(filters);
}

async function loadMore(): Promise<void> {
  if (props.mode === 'public') {
    await journal.loadMorePublic({ tag: props.initialTag });
    return;
  }
  await journal.loadMorePrivate(filters);
}

async function authenticate(password: string): Promise<void> {
  await journal.authenticate(password, filters);
}

async function selectTag(tag: string): Promise<void> {
  if (props.mode === 'public') {
    emit('navigate', `/?tag=${encodeURIComponent(tag)}`);
    return;
  }
  filters.tag = tag;
  await journal.loadPrivate(filters);
}

function viewDetail(publicId: string): void {
  emit('navigate', `/p/${encodeURIComponent(publicId)}`);
}

async function saveContent(entry: JournalEntry, contentText: string): Promise<void> {
  await journal.saveContent(entry, contentText);
  if (journal.error.value === null) await journal.loadPrivate(filters);
}

async function setVisibility(entry: JournalEntry, visibility: JournalVisibility): Promise<void> {
  await journal.setVisibility(entry, visibility);
  if (journal.error.value === null) await journal.loadPrivate(filters);
}

async function setPinned(entry: JournalEntry, pinned: boolean): Promise<void> {
  await journal.setPinned(entry, pinned);
  if (journal.error.value === null) await journal.loadPrivate(filters);
}

async function deleteEntry(entry: JournalEntry): Promise<void> {
  await journal.deleteEntry(entry);
}
</script>

<template>
  <main class="feed">
    <div v-if="isDetail" class="feed__detail-heading">
      <button class="text-button" type="button" @click="emit('navigate', '/')">← 返回信息流</button>
      <span>永久记录</span>
    </div>

    <template v-else-if="mode === 'private'">
      <div class="feed__private-heading">
        <div>
          <span class="feed__eyebrow">PERSONAL ARCHIVE</span>
          <h1 class="feed__title">{{ listTitle }}</h1>
        </div>
        <button
          v-if="journal.authenticationState.value === 'authenticated'"
          class="button button--quiet"
          type="button"
          :disabled="journal.loading.value"
          @click="journal.logout"
        >
          退出登录
        </button>
      </div>
    </template>

    <div v-else class="feed__public-heading">
      <span class="feed__eyebrow">PUBLIC NOTES</span>
      <div class="feed__title-row">
        <h1 class="feed__title">{{ listTitle }}</h1>
        <button
          v-if="initialTag"
          class="text-button"
          type="button"
          @click="emit('navigate', '/')"
        >
          清除标签
        </button>
      </div>
    </div>

    <p v-if="journal.error.value" class="notice notice--error" role="alert">{{ journal.error.value }}</p>

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
        @view-detail="viewDetail"
        @select-tag="selectTag"
        @save-content="saveContent"
        @set-visibility="setVisibility"
        @set-pinned="setPinned"
        @delete-entry="deleteEntry"
      />
    </template>

    <div v-if="journal.loading.value" class="feed__loading" role="status">正在读取记录…</div>

    <EntryCard
      v-else-if="isDetail && journal.detail.value"
      :entry="journal.detail.value"
      :linkable="false"
      @select-tag="selectTag"
      @view-detail="viewDetail"
      @save-content="saveContent"
      @set-visibility="setVisibility"
      @set-pinned="setPinned"
      @delete-entry="deleteEntry"
    />

    <div
      v-else-if="!isDetail && (mode === 'public' || journal.authenticationState.value === 'authenticated')"
      class="feed__entries"
    >
      <EntryCard
        v-for="entry in journal.entries.value"
        :key="entry.id"
        :entry="entry"
        :editable="mode === 'private'"
        :busy="journal.mutationEntryId.value === entry.id"
        @view-detail="viewDetail"
        @select-tag="selectTag"
        @save-content="saveContent"
        @set-visibility="setVisibility"
        @set-pinned="setPinned"
        @delete-entry="deleteEntry"
      />

      <p v-if="!journal.entries.value.length && !journal.error.value" class="feed__empty">
        {{ mode === 'private' ? '没有符合当前筛选条件的记录。' : '这里还没有公开记录。' }}
      </p>

      <button
        v-if="journal.nextCursor.value"
        class="button button--more"
        type="button"
        :disabled="journal.loadingMore.value"
        @click="loadMore"
      >
        {{ journal.loadingMore.value ? '读取中…' : '加载更早记录' }}
      </button>
    </div>
  </main>
</template>

<style scoped>
.feed {
  display: grid;
  gap: 1rem;
  width: min(100%, var(--content-width));
  margin: 0 auto;
  padding: 1.3rem 0 4rem;
}

.feed__public-heading,
.feed__private-heading,
.feed__detail-heading {
  padding: 0 0.15rem;
}

.feed__public-heading,
.feed__private-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  min-height: 3.5rem;
}

.feed__detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.feed__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.17em;
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

.feed__loading,
.feed__empty {
  padding: 3rem 1rem;
  color: var(--text-muted);
  text-align: center;
}

.button--more {
  justify-self: center;
  margin-top: 0.5rem;
}

@media (max-width: 720px) {
  .feed__public-heading,
  .feed__private-heading,
  .feed__detail-heading,
  .notice {
    margin-right: 1rem;
    margin-left: 1rem;
  }
}
</style>
