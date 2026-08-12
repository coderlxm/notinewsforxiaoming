<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  shallowRef,
} from 'vue';
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import { fetchPublicDiscoverySearch } from '../../api';
import {
  type PublicDiscoveryCachedPage,
  usePublicDiscoveryCache,
} from '../../composables/usePublicDiscoveryCache';
import type {
  JournalDiscoveryEntrySummary,
  JournalDiscoveryListItem,
} from '../../types';
import JournalLoading from '../ui/JournalLoading.vue';
import PublicDiscoveryList from './PublicDiscoveryList.vue';
import {
  discoveryErrorMessage,
  normalizePublicSearchQuery,
  publicSearchPath,
} from './discoveryRoutes';
import { usePublicDiscoveryHead } from './usePublicDiscoveryHead';

defineOptions({ name: 'PublicSearchView' });

const props = defineProps<{
  accessScope: string;
  query: string;
}>();

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: JournalDiscoveryListItem];
}>();

const route = useRoute();
const router = useRouter();
const cache = usePublicDiscoveryCache();
const currentQuery = shallowRef(normalizePublicSearchQuery(props.query));
const entries = shallowRef<readonly JournalDiscoveryEntrySummary[]>([]);
const nextCursor = shallowRef<string | null>(null);
const loading = shallowRef(currentQuery.value.length > 0);
const loadingMore = shallowRef(false);
const initialError = shallowRef<string | null>(null);
const paginationError = shallowRef<string | null>(null);
let activeIdentity = '';

function searchHead(query: string) {
  return {
    title: query ? `${query} · 搜索 · 小明同学` : '搜索 · 小明同学',
    robots: 'noindex, follow' as const,
    canonicalPath: '/search',
    structuredData: null,
  };
}

const pageHead = usePublicDiscoveryHead(() => searchHead(currentQuery.value));

function identity(accessScope: string, canonicalPath: string): string {
  return `${accessScope}\u0000${canonicalPath}`;
}

async function announceLayout(identityAtRequest: string): Promise<void> {
  await nextTick();
  if (activeIdentity === identityAtRequest) emit('layoutReady');
}

async function activate(query: string, accessScope: string): Promise<void> {
  const normalizedQuery = normalizePublicSearchQuery(query);
  const canonicalPath = publicSearchPath(normalizedQuery);
  const nextIdentity = identity(accessScope, canonicalPath);
  activeIdentity = nextIdentity;
  currentQuery.value = normalizedQuery;
  entries.value = [];
  nextCursor.value = null;
  initialError.value = null;
  paginationError.value = null;
  loadingMore.value = false;
  pageHead.apply(searchHead(normalizedQuery));

  if (!normalizedQuery) {
    loading.value = false;
    await announceLayout(nextIdentity);
    return;
  }

  const cached = cache.read<PublicDiscoveryCachedPage<JournalDiscoveryEntrySummary>>(
    accessScope,
    canonicalPath,
  );
  if (cached) {
    entries.value = cached.entries;
    nextCursor.value = cached.nextCursor;
    loading.value = false;
    await announceLayout(nextIdentity);
    return;
  }

  loading.value = true;
  try {
    const response = await fetchPublicDiscoverySearch({ query: normalizedQuery });
    const cacheValue: PublicDiscoveryCachedPage<JournalDiscoveryEntrySummary> = {
      entries: response.entries,
      nextCursor: response.nextCursor,
    };
    cache.write(accessScope, canonicalPath, cacheValue);
    if (activeIdentity !== nextIdentity) return;
    entries.value = cacheValue.entries;
    nextCursor.value = cacheValue.nextCursor;
  }
  catch (reason) {
    if (activeIdentity === nextIdentity) initialError.value = discoveryErrorMessage(reason);
  }
  finally {
    if (activeIdentity === nextIdentity) {
      loading.value = false;
      await announceLayout(nextIdentity);
    }
  }
}

async function loadMore(): Promise<void> {
  const cursor = nextCursor.value;
  if (!cursor || loadingMore.value) return;

  const query = currentQuery.value;
  const canonicalPath = publicSearchPath(query);
  const identityAtRequest = activeIdentity;
  const accessScope = props.accessScope;
  const entriesAtRequest = entries.value;
  loadingMore.value = true;
  paginationError.value = null;
  try {
    const response = await fetchPublicDiscoverySearch({ query, cursor });
    const cacheValue: PublicDiscoveryCachedPage<JournalDiscoveryEntrySummary> = {
      entries: [...entriesAtRequest, ...response.entries],
      nextCursor: response.nextCursor,
    };
    cache.write(accessScope, canonicalPath, cacheValue);
    if (activeIdentity !== identityAtRequest) return;
    entries.value = cacheValue.entries;
    nextCursor.value = cacheValue.nextCursor;
  }
  catch (reason) {
    if (activeIdentity === identityAtRequest) {
      paginationError.value = discoveryErrorMessage(reason);
    }
  }
  finally {
    if (activeIdentity === identityAtRequest) loadingMore.value = false;
  }
}

function openEntry(entry: JournalDiscoveryListItem): void {
  emit('openEntry', entry);
}

