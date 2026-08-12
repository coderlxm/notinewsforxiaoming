<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  shallowRef,
} from 'vue';
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import { fetchPublicDiscoveryArchiveMonth } from '../../api';
import {
  type PublicDiscoveryCachedPage,
  usePublicDiscoveryCache,
} from '../../composables/usePublicDiscoveryCache';
import type { JournalDiscoveryListItem } from '../../types';
import JournalLoading from '../ui/JournalLoading.vue';
import PublicDiscoveryList from './PublicDiscoveryList.vue';
import {
  discoveryErrorMessage,
  publicArchiveMonthPath,
} from './discoveryRoutes';
import { usePublicDiscoveryHead } from './usePublicDiscoveryHead';

defineOptions({ name: 'PublicArchiveMonthView' });

const props = defineProps<{
  accessScope: string;
  year: string;
  month: string;
}>();

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: JournalDiscoveryListItem];
}>();

const route = useRoute();
const router = useRouter();
const cache = usePublicDiscoveryCache();
const currentYear = shallowRef(Number(props.year));
const currentMonth = shallowRef(Number(props.month));
const entries = shallowRef<readonly JournalDiscoveryListItem[]>([]);
const nextCursor = shallowRef<string | null>(null);
const loading = shallowRef(true);
const loadingMore = shallowRef(false);
const initialError = shallowRef<string | null>(null);
const paginationError = shallowRef<string | null>(null);
let activeIdentity = '';