onBeforeRouteUpdate((to) => {
  const rawQuery = typeof to.query.q === 'string' ? to.query.q : '';
  const normalizedQuery = normalizePublicSearchQuery(rawQuery);
  const canonicalPath = publicSearchPath(normalizedQuery);
  if (to.fullPath !== canonicalPath) return canonicalPath;
  if (normalizedQuery === currentQuery.value && !activeIdentity) {
    void activate(normalizedQuery, props.accessScope);
  }
});

onMounted(() => {
  const canonicalPath = publicSearchPath(currentQuery.value);
  if (route.fullPath !== canonicalPath) {
    void router.replace(canonicalPath);
    return;
  }
  void activate(currentQuery.value, props.accessScope);
});

onUpdated(() => {
  pageHead.apply(searchHead(currentQuery.value));
});

onBeforeUnmount(() => {
  activeIdentity = '';
});
</script>

<template>
  <main class="search-view">
    <header class="search-view__header">
      <p class="search-view__eyebrow">SEARCH</p>
      <h1 class="search-view__title">
        {{ currentQuery ? `“${currentQuery}”` : '搜索公开内容' }}
      </h1>
      <p class="search-view__description">
        {{ currentQuery ? '按相关性查看标题、正文和标签中的匹配内容。' : '在顶部搜索框输入关键词，查找公开记录与文章。' }}
      </p>
      <RouterLink class="search-view__archive-shortcut" :to="{ name: 'archive' }">
        浏览时间归档
      </RouterLink>
    </header>

    <section v-if="!currentQuery" class="search-view__state" aria-labelledby="search-start-title">
      <h2 id="search-start-title">输入标题、正文或标签开始搜索</h2>
      <p>也可以按发布时间浏览全部公开内容。</p>
      <RouterLink class="search-view__archive-link" :to="{ name: 'archive' }">浏览时间归档</RouterLink>
    </section>

    <JournalLoading v-else-if="loading" label="正在查找相关内容…" />

    <section v-else-if="initialError" class="search-view__state search-view__state--error" role="alert">
      <h2>搜索没有完成</h2>
      <p>{{ initialError }}</p>
    </section>

    <section v-else-if="entries.length === 0" class="search-view__state" aria-live="polite">
      <h2>没有找到与“{{ currentQuery }}”相关的公开内容</h2>
      <p>换一个关键词，或从时间归档继续浏览。</p>
      <RouterLink class="search-view__archive-link" :to="{ name: 'archive' }">浏览时间归档</RouterLink>
    </section>

    <template v-else>
      <PublicDiscoveryList :entries="entries" :query="currentQuery" @open="openEntry" />

      <footer class="search-view__pagination">
        <p v-if="paginationError" class="search-view__pagination-error" role="alert">
          {{ paginationError }}
        </p>
        <button
          v-else-if="nextCursor"
          class="button button--more"
          type="button"
          :disabled="loadingMore"
          :aria-busy="loadingMore"
          @click="loadMore"
        >
          <JournalLoading v-if="loadingMore" variant="inline" label="加载中…" />
          <template v-else>继续加载</template>
        </button>
        <p v-else class="search-view__finished">已经看到全部结果</p>
      </footer>
    </template>
  </main>
</template>

<style scoped>
.search-view {
  display: grid;
  width: min(calc(100% - (var(--page-gutter) * 2)), 960px);
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 4.2rem) 0 5rem;
}

.search-view__header {
  display: grid;
  gap: 0.45rem;
  margin-bottom: clamp(1.6rem, 4vw, 2.8rem);
}

.search-view__eyebrow,
.search-view__title,
.search-view__description,
.search-view__state h2,
.search-view__state p,
.search-view__pagination p {
  margin: 0;
}

.search-view__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 780;
  letter-spacing: 0.2em;
}

.search-view__title,
.search-view__state h2 {
  font-family: var(--font-serif);
}

.search-view__title {
  overflow-wrap: anywhere;
  font-size: clamp(1.55rem, 4vw, 2.35rem);
  line-height: 1.35;
}

.search-view__description,
.search-view__state p {
  color: var(--text-muted);
  font-size: 0.84rem;
  line-height: 1.7;
}

.search-view__archive-shortcut {
  width: max-content;
  color: var(--text-muted);
  font-size: 0.74rem;
  font-weight: 680;
  text-decoration: none;
}

.search-view__archive-shortcut:hover {
  color: var(--accent-strong);
}

.search-view__state {
  display: grid;
  min-height: 18rem;
  align-content: center;
  justify-items: start;
  gap: 0.65rem;
  padding: clamp(1.4rem, 4vw, 2.2rem);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.search-view__state h2 {
  font-size: 1.15rem;
}

.search-view__state--error {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border-subtle));
}

.search-view__state--error h2,
.search-view__state--error p {
  color: var(--danger);
}

.search-view__archive-link {
  margin-top: 0.35rem;
  color: var(--accent-strong);
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
}

.search-view__archive-link:hover {
  text-decoration: underline;
}

.search-view__pagination {
  display: grid;
  min-height: 5.5rem;
  place-items: center;
  padding-top: 1.25rem;
}

.search-view__pagination-error {
  color: var(--danger);
  font-size: 0.78rem;
}

.search-view__finished {
  color: var(--text-muted);
  font-size: 0.72rem;
}
</style>