function monthHead(year: number, month: number) {
  const canonicalPath = publicArchiveMonthPath(year, month);
  return {
    title: `${year}年${month}月归档 · 小明同学`,
    robots: 'index, follow' as const,
    canonicalPath,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${year}年${month}月归档`,
      url: new URL(canonicalPath, window.location.origin).href,
    },
  };
}

const pageHead = usePublicDiscoveryHead(() => monthHead(currentYear.value, currentMonth.value));

async function announceLayout(identityAtRequest: string): Promise<void> {
  await nextTick();
  if (activeIdentity === identityAtRequest) emit('layoutReady');
}

async function activate(year: number, month: number, accessScope: string): Promise<void> {
  const canonicalPath = publicArchiveMonthPath(year, month);
  const nextIdentity = `${accessScope}\u0000${canonicalPath}`;
  activeIdentity = nextIdentity;
  currentYear.value = year;
  currentMonth.value = month;
  entries.value = [];
  nextCursor.value = null;
  initialError.value = null;
  paginationError.value = null;
  loadingMore.value = false;
  pageHead.apply(monthHead(year, month));

  const cached = cache.read<PublicDiscoveryCachedPage<JournalDiscoveryListItem>>(
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
    const response = await fetchPublicDiscoveryArchiveMonth({ year, month });
    const cacheValue: PublicDiscoveryCachedPage<JournalDiscoveryListItem> = {
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

  const year = currentYear.value;
  const month = currentMonth.value;
  const canonicalPath = publicArchiveMonthPath(year, month);
  const identityAtRequest = activeIdentity;
  const accessScope = props.accessScope;
  const entriesAtRequest = entries.value;
  loadingMore.value = true;
  paginationError.value = null;
  try {
    const response = await fetchPublicDiscoveryArchiveMonth({ year, month, cursor });
    const cacheValue: PublicDiscoveryCachedPage<JournalDiscoveryListItem> = {
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
  const year = Number(to.params.year);
  const month = Number(to.params.month);
  const canonicalPath = publicArchiveMonthPath(year, month);
  if (to.fullPath !== canonicalPath) return canonicalPath;
  if (
    year === currentYear.value
    && month === currentMonth.value
    && !activeIdentity
  ) {
    void activate(year, month, props.accessScope);
  }
});

onMounted(() => {
  const canonicalPath = publicArchiveMonthPath(currentYear.value, currentMonth.value);
  if (route.fullPath !== canonicalPath) {
    void router.replace(canonicalPath);
    return;
  }
  void activate(currentYear.value, currentMonth.value, props.accessScope);
});

onUpdated(() => {
  pageHead.apply(monthHead(currentYear.value, currentMonth.value));
});

onBeforeUnmount(() => {
  activeIdentity = '';
});
</script>

<template>
  <main class="archive-month-view">
    <header class="archive-month-view__header">
      <RouterLink class="archive-month-view__back" :to="{ name: 'archive' }">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        <span>返回时间归档</span>
      </RouterLink>
      <p class="archive-month-view__eyebrow">ARCHIVE</p>
      <h1 class="archive-month-view__title">{{ currentYear }}年{{ currentMonth }}月</h1>
      <p class="archive-month-view__description">这个月发布的公开内容，按时间从近到远排列。</p>
    </header>

    <JournalLoading v-if="loading" label="正在读取这个月的内容…" />

    <section
      v-else-if="initialError"
      class="archive-month-view__state archive-month-view__state--error"
      role="alert"
    >
      <h2>这个月的归档没有加载完成</h2>
      <p>{{ initialError }}</p>
    </section>

    <section v-else-if="entries.length === 0" class="archive-month-view__state" aria-live="polite">
      <h2>这个月份没有公开内容</h2>
      <p>返回时间归档，继续浏览其他月份。</p>
      <RouterLink class="archive-month-view__overview-link" :to="{ name: 'archive' }">
        查看全部归档
      </RouterLink>
    </section>

    <template v-else>
      <PublicDiscoveryList :entries="entries" @open="openEntry" />

      <footer class="archive-month-view__pagination">
        <p v-if="paginationError" class="archive-month-view__pagination-error" role="alert">
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
        <p v-else class="archive-month-view__finished">已经看到这个月的全部内容</p>
      </footer>
    </template>
  </main>
</template>

<style scoped>
.archive-month-view {
  display: grid;
  width: min(calc(100% - (var(--page-gutter) * 2)), 960px);
  margin: 0 auto;
  padding: clamp(1.5rem, 4vw, 3rem) 0 5rem;
}

.archive-month-view__header {
  display: grid;
  gap: 0.45rem;
  margin-bottom: clamp(1.6rem, 4vw, 2.8rem);
}

.archive-month-view__back {
  display: inline-flex;
  width: max-content;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 1.1rem;
  color: var(--text-muted);
  font-size: 0.74rem;
  font-weight: 680;
  text-decoration: none;
}

.archive-month-view__back:hover {
  color: var(--accent-strong);
}

.archive-month-view__back svg {
  width: 1rem;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.archive-month-view__eyebrow,
.archive-month-view__title,
.archive-month-view__description,
.archive-month-view__state h2,
.archive-month-view__state p,
.archive-month-view__pagination p {
  margin: 0;
}

.archive-month-view__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 780;
  letter-spacing: 0.2em;
}

.archive-month-view__title,
.archive-month-view__state h2 {
  font-family: var(--font-serif);
}

.archive-month-view__title {
  font-size: clamp(1.65rem, 4vw, 2.35rem);
}

.archive-month-view__description,
.archive-month-view__state p {
  color: var(--text-muted);
  font-size: 0.84rem;
  line-height: 1.7;
}

.archive-month-view__state {
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

.archive-month-view__state h2 {
  font-size: 1.15rem;
}

.archive-month-view__state--error {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border-subtle));
}

.archive-month-view__state--error h2,
.archive-month-view__state--error p {
  color: var(--danger);
}

.archive-month-view__overview-link {
  margin-top: 0.35rem;
  color: var(--accent-strong);
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
}

.archive-month-view__overview-link:hover {
  text-decoration: underline;
}

.archive-month-view__pagination {
  display: grid;
  min-height: 5.5rem;
  place-items: center;
  padding-top: 1.25rem;
}

.archive-month-view__pagination-error {
  color: var(--danger);
  font-size: 0.78rem;
}

.archive-month-view__finished {
  color: var(--text-muted);
  font-size: 0.72rem;
}
</style>
